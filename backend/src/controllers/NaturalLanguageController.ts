import { Response, NextFunction } from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { PromptHelper } from '../helpers/PromptHelper.js';
import { StatusCodes } from 'http-status-codes';
import { ApplicationError } from '../errors/ApplicationError.js';

class NaturalLanguageQueryError extends ApplicationError {
  constructor(description?: string) {
    super('NaturalLanguageQueryError', StatusCodes.INTERNAL_SERVER_ERROR, description);
  }
}

class InvalidQueryError extends ApplicationError {
  constructor(description?: string) {
    super('InvalidQueryError', StatusCodes.BAD_REQUEST, description);
  }
}

interface NLQueryResponse {
  intent: string;
  entity: string;
  response: string;
  suggestedEndpoint?: string;
  suggestedAction?: string;
}

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userQuery = req.body.query;

    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
      throw new InvalidQueryError('Query field is required and must be a non-empty string');
    }

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new NaturalLanguageQueryError(
        'OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.'
      );
    }

    // Load the prompt template
    const promptTemplate = await PromptHelper.loadPrompt('query-interpreter.txt');
    const fullPrompt = PromptHelper.formatPrompt(promptTemplate, userQuery);

    // Initialize the ChatOpenAI model
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
      openAIApiKey: apiKey,
    });

    // Invoke the model
    const response = await model.invoke(fullPrompt);

    // Parse the response
    let parsedResponse: NLQueryResponse;
    try {
      // The response content should be a JSON string
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
      
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      // If parsing fails, create a fallback response
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
      
      parsedResponse = {
        intent: 'general_query',
        entity: 'unknown',
        response: content,
      };
    }

    return res.json({
      query: userQuery,
      result: parsedResponse,
    });
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
