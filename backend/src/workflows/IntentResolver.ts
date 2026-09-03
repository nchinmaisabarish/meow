import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { createFetchCardsTool, createGetCardTool } from '../tools/CardTools.js';
import { createFetchAccountsTool, createGetAccountTool } from '../tools/AccountTools.js';

export interface IntentRequest {
  query: string;
  context?: Record<string, any>;
}

export interface IntentResponse {
  success: boolean;
  result?: string;
  error?: string;
  toolUsed?: string;
}

/**
 * IntentResolver uses LangChain to parse user intent and dispatch to appropriate tools
 */
export class IntentResolver {
  private model: ChatOpenAI;
  private user: User;
  private team: Team;

  constructor(user: User, team: Team, apiKey?: string) {
    this.user = user;
    this.team = team;

    // Initialize ChatOpenAI with tool binding
    this.model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      openAIApiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Resolve user intent and execute the appropriate tool
   */
  async resolve(request: IntentRequest): Promise<IntentResponse> {
    try {
      // Create tools with user context
      const tools = [
        createFetchCardsTool(this.user, this.team),
        createGetCardTool(this.user, this.team),
        createFetchAccountsTool(this.user, this.team),
        createGetAccountTool(this.user, this.team),
      ];

      // Bind tools to the model
      const modelWithTools = this.model.bindTools(tools);

      // Create system message to guide the model
      const systemMessage = new SystemMessage(
        'You are a helpful assistant for a sales pipeline management system. ' +
        'Use the available tools to help users query their cards (deals/opportunities) and accounts (companies/customers). ' +
        'When a user asks about their pipeline, deals, opportunities, or cards, use the fetch_cards or get_card tools. ' +
        'When a user asks about companies, customers, or accounts, use the fetch_accounts or get_account tools. ' +
        'Always use the most appropriate tool based on the user\'s query.'
      );

      const userMessage = new HumanMessage(request.query);

      // Invoke the model with tools
      const response = await modelWithTools.invoke([systemMessage, userMessage]);

      // Check if the model wants to use a tool
      if (response.additional_kwargs?.tool_calls && response.additional_kwargs.tool_calls.length > 0) {
        const toolCall = response.additional_kwargs.tool_calls[0];
        if (!toolCall) {
          return {
            success: false,
            error: 'Tool call is undefined',
          };
        }
        
        const toolName = toolCall.function?.name;
        const toolArgs = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};

        // Find and execute the appropriate tool
        const tool = tools.find((t: any) => t.name === toolName);
        if (tool) {
          const toolResult = await tool.invoke(toolArgs);
          
          return {
            success: true,
            result: toolResult,
            toolUsed: toolName,
          };
        } else {
          return {
            success: false,
            error: `Tool ${toolName} not found`,
          };
        }
      }

      // If no tool was called, return the model's direct response
      return {
        success: true,
        result: response.content as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get available tools for this user
   */
  getAvailableTools(): string[] {
    return [
      'fetch_cards',
      'get_card',
      'fetch_accounts',
      'get_account',
    ];
  }
}
