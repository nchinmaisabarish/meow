import { DynamicStructuredTool } from '@langchain/core/tools';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { createCardTools } from './CardTools.js';

/**
 * ToolRegistry manages and provides access to all available LangChain tools
 * in the application. Tools are context-aware and created per user/team.
 */
export class ToolRegistry {
  private tools: DynamicStructuredTool[];

  constructor(user: User, team: Team) {
    this.tools = [];
    this.registerTools(user, team);
  }

  /**
   * Register all available tools for the given user and team context.
   */
  private registerTools(user: User, team: Team): void {
    // Register card management tools
    const cardTools = createCardTools(user, team);
    this.tools.push(...cardTools);
  }

  /**
   * Get all registered tools.
   */
  public getTools(): DynamicStructuredTool[] {
    return this.tools;
  }

  /**
   * Get a tool by name.
   */
  public getToolByName(name: string): DynamicStructuredTool | undefined {
    return this.tools.find((tool: DynamicStructuredTool) => tool.name === name);
  }

  /**
   * Get all tool names.
   */
  public getToolNames(): string[] {
    return this.tools.map((tool: DynamicStructuredTool) => tool.name);
  }

  /**
   * Get tool schemas in a format suitable for agent configuration.
   */
  public getToolSchemas(): Array<{ name: string; description: string; schema: any }> {
    return this.tools.map((tool: DynamicStructuredTool) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }));
  }

  /**
   * Create a new ToolRegistry instance for a user and team.
   */
  static create(user: User, team: Team): ToolRegistry {
    return new ToolRegistry(user, team);
  }
}
