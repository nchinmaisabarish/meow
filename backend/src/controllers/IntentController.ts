import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { executeIntentWorkflow } from '../workflows/IntentWorkflow.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';
import { StatusCodes } from 'http-status-codes';

/**
 * Handle intent-based requests using the LangGraph workflow
 */
const handle = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userRequest = req.body.request;

    if (!userRequest || typeof userRequest !== 'string') {
      throw new InvalidRequestError('Request field is required and must be a string');
    }

    // Execute the intent workflow
    const result = await executeIntentWorkflow(userRequest, req.jwt.user, req.jwt.team);

    // Handle case where result might be undefined
    if (!result) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        request: userRequest,
        success: false,
        message: 'Failed to process request',
      });
    }

    // Return the response with appropriate status code
    const statusCode = result.success ? StatusCodes.OK : StatusCodes.BAD_REQUEST;

    return res.status(statusCode).json({
      request: userRequest,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

export const IntentController = {
  handle,
};
