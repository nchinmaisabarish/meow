import { StructuredToolInterface } from '@langchain/core/tools';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';

/**
 * Represents the state of the intent workflow
 */
export interface WorkflowState {
  /**
   * The original user request/query
   */
  userRequest: string;
  
  /**
   * The authenticated user making the request
   */
  user: User;
  
  /**
   * The team context for the request
   */
  team: Team;
  
  /**
   * Parsed intent from the user request
   */
  intent?: {
    operation: string;
    entity?: string;
    confidence?: number;
  };
  
  /**
   * The tool selected to handle the request
   */
  selectedTool?: string;
  
  /**
   * Parameters extracted for the tool
   */
  toolParameters?: Record<string, unknown>;
  
  /**
   * Result from tool execution
   */
  toolResult?: string;
  
  /**
   * Final response to return to the user
   */
  response?: {
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
  };
  
  /**
   * Any errors encountered during workflow execution
   */
  error?: string;
}

/**
 * Helper class for managing workflow state transitions
 */
export class WorkflowStateHelper {
  /**
   * Create initial workflow state from user request
   */
  static createInitialState(
    userRequest: string,
    user: User,
    team: Team
  ): WorkflowState {
    return {
      userRequest,
      user,
      team,
    };
  }

  /**
   * Update state with parsed intent
   */
  static updateWithIntent(
    state: WorkflowState,
    intent: { operation: string; entity?: string; confidence?: number }
  ): Partial<WorkflowState> {
    return {
      intent,
    };
  }

  /**
   * Update state with selected tool and parameters
   */
  static updateWithToolSelection(
    state: WorkflowState,
    toolName: string,
    parameters: Record<string, unknown>
  ): Partial<WorkflowState> {
    return {
      selectedTool: toolName,
      toolParameters: parameters,
    };
  }

  /**
   * Update state with tool execution result
   */
  static updateWithToolResult(
    state: WorkflowState,
    result: string
  ): Partial<WorkflowState> {
    return {
      toolResult: result,
    };
  }

  /**
   * Update state with final response
   */
  static updateWithResponse(
    state: WorkflowState,
    response: {
      success: boolean;
      message: string;
      data?: unknown;
      error?: string;
    }
  ): Partial<WorkflowState> {
    return {
      response,
    };
  }

  /**
   * Update state with error
   */
  static updateWithError(state: WorkflowState, error: string): Partial<WorkflowState> {
    return {
      error,
      response: {
        success: false,
        message: 'An error occurred while processing your request',
        error,
      },
    };
  }

  /**
   * Check if a tool is available for the given intent
   */
  static findToolForIntent(
    intent: string,
    availableTools: StructuredToolInterface[]
  ): StructuredToolInterface | undefined {
    // Simple mapping of intents to tool names
    const intentToToolMap: Record<string, string> = {
      CREATE_CARD: 'create_card',
      ADD_CARD: 'create_card',
      NEW_CARD: 'create_card',
      CREATE_DEAL: 'create_card',
      ADD_DEAL: 'create_card',
    };

    const toolName = intentToToolMap[intent.toUpperCase()];
    if (!toolName) {
      return undefined;
    }

    return availableTools.find((tool: StructuredToolInterface) => tool.name === toolName);
  }

  /**
   * Extract parameters from user request for a given tool
   * This is a simplified version - in production, you'd use an LLM to extract parameters
   */
  static extractToolParameters(
    userRequest: string,
    toolName: string,
    user: User,
    team: Team
  ): Record<string, unknown> {
    // For now, return basic parameters
    // In a real implementation, you would use an LLM to extract these from the user request
    const params: Record<string, unknown> = {
      userId: user._id.toString(),
      teamId: team._id.toString(),
    };

    return params;
  }
}
