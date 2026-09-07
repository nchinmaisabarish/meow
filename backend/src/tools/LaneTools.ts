import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { LaneController } from '../controllers/LaneController.js';
import { LaneStatisticsController } from '../controllers/LaneStatisticsController.js';

/**
 * Tool for creating a new lane in the sales pipeline board.
 * Creates a lane with the specified name, index, color, and configuration.
 */
export const createLaneTool = new DynamicStructuredTool({
  name: 'create_lane',
  description:
    'Create a new lane (pipeline stage) in the sales board. A lane represents a stage in the sales pipeline where cards (opportunities) can be placed. Lanes are ordered by index and can be configured to be included in forecasts. Returns the created lane with its ID.',
  schema: z.object({
    userId: z.string().describe('The ID of the user creating the lane'),
    teamId: z.string().describe('The ID of the team the lane belongs to'),
    boardId: z.string().describe('The ID of the board where the lane will be placed'),
    name: z.string().describe('The name/title of the lane (e.g., "Prospecting", "Negotiation")'),
    index: z.number().describe('The position/order of the lane in the board (0-based)'),
    color: z
      .string()
      .optional()
      .describe('Optional color code for the lane (e.g., "#FF5733")'),
    inForecast: z
      .boolean()
      .optional()
      .describe('Whether cards in this lane should be included in forecast calculations'),
    tags: z
      .record(z.union([z.string(), z.boolean()]))
      .optional()
      .describe('Optional tags/metadata for the lane (e.g., {"type": "normal"})'),
  }),
  func: async (input: {
    userId: string;
    teamId: string;
    boardId: string;
    name: string;
    index: number;
    color?: string;
    inForecast?: boolean;
    tags?: { [key: string]: string | boolean };
  }) => {
    try {
      const lane = await LaneController.createLaneStatic(input);
      return JSON.stringify({
        success: true,
        lane: {
          _id: lane._id.toString(),
          teamId: lane.teamId.toString(),
          boardId: lane.boardId.toString(),
          name: lane.name,
          index: lane.index,
          color: lane.color,
          inForecast: lane.inForecast,
          tags: lane.tags,
          createdAt: lane.createdAt,
          updatedAt: lane.updatedAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return JSON.stringify({
        success: false,
        error: errorMessage,
      });
    }
  },
});

/**
 * Tool for retrieving a lane by its ID.
 * Fetches the full details of a specific lane.
 */
export const getLaneTool = new DynamicStructuredTool({
  name: 'get_lane',
  description:
    'Retrieve a lane (pipeline stage) by its ID. Returns the full details of the lane including name, index, color, forecast settings, and tags. Validates that the user has access to the lane.',
  schema: z.object({
    laneId: z.string().describe('The ID of the lane to retrieve'),
    userId: z.string().describe('The ID of the user requesting the lane'),
  }),
  func: async (input: { laneId: string; userId: string }) => {
    try {
      const lane = await LaneController.getLaneStatic(input);
      return JSON.stringify({
        success: true,
        lane: {
          _id: lane._id.toString(),
          teamId: lane.teamId.toString(),
          boardId: lane.boardId.toString(),
          name: lane.name,
          index: lane.index,
          color: lane.color,
          inForecast: lane.inForecast,
          tags: lane.tags,
          createdAt: lane.createdAt,
          updatedAt: lane.updatedAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return JSON.stringify({
        success: false,
        error: errorMessage,
      });
    }
  },
});

/**
 * Tool for updating an existing lane.
 * Updates lane properties such as name, index, color, forecast settings, and tags.
 */
export const updateLaneTool = new DynamicStructuredTool({
  name: 'update_lane',
  description:
    'Update an existing lane (pipeline stage) in the sales board. Can update the name, index (position), color, forecast inclusion, and tags. Returns the updated lane.',
  schema: z.object({
    laneId: z.string().describe('The ID of the lane to update'),
    userId: z.string().describe('The ID of the user performing the update'),
    name: z.string().describe('The updated name/title of the lane'),
    inForecast: z
      .boolean()
      .describe('Whether cards in this lane should be included in forecast calculations'),
    tags: z
      .record(z.union([z.string(), z.boolean()]))
      .optional()
      .describe('Optional: Updated tags/metadata for the lane'),
  }),
  func: async (input: {
    laneId: string;
    userId: string;
    name: string;
    inForecast: boolean;
    tags?: { [key: string]: string | boolean };
  }) => {
    try {
      const lane = await LaneController.updateLaneStatic(input);
      return JSON.stringify({
        success: true,
        lane: {
          _id: lane._id.toString(),
          teamId: lane.teamId.toString(),
          boardId: lane.boardId.toString(),
          name: lane.name,
          index: lane.index,
          color: lane.color,
          inForecast: lane.inForecast,
          tags: lane.tags,
          createdAt: lane.createdAt,
          updatedAt: lane.updatedAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return JSON.stringify({
        success: false,
        error: errorMessage,
      });
    }
  },
});

/**
 * Tool for deleting a lane.
 * Removes a lane from the board (hard delete).
 */
export const deleteLaneTool = new DynamicStructuredTool({
  name: 'delete_lane',
  description:
    'Delete a lane (pipeline stage) from the sales board. This performs a hard delete and removes the lane permanently. Note: This may affect cards that are currently in this lane. Returns the deleted lane.',
  schema: z.object({
    laneId: z.string().describe('The ID of the lane to delete'),
    userId: z.string().describe('The ID of the user performing the deletion'),
  }),
  func: async (input: { laneId: string; userId: string }) => {
    try {
      const lane = await LaneController.deleteLaneStatic(input);
      return JSON.stringify({
        success: true,
        lane: {
          _id: lane._id.toString(),
          teamId: lane.teamId.toString(),
          boardId: lane.boardId.toString(),
          name: lane.name,
          index: lane.index,
          color: lane.color,
          inForecast: lane.inForecast,
          tags: lane.tags,
          createdAt: lane.createdAt,
          updatedAt: lane.updatedAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return JSON.stringify({
        success: false,
        error: errorMessage,
      });
    }
  },
});

/**
 * Tool for retrieving lane statistics.
 * Fetches aggregated statistics for lanes including card counts, cycle times, and movement data.
 */
export const getLaneStatisticsTool = new DynamicStructuredTool({
  name: 'get_lane_statistics',
  description:
    'Retrieve statistics for lanes in the sales pipeline. Returns aggregated data including active card counts, won/lost movement statistics, average cycle times, and time in lane metrics. Can be filtered by user and text search.',
  schema: z.object({
    teamId: z.string().describe('The ID of the team to get statistics for'),
    userId: z
      .string()
      .optional()
      .describe('Optional: Filter statistics to cards owned by this user'),
    filter: z
      .string()
      .optional()
      .describe(
        'Optional: Comma-separated filter modes (e.g., "owned-by-me,require-update,recently-updated")'
      ),
    text: z.string().optional().describe('Optional: Text search filter for card/lane names'),
  }),
  func: async (input: {
    teamId: string;
    userId?: string;
    filter?: string;
    text?: string;
  }) => {
    try {
      const statistics = await LaneStatisticsController.getLaneStatisticsStatic(input);
      return JSON.stringify({
        success: true,
        statistics,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return JSON.stringify({
        success: false,
        error: errorMessage,
      });
    }
  },
});
