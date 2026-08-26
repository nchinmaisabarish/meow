import { ExecutionContext } from './ExecutionContext';

export interface WorkflowStep {
  id: string;
  name: string;
  execute(context: ExecutionContext): Promise<void>;
}
