import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { cardTools } from '../tools/CardTools.js';
import { accountTools } from '../tools/AccountTools.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';

/**
 * Service for resolving user intents using LLM and structured tools
 */
export class IntentResolverService {
  private model: ChatOpenAI;
  private tools: any[];

  constructor() {
    // Initialize ChatOpenAI with tool binding
    this.model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Combine all available tools
    this.tools = [...cardTools, ...accountTools];
  }

  /**
   * Resolves user intent and executes the appropriate tool
   * @param query Natural language query from the user
   * @param user Authenticated user
   * @param team User's team
   * @returns Result from the executed tool
   */
  async resolveIntent(query: string, user: User, team: Team): Promise<any> {
    try {
      // Bind tools to the model
      const modelWithTools = this.model.bind({
        tools: this.tools,
      });

      // Create a message with context about the user and team
      const contextualQuery = `User ID: ${user._id.toString()}, Team ID: ${team._id.toString()}\nQuery: ${query}`;
      
      // Invoke the model with the query
      const response = await modelWithTools.invoke([
        new HumanMessage(contextualQuery),
      ]);

      // Check if the model wants to call a tool
      if (response.additional_kwargs?.tool_calls && response.additional_kwargs.tool_calls.length > 0) {
        const toolCall = response.additional_kwargs.tool_calls[0];
        
        if (!toolCall) {
          return {
            success: false,
            error: 'Tool call is undefined',
          };
        }
        
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Find the matching tool
        const tool = this.tools.find((t: any) => t.name === toolName);
        
        if (!tool) {
          return {
            success: false,
            error: `Tool ${toolName} not found`,
            intent: toolName,
          };
        }

        // Inject user and team IDs if not already present
        if (!toolArgs.userId && user._id) {
          toolArgs.userId = user._id.toString();
        }
        if (!toolArgs.teamId && team._id) {
          toolArgs.teamId = team._id.toString();
        }

        // Execute the tool
        const result = await tool.invoke(toolArgs);
        
        // Parse the result (tools return JSON strings)
        const parsedResult = JSON.parse(result);

        return {
          success: true,
          intent: toolName,
          arguments: toolArgs,
          result: parsedResult,
        };
      } else {
        // No tool was called, return the direct response
        return {
          success: true,
          intent: 'direct_response',
          result: {
            message: response.content,
          },
        };
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Unknown error occurred during intent resolution',
      };
    }
  }

  /**
   * Lists all available tools and their descriptions
   * @returns Array of tool metadata
   */
  getAvailableTools(): Array<{ name: string; description: string }> {
    return this.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}
