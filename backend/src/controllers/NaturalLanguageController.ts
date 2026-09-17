import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { ApplicationError } from '../errors/ApplicationError.js';
import { StatusCodes } from 'http-status-codes';
import { IntentWorkflow } from '../workflows/IntentWorkflow.js';

class InvalidQueryError extends ApplicationError {
  constructor(description?: string) {
    super('InvalidQueryError', StatusCodes.BAD_REQUEST, description);
  }
}

// Singleton workflow instance
let workflowInstance: IntentWorkflow | null = null;

function getWorkflow(): IntentWorkflow {
  if (!workflowInstance) {
    workflowInstance = new IntentWorkflow();
  }
  return workflowInstance;
}

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userQuery = req.body.query;

    if (!userQuery || typeof userQuery !== 'string') {
      throw new InvalidQueryError('Query parameter is required and must be a string');
    }

    if (userQuery.trim().length === 0) {
      throw new InvalidQueryError('Query cannot be empty');
    }

    // Execute the intent workflow
    const workflow = getWorkflow();
    const workflowOutput = await workflow.invoke({
      userRequest: userQuery,
      user: req.jwt.user,
      team: req.jwt.team,
    });

    // Return the workflow result
    return res.json({
      success: workflowOutput.success,
      intent: workflowOutput.intent,
      confidence: workflowOutput.confidence,
      reasoning: workflowOutput.reasoning,
      toolName: workflowOutput.toolName,
      data: workflowOutput.result,
      error: workflowOutput.error,
    });
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
