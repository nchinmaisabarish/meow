import { WorkflowContext } from './WorkflowContext';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'decision' | 'start' | 'end';
  handler?: (context: WorkflowContext) => Promise<void>;
  rollbackHandler?: (context: WorkflowContext) => Promise<void>;
  transitions?: WorkflowTransition[];
  timeout?: number;
}

export interface WorkflowTransition {
  targetStepId: string;
  condition?: (context: WorkflowContext) => boolean;
  priority?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
  startStepId: string;
}

export interface WorkflowExecutionResult {
  success: boolean;
  executionId: string;
  finalStep: string;
  completedSteps: string[];
  error?: string;
  duration: number;
}

export interface WorkflowExecutorOptions {
  maxExecutionTime?: number;
  enableRollback?: boolean;
  persistContext?: boolean;
  onStepStart?: (stepId: string, context: WorkflowContext) => void;
  onStepComplete?: (stepId: string, context: WorkflowContext) => void;
  onStepError?: (stepId: string, error: Error, context: WorkflowContext) => void;
}

export class WorkflowExecutor {
  private workflow: WorkflowDefinition;
  private options: WorkflowExecutorOptions;
  private executionStartTime?: number;

  constructor(workflow: WorkflowDefinition, options: WorkflowExecutorOptions = {}) {
    this.workflow = workflow;
    this.options = {
      maxExecutionTime: options.maxExecutionTime || 300000,
      enableRollback: options.enableRollback !== false,
      persistContext: options.persistContext !== false,
      onStepStart: options.onStepStart,
      onStepComplete: options.onStepComplete,
      onStepError: options.onStepError
    };
    this.validateWorkflow();
  }

  async executeWorkflow(context: WorkflowContext): Promise<WorkflowExecutionResult> {
    this.executionStartTime = Date.now();
    const executionId = context.getExecutionId();

    try {
      context.setStatus('running');
      context.setCurrentStep(this.workflow.startStepId);

      let currentStepId = this.workflow.startStepId;
      const visitedSteps = new Set<string>();

      while (currentStepId) {
        if (visitedSteps.has(currentStepId)) {
          throw new Error(`Circular workflow detected at step: ${currentStepId}`);
        }

        if (this.isExecutionTimedOut()) {
          throw new Error(`Workflow execution exceeded maximum time of ${this.options.maxExecutionTime}ms`);
        }

        visitedSteps.add(currentStepId);

        const step = this.getStepById(currentStepId);
        if (!step) {
          throw new Error(`Step not found: ${currentStepId}`);
        }

        context.setCurrentStep(currentStepId);

        if (this.options.onStepStart) {
          this.options.onStepStart(currentStepId, context);
        }

        try {
          await this.executeStep(step, context);
          context.markStepCompleted(currentStepId);

          if (this.options.onStepComplete) {
            this.options.onStepComplete(currentStepId, context);
          }

          if (step.type === 'end') {
            break;
          }

          currentStepId = this.evaluateTransitions(step, context);
        } catch (error) {
          if (this.options.onStepError) {
            this.options.onStepError(currentStepId, error as Error, context);
          }

          if (this.options.enableRollback) {
            await this.rollbackWorkflow(context);
          }

          throw error;
        }
      }

      context.setStatus('completed');

      return {
        success: true,
        executionId,
        finalStep: context.getCurrentStep(),
        completedSteps: context.getCompletedSteps(),
        duration: Date.now() - this.executionStartTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.setError(errorMessage);

      return {
        success: false,
        executionId,
        finalStep: context.getCurrentStep(),
        completedSteps: context.getCompletedSteps(),
        error: errorMessage,
        duration: Date.now() - (this.executionStartTime || Date.now())
      };
    }
  }

  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<void> {
    if (step.type === 'start' || step.type === 'end') {
      return;
    }

    if (!step.handler) {
      throw new Error(`Step ${step.id} has no handler defined`);
    }

    if (step.timeout) {
      await this.executeWithTimeout(step.handler, context, step.timeout);
    } else {
      await step.handler(context);
    }
  }

  private async executeWithTimeout(
    handler: (context: WorkflowContext) => Promise<void>,
    context: WorkflowContext,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step execution timed out after ${timeout}ms`));
      }, timeout);

      handler(context)
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private evaluateTransitions(step: WorkflowStep, context: WorkflowContext): string {
    if (!step.transitions || step.transitions.length === 0) {
      return '';
    }

    const sortedTransitions = [...step.transitions].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    for (const transition of sortedTransitions) {
      if (!transition.condition || transition.condition(context)) {
        return transition.targetStepId;
      }
    }

    if (sortedTransitions.length > 0) {
      return sortedTransitions[sortedTransitions.length - 1].targetStepId;
    }

    return '';
  }

  private async rollbackWorkflow(context: WorkflowContext): Promise<void> {
    const completedSteps = context.getCompletedSteps();

    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const stepId = completedSteps[i];
      const step = this.getStepById(stepId);

      if (step && step.rollbackHandler) {
        try {
          await step.rollbackHandler(context);
        } catch (rollbackError) {
          console.error(`Rollback failed for step ${stepId}:`, rollbackError);
        }
      }
    }

    context.setStatus('rolled_back');
  }

  private getStepById(stepId: string): WorkflowStep | undefined {
    return this.workflow.steps.find(step => step.id === stepId);
  }

  private isExecutionTimedOut(): boolean {
    if (!this.executionStartTime || !this.options.maxExecutionTime) {
      return false;
    }
    return Date.now() - this.executionStartTime > this.options.maxExecutionTime;
  }

  private validateWorkflow(): void {
    if (!this.workflow.id || !this.workflow.name) {
      throw new Error('Workflow must have an id and name');
    }

    if (!this.workflow.steps || this.workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    if (!this.workflow.startStepId) {
      throw new Error('Workflow must have a startStepId');
    }

    const startStep = this.getStepById(this.workflow.startStepId);
    if (!startStep) {
      throw new Error(`Start step ${this.workflow.startStepId} not found in workflow steps`);
    }

    const stepIds = new Set<string>();
    for (const step of this.workflow.steps) {
      if (!step.id) {
        throw new Error('All steps must have an id');
      }

      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);

      if (step.type !== 'start' && step.type !== 'end' && !step.handler) {
        throw new Error(`Step ${step.id} must have a handler`);
      }

      if (step.transitions) {
        for (const transition of step.transitions) {
          if (!transition.targetStepId) {
            throw new Error(`Transition in step ${step.id} must have a targetStepId`);
          }
        }
      }
    }

    for (const step of this.workflow.steps) {
      if (step.transitions) {
        for (const transition of step.transitions) {
          if (!stepIds.has(transition.targetStepId)) {
            throw new Error(
              `Step ${step.id} has transition to non-existent step: ${transition.targetStepId}`
            );
          }
        }
      }
    }

    const hasEndStep = this.workflow.steps.some(step => step.type === 'end');
    if (!hasEndStep) {
      console.warn('Workflow does not have an explicit end step');
    }
  }

  getWorkflowDefinition(): WorkflowDefinition {
    return { ...this.workflow };
  }

  async validateContext(context: WorkflowContext): Promise<boolean> {
    if (context.getWorkflowId() !== this.workflow.id) {
      return false;
    }

    const currentStep = context.getCurrentStep();
    if (currentStep && !this.getStepById(currentStep)) {
      return false;
    }

    return true;
  }

  async resumeWorkflow(context: WorkflowContext): Promise<WorkflowExecutionResult> {
    const isValid = await this.validateContext(context);
    if (!isValid) {
      throw new Error('Invalid context for workflow resumption');
    }

    if (context.getStatus() === 'completed') {
      throw new Error('Cannot resume a completed workflow');
    }

    return this.executeWorkflow(context);
  }
}
