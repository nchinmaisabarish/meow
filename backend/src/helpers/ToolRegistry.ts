import { StructuredToolInterface } from '@langchain/core/tools';
import { createCardTool } from '../tools/CardTools.js';
import { createLaneTool, updateLaneTool, reorderLanesTool } from '../tools/LaneTools.js';
import { createAccountTool, addUserToTeamTool, updateTeamSettingsTool } from '../tools/AccountTeamTools.js';

/**
 * Registry of all available LangChain tools for the application
 * This provides a centralized location for tool discovery by orchestration layers
 */
export const availableTools: StructuredToolInterface[] = [
  createCardTool,
  createLaneTool,
  updateLaneTool,
  reorderLanesTool,
  createAccountTool,
  addUserToTeamTool,
  updateTeamSettingsTool,
];

/**
 * Get all available tools
 * @returns Array of all registered LangChain tools
 */
export function getAllTools(): StructuredToolInterface[] {
  return availableTools;
}

/**
 * Get a tool by name
 * @param name The name of the tool to retrieve
 * @returns The tool if found, undefined otherwise
 */
export function getToolByName(name: string): StructuredToolInterface | undefined {
  return availableTools.find((tool: StructuredToolInterface) => tool.name === name);
}

/**
 * Get tool names
 * @returns Array of all tool names
 */
export function getToolNames(): string[] {
  return availableTools.map((tool: StructuredToolInterface) => tool.name);
}
