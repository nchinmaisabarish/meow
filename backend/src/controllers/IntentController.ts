import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import {
  IntentRegistry,
  Intent,
  IntentNotFoundError,
  InvalidIntentParametersError,
  IntentExecutionError,
} from '../services/IntentResolver.js';
import { Account, NewAccount } from '../entities/Account.js';
import { Card, NewCard, CardStatus } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EventHelper } from '../helpers/EventHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';

/**
 * Intent handler: Create a new card
 */
async function createCardIntent(parameters: any, context: any): Promise<any> {
  const { name, amount, laneId, laneName } = parameters;
  const { user, team } = context;

  let lane: Lane | null = null;

  if (laneName) {
    const query = {
      teamId: team._id,
      name: laneName,
    };
    lane = await EntityHelper.findOneBy(Lane, query);
  }

  if (laneId) {
    lane = await EntityHelper.findOneById(Lane, laneId);
  }

  if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
    throw new EntityNotFoundError();
  }

  const card = new NewCard(user, lane, name, parseInt(amount));
  const createdCard = await EntityHelper.create(card, Card);

  EventHelper.get().emit('card', {
    user: user,
    latest: createdCard.toPlain(),
  });

  return {
    card: createdCard.toPlain(),
    message: 'Card created successfully',
  };
}

/**
 * Intent handler: Get account information
 */
async function getAccountIntent(parameters: any, context: any): Promise<any> {
  const { accountId } = parameters;
  const { user } = context;

  const account = await EntityHelper.findOneById(Account, accountId);

  if (!account || !EntityHelper.isEntityOwnedBy(account, user)) {
    throw new EntityNotFoundError();
  }

  return {
    account: account.toPlain(),
  };
}

/**
 * Intent handler: List all accounts
 */
async function listAccountsIntent(parameters: any, context: any): Promise<any> {
  const { team } = context;

  const accounts = await EntityHelper.findByTeam(Account, team);

  return {
    accounts: accounts.map((account: Account) => account.toPlain()),
    count: accounts.length,
  };
}

/**
 * Intent handler: Create a new account
 */
async function createAccountIntent(parameters: any, context: any): Promise<any> {
  const { name, attributes } = parameters;
  const { user, team } = context;

  const account = new NewAccount(team, name);

  if (attributes) {
    account.attributes = attributes;
  }

  const createdAccount = await EntityHelper.create(account, Account);

  EventHelper.get().emit('account', {
    user: user,
    latest: createdAccount.toPlain(),
  });

  return {
    account: createdAccount.toPlain(),
    message: 'Account created successfully',
  };
}

/**
 * Intent handler: List all cards
 */
async function listCardsIntent(parameters: any, context: any): Promise<any> {
  const { team } = context;

  const query: any = {
    teamId: { $eq: team._id },
    status: { $ne: CardStatus.Deleted },
  };

  const cards = await EntityHelper.findBy(Card, query);

  return {
    cards: cards.map((card: Card) => card.toPlain()),
    count: cards.length,
  };
}

/**
 * Intent handler: Placeholder for card workflow
 * This would integrate with LangGraph workflows from recommendation 2
 */
async function runCardWorkflowIntent(parameters: any, context: any): Promise<any> {
  const { cardId, workflowType } = parameters;
  const { user } = context;

  // Placeholder implementation - would integrate with actual workflow engine
  const card = await EntityHelper.findOneById(Card, cardId);

  if (!card || !EntityHelper.isEntityOwnedBy(card, user)) {
    throw new EntityNotFoundError();
  }

  return {
    workflowId: `workflow_${Date.now()}`,
    cardId: cardId,
    workflowType: workflowType || 'default',
    status: 'initiated',
    message: 'Card workflow initiated (placeholder - integrate with LangGraph)',
  };
}

/**
 * Initialize the intent registry with all available intents
 */
function initializeIntentRegistry(): IntentRegistry {
  const registry = new IntentRegistry();

  // Register create_card intent
  registry.registerIntent({
    name: 'create_card',
    type: 'tool',
    description: 'Create a new card in a lane',
    handler: createCardIntent,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        amount: { type: 'number' },
        laneId: { type: 'string' },
        laneName: { type: 'string' },
      },
      required: ['name', 'amount'],
      additionalProperties: false,
    },
  });

  // Register get_account intent
  registry.registerIntent({
    name: 'get_account',
    type: 'tool',
    description: 'Get account information by ID',
    handler: getAccountIntent,
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
      },
      required: ['accountId'],
      additionalProperties: false,
    },
  });

  // Register list_accounts intent
  registry.registerIntent({
    name: 'list_accounts',
    type: 'tool',
    description: 'List all accounts for the team',
    handler: listAccountsIntent,
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  });

  // Register create_account intent
  registry.registerIntent({
    name: 'create_account',
    type: 'tool',
    description: 'Create a new account',
    handler: createAccountIntent,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        attributes: { type: 'object' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  });

  // Register list_cards intent
  registry.registerIntent({
    name: 'list_cards',
    type: 'tool',
    description: 'List all active cards for the team',
    handler: listCardsIntent,
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  });

  // Register run_card_workflow intent (placeholder for LangGraph integration)
  registry.registerIntent({
    name: 'run_card_workflow',
    type: 'workflow',
    description: 'Execute a workflow for a card (integrates with LangGraph)',
    handler: runCardWorkflowIntent,
    schema: {
      type: 'object',
      properties: {
        cardId: { type: 'string' },
        workflowType: { type: 'string' },
      },
      required: ['cardId'],
      additionalProperties: false,
    },
  });

  return registry;
}

// Create a singleton instance of the intent registry
const intentRegistry = initializeIntentRegistry();

/**
 * POST /intent handler
 * Accepts { intent: string, parameters: object } and executes the intent
 */
const execute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { intent, parameters } = req.body;

    // Validate request body
    if (!intent || typeof intent !== 'string') {
      throw new InvalidIntentParametersError('Intent name is required and must be a string');
    }

    // Prepare context from authenticated request
    const context = {
      user: req.jwt.user,
      team: req.jwt.team,
    };

    // Resolve and execute the intent
    const result = await intentRegistry.resolveIntent(intent, parameters || {}, context);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /intent handler
 * Returns list of all available intents
 */
const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const intents = intentRegistry.getAllIntents();

    const intentList = intents.map((intent: Intent) => ({
      name: intent.name,
      type: intent.type,
      description: intent.description,
      schema: intent.schema,
    }));

    return res.status(200).json({
      intents: intentList,
      count: intentList.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const IntentController = {
  execute,
  list,
};

// Export the registry for testing purposes
export { intentRegistry };
