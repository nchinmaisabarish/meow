import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { EntityHelper } from './EntityHelper.js';
import { Card } from '../entities/Card.js';
import { Account } from '../entities/Account.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { ForecastService } from '../services/ForecastService.js';
import { LaneType } from '../entities/Lane.js';
import { DateTime } from 'luxon';
import { ApplicationError } from '../errors/ApplicationError.js';
import { StatusCodes } from 'http-status-codes';
import { DatabaseHelper } from './DatabaseHelper.js';
import { IntentWorkflow } from '../workflows/IntentWorkflow.js';

class UnknownIntentError extends ApplicationError {
  constructor(intent: string) {
    super('UnknownIntentError', StatusCodes.BAD_REQUEST, `Unknown intent: ${intent}`);
  }
}

class IntentRoutingError extends ApplicationError {
  constructor(description?: string) {
    super('IntentRoutingError', StatusCodes.BAD_REQUEST, description);
  }
}

/**
 * Routes parsed natural language intents to appropriate controller methods.
 * This class now uses the IntentWorkflow system for semantic intent dispatch
 * instead of hardcoded switch statements, while maintaining backward compatibility
 * for direct intent routing.
 */
export class IntentRouter {
  /**
   * Route an intent using the workflow system
   * This is the preferred method for intent routing
   */
  static async routeWithWorkflow(
    userRequest: string,
    req: AuthenticatedRequest
  ): Promise<unknown> {
    const workflow = new IntentWorkflow();
    const result = await workflow.invoke({
      userRequest,
      user: req.jwt.user,
      team: req.jwt.team,
    });

    if (!result.success) {
      throw new IntentRoutingError(result.error || 'Failed to route intent');
    }

    return result.result;
  }

  /**
   * Legacy method for direct intent routing
   * Maintained for backward compatibility
   * @deprecated Use routeWithWorkflow instead for semantic intent dispatch
   */
  static async route(
    intent: string,
    parameters: Record<string, unknown>,
    req: AuthenticatedRequest
  ): Promise<unknown> {
    switch (intent) {
      case 'list_cards':
        return await IntentRouter.listCards(req);

      case 'list_accounts':
        return await IntentRouter.listAccounts(req);

      case 'list_lanes':
        return await IntentRouter.listLanes(req);

      case 'list_users':
        return await IntentRouter.listUsers(req);

      case 'get_predicted_forecast':
        return await IntentRouter.getPredictedForecast(req);

      case 'get_achieved_forecast':
        return await IntentRouter.getAchievedForecast(req);

      case 'list_activities':
        return await IntentRouter.listActivities(req);

      default:
        throw new UnknownIntentError(intent);
    }
  }

  private static async listCards(req: AuthenticatedRequest): Promise<unknown> {
    const cards = await EntityHelper.findByTeam(Card, req.jwt.team);
    return cards;
  }

  private static async listAccounts(req: AuthenticatedRequest): Promise<unknown> {
    const accounts = await EntityHelper.findByTeam(Account, req.jwt.team);
    return accounts;
  }

  private static async listLanes(req: AuthenticatedRequest): Promise<unknown> {
    const lanes = await EntityHelper.findByTeam(Lane, req.jwt.team);
    return lanes;
  }

  private static async listUsers(req: AuthenticatedRequest): Promise<unknown> {
    const users = await EntityHelper.findByTeam(User, req.jwt.team);
    return users;
  }

  private static async getPredictedForecast(req: AuthenticatedRequest): Promise<unknown> {
    const forecastService = new ForecastService();
    
    // Default to current month
    const start = DateTime.utc().startOf('month').toJSDate();
    const end = DateTime.utc().endOf('month').toJSDate();

    const forecast = await forecastService.getByLaneType(
      LaneType.Normal,
      req.jwt.team._id,
      start,
      end,
      undefined
    );

    return forecast;
  }

  private static async getAchievedForecast(req: AuthenticatedRequest): Promise<unknown> {
    const forecastService = new ForecastService();
    
    // Default to current month
    const start = DateTime.utc().startOf('month').toJSDate();
    const end = DateTime.utc().endOf('month').toJSDate();

    const forecast = await forecastService.getByLaneType(
      LaneType.ClosedWon,
      req.jwt.team._id,
      start,
      end,
      undefined
    );

    return forecast;
  }

  private static async listActivities(req: AuthenticatedRequest): Promise<unknown> {
    // Get recent activities from the database
    const collection = DatabaseHelper.getCollection('Activities');
    
    const activities = await collection
      .find({ teamId: req.jwt.team._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return activities;
  }
}
