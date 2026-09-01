import { StructuredToolInterface } from '@langchain/core/tools';
import { createCardTool } from './CardTools.js';

/**
 * Registry of all available structured tools.
 * This array can be consumed by orchestration frameworks and agent systems
 * to discover and invoke application operations programmatically.
 */
export const tools: StructuredToolInterface[] = [
  createCardTool,
];

export { createCardTool } from './CardTools.js';
