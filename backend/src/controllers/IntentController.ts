import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { IntentResolverService } from '../services/IntentResolverService.js';

/**
 * Controller for handling intent-based requests
 */
const resolve = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a string',
      });
    }

    const intentResolver = new IntentResolverService();
    const result = await intentResolver.resolveIntent(query, req.jwt.user, req.jwt.team);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

/**
 * Lists all available tools/capabilities
 */
const listTools = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const intentResolver = new IntentResolverService();
    const tools = intentResolver.getAvailableTools();

    return res.json({
      success: true,
      tools,
      count: tools.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const IntentController = {
  resolve,
  listTools,
};
