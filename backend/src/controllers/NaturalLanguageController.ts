import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { getLLMService } from '../services/LLMService.js';
import { getConversationMemory, ConversationMemory } from '../services/ConversationMemory.js';
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
    const { query: userQuery, threadId: providedThreadId } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      throw new InvalidRequestBodyError('Query field is required and must be a string');
    }

    const llmService = getLLMService();

    if (!llmService.isConfigured()) {
      throw new InvalidConfigurationError('Natural language processing is not configured. Please contact your administrator.');
    }

    // Get or create thread ID for this conversation
    const userId = req.jwt.user._id?.toString();
    const threadId = providedThreadId || ConversationMemory.getUserThreadId(userId!, 'nl_query');

    // Get conversation memory
    const conversationMemory = getConversationMemory();

    // Retrieve recent conversation history for context
    const recentHistory = await conversationMemory.getRecentHistory(threadId, 5);
    
    // Build context summary if there's history
    let contextSummary = '';
    if (recentHistory.length > 0) {
      contextSummary = await conversationMemory.buildConversationSummary(threadId, 5);
    }

    // Process the query through the LLM (with context if available)
    const queryWithContext = contextSummary 
      ? `Previous conversation:\n${contextSummary}\n\nCurrent query: ${userQuery}`
      : userQuery;
    
    const llmResponse = await llmService.processQuery(queryWithContext);

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
      data: data,
      threadId: threadId,
      conversationContext: {
        checkpointCount: await conversationMemory.getCheckpointCount(threadId),
        hasHistory: recentHistory.length > 0,
      },
    });
  } catch (error: unknown) {
    return next(error);
  }
};

/**
 * Clear conversation history for a user
 */
const clearHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { threadId } = req.body;

    if (!threadId || typeof threadId !== 'string') {
      throw new InvalidRequestBodyError('threadId field is required and must be a string');
    }

    const conversationMemory = getConversationMemory();
    await conversationMemory.clearThread(threadId);

    return res.json({
      success: true,
      message: 'Conversation history cleared',
    });
  } catch (error: unknown) {
    return next(error);
  }
};

/**
 * Get conversation history for a user
 */
const getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const threadId = req.query.threadId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (!threadId) {
      throw new InvalidRequestBodyError('threadId query parameter is required');
    }

    const conversationMemory = getConversationMemory();
    const history = await conversationMemory.getRecentHistory(threadId, limit);

    return res.json({
      threadId,
      history,
      count: history.length,
    });
  } catch (error: unknown) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
  clearHistory,
  getHistory,
};
