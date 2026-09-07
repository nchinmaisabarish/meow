import { StructuredToolInterface } from '@langchain/core/tools';
import { createCardTool, getCardTool, updateCardTool, deleteCardTool } from './CardTools.js';
import {
  createLaneTool,
  getLaneTool,
  updateLaneTool,
  deleteLaneTool,
  getLaneStatisticsTool,
} from './LaneTools.js';
import {
  createAccountTool,
  updateAccountTool,
  deleteAccountTool,
  getAccountEventsTool,
} from './AccountTools.js';
import {
  createTeamTool,
  updateTeamTool,
  deleteTeamTool,
  getTeamTool,
} from './TeamTools.js';

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
  createAccountTool,
  updateAccountTool,
  deleteAccountTool,
  getAccountEventsTool,
  createTeamTool,
  updateTeamTool,
  deleteTeamTool,
  getTeamTool,
];

/**
 * Export individual tools for direct usage
 */
export { createCardTool, getCardTool, updateCardTool, deleteCardTool };
export { createLaneTool, getLaneTool, updateLaneTool, deleteLaneTool, getLaneStatisticsTool };
export { createAccountTool, updateAccountTool, deleteAccountTool, getAccountEventsTool };
export { createTeamTool, updateTeamTool, deleteTeamTool, getTeamTool };
