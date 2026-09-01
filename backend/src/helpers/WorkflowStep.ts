import { WorkflowState } from './WorkflowState.js';

/**
 * Interface defining the contract for executable workflow steps.
 * Each step can execute logic based on the current state and determine
 * which steps should execute next, enabling dynamic workflow graphs.
 */
export interface WorkflowStep {
  /**
   * Execute the workflow step with the given state.
   * @param state - The current workflow state containing context data
   * @returns A promise that resolves when the step execution is complete
   */
  execute(state: WorkflowState): Promise<void>;

  /**
   * Determine the next steps to execute based on the current state.
   * @returns An array of workflow step identifiers or step instances to execute next
   */
  getNextSteps(): string[] | WorkflowStep[];
}
