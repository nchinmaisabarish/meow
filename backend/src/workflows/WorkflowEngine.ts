import { IWorkflowContext, WorkflowDefinition, WorkflowTransition } from './WorkflowTypes.js';

export interface WorkflowExecutionResult {
  success: boolean;
  currentState: string;
  previousState: string;
  transitionId?: string;
  error?: string;
}

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  public registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  public getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  public async executeWorkflow(
    workflowId: string,
    context: IWorkflowContext
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      return {
        success: false,
        currentState: context.currentState,
        previousState: context.currentState,
        error: `Workflow ${workflowId} not found`,
      };
    }

    const previousState = context.currentState;
    const applicableTransitions = workflow.transitions.filter(
      (t) => t.from === context.currentState && t.event === (context as any).eventType
    );

    for (const transition of applicableTransitions) {
      if (!transition.condition || transition.condition(context)) {
        if (transition.action) {
          await transition.action(context);
        }

        context.currentState = transition.to;

        return {
          success: true,
          currentState: transition.to,
          previousState,
          transitionId: transition.id,
        };
      }
    }

    return {
      success: false,
      currentState: context.currentState,
      previousState,
      error: 'No applicable transition found',
    };
  }
}
