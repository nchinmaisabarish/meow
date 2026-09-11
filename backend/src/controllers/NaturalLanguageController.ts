import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { OpenAIHelper } from '../helpers/OpenAIHelper.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { Account } from '../entities/Account.js';
import { Card } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';
import { StatusCodes } from 'http-status-codes';

/**
 * Process natural language queries and route to appropriate operations
 */
const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userQuery = req.body.query;
    
    if (!userQuery || typeof userQuery !== 'string') {
      throw new InvalidRequestError('Query field is required and must be a string');
    }
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        error: 'Natural language processing is not configured',
        message: 'OPENAI_API_KEY environment variable is not set',
      });
    }
    
    // Parse the user's intent using OpenAI
    let intent;
    try {
      intent = await OpenAIHelper.parseQueryIntent(userQuery);
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to process query',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Route to appropriate operation based on intent
    let result;
    
    try {
      switch (intent.operation) {
        case 'LIST_ACCOUNTS':
          result = await EntityHelper.findByTeam(Account, req.jwt.team);
          break;
          
        case 'LIST_CARDS':
          result = await EntityHelper.findByTeam(Card, req.jwt.team);
          break;
          
        case 'LIST_LANES':
          result = await EntityHelper.findByTeam(Lane, req.jwt.team);
          break;
          
        case 'LIST_USERS':
          result = await EntityHelper.findByTeam(User, req.jwt.team);
          break;
          
        case 'GENERAL_INFO':
          result = {
            system: 'Meow Sales Pipeline Management',
            capabilities: [
              'Manage accounts and customer organizations',
              'Track sales opportunities (cards) through pipeline stages',
              'View sales forecasts and predictions',
              'Manage team members and pipeline stages',
            ],
            available_queries: [
              'Show me all accounts',
              'What deals are in the pipeline?',
              'How are we doing this quarter?',
              'Show me the sales stages',
              'Who is on my team?',
            ],
          };
          break;
          
        case 'GET_FORECAST_ACHIEVED':
        case 'GET_FORECAST_PREDICTED':
          // These would require date range parameters which we don't have from the simple query
          // Return a helpful message instead
          result = {
            message: 'Forecast queries require specific date ranges. Please use the /api/forecast endpoints directly with start and end dates.',
            hint: 'Try: GET /api/forecast/achieved?start=2024-01-01&end=2024-12-31',
          };
          break;
          
        default:
          result = {
            message: 'I understood your query but cannot perform that operation yet.',
            intent: intent,
          };
      }
      
      return res.json({
        query: userQuery,
        intent: {
          operation: intent.operation,
          entity: intent.entity,
          confidence: intent.confidence,
        },
        response: intent.natural_response,
        data: result,
      });
      
    } catch (operationError) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to execute operation',
        intent: intent,
        message: operationError instanceof Error ? operationError.message : 'Unknown error',
      });
    }
    
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
