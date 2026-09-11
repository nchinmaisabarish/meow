import { Response, NextFunction } from 'express';
import { Lane, LaneRequest, NewLane } from '../entities/Lane.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { Board, NewBoard } from '../entities/Board.js';
import { validateAndFetchLane } from '../helpers/EntityFetchHelper.js';
import { emitLaneEvent } from '../helpers/EventHelper.js';
import { Team } from '../entities/Team.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';

const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const lanes = await EntityHelper.findByTeam(Lane, req.jwt.team);

    return res.json(lanes);
  } catch (error) {
    return next(error);
  }
};

const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const lane = await validateAndFetchLane(req.params.id, req.jwt.user);

    lane.inForecast = req.body.inForecast;
    lane.name = req.body.name;
    lane.tags = req.body.tags;

    const updated = await EntityHelper.update(lane);

    emitLaneEvent(lane._id);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

const updateAll = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const lanesInDatabase = await EntityHelper.findByTeam(Lane, req.jwt.team);

    const lanesToDelete = lanesInDatabase.filter((laneInDatabase: Lane) => {
      return !req.body.find((laneInRequest: LaneRequest) => {
        return laneInRequest._id === laneInDatabase._id!.toString();
      });
    });

    await Promise.all(
      lanesToDelete.map(async (lane: Lane) => {
        await EntityHelper.remove(Lane, lane);
      })
    );

    let board = await EntityHelper.findOneByTeam(Board, req.jwt.team);

    /* TODO temporary migration, if board does not exist just create it */
    if (!board) {
      board = await EntityHelper.create(new NewBoard(req.jwt.team, 'default'), Board);
    }

    const list: Lane[] = [];

    await Promise.all(
      req.body.map(async (item: LaneRequest) => {
        if (!item._id) {
          const lane = await EntityHelper.create(
            new NewLane(
              req.jwt.team,
              board!,
              item.name,
              item.index,
              item.color,
              item.inForecast,
              item.tags ?? {}
            ),
            Lane
          );

          list.push(lane!);
        } else {
          const lane = await validateAndFetchLane(item._id, req.jwt.user);

          if (lane) {
            lane.name = item.name;
            lane.color = item.color === undefined ? '' : item.color;
            lane.inForecast = item.inForecast;
            lane.index = item.index;
            lane.tags = item.tags ?? {};

            const updated = await EntityHelper.update(lane);

            emitLaneEvent(updated._id);

            list.push(updated);
          }
        }
      })
    );

    return res.json(list);
  } catch (error) {
    return next(error);
  }
};

/**
 * Creates a lane from tool input (for LangChain tool usage)
 * This method can be called programmatically without an HTTP request
 */
const createLaneFromTool = async (params: {
  teamId: string;
  boardId: string;
  name: string;
  index: number;
  color?: string;
  inForecast?: boolean;
  tags?: { [key: string]: string | boolean };
}): Promise<Lane> => {
  // Fetch and validate the team
  const team = await EntityHelper.findOneById(Team, params.teamId);
  if (!team) {
    throw new EntityNotFoundError();
  }

  // Fetch and validate the board
  const board = await EntityHelper.findOneById(Board, params.boardId);
  if (!board || board.teamId.toString() !== team._id.toString()) {
    throw new EntityNotFoundError();
  }

  // Create the new lane
  const lane = new NewLane(
    team,
    board,
    params.name,
    params.index,
    params.color ?? '',
    params.inForecast ?? false,
    params.tags ?? {}
  );

  // Save the lane to the database
  const latest = await EntityHelper.create(lane, Lane);

  if (!latest) {
    throw new Error('Failed to create lane');
  }

  // Emit events
  emitLaneEvent(latest._id);

  return latest;
};

/**
 * Updates a lane from tool input (for LangChain tool usage)
 * This method can be called programmatically without an HTTP request
 */
const updateLaneFromTool = async (params: {
  laneId: string;
  teamId: string;
  name?: string;
  color?: string;
  inForecast?: boolean;
  tags?: { [key: string]: string | boolean };
}): Promise<Lane> => {
  // Fetch and validate the team
  const team = await EntityHelper.findOneById(Team, params.teamId);
  if (!team) {
    throw new EntityNotFoundError();
  }

  // Fetch and validate the lane
  const lane = await EntityHelper.findOneById(Lane, params.laneId);
  if (!lane || lane.teamId.toString() !== team._id.toString()) {
    throw new EntityNotFoundError();
  }

  // Update lane properties
  if (params.name !== undefined) {
    lane.name = params.name;
  }
  if (params.color !== undefined) {
    lane.color = params.color;
  }
  if (params.inForecast !== undefined) {
    lane.inForecast = params.inForecast;
  }
  if (params.tags !== undefined) {
    lane.tags = params.tags;
  }

  // Save the updated lane
  const updated = await EntityHelper.update(lane);

  // Emit events
  emitLaneEvent(updated._id);

  return updated;
};

/**
 * Reorders lanes from tool input (for LangChain tool usage)
 * This method can be called programmatically without an HTTP request
 */
const reorderLanesFromTool = async (params: {
  teamId: string;
  lanes: Array<{ laneId: string; index: number }>;
}): Promise<Lane[]> => {
  // Fetch and validate the team
  const team = await EntityHelper.findOneById(Team, params.teamId);
  if (!team) {
    throw new EntityNotFoundError();
  }

  const updatedLanes: Lane[] = [];

  // Update each lane's index
  await Promise.all(
    params.lanes.map(async (laneUpdate: { laneId: string; index: number }) => {
      const lane = await EntityHelper.findOneById(Lane, laneUpdate.laneId);
      
      if (!lane || lane.teamId.toString() !== team._id.toString()) {
        throw new EntityNotFoundError();
      }

      lane.index = laneUpdate.index;
      const updated = await EntityHelper.update(lane);
      
      emitLaneEvent(updated._id);
      updatedLanes.push(updated);
    })
  );

  // Sort by index before returning
  return updatedLanes.sort((a: Lane, b: Lane) => a.index - b.index);
};

export const LaneController = {
  list,
  update,
  updateAll,
  createLaneFromTool,
  updateLaneFromTool,
  reorderLanesFromTool,
};
