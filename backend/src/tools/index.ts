import { StructuredToolInterface } from '@langchain/core/tools';
import { createCardTool, getCardTool, updateCardTool, deleteCardTool } from './CardTools.js';
import {
  createLaneTool,
  getLaneTool,
  updateLaneTool,
  deleteLaneTool,
  getLaneStatisticsTool,
} from './LaneTools.js';

/**
 * Central registry of all available tools for agent systems.
 * This array contains all structured tools that can be discovered and invoked
 * by LangChain agents or other orchestration layers.
 */
export const ToolRegistry: StructuredToolInterface[] = [
  createCardTool,
  getCardTool,
  updateCardTool,
  deleteCardTool,
  createLaneTool,
  getLaneTool,
  updateLaneTool,
  deleteLaneTool,
  getLaneStatisticsTool,
];

/**
 * Export individual tools for direct usage
 */
export { createCardTool, getCardTool, updateCardTool, deleteCardTool };
export { createLaneTool, getLaneTool, updateLaneTool, deleteLaneTool, getLaneStatisticsTool };
