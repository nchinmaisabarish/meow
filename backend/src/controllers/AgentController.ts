import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';
import { intentRouter } from '../services/IntentRouter.js';
import { log } from '../worker.js';

/**
 * Handle agent intent requests
 */
const execute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userInput = req.body.input;

    // Validate input
    if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
      throw new InvalidRequestError('Input parameter is required and must be a non-empty string.');
    }

    if (userInput.length > 2000) {
      throw new InvalidRequestError('Input is too long. Maximum length is 2000 characters.');
    }

    // Get user and team from authenticated request
    const user = req.jwt.user;
    const team = req.jwt.team;

    log.info('Agent request received:', {
      userId: user._id!.toString(),
      teamId: team._id!.toString(),
      inputLength: userInput.length,
    });

    // Execute the agent
    const result = await intentRouter.execute({
      input: userInput,
      user,
      team,
    });

    // Return the result
    return res.json({
      success: true,
      input: userInput,
      output: result.output,
      intermediateSteps: result.intermediateSteps,
    });
  } catch (error: unknown) {
    // Log the error
    log.error('Agent controller error:', error);

    // Pass to error handler middleware
    return next(error);
  }
};

export const AgentController = {
  execute,
};
