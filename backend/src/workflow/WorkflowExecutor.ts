import { ObjectId } from 'mongodb';
import { WorkflowInstance, WorkflowStatus, WorkflowStepState } from '../entities/WorkflowInstance';
import { WorkflowInstanceRepository } from '../repositories/WorkflowInstanceRepository';

export interface WorkflowStep {
  id: string;
  name: string;
  execute: (context: Record<string, any>, input?: any) => Promise<any>;
  onError?: (error: Error, context: Record<string, any>) => Promise<void>;
  retryable?: boolean;
  maxRetries?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  onComplete?: (context: Record<string, any>, output: any) => Promise<void>;
  onError?: (error: Error, context: Record<string, any>) => Promise<void>;
}

export interface WorkflowExecutionOptions {
  persistState?: boolean;
  autoResume?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class WorkflowExecutor {
  private repository: WorkflowInstanceRepository;
  private workflows: Map<string, WorkflowDefinition>;
  private defaultOptions: WorkflowExecutionOptions;

  constructor(repository: WorkflowInstanceRepository, options?: WorkflowExecutionOptions) {
    this.repository = repository;
    this.workflows = new Map();
    this.defaultOptions = {
      persistState: true,
      autoResume: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  unregisterWorkflow(workflowId: string): void {
    this.workflows.delete(workflowId);
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  async startWorkflow(
    workflowId: string,
    input?: any,
    metadata?: Record<string, any>,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowInstance> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with id ${workflowId} not found`);
    }

    const executionOptions = { ...this.defaultOptions, ...options };

    const workflowInstance = new WorkflowInstance({
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: WorkflowStatus.PENDING,
      currentStepIndex: 0,
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        stepName: step.name,
        status: WorkflowStatus.PENDING
      })),
      context: {},
      input,
      startedAt: new Date(),
      updatedAt: new Date(),
      metadata
    });

    if (executionOptions.persistState) {
      await this.repository.create(workflowInstance);
    }

    await this.executeWorkflow(workflowInstance, workflow, executionOptions);

    return workflowInstance;
  }

  async resumeWorkflow(
    instanceId: string | ObjectId,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowInstance> {
    const workflowInstance = await this.repository.findById(instanceId);
    if (!workflowInstance) {
      throw new Error(`Workflow instance with id ${instanceId} not found`);
    }

    if (!workflowInstance.canResume()) {
      throw new Error(`Workflow instance ${instanceId} cannot be resumed. Current status: ${workflowInstance.status}`);
    }

    const workflow = this.workflows.get(workflowInstance.workflowId);
    if (!workflow) {
      throw new Error(`Workflow definition ${workflowInstance.workflowId} not found`);
    }

    const executionOptions = { ...this.defaultOptions, ...options };

    workflowInstance.updateStatus(WorkflowStatus.RUNNING);
    if (executionOptions.persistState) {
      await this.repository.update(workflowInstance._id!, workflowInstance);
    }

    await this.executeWorkflow(workflowInstance, workflow, executionOptions);

    return workflowInstance;
  }

  private async executeWorkflow(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    try {
      instance.updateStatus(WorkflowStatus.RUNNING);
      if (options.persistState) {
        await this.saveState(instance);
      }

      while (instance.currentStepIndex < workflow.steps.length) {
        const step = workflow.steps[instance.currentStepIndex];
        const stepState = instance.steps[instance.currentStepIndex];

        await this.executeStep(instance, step, stepState, options);

        if (instance.status === WorkflowStatus.FAILED || instance.status === WorkflowStatus.PAUSED) {
          break;
        }

        instance.moveToNextStep();
        if (options.persistState) {
          await this.saveState(instance);
        }
      }

      if (instance.currentStepIndex >= workflow.steps.length && instance.status === WorkflowStatus.RUNNING) {
        instance.updateStatus(WorkflowStatus.COMPLETED);
        const lastStep = instance.steps[instance.steps.length - 1];
        instance.output = lastStep.output;

        if (workflow.onComplete) {
          await workflow.onComplete(instance.context, instance.output);
        }

        if (options.persistState) {
          await this.saveState(instance);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      instance.setError(errorMessage);

      if (workflow.onError) {
        await workflow.onError(error as Error, instance.context);
      }

      if (options.persistState) {
        await this.saveState(instance);
      }

      throw error;
    }
  }

  private async executeStep(
    instance: WorkflowInstance,
    step: WorkflowStep,
    stepState: WorkflowStepState,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const maxRetries = step.maxRetries ?? options.maxRetries ?? 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        stepState.status = WorkflowStatus.RUNNING;
        stepState.startedAt = new Date();
        instance.updateStep(instance.currentStepIndex, stepState);

        if (options.persistState) {
          await this.saveState(instance);
        }

        const stepInput = retryCount === 0 ? stepState.input : instance.context;
        const output = await step.execute(instance.context, stepInput);

        stepState.output = output;
        stepState.status = WorkflowStatus.COMPLETED;
        stepState.completedAt = new Date();
        instance.updateStep(instance.currentStepIndex, stepState);

        if (options.persistState) {
          await this.saveState(instance);
        }

        return;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount > maxRetries || !(step.retryable ?? true)) {
          stepState.status = WorkflowStatus.FAILED;
          stepState.error = lastError.message;
          stepState.completedAt = new Date();
          instance.updateStep(instance.currentStepIndex, stepState);
          instance.setError(`Step ${step.name} failed: ${lastError.message}`);

          if (step.onError) {
            await step.onError(lastError, instance.context);
          }

          if (options.persistState) {
            await this.saveState(instance);
          }

          throw lastError;
        }

        if (options.retryDelay) {
          await this.delay(options.retryDelay);
        }
      }
    }
  }

  private async saveState(instance: WorkflowInstance): Promise<void> {
    if (instance._id) {
      await this.repository.update(instance._id, instance);
    } else {
      await this.repository.create(instance);
    }
  }

  async pauseWorkflow(instanceId: string | ObjectId): Promise<boolean> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      return false;
    }

    if (instance.status === WorkflowStatus.RUNNING) {
      instance.updateStatus(WorkflowStatus.PAUSED);
      await this.repository.update(instance._id!, instance);
      return true;
    }

    return false;
  }

  async cancelWorkflow(instanceId: string | ObjectId): Promise<boolean> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      return false;
    }

    if (!instance.isComplete()) {
      instance.setError('Workflow cancelled by user');
      await this.repository.update(instance._id!, instance);
      return true;
    }

    return false;
  }

  async getWorkflowInstance(instanceId: string | ObjectId): Promise<WorkflowInstance | null> {
    return await this.repository.findById(instanceId);
  }

  async getWorkflowInstances(workflowId: string): Promise<WorkflowInstance[]> {
    return await this.repository.findByWorkflowId(workflowId);
  }

  async getRunningWorkflows(): Promise<WorkflowInstance[]> {
    return await this.repository.findRunningInstances();
  }

  async getResumableWorkflows(): Promise<WorkflowInstance[]> {
    return await this.repository.findResumableInstances();
  }

  async autoResumeWorkflows(): Promise<WorkflowInstance[]> {
    const resumableInstances = await this.getResumableWorkflows();
    const resumed: WorkflowInstance[] = [];

    for (const instance of resumableInstances) {
      try {
        const resumedInstance = await this.resumeWorkflow(instance._id!);
        resumed.push(resumedInstance);
      } catch (error) {
        console.error(`Failed to auto-resume workflow ${instance._id}:`, error);
      }
    }

    return resumed;
  }

  async getStatistics(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
  }> {
    return await this.repository.getStatistics();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
