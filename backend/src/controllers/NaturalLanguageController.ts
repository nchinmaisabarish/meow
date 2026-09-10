import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { LLMHelper } from '../helpers/LLMHelper.js';
import { log } from '../worker.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userQuery = req.body.query;

    if (!userQuery || typeof userQuery !== 'string') {
      throw new InvalidRequestBodyError('Query field is required and must be a string');
    }

    if (userQuery.trim().length === 0) {
      throw new InvalidRequestBodyError('Query cannot be empty');
    }

    log.debug(`Processing natural language query: ${userQuery}`);

    const response = await LLMHelper.processQuery(userQuery);

    res.json({
      query: userQuery,
      response: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
