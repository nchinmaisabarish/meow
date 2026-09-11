import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { LaneController } from '../controllers/LaneController.js';

/**
 * Input schema for the createLane tool
 */
const createLaneSchema = z.object({
  teamId: z.string().describe('The ID of the team that owns the lane'),
  boardId: z.string().describe('The ID of the board where the lane should be created'),
  name: z.string().describe('The name of the lane (e.g., "Prospecting", "Qualified", "Closed Won")'),
  index: z.number().describe('The position/order of the lane in the board (0-based index)'),
  color: z.string().optional().describe('Optional color code for the lane (e.g., "#FF5733")'),
  inForecast: z.boolean().optional().describe('Whether cards in this lane should be included in forecast calculations'),
  tags: z.record(z.union([z.string(), z.boolean()])).optional().describe('Optional custom tags for the lane'),
});

/**
 * Input schema for the updateLane tool
 */
const updateLaneSchema = z.object({
  laneId: z.string().describe('The ID of the lane to update'),
  teamId: z.string().describe('The ID of the team that owns the lane'),
  name: z.string().optional().describe('The new name for the lane'),
  color: z.string().optional().describe('The new color code for the lane'),
  inForecast: z.boolean().optional().describe('Whether cards in this lane should be included in forecast calculations'),
  tags: z.record(z.union([z.string(), z.boolean()])).optional().describe('Custom tags for the lane'),
});

/**
 * Input schema for the reorderLanes tool
 */
const reorderLanesSchema = z.object({
  teamId: z.string().describe('The ID of the team that owns the lanes'),
  lanes: z.array(z.object({
    laneId: z.string().describe('The ID of the lane'),
    index: z.number().describe('The new position/order of the lane (0-based index)'),
  })).describe('Array of lane IDs with their new index positions'),
});

/**
 * LangChain structured tool for creating lanes
 */
export const createLaneTool = new DynamicStructuredTool({
  name: 'create_lane',
  description: 'Creates a new lane (stage) in a sales pipeline board. Lanes represent different stages in the sales process (e.g., "Prospecting", "Qualified", "Negotiation", "Closed Won"). Cards (deals) move through these lanes as they progress through the sales cycle.',
  schema: createLaneSchema,
  func: async (input: z.infer<typeof createLaneSchema>): Promise<string> => {
    try {
      const lane = await LaneController.createLaneFromTool(input);
      return JSON.stringify({
        success: true,
        lane: {
          _id: lane._id.toString(),
          name: lane.name,
          index: lane.index,
          color: lane.color,
          inForecast: lane.inForecast,
          tags: lane.tags,
        },
        message: `Lane "${lane.name}" created successfully with ID ${lane._id.toString()}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to create lane: ${errorMessage}`,
      });
    }
  },
});

/**
 * LangChain structured tool for updating lanes
 */
export const updateLaneTool = new DynamicStructuredTool({
  name: 'update_lane',
  description: 'Updates an existing lane (stage) in the sales pipeline. You can change the lane\'s name, color, forecast inclusion status, or custom tags. This is useful for renaming stages, adjusting visual appearance, or modifying which stages contribute to sales forecasts.',
  schema: updateLaneSchema,
  func: async (input: z.infer<typeof updateLaneSchema>): Promise<string> => {
    try {
      const lane = await LaneController.updateLaneFromTool(input);
      return JSON.stringify({
        success: true,
        lane: {
          _id: lane._id.toString(),
          name: lane.name,
          index: lane.index,
          color: lane.color,
          inForecast: lane.inForecast,
          tags: lane.tags,
        },
        message: `Lane "${lane.name}" updated successfully`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to update lane: ${errorMessage}`,
      });
    }
  },
});

/**
 * LangChain structured tool for reordering lanes
 */
export const reorderLanesTool = new DynamicStructuredTool({
  name: 'reorder_lanes',
  description: 'Reorders lanes (stages) in the sales pipeline by updating their index positions. This changes the visual order in which lanes appear on the board. Useful for reorganizing the sales process flow or adjusting stage sequences.',
  schema: reorderLanesSchema,
  func: async (input: z.infer<typeof reorderLanesSchema>): Promise<string> => {
    try {
      const lanes = await LaneController.reorderLanesFromTool(input);
      return JSON.stringify({
        success: true,
        lanes: lanes.map((lane) => ({
          _id: lane._id.toString(),
          name: lane.name,
          index: lane.index,
        })),
        message: `Successfully reordered ${lanes.length} lane(s)`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to reorder lanes: ${errorMessage}`,
      });
    }
  },
});
