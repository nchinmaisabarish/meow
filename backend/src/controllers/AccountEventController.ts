import { Response, NextFunction } from 'express';
import { EventType } from '../entities/EventType.js';
import { InvalidUrlError } from '../errors/InvalidUrlError.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { ObjectId, Sort } from 'mongodb';
import { AccountEvent, NewAccountEvent } from '../entities/AccountEvent.js';
import { validateAndFetchAccount } from '../helpers/EntityFetchHelper.js';

const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.params.id) {
      throw new InvalidUrlError();
    }

    const query = {
      accountId: { $eq: new ObjectId(req.params.id) },
      teamId: { $eq: req.jwt.team._id },
    };

    const sort: Sort = {
      updatedAt: -1,
    };

    const events = await EntityHelper.findBy(AccountEvent, query, sort);
    return res.json(events);
  } catch (error) {
    return next(error);
  }
};

const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const account = await validateAndFetchAccount(req.params.id, req.jwt.user);

    let event = new NewAccountEvent(account, req.jwt.user, EventType.CommentCreated, {
      text: req.body.text,
    });

    const updated = await EntityHelper.create(event, AccountEvent);

    return res.status(201).json(updated);
  } catch (error) {
    return next(error);
  }
};

// Static method for tool usage (without Express req/res)
const getAccountEventsStatic = async (params: {
  accountId: string;
  userId: string;
  teamId: string;
}): Promise<AccountEvent[]> => {
  const user = await EntityHelper.findOneById(
    (await import('../entities/User.js')).User,
    params.userId
  );
  if (!user) {
    throw new Error('User not found');
  }

  const team = await EntityHelper.findOneById(
    (await import('../entities/Team.js')).Team,
    params.teamId
  );
  if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
    throw new Error('Team not found or access denied');
  }

  const query = {
    accountId: { $eq: new ObjectId(params.accountId) },
    teamId: { $eq: new ObjectId(params.teamId) },
  };

  const sort: Sort = {
    updatedAt: -1,
  };

  const events = await EntityHelper.findBy(AccountEvent, query, sort);
  return events;
};

export const AccountEventController = {
  list,
  create,
  getAccountEventsStatic,
};
