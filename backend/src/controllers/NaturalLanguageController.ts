import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { getLLMService } from '../services/LLMService.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';
import { InvalidConfigurationError } from '../errors/InvalidConfigurationError.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { Card, NewCard } from '../entities/Card.js';
import { Account, NewAccount } from '../entities/Account.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query: userQuery } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      throw new InvalidRequestBodyError('Query field is required and must be a string');
    }

    const llmService = getLLMService();

    if (!llmService.isConfigured()) {
      throw new InvalidConfigurationError('Natural language processing is not configured. Please contact your administrator.');
    }

    // Process the query through the LLM
    const llmResponse = await llmService.processQuery(userQuery);

    // Execute the intent based on the LLM response
    let data: any = null;

    switch (llmResponse.intent) {
      case 'list_cards':
        data = await EntityHelper.findByTeam(Card, req.jwt.team);
        break;

      case 'list_accounts':
        data = await EntityHelper.findByTeam(Account, req.jwt.team);
        break;

      case 'list_lanes':
        data = await EntityHelper.findByTeam(Lane, req.jwt.team);
        break;

      case 'list_users':
        data = await EntityHelper.findByTeam(User, req.jwt.team);
        break;

      case 'get_team':
        data = req.jwt.team;
        break;

      case 'create_account':
        if (llmResponse.parameters.name) {
          const newAccount = new NewAccount(req.jwt.team, llmResponse.parameters.name);
          if (llmResponse.parameters.attributes) {
            newAccount.attributes = llmResponse.parameters.attributes;
          }
          data = await EntityHelper.create(newAccount, Account);
        }
        break;

      case 'clarify':
        // LLM needs more information
        break;

      default:
        // For unimplemented intents, just return the LLM response
        break;
    }

    return res.json({
      intent: llmResponse.intent,
      entity: llmResponse.entity,
      response: llmResponse.response,
      data: data
    });
  } catch (error: unknown) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query
};
