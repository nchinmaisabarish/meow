import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { NaturalLanguageService } from '../services/NaturalLanguageService.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';

const processQuery = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new InvalidRequestBodyError('Query must be a non-empty string');
    }

    const service = new NaturalLanguageService();
    const result = await service.processQuery(query);

    return res.json({
      query: query,
      response: result.response,
      intent: result.intent,
      teamId: req.jwt.team._id,
      userId: req.jwt.user._id,
    });
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  processQuery,
};
