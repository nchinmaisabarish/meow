import { StructuredToolInterface } from '@langchain/core/tools';
import { User } from '../entities/User.js';
import { createCardTool, updateCardTool, getCardTool, moveCardToLaneTool } from './CardTools.js';

/**
 * Tool Registry that provides access to all available structured tools
 */
export class ToolRegistry {
  private tools: StructuredToolInterface[];

  constructor(authenticatedUser: User) {
    this.tools = [
      createCardTool(authenticatedUser),
      updateCardTool(authenticatedUser),
      getCardTool(authenticatedUser),
      moveCardToLaneTool(authenticatedUser),
    ];
  }

  /**
   * Get all registered tools
   */
  getTools(): StructuredToolInterface[] {
    return this.tools;
  }

  /**
   * Get tool schemas in a format suitable for API responses
   */
  getToolSchemas() {
    return this.tools.map((tool: StructuredToolInterface) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }));
  }

  /**
   * Get a specific tool by name
   */
  getToolByName(name: string): StructuredToolInterface | undefined {
    return this.tools.find((tool: StructuredToolInterface) => tool.name === name);
  }
}

/**
 * Factory function to create a tool registry for an authenticated user
 */
export function createToolRegistry(authenticatedUser: User): ToolRegistry {
  return new ToolRegistry(authenticatedUser);
}
