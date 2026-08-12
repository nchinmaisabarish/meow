export interface IWorkflowContext {
  currentState: string;
  [key: string]: any;
}

export interface WorkflowState {
  id: string;
  name: string;
  metadata?: Record<string, any>;
}

export interface WorkflowTransition {
  id: string;
  from: string;
  to: string;
  event: string;
  condition?: (context: IWorkflowContext) => boolean;
  action?: (context: IWorkflowContext) => void | Promise<void>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  initialState: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}
