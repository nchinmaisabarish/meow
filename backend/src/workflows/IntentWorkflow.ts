import { StateGraph, Annotation, END, BaseCheckpointSaver } from '@langchain/langgraph';
import { WorkflowState, WorkflowStateHelper } from '../helpers/WorkflowStateHelper.js';
import { getAllTools } from '../helpers/ToolRegistry.js';
import { OpenAIHelper } from '../helpers/OpenAIHelper.js';
import { CheckpointerHelper } from '../helpers/CheckpointerHelper.js';

/**
 * Intent Workflow - Natural language processing workflow for handling user requests
 * 
 * This workflow supports conversation state persistence using MongoDB checkpointer.
 * 
 * Usage with checkpointer:
 * ```typescript
 * // Single request without persistence
 * const response = await executeIntentWorkflow(userRequest, user, team);
 * 
 * // Multi-turn conversation with persistence
 * const threadId = 'conversation-123';
 * const response1 = await executeIntentWorkflow(userRequest1, user, team, threadId);
 * const response2 = await executeIntentWorkflow(userRequest2, user, team, threadId);
 * // The workflow can access state from previous requests in the same thread
 * ```
 */

/**
 * Define the state annotation for the workflow
 * This uses LangGraph's Annotation API to define state structure
 */
const WorkflowStateAnnotation = Annotation.Root({
  userRequest: Annotation<string>(),
  user: Annotation<WorkflowState['user']>(),
  team: Annotation<WorkflowState['team']>(),
  intent: Annotation<WorkflowState['intent']>(),
  selectedTool: Annotation<string>(),
  toolParameters: Annotation<Record<string, unknown>>(),
  toolResult: Annotation<string>(),
  response: Annotation<WorkflowState['response']>(),
  error: Annotation<string>(),
});

/**
 * Node: Parse user intent from the request
 */
async function parseIntent(state: typeof WorkflowStateAnnotation.State): Promise<Partial<typeof WorkflowStateAnnotation.State>> {
  try {
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return WorkflowStateHelper.updateWithError(
        state,
        'Natural language processing is not configured. OPENAI_API_KEY environment variable is not set.'
      );
    }

    // Use OpenAI to parse the user's intent
    const intent = await OpenAIHelper.parseQueryIntent(state.userRequest);

    return WorkflowStateHelper.updateWithIntent(state, {
      operation: intent.operation,
      entity: intent.entity,
      confidence: intent.confidence,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing intent';
    return WorkflowStateHelper.updateWithError(state, errorMessage);
  }
}

/**
 * Node: Select the appropriate tool based on intent
 */
async function selectTool(state: typeof WorkflowStateAnnotation.State): Promise<Partial<typeof WorkflowStateAnnotation.State>> {
  try {
    // If there's an error, skip tool selection
    if (state.error) {
      return {};
    }

    if (!state.intent) {
      return WorkflowStateHelper.updateWithError(state, 'No intent was parsed from the request');
    }

    // Get all available tools
    const availableTools = getAllTools();

    // Find a tool that matches the intent
    const tool = WorkflowStateHelper.findToolForIntent(state.intent.operation, availableTools);

    if (!tool) {
      return WorkflowStateHelper.updateWithError(
        state,
        `No tool available to handle intent: ${state.intent.operation}`
      );
    }

    // Extract parameters for the tool
    const parameters = WorkflowStateHelper.extractToolParameters(
      state.userRequest,
      tool.name,
      state.user,
      state.team
    );

    return WorkflowStateHelper.updateWithToolSelection(state, tool.name, parameters);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error selecting tool';
    return WorkflowStateHelper.updateWithError(state, errorMessage);
  }
}

/**
 * Node: Execute the selected tool
 */
async function executeTool(state: typeof WorkflowStateAnnotation.State): Promise<Partial<typeof WorkflowStateAnnotation.State>> {
  try {
    // If there's an error, skip tool execution
    if (state.error) {
      return {};
    }

    if (!state.selectedTool || !state.toolParameters) {
      return WorkflowStateHelper.updateWithError(state, 'No tool selected for execution');
    }

    // Get the tool
    const availableTools = getAllTools();
    const tool = availableTools.find((t) => t.name === state.selectedTool);

    if (!tool) {
      return WorkflowStateHelper.updateWithError(state, `Tool not found: ${state.selectedTool}`);
    }

    // Execute the tool
    const result = await tool.invoke(state.toolParameters);

    return WorkflowStateHelper.updateWithToolResult(state, result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error executing tool';
    return WorkflowStateHelper.updateWithError(state, errorMessage);
  }
}

/**
 * Node: Format the final response
 */
async function formatResponse(state: typeof WorkflowStateAnnotation.State): Promise<Partial<typeof WorkflowStateAnnotation.State>> {
  // If there's already an error response, return it
  if (state.error && state.response) {
    return {};
  }

  // If there's a tool result, parse it and format the response
  if (state.toolResult) {
    try {
      const parsedResult = JSON.parse(state.toolResult);
      
      return WorkflowStateHelper.updateWithResponse(state, {
        success: parsedResult.success || false,
        message: parsedResult.message || 'Operation completed',
        data: parsedResult.card || parsedResult.data,
        error: parsedResult.error,
      });
    } catch (error: unknown) {
      // If we can't parse the result, return it as-is
      return WorkflowStateHelper.updateWithResponse(state, {
        success: true,
        message: 'Operation completed',
        data: state.toolResult,
      });
    }
  }

  // Default response if no tool was executed
  return WorkflowStateHelper.updateWithResponse(state, {
    success: false,
    message: 'No operation was performed',
  });
}

/**
 * Conditional edge: Determine if we should continue to tool execution or skip to response
 */
function shouldExecuteTool(state: typeof WorkflowStateAnnotation.State): string {
  // If there's an error, skip to response formatting
  if (state.error) {
    return 'formatResponse';
  }

  // If a tool was selected, execute it
  if (state.selectedTool) {
    return 'executeTool';
  }

  // Otherwise, skip to response formatting
  return 'formatResponse';
}

/**
 * Create and compile the intent workflow graph
 * @param checkpointer Optional checkpoint saver for state persistence
 */
export function createIntentWorkflow(checkpointer?: BaseCheckpointSaver) {
  // Create a new state graph
  const workflow = new StateGraph(WorkflowStateAnnotation)
    // Add nodes for each step in the workflow
    .addNode('parseIntent', parseIntent)
    .addNode('selectTool', selectTool)
    .addNode('executeTool', executeTool)
    .addNode('formatResponse', formatResponse)
    // Define the flow
    .addEdge('__start__', 'parseIntent')
    .addEdge('parseIntent', 'selectTool')
    .addConditionalEdges('selectTool', shouldExecuteTool, {
      executeTool: 'executeTool',
      formatResponse: 'formatResponse',
    })
    .addEdge('executeTool', 'formatResponse')
    .addEdge('formatResponse', '__end__');

  // Compile the graph with optional checkpointer
  return workflow.compile({ checkpointer });
}

/**
 * Execute the intent workflow with the given state
 * @param userRequest The user's natural language request
 * @param user The authenticated user
 * @param team The team context
 * @param threadId Optional thread ID for conversation persistence
 * @param useCheckpointer Whether to use checkpointer for state persistence (default: true)
 */
export async function executeIntentWorkflow(
  userRequest: string,
  user: WorkflowState['user'],
  team: WorkflowState['team'],
  threadId?: string,
  useCheckpointer: boolean = true
): Promise<WorkflowState['response']> {
  // Get checkpointer if enabled
  const checkpointer = useCheckpointer ? CheckpointerHelper.getCheckpointer() : undefined;
  
  // Create the workflow with optional checkpointer
  const workflow = createIntentWorkflow(checkpointer);

  // Create initial state
  const initialState = WorkflowStateHelper.createInitialState(userRequest, user, team);

  // Build config with optional thread_id for persistence
  const config = threadId ? {
    configurable: {
      thread_id: threadId,
    },
  } : undefined;

  // Execute the workflow
  const result = await workflow.invoke(initialState, config);

  // Return the response
  return result.response || {
    success: false,
    message: 'No response generated',
  };
}
