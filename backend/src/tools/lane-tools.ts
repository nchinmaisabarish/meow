import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Lane, NewLane } from '../entities/Lane.js';
import { Board } from '../entities/Board.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { validateAndFetchLane } from '../helpers/EntityFetchHelper.js';
import { emitLaneEvent } from '../helpers/EventHelper.js';

/**
 * Schema for creating a new lane
 */
const createLaneSchema = z.object({
  name: z.string().describe('The name of the lane'),
  boardId: z.string().describe('The ID of the board where the lane should be created'),
  position: z.number().describe('The position/index of the lane in the board'),
  userId: z.string().describe('The ID of the authenticated user'),
  teamId: z.string().describe('The ID of the team the lane belongs to'),
  color: z.string().optional().describe('Optional color for the lane'),
  inForecast: z.boolean().default(false).describe('Whether the lane is included in forecast calculations'),
});

/**
 * Schema for listing lanes
 */
const listLanesSchema = z.object({
  boardId: z.string().optional().describe('Optional board ID to filter lanes by board'),
  userId: z.string().describe('The ID of the authenticated user'),
  teamId: z.string().describe('The ID of the team the user belongs to'),
});

/**
 * Schema for updating lane order/position
 */
const updateLaneOrderSchema = z.object({
  laneId: z.string().describe('The ID of the lane to update'),
  newPosition: z.number().describe('The new position/index for the lane'),
  userId: z.string().describe('The ID of the authenticated user'),
  teamId: z.string().describe('The ID of the team the user belongs to'),
});

/**
 * Tool for creating a new lane
 */
export const createLaneTool = new DynamicStructuredTool({
  name: 'create_lane',
  description: 'Creates a new lane in the specified board. Use this to add new stages or columns to the sales pipeline or project board.',
  schema: createLaneSchema,
  func: async (input: z.infer<typeof createLaneSchema>): Promise<string> => {
    try {
      // Fetch the user
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch the board
      const board = await EntityHelper.findOneById(Board, input.boardId);
      if (!board || !EntityHelper.isEntityOwnedBy(board, user)) {
        throw new EntityNotFoundError();
      }

      // Fetch the team
      const teamResult = await EntityHelper.findOneById(Team, input.teamId);
      if (!teamResult) {
        throw new EntityNotFoundError();
      }
      const team = teamResult as Team;

      // Create the lane
      const lane = new NewLane(
        team,
        board,
        input.name,
        input.position,
        input.color || '',
        input.inForecast,
        {}
      );

      const createdLane = await EntityHelper.create(lane, Lane);

      // Emit event
      emitLaneEvent(createdLane!._id);

      return JSON.stringify({
        success: true,
        laneId: createdLane!._id.toString(),
        message: `Lane "${input.name}" created successfully in board ${board.name}`,
        lane: {
          _id: createdLane!._id.toString(),
          name: createdLane!.name,
          index: createdLane!.index,
          boardId: createdLane!.boardId.toString(),
          teamId: createdLane!.teamId.toString(),
          inForecast: createdLane!.inForecast,
          color: createdLane!.color,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lane',
      });
    }
  },
});

/**
 * Tool for listing lanes
 */
export const listLanesTool = new DynamicStructuredTool({
  name: 'list_lanes',
  description: 'Lists all lanes for the team, optionally filtered by board. Use this to view all stages/columns in the pipeline.',
  schema: listLanesSchema,
  func: async (input: z.infer<typeof listLanesSchema>): Promise<string> => {
    try {
      // Fetch the user
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch the team
      const teamResult = await EntityHelper.findOneById(Team, input.teamId);
      if (!teamResult) {
        throw new EntityNotFoundError();
      }
      const team = teamResult as Team;

      // Fetch lanes by team
      const lanes = await EntityHelper.findByTeam(Lane, team);

      // Filter by board if specified
      let filteredLanes = lanes;
      if (input.boardId) {
        filteredLanes = lanes.filter((lane: Lane) => lane.boardId.toString() === input.boardId);
      }

      // Sort by index
      filteredLanes.sort((a: Lane, b: Lane) => a.index - b.index);

      const lanesData = filteredLanes.map((lane: Lane) => ({
        _id: lane._id.toString(),
        name: lane.name,
        index: lane.index,
        boardId: lane.boardId.toString(),
        teamId: lane.teamId.toString(),
        inForecast: lane.inForecast,
        color: lane.color,
        tags: lane.tags,
      }));

      return JSON.stringify({
        success: true,
        count: lanesData.length,
        lanes: lanesData,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list lanes',
      });
    }
  },
});

/**
 * Tool for updating lane order/position
 */
export const updateLaneOrderTool = new DynamicStructuredTool({
  name: 'update_lane_order',
  description: 'Updates the position/order of a lane in the board. Use this to reorder stages in the pipeline.',
  schema: updateLaneOrderSchema,
  func: async (input: z.infer<typeof updateLaneOrderSchema>): Promise<string> => {
    try {
      // Fetch the user
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch and validate the lane
      const lane = await validateAndFetchLane(input.laneId, user);

      // Update the lane position
      lane.index = input.newPosition;

      const updatedLane = await EntityHelper.update(lane);

      // Emit event
      emitLaneEvent(updatedLane._id);

      return JSON.stringify({
        success: true,
        message: `Lane "${lane.name}" position updated to ${input.newPosition}`,
        lane: {
          _id: updatedLane._id.toString(),
          name: updatedLane.name,
          index: updatedLane.index,
          boardId: updatedLane.boardId.toString(),
          teamId: updatedLane.teamId.toString(),
          inForecast: updatedLane.inForecast,
          color: updatedLane.color,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lane order',
      });
    }
  },
});

/**
 * Registry of all lane-related tools
 */
export const laneTools = {
  createLane: createLaneTool,
  listLanes: listLanesTool,
  updateLaneOrder: updateLaneOrderTool,
};

/**
 * Array of all lane tools for easy iteration
 */
export const laneToolsArray = [createLaneTool, listLanesTool, updateLaneOrderTool];
