import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Lane, NewLane, Tags } from '../entities/Lane.js';
import { Board, NewBoard } from '../entities/Board.js';
import { Team } from '../entities/Team.js';
import { User } from '../entities/User.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { emitLaneEvent } from '../helpers/EventHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { ObjectId } from 'mongodb';

// Zod schema for creating a lane
const CreateLaneSchema = z.object({
  userId: z.string().describe('The ID of the user creating the lane'),
  teamId: z.string().describe('The ID of the team'),
  name: z.string().describe('The name of the lane (pipeline stage)'),
  index: z.number().describe('The position/order of the lane in the pipeline'),
  color: z.string().optional().describe('The color code for the lane'),
  inForecast: z.boolean().optional().describe('Whether this lane is included in forecast calculations'),
  tags: z.record(z.union([z.string(), z.boolean()])).optional().describe('Additional tags for the lane'),
});

// Zod schema for updating a lane
const UpdateLaneSchema = z.object({
  laneId: z.string().describe('The ID of the lane to update'),
  userId: z.string().describe('The ID of the user performing the update'),
  teamId: z.string().describe('The ID of the team'),
  name: z.string().optional().describe('The new name of the lane'),
  inForecast: z.boolean().optional().describe('Whether this lane should be included in forecast calculations'),
  tags: z.record(z.union([z.string(), z.boolean()])).optional().describe('Updated tags for the lane'),
});

// Zod schema for listing lanes
const ListLanesSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the lanes'),
  teamId: z.string().describe('The ID of the team'),
});

// Zod schema for getting lane statistics
const GetLaneStatisticsSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the statistics'),
  teamId: z.string().describe('The ID of the team'),
  filterUserId: z.string().optional().describe('Optional user ID to filter statistics by assigned user'),
  filterText: z.string().optional().describe('Optional text to filter cards by name'),
});

/**
 * Tool for creating a new lane
 */
export const createLaneTool = new DynamicStructuredTool({
  name: 'create_lane',
  description: 'Creates a new lane (pipeline stage) in the sales board. Lanes represent different stages in the sales process (e.g., "Lead", "Qualified", "Proposal", "Closed Won"). Cards move through lanes as deals progress.',
  schema: CreateLaneSchema,
  func: async (input: z.infer<typeof CreateLaneSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const team = await EntityHelper.findOneById(Team, input.teamId);
      if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
        throw new EntityNotFoundError();
      }

      let board = await EntityHelper.findOneByTeam(Board, team);

      // Create board if it doesn't exist (temporary migration logic)
      if (!board) {
        board = await EntityHelper.create(new NewBoard(team, 'default'), Board);
      }

      const tags: Tags = input.tags || {};
      const lane = new NewLane(
        team,
        board!,
        input.name,
        input.index,
        input.color || '',
        input.inForecast || false,
        tags
      );

      const created = await EntityHelper.create(lane, Lane);

      emitLaneEvent(created!._id);

      return JSON.stringify({
        success: true,
        lane: {
          _id: created!._id.toString(),
          teamId: created!.teamId.toString(),
          boardId: created!.boardId.toString(),
          name: created!.name,
          index: created!.index,
          inForecast: created!.inForecast,
          tags: created!.tags,
          color: created!.color,
          createdAt: created!.createdAt,
          updatedAt: created!.updatedAt,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for updating an existing lane
 */
export const updateLaneTool = new DynamicStructuredTool({
  name: 'update_lane',
  description: 'Updates an existing lane (pipeline stage) in the sales board. You can change the lane name, forecast inclusion, and tags. This affects how the stage appears and behaves in the pipeline.',
  schema: UpdateLaneSchema,
  func: async (input: z.infer<typeof UpdateLaneSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const lane = await EntityHelper.findOneById(Lane, input.laneId);
      if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
        throw new EntityNotFoundError();
      }

      if (input.name !== undefined) {
        lane.name = input.name;
      }

      if (input.inForecast !== undefined) {
        lane.inForecast = input.inForecast;
      }

      if (input.tags !== undefined) {
        lane.tags = input.tags;
      }

      const updated = await EntityHelper.update(lane);

      emitLaneEvent(updated._id);

      return JSON.stringify({
        success: true,
        lane: {
          _id: updated._id.toString(),
          teamId: updated.teamId.toString(),
          boardId: updated.boardId.toString(),
          name: updated.name,
          index: updated.index,
          inForecast: updated.inForecast,
          tags: updated.tags,
          color: updated.color,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for listing all lanes
 */
export const listLanesTool = new DynamicStructuredTool({
  name: 'list_lanes',
  description: 'Lists all lanes (pipeline stages) for a team. Returns all stages in the sales pipeline in order, showing their configuration and properties.',
  schema: ListLanesSchema,
  func: async (input: z.infer<typeof ListLanesSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const team = await EntityHelper.findOneById(Team, input.teamId);
      if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
        throw new EntityNotFoundError();
      }

      const lanes = await EntityHelper.findByTeam(Lane, team);

      return JSON.stringify({
        success: true,
        count: lanes.length,
        lanes: lanes.map((lane: Lane) => ({
          _id: lane._id.toString(),
          teamId: lane.teamId.toString(),
          boardId: lane.boardId.toString(),
          name: lane.name,
          index: lane.index,
          inForecast: lane.inForecast,
          tags: lane.tags,
          color: lane.color,
          createdAt: lane.createdAt,
          updatedAt: lane.updatedAt,
        })),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for getting lane statistics
 */
export const getLaneStatisticsTool = new DynamicStructuredTool({
  name: 'get_lane_statistics',
  description: 'Retrieves statistics for all lanes including card counts, average cycle times, and movement data. Useful for analyzing pipeline performance and identifying bottlenecks.',
  schema: GetLaneStatisticsSchema,
  func: async (input: z.infer<typeof GetLaneStatisticsSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const team = await EntityHelper.findOneById(Team, input.teamId);
      if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
        throw new EntityNotFoundError();
      }

      // Import the statistics functions from LaneStatisticsController
      const { CardStatus } = await import('../entities/Card.js');
      const { LaneType } = await import('../entities/Lane.js');
      const { DatabaseHelper } = await import('../helpers/DatabaseHelper.js');
      const { DateTime } = await import('luxon');

      const teamId = new ObjectId(input.teamId);
      const filterUserId = input.filterUserId ? new ObjectId(input.filterUserId) : undefined;
      const lanes = await EntityHelper.findByTeam(Lane, team);

      // Get active statistics
      const direct = DatabaseHelper.get();
      const collection = direct.collection('Cards');

      const match: any = {
        $match: {
          teamId: { $eq: teamId },
          status: { $ne: CardStatus.Deleted },
          laneId: { $in: lanes.map((lane: Lane) => lane._id) },
        },
      };

      if (filterUserId) {
        match.$match.userId = { $eq: filterUserId };
      }

      if (input.filterText) {
        match.$match.name = { $regex: RegExp(`${input.filterText}`, 'i') };
      }

      const group = {
        $group: {
          _id: '$laneId',
          count: { $sum: 1 },
          cycleTimeTotal: {
            $sum: {
              $divide: [{ $subtract: ['$closedAt', '$createdAt'] }, 1000 * 60 * 60],
            },
          },
          timeSinceCreationTotal: {
            $sum: {
              $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60],
            },
          },
          timeInLaneTotal: {
            $sum: {
              $divide: [{ $subtract: [new Date(), '$inLaneSince'] }, 1000 * 60 * 60],
            },
          },
        },
      };

      const project = {
        $project: {
          _id: 1,
          timeInLaneAvg: { $divide: ['$timeInLaneTotal', '$count'] },
          timeSinceCreationAvg: { $divide: ['$timeSinceCreationTotal', '$count'] },
          cycleTimeAvg: {
            $divide: ['$cycleTimeTotal', '$count'],
          },
          count: 1,
        },
      };

      const cursor = await collection.aggregate([match, group, project]);
      const statistics = await cursor.toArray();

      return JSON.stringify({
        success: true,
        statistics: statistics.map((stat: any) => ({
          laneId: stat._id.toString(),
          count: stat.count,
          timeInLaneAvg: stat.timeInLaneAvg,
          timeSinceCreationAvg: stat.timeSinceCreationAvg,
          cycleTimeAvg: stat.cycleTimeAvg,
        })),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});
