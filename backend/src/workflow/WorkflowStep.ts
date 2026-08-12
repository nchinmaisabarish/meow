export interface WorkflowStepResult {
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  readonly name: string;
  readonly description?: string;
  
  execute(context: ExecutionContext): Promise<WorkflowStepResult>;
  
  canExecute?(context: ExecutionContext): Promise<boolean>;
  
  onSuccess?(context: ExecutionContext, result: WorkflowStepResult): Promise<void>;
  
  onError?(context: ExecutionContext, error: Error): Promise<void>;
}

export abstract class BaseWorkflowStep implements WorkflowStep {
  constructor(
    public readonly name: string,
    public readonly description?: string
  ) {}

  abstract execute(context: ExecutionContext): Promise<WorkflowStepResult>;

  async canExecute(context: ExecutionContext): Promise<boolean> {
    return true;
  }

  async onSuccess(context: ExecutionContext, result: WorkflowStepResult): Promise<void> {
    context.addStepResult(this.name, result);
  }

  async onError(context: ExecutionContext, error: Error): Promise<void> {
    context.addError(this.name, error);
  }
}

import { ExecutionContext } from './ExecutionContext';
