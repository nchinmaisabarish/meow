import { WorkflowStep, WorkflowStepResult } from './WorkflowStep';
import { ExecutionContext } from './ExecutionContext';

export type ControllerMethod = (
  ...args: any[]
) => Promise<any> | any;

export interface AdapterOptions {
  name: string;
  description?: string;
  inputMapper?: (context: ExecutionContext) => any[];
  outputMapper?: (result: any, context: ExecutionContext) => WorkflowStepResult;
  errorHandler?: (error: Error, context: ExecutionContext) => WorkflowStepResult;
}

export class WorkflowStepAdapter implements WorkflowStep {
  public readonly name: string;
  public readonly description?: string;
  private readonly controllerMethod: ControllerMethod;
  private readonly inputMapper?: (context: ExecutionContext) => any[];
  private readonly outputMapper?: (result: any, context: ExecutionContext) => WorkflowStepResult;
  private readonly errorHandler?: (error: Error, context: ExecutionContext) => WorkflowStepResult;

  constructor(
    controllerMethod: ControllerMethod,
    options: AdapterOptions
  ) {
    this.controllerMethod = controllerMethod;
    this.name = options.name;
    this.description = options.description;
    this.inputMapper = options.inputMapper;
    this.outputMapper = options.outputMapper;
    this.errorHandler = options.errorHandler;
  }

  async execute(context: ExecutionContext): Promise<WorkflowStepResult> {
    try {
      const args = this.inputMapper ? this.inputMapper(context) : [];
      
      const result = await Promise.resolve(this.controllerMethod(...args));
      
      if (this.outputMapper) {
        return this.outputMapper(result, context);
      }
      
      return {
        success: true,
        data: result,
        metadata: {
          stepName: this.name,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (this.errorHandler) {
        return this.errorHandler(err, context);
      }
      
      return {
        success: false,
        error: err,
        metadata: {
          stepName: this.name,
          executedAt: new Date().toISOString(),
        },
      };
    }
  }

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

export function createWorkflowStepAdapter(
  controllerMethod: ControllerMethod,
  options: AdapterOptions
): WorkflowStepAdapter {
  return new WorkflowStepAdapter(controllerMethod, options);
}

export function wrapControllerMethod(
  name: string,
  controllerMethod: ControllerMethod,
  inputMapper?: (context: ExecutionContext) => any[],
  outputMapper?: (result: any, context: ExecutionContext) => WorkflowStepResult
): WorkflowStepAdapter {
  return new WorkflowStepAdapter(controllerMethod, {
    name,
    inputMapper,
    outputMapper,
  });
}
