import { Response, NextFunction } from 'express';
import { EventType } from '../entities/EventType.js';
import { InvalidUrlError } from '../errors/InvalidUrlError.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { ObjectId, Sort } from 'mongodb';
import { CardEvent, NewCardEvent } from '../entities/CardEvent.js';
import { validateAndFetchCard } from '../helpers/EntityFetchHelper.js';
import { cardLifecycleWorkflow } from '../workflow/CardLifecycleWorkflow.js';

const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.params.id) {
      throw new InvalidUrlError();
    }

    const query = {
      cardId: { $eq: new ObjectId(req.params.id) },
      teamId: { $eq: req.jwt.team._id },
      type: { $ne: EventType.ForecastCard },
    };

    const sort: Sort = {
      updatedAt: -1,
    };

    const events = await EntityHelper.findBy(CardEvent, query, sort);

    return res.json(events);
  } catch (error) {
    return next(error);
  }
};

const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const card = await validateAndFetchCard(req.params.id, req.jwt.user);

    let event = await EntityHelper.create(
      new NewCardEvent(card, req.jwt.user, EventType.CommentCreated, {
        text: req.body.text,
      }),
      CardEvent
    );

    return res.status(201).json(event);
  } catch (error) {
    return next(error);
  }
};

const logWorkflowStateChange = async (
  cardId: ObjectId,
  userId: ObjectId,
  teamId: ObjectId,
  fromState: string,
  toState: string,
  metadata?: Record<string, any>
): Promise<CardEvent | null> => {
  try {
    const card = await EntityHelper.findOneById(
      { collection: 'cards' } as any,
      cardId
    );

    if (!card) {
      return null;
    }

    const user = await EntityHelper.findOneById(
      { collection: 'users' } as any,
      userId
    );

    if (!user) {
      return null;
    }

    const eventData = {
      fromState,
      toState,
      transitionedAt: new Date(),
      ...metadata,
    };

    const newEvent = new NewCardEvent(
      card as any,
      user as any,
      EventType.CardUpdated,
      eventData
    );

    const event = await EntityHelper.create(newEvent, CardEvent);

    return event;
  } catch (error) {
    console.error('Failed to log workflow state change:', error);
    return null;
  }
};

export const CardEventController = {
  list,
  create,
  logWorkflowStateChange,
};
