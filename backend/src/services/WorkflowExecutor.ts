import { CompiledStateGraph } from '@langchain/langgraph';
import { Card } from '../entities/Card.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { Attribute } from '../entities/Attribute.js';
import {
  createCardLifecycleWorkflow,
  CardWorkflowState,
} from '../workflows/CardLifecycleWorkflow.js';
import {
  createForecastWorkflow,
  ForecastWorkflowState,
} from '../workflows/ForecastWorkflow.js';
import { ObjectId } from 'mongodb';

/**
 * Input parameters for creating a card through the workflow
 */
export interface CreateCardWorkflowInput {
  user: User;
  lane: Lane;
  name: string;
  amount: number;
  attributes?: Attribute;
  closedAt?: Date;
  nextFollowUpAt?: Date;
}

/**
 * Result of executing the card creation workflow
 */
export interface WorkflowExecutionResult {
  success: boolean;
  card?: Card;
  error?: string;
  validationErrors?: string[];
  state?: CardWorkflowState;
}

/**
 * Input parameters for executing forecast generation workflow
 */
export interface ForecastWorkflowInput {
  laneType: LaneType;
  teamId: ObjectId;
  start: Date;
  end: Date;
  userId?: ObjectId;
}

/**
 * Result of executing the forecast generation workflow
 */
export interface ForecastWorkflowExecutionResult {
  success: boolean;
  prediction: {
    amount: number;
    count: number;
  };
  confidence?: number;
  error?: string;
  validationErrors?: string[];
  state?: ForecastWorkflowState;
}

/**
 * WorkflowExecutor service handles the compilation and execution of LangGraph workflows.
 * It provides a clean interface for running stateful workflows and managing their lifecycle.
 */
export class WorkflowExecutor {
  private cardLifecycleGraph: ReturnType<
    ReturnType<typeof createCardLifecycleWorkflow>['compile']
  > | null = null;

  private forecastGraph: ReturnType<
    ReturnType<typeof createForecastWorkflow>['compile']
  > | null = null;

  /**
   * Get or compile the card lifecycle workflow graph
   */
  private getCardLifecycleGraph(): ReturnType<
    ReturnType<typeof createCardLifecycleWorkflow>['compile']
  > {
    if (!this.cardLifecycleGraph) {
      const workflow = createCardLifecycleWorkflow();
      this.cardLifecycleGraph = workflow.compile();
    }
    return this.cardLifecycleGraph;
  }

  /**
   * Get or compile the forecast workflow graph
   */
  private getForecastGraph(): ReturnType<
    ReturnType<typeof createForecastWorkflow>['compile']
  > {
    if (!this.forecastGraph) {
      const workflow = createForecastWorkflow();
      this.forecastGraph = workflow.compile();
    }
    return this.forecastGraph;
  }

  /**
   * Execute the card creation workflow
   * @param input - The input parameters for card creation
   * @returns WorkflowExecutionResult containing the created card or error information
   */
  async executeCardCreation(input: CreateCardWorkflowInput): Promise<WorkflowExecutionResult> {
    try {
      const graph = this.getCardLifecycleGraph();

      // Initialize the workflow state
      const initialState: CardWorkflowState = {
        user: input.user,
        lane: input.lane,
        name: input.name,
        amount: input.amount,
        attributes: input.attributes,
        closedAt: input.closedAt,
        nextFollowUpAt: input.nextFollowUpAt,
        validationStatus: 'pending',
        validationErrors: [],
        currentPhase: 'create',
        nextActions: [],
      };

      // Invoke the workflow
      const result = await graph.invoke(initialState);

      // Check if workflow completed successfully
      if (result.error || result.validationStatus === 'invalid') {
        return {
          success: false,
          error: result.error,
          validationErrors: result.validationErrors,
          state: result,
        };
      }

      if (!result.card) {
        return {
          success: false,
          error: 'Workflow completed but no card was created',
          state: result,
        };
      }

      return {
        success: true,
        card: result.card,
        state: result,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown workflow execution error',
      };
    }
  }

  /**
   * Stream the card creation workflow execution (for future use with real-time updates)
   * This method demonstrates how to use LangGraph's streaming capabilities
   * @param input - The input parameters for card creation
   */
  async *streamCardCreation(
    input: CreateCardWorkflowInput
  ): AsyncGenerator<CardWorkflowState, void, unknown> {
    try {
      const graph = this.getCardLifecycleGraph();

      const initialState: CardWorkflowState = {
        user: input.user,
        lane: input.lane,
        name: input.name,
        amount: input.amount,
        attributes: input.attributes,
        closedAt: input.closedAt,
        nextFollowUpAt: input.nextFollowUpAt,
        validationStatus: 'pending',
        validationErrors: [],
        currentPhase: 'create',
        nextActions: [],
      };

      // Stream workflow execution
      const stream = await graph.stream(initialState);

      for await (const state of stream) {
        // Extract the actual state from the stream output
        // LangGraph stream returns objects with node names as keys
        const nodeOutputs = Object.values(state);
        if (nodeOutputs.length > 0) {
          const nodeOutput = nodeOutputs[0];
          if (nodeOutput) {
            yield nodeOutput as CardWorkflowState;
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error streaming workflow:', error);
      throw error;
    }
  }

  /**
   * Execute the forecast generation workflow
   * @param input - The input parameters for forecast generation
   * @returns ForecastWorkflowExecutionResult containing the prediction or error information
   */
  async executeForecastGeneration(input: ForecastWorkflowInput): Promise<ForecastWorkflowExecutionResult> {
    try {
      const graph = this.getForecastGraph();

      // Initialize the workflow state
      const initialState: ForecastWorkflowState = {
        laneType: input.laneType,
        teamId: input.teamId,
        start: input.start,
        end: input.end,
        userId: input.userId,
        currentPhase: 'collect_data',
        nextActions: [],
        lanes: [],
        historicalData: [],
        aggregationResult: [],
        prediction: { amount: 0, count: 0 },
        validationErrors: [],
      };

      // Invoke the workflow
      const result = await graph.invoke(initialState);

      // Check if workflow completed successfully
      if (result.error && result.validationErrors && result.validationErrors.length > 0) {
        return {
          success: false,
          prediction: result.prediction || { amount: 0, count: 0 },
          error: result.error,
          validationErrors: result.validationErrors,
          state: result,
        };
      }

      return {
        success: true,
        prediction: result.prediction,
        confidence: result.confidence,
        state: result,
      };
    } catch (error: unknown) {
      return {
        success: false,
        prediction: { amount: 0, count: 0 },
        error: error instanceof Error ? error.message : 'Unknown workflow execution error',
      };
    }
  }

  /**
   * Stream the forecast generation workflow execution
   * This method demonstrates how to use LangGraph's streaming capabilities for forecast generation
   * @param input - The input parameters for forecast generation
   */
  async *streamForecastGeneration(
    input: ForecastWorkflowInput
  ): AsyncGenerator<ForecastWorkflowState, void, unknown> {
    try {
      const graph = this.getForecastGraph();

      const initialState: ForecastWorkflowState = {
        laneType: input.laneType,
        teamId: input.teamId,
        start: input.start,
        end: input.end,
        userId: input.userId,
        currentPhase: 'collect_data',
        nextActions: [],
        lanes: [],
        historicalData: [],
        aggregationResult: [],
        prediction: { amount: 0, count: 0 },
        validationErrors: [],
      };

      // Stream workflow execution
      const stream = await graph.stream(initialState);

      for await (const state of stream) {
        // Extract the actual state from the stream output
        // LangGraph stream returns objects with node names as keys
        const nodeOutputs = Object.values(state);
        if (nodeOutputs.length > 0) {
          const nodeOutput = nodeOutputs[0];
          if (nodeOutput) {
            yield nodeOutput as ForecastWorkflowState;
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error streaming forecast workflow:', error);
      throw error;
    }
  }

  /**
   * Get the current state of a workflow execution
   * This is a placeholder for future checkpoint-based state retrieval
   * @param workflowId - The ID of the workflow execution
   */
  async getWorkflowState(workflowId: string): Promise<CardWorkflowState | null> {
    // TODO: Implement checkpoint-based state retrieval
    // This would require configuring a checkpointer when compiling the graph
    // For now, return null as we're not persisting intermediate states
    return null;
  }
}

/**
 * Singleton instance of WorkflowExecutor
 * This ensures we reuse the compiled graph across requests
 */
let workflowExecutorInstance: WorkflowExecutor | null = null;

/**
 * Get the singleton WorkflowExecutor instance
 */
export function getWorkflowExecutor(): WorkflowExecutor {
  if (!workflowExecutorInstance) {
    workflowExecutorInstance = new WorkflowExecutor();
  }
  return workflowExecutorInstance;
}
