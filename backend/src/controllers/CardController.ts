import { Response, NextFunction } from 'express';
import { DateTime } from 'luxon';
import { Card, CardStatus, NewCard } from '../entities/Card.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { InvalidCardPropertyError } from '../errors/InvalidCardPropertyError.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { RequestParser } from '../helpers/RequestParser.js';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { ObjectId } from 'mongodb';
import {
  validateAndFetchCard,
  validateAndFetchLane,
  validateAndFetchUser,
} from '../helpers/EntityFetchHelper.js';

const extractDateLimitFromRequest = (req: AuthenticatedRequest): DateTime | undefined => {
  const maxDaysAgo = req.query['max-days-ago']
    ? parseInt(req.query['max-days-ago'] as string)
    : undefined;

  if (maxDaysAgo && !isNaN(maxDaysAgo)) {
    return DateTime.utc().startOf('day').minus({ days: maxDaysAgo });
  }

  return undefined;
};

const extractDateFromRequest = (req: AuthenticatedRequest, name: string): DateTime | undefined => {
  const date = req.query[name] as string;
  if (date) {
    return DateTime.fromISO(date, { zone: 'utc' });
  }
  return undefined;
};

function parseCardStatus(value: unknown): CardStatus {
  switch (value) {
    case 'active':
      return CardStatus.Active;
    case 'deleted':
      return CardStatus.Deleted;
    default:
      throw new InvalidCardPropertyError(`Unsupported status value: ${value}`);
  }
}

const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const query: any = {
    teamId: { $eq: req.jwt.team._id! },
    status: { $ne: CardStatus.Deleted },
  };

  const limit = extractDateLimitFromRequest(req);
  const start = extractDateFromRequest(req, 'start');
  const end = extractDateFromRequest(req, 'end');

  if (start && end) {
    query.closedAt = { $gte: start.toJSDate(), $lte: end.endOf('day').toJSDate() };
  }

  if (limit) {
    query.$or = [{ closedAt: { $exists: false } }, { closedAt: { $gte: limit.toJSDate() } }];
  }

  try {
    const cards = await EntityHelper.findBy(Card, query);

    return res.json(cards);
  } catch (error) {
    return next(error);
  }
};

const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let lane: Lane | null = null;

    const { body } = req;

    if (body.laneName) {
      const query = {
        teamId: req.jwt.team._id,
        name: body.laneName,
      };

      lane = await EntityHelper.findOneBy(Lane, query);
    }

    if (body.laneId) {
      lane = await EntityHelper.findOneById(Lane, body.laneId);
    }

    if (!lane || !EntityHelper.isEntityOwnedBy(lane, req.jwt.user)) {
      throw new EntityNotFoundError();
    }

    const card = new NewCard(req.jwt.user, lane, body.name, parseInt(body.amount));

    if (body.attributes) {
      card.attributes = body.attributes;
    }

    if (body.closedAt && RequestParser.isValidDateTimeString(body.closedAt)) {
      card.closedAt = RequestParser.toJsDate(body.closedAt);
    }

    if (body.nextFollowUpAt && RequestParser.isValidDateTimeString(body.nextFollowUpAt)) {
      card.nextFollowUpAt = RequestParser.toJsDate(body.nextFollowUpAt);
    }

    const latest = await EntityHelper.create(card, Card);

    emitCardEvent(req.jwt.user, latest!.toPlain());
    emitLaneEvent(card.laneId, card.userId);
    emitBoardEvent(lane.boardId, card.userId);

    return res.status(201).json(latest);
  } catch (error) {
    return next(error);
  }
};

const get = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const card = await validateAndFetchCard(req.params.id, req.jwt.user);

    return res.json(card);
  } catch (error) {
    return next(error);
  }
};

const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const card = await validateAndFetchCard(req.params.id, req.jwt.user);

    const previous = card.toPlain();

    const { body } = req;

    card.name = body.name;

    let previousUserId = undefined;

    if (body.userId && card.userId.toString() !== body.userId.toString()) {
      const user = await validateAndFetchUser(body.userId, req.jwt.user);

      previousUserId = card.userId;

      card.userId = user._id!;
    }

    if (body.attributes) {
      card.attributes = body.attributes;
    }

    let previousAmount = undefined;

    if (card.amount !== parseInt(body.amount)) {
      previousAmount = card.amount;

      card.amount = parseInt(body.amount);
    }

    if (body.status) {
      card.status = parseCardStatus(req.body.status);
    }

    if (body.closedAt && !RequestParser.isEqualDates(body.closedAt, card.closedAt)) {
      const closedAt = RequestParser.toJsDate(body.closedAt);

      card.closedAt = closedAt;
    }

    if (
      body.nextFollowUpAt &&
      !RequestParser.isEqualDates(body.nextFollowUpAt, card.nextFollowUpAt)
    ) {
      const nextFollowUpAt = RequestParser.toJsDate(body.nextFollowUpAt);

      card.nextFollowUpAt = nextFollowUpAt;
    }

    let previousLaneId: ObjectId | undefined = undefined;

    if (body.laneId) {
      const lane = await validateAndFetchLane(body.laneId, req.jwt.user);

      if (body.laneId.toString() !== card.laneId.toString()) {
        previousLaneId = card.laneId;

        card.inLaneSince = new Date();
      }

      card.laneId = lane._id!;

      if (lane.tags?.type && lane.tags.type !== LaneType.Normal) {
        const closedAt = DateTime.utc().startOf('day');

        card.closedAt = closedAt.toJSDate();
      }
    }

    const latest = await EntityHelper.update(card);

    /* emit events */

    /* if lane has hanged emit events for the previous and current lane */
    if (previousLaneId) {
      emitLaneEvent(previousLaneId, card.userId);
      emitLaneEvent(card.laneId, card.userId);
    }

    /* if card has a changed amount update the lane and user */
    if (previousAmount) {
      emitLaneEvent(card.laneId, card.userId);
    }

    const lane = await EntityHelper.findOneById(Lane, card.laneId);

    /* if card assignment has changed update lane and both users */
    if (previousUserId) {
      emitLaneEvent(card.laneId, previousUserId);
      emitLaneEvent(card.laneId, card.userId);

      emitBoardEvent(lane!.boardId, previousUserId);
    }

    emitCardEvent(req.jwt.user, latest.toPlain(), previous);
    emitBoardEvent(lane!.boardId, card.userId);

    return res.json(latest);
  } catch (error) {
    return next(error);
  }
};

/**
 * Creates a card from tool input (for LangChain tool usage)
 * This method can be called programmatically without an HTTP request
 */
const createCardFromTool = async (params: {
  userId: string;
  laneId: string;
  name: string;
  amount: number;
  attributes?: { [key: string]: string | number | null };
  closedAt?: string;
  nextFollowUpAt?: string;
}): Promise<Card> => {
  // Fetch and validate the user
  const user = await EntityHelper.findOneById(User, params.userId);
  if (!user) {
    throw new EntityNotFoundError();
  }

  // Fetch and validate the lane
  const lane = await EntityHelper.findOneById(Lane, params.laneId);
  if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
    throw new EntityNotFoundError();
  }

  // Create the new card
  const card = new NewCard(user, lane, params.name, params.amount);

  // Set optional attributes
  if (params.attributes) {
    card.attributes = params.attributes;
  }

  if (params.closedAt && RequestParser.isValidDateTimeString(params.closedAt)) {
    card.closedAt = RequestParser.toJsDate(params.closedAt);
  }

  if (params.nextFollowUpAt && RequestParser.isValidDateTimeString(params.nextFollowUpAt)) {
    card.nextFollowUpAt = RequestParser.toJsDate(params.nextFollowUpAt);
  }

  // Save the card to the database
  const latest = await EntityHelper.create(card, Card);

  if (!latest) {
    throw new Error('Failed to create card');
  }

  // Emit events
  emitCardEvent(user, latest.toPlain());
  emitLaneEvent(card.laneId, card.userId);
  emitBoardEvent(lane.boardId, card.userId);

  return latest;
};

export const CardController = {
  list,
  get,
  create,
  update,
  createCardFromTool,
};
