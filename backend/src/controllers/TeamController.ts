import { Response, NextFunction } from 'express';
import { CurrencyCode } from '../entities/Team.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { validateAndFetchTeam } from '../helpers/EntityFetchHelper.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';

const parseCurrencyCode = (value: string): CurrencyCode => {
  if (value in CurrencyCode) {
    return value as CurrencyCode;
  }
  throw new InvalidRequestBodyError('invalid currency code');
};

const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const team = await validateAndFetchTeam(req.params.id, req.jwt.user);

    team.currency = parseCurrencyCode(req.body.currency);

    const updated = await EntityHelper.update(team);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

const updateIntegration = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const team = await validateAndFetchTeam(req.params.id, req.jwt.user);

    const integrations = team.integrations ?? [];

    const updatedIntegrations = integrations.filter(
      (integration) => integration.key !== req.body.key
    );

    updatedIntegrations.push(req.body);

    team.integrations = updatedIntegrations;

    const updated = await EntityHelper.update(team);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

const allowTeamRegistration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let team = await validateAndFetchTeam(req.params.id, req.jwt.user);

    if (team.isFirstTeam !== true) {
      throw new InvalidRequestError();
    }

    let flag = await EntityHelper.findOrCreateGlobalFlagByName('allow-team-registration');

    flag.value = req.body.allowTeamRegistration === true;

    flag = await EntityHelper.update(flag);

    delete team.isFirstTeam;

    team = await EntityHelper.update(team);

    return res.json(team);
  } catch (error) {
    return next(error);
  }
};

const get = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const team = await validateAndFetchTeam(req.params.id, req.jwt.user);

    return res.json(team);
  } catch (error) {
    return next(error);
  }
};

// Static methods for tool usage (without Express req/res)
const createTeamStatic = async (params: {
  name: string;
  currency: string;
  isFirstTeam?: boolean;
}): Promise<import('../entities/Team.js').Team> => {
  const { Team, NewTeam } = await import('../entities/Team.js');

  const currencyCode = parseCurrencyCode(params.currency);

  const team = new NewTeam(params.name, currencyCode, params.isFirstTeam);

  const created = await EntityHelper.create(team, Team);

  return created!;
};

const updateTeamStatic = async (params: {
  teamId: string;
  userId: string;
  currency: string;
}): Promise<import('../entities/Team.js').Team> => {
  const user = await EntityHelper.findOneById(
    (await import('../entities/User.js')).User,
    params.userId
  );
  if (!user) {
    throw new Error('User not found');
  }

  const team = await validateAndFetchTeam(params.teamId, user);

  team.currency = parseCurrencyCode(params.currency);

  const updated = await EntityHelper.update(team);

  return updated;
};

const deleteTeamStatic = async (params: {
  teamId: string;
  userId: string;
}): Promise<import('../entities/Team.js').Team> => {
  const { Team } = await import('../entities/Team.js');
  const user = await EntityHelper.findOneById(
    (await import('../entities/User.js')).User,
    params.userId
  );
  if (!user) {
    throw new Error('User not found');
  }

  const team = await validateAndFetchTeam(params.teamId, user);

  await EntityHelper.remove(Team, team);

  return team;
};

const getTeamStatic = async (params: {
  teamId: string;
  userId: string;
}): Promise<import('../entities/Team.js').Team> => {
  const user = await EntityHelper.findOneById(
    (await import('../entities/User.js')).User,
    params.userId
  );
  if (!user) {
    throw new Error('User not found');
  }

  const team = await validateAndFetchTeam(params.teamId, user);

  return team;
};

export const TeamController = {
  update,
  allowTeamRegistration,
  updateIntegration,
  get,
  createTeamStatic,
  updateTeamStatic,
  deleteTeamStatic,
  getTeamStatic,
};
