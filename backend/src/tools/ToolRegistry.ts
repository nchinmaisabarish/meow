import { StructuredToolInterface } from '@langchain/core/tools';
import {
  createCardTool,
  updateCardTool,
  deleteCardTool,
  getCardTool,
  listCardsTool,
} from './CardTools.js';

/**
 * Registry of all available tools in the application.
 * This provides a centralized location for discovering and accessing
 * all structured tools that can be used by AI agents and orchestration layers.
 */
export class ToolRegistry {
  private static tools: StructuredToolInterface[] = [
    createCardTool,
    updateCardTool,
    deleteCardTool,
    getCardTool,
    listCardsTool,
  ];

  /**
   * Get all registered tools
   */
  static getAllTools(): StructuredToolInterface[] {
    return this.tools;
  }

  /**
   * Get a tool by name
   */
  static getToolByName(name: string): StructuredToolInterface | undefined {
    return this.tools.find((tool: StructuredToolInterface) => tool.name === name);
  }

  /**
   * Get tool schemas in a format suitable for API responses
   */
  static getToolSchemas(): Array<{
    name: string;
    description: string;
    schema: any;
  }> {
    return this.tools.map((tool: StructuredToolInterface) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }));
  }

  /**
   * Get a summary of all available tools
   */
  static getToolSummary(): Array<{
    name: string;
    description: string;
  }> {
    return this.tools.map((tool: StructuredToolInterface) => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}

/**
 * Export all tools for direct access
 */
export const allTools = ToolRegistry.getAllTools();

/**
 * Export individual tool categories
 */
export const cardTools = [
  createCardTool,
  updateCardTool,
  deleteCardTool,
  getCardTool,
  listCardsTool,
];
