import { Response, NextFunction } from 'express';
import { Account, NewAccount } from '../entities/Account.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { EventHelper } from '../helpers/EventHelper.js';
import { validateAndFetchAccount } from '../helpers/EntityFetchHelper.js';

const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const account = new NewAccount(req.jwt.team, req.body.name);

    if (req.body.attributes) {
      account.attributes = req.body.attributes;
    }

    const latest = await EntityHelper.create(account, Account);

    EventHelper.get().emit('account', { user: req.jwt.user, latest: latest.toPlain() });

    return res.status(201).json(latest);
  } catch (error) {
    return next(error);
  }
};

const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let account = await validateAndFetchAccount(req.params.id, req.jwt.user);

    const previous = account.toPlain();

    account.name = req.body.name;

    if (req.body.attributes) {
      account.attributes = req.body.attributes;
    }

    const latest = await EntityHelper.update(account);

    // TODO rename account to original
    EventHelper.get().emit('account', {
      user: req.jwt.user,
      latest: latest.toPlain(),
      previous: previous,
    });

    return res.json(latest);
  } catch (error) {
    return next(error);
  }
};

const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const accounts = await EntityHelper.findByTeam(Account, req.jwt.team);

    return res.json(accounts);
  } catch (error) {
    return next(error);
  }
};

const fetch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const account = await validateAndFetchAccount(req.params.id, req.jwt.user);

    return res.json(account);
  } catch (error) {
    return next(error);
  }
};

// Static methods for tool usage (without Express req/res)
const createAccountStatic = async (params: {
  userId: string;
  teamId: string;
  name: string;
  attributes?: { [key: string]: string | number | null };
}): Promise<Account> => {
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

  const account = new NewAccount(team, params.name);

  if (params.attributes) {
    account.attributes = params.attributes;
  }

  const latest = await EntityHelper.create(account, Account);

  EventHelper.get().emit('account', { user: user, latest: latest.toPlain() });

  return latest;
};

const updateAccountStatic = async (params: {
  accountId: string;
  userId: string;
  name: string;
  attributes?: { [key: string]: string | number | null };
}): Promise<Account> => {
  const user = await EntityHelper.findOneById(
    (await import('../entities/User.js')).User,
    params.userId
  );
  if (!user) {
    throw new Error('User not found');
  }

  let account = await validateAndFetchAccount(params.accountId, user);

  const previous = account.toPlain();

  account.name = params.name;

  if (params.attributes) {
    account.attributes = params.attributes;
  }

  const latest = await EntityHelper.update(account);

  EventHelper.get().emit('account', {
    user: user,
    latest: latest.toPlain(),
    previous: previous,
  });

  return latest;
};

const deleteAccountStatic = async (params: {
  accountId: string;
  userId: string;
}): Promise<Account> => {
  const user = await EntityHelper.findOneById(
    (await import('../entities/User.js')).User,
    params.userId
  );
  if (!user) {
    throw new Error('User not found');
  }

  const account = await validateAndFetchAccount(params.accountId, user);

  await EntityHelper.remove(Account, account);

  return account;
};

export const AccountController = {
  update,
  create,
  list,
  fetch,
  createAccountStatic,
  updateAccountStatic,
  deleteAccountStatic,
};
