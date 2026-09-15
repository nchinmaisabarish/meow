import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { NaturalLanguageService } from '../services/NaturalLanguageService.js';
import { CardController } from './CardController.js';
import { AccountController } from './AccountController.js';
import { LaneController } from './LaneController.js';
import { UserController } from './UserController.js';
import { ForecastController } from './ForecastController.js';
import { ActivityController } from './ActivityController.js';
import { LaneStatisticsController } from './LaneStatisticsController.js';

const service = new NaturalLanguageService();

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userQuery = req.body.query;

    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid query parameter',
      });
    }

    // Process the query with the NL service
    const intent = await service.processQuery(userQuery);

    // If confidence is too low or intent is unknown, return the natural response
    if (intent.confidence < 0.5 || intent.intent === 'unknown') {
      return res.json({
        intent: intent.intent,
        message: intent.natural_response,
        data: null,
      });
    }

    // Route to appropriate controller based on intent
    switch (intent.intent) {
      case 'list_cards':
        return await CardController.list(req, res, next);

      case 'list_accounts':
        return await AccountController.list(req, res, next);

      case 'list_lanes':
        return await LaneController.list(req, res, next);

      case 'get_lane_statistics':
        return await LaneStatisticsController.get(req, res, next);

      case 'list_users':
        return await UserController.list(req, res, next);

      case 'get_forecast':
      case 'get_forecast_achieved':
        return await ForecastController.achieved(req, res, next);

      case 'get_forecast_predicted':
        return await ForecastController.predicted(req, res, next);

      case 'get_forecast_list':
        return await ForecastController.list(req, res, next);

      case 'get_forecast_series':
        return await ForecastController.series(req, res, next);

      case 'list_activities':
        return await ActivityController.list(req, res, next);

      default:
        return res.json({
          intent: intent.intent,
          message: intent.natural_response,
          data: null,
        });
    }
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
