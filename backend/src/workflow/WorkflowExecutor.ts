import { WorkflowStep } from './WorkflowStep';
import { ExecutionContext } from './ExecutionContext';
import { ConditionalStep } from './ConditionalStep';

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  startStepId: string;
}

export interface ExecutionResult {
  success: boolean;
  context: ExecutionContext;
  error?: Error;
  executedSteps: string[];
  duration: number;
}

export class WorkflowExecutor {
  private workflows: Map<string, WorkflowDefinition>;
  private maxIterations: number;

  constructor(maxIterations: number = 1000) {
    this.workflows = new Map();
    this.maxIterations = maxIterations;
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  async executeWorkflow(
    workflowId: string,
    initialContext?: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const context = initialContext || new ExecutionContext();
    context.setStatus('running');
    context.log(`Starting workflow: ${workflow.name}`);

    const executedSteps: string[] = [];
    const stepMap = new Map<string, WorkflowStep>();

    workflow.steps.forEach(step => {
      stepMap.set(step.id, step);
    });

    let currentStepId: string | undefined = workflow.startStepId;
    let iterations = 0;

    try {
      while (currentStepId && iterations < this.maxIterations) {
        iterations++;

        const currentStep = stepMap.get(currentStepId);

        if (!currentStep) {
          throw new Error(`Step not found: ${currentStepId}`);
        }

        context.log(`Executing step: ${currentStep.name} (${currentStep.id})`);
        executedSteps.push(currentStep.id);

        context.clearNextStepId();

        await currentStep.execute(context);

        const explicitNextStep = context.getNextStepId();

        if (explicitNextStep) {
          currentStepId = explicitNextStep;
        } else if (currentStep instanceof ConditionalStep) {
          currentStepId = undefined;
        } else {
          currentStepId = this.getNextStepInSequence(workflow, currentStepId);
        }

        if (!currentStepId) {
          context.log('No more steps to execute');
          break;
        }
      }

      if (iterations >= this.maxIterations) {
        throw new Error(`Workflow exceeded maximum iterations: ${this.maxIterations}`);
      }

      context.setStatus('completed');
      context.log('Workflow completed successfully');

      const duration = Date.now() - startTime;

      return {
        success: true,
        context,
        executedSteps,
        duration
      };
    } catch (error) {
      context.setStatus('failed');
      context.log(`Workflow failed: ${error}`);

      const duration = Date.now() - startTime;

      return {
        success: false,
        context,
        error: error as Error,
        executedSteps,
        duration
      };
    }
  }

  private getNextStepInSequence(
    workflow: WorkflowDefinition,
    currentStepId: string
  ): string | undefined {
    const currentIndex = workflow.steps.findIndex(step => step.id === currentStepId);

    if (currentIndex === -1 || currentIndex === workflow.steps.length - 1) {
      return undefined;
    }

    return workflow.steps[currentIndex + 1].id;
  }

  async executeStep(
    workflowId: string,
    stepId: string,
    context: ExecutionContext
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.find(s => s.id === stepId);

    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    await step.execute(context);
  }

  validateWorkflow(workflow: WorkflowDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workflow.id) {
      errors.push('Workflow must have an id');
    }

    if (!workflow.name) {
      errors.push('Workflow must have a name');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    if (!workflow.startStepId) {
      errors.push('Workflow must have a startStepId');
    }

    const stepIds = new Set<string>();
    const duplicateIds: string[] = [];

    workflow.steps.forEach(step => {
      if (!step.id) {
        errors.push('All steps must have an id');
      } else {
        if (stepIds.has(step.id)) {
          duplicateIds.push(step.id);
        }
        stepIds.add(step.id);
      }

      if (!step.name) {
        errors.push(`Step ${step.id} must have a name`);
      }
    });

    if (duplicateIds.length > 0) {
      errors.push(`Duplicate step IDs found: ${duplicateIds.join(', ')}`);
    }

    if (workflow.startStepId && !stepIds.has(workflow.startStepId)) {
      errors.push(`Start step ${workflow.startStepId} not found in workflow steps`);
    }

    workflow.steps.forEach(step => {
      if (step instanceof ConditionalStep) {
        const branches = step.getBranches();
        branches.forEach(branch => {
          if (!stepIds.has(branch.nextStepId)) {
            errors.push(
              `Conditional step ${step.id} references non-existent step: ${branch.nextStepId}`
            );
          }
        });

        const defaultBranch = step.getDefaultBranch();
        if (defaultBranch && !stepIds.has(defaultBranch)) {
          errors.push(
            `Conditional step ${step.id} default branch references non-existent step: ${defaultBranch}`
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  removeWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  clearWorkflows(): void {
    this.workflows.clear();
  }
}
