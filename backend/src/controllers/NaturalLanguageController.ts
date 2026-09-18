import { Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';
import { log } from '../worker.js';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;
let promptTemplate: string | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new InvalidRequestError(
        'OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
};

const getPromptTemplate = (): string => {
  if (!promptTemplate) {
    try {
      const promptPath = join(__dirname, '..', 'prompts', 'query-assistant.txt');
      promptTemplate = readFileSync(promptPath, 'utf-8');
    } catch (error: unknown) {
      log.error('Failed to load prompt template:', error);
      throw new InvalidRequestError('Failed to load natural language processing configuration.');
    }
  }
  return promptTemplate;
};

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userQuery = req.body.query;

    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
      throw new InvalidRequestError('Query parameter is required and must be a non-empty string.');
    }

    if (userQuery.length > 1000) {
      throw new InvalidRequestError('Query is too long. Maximum length is 1000 characters.');
    }

    const client = getOpenAIClient();
    const systemPrompt = getPromptTemplate();

    // Add context about the current user and team
    const contextMessage = `Current user: ${req.jwt.user.name} (ID: ${req.jwt.user._id.toString()})
Team: ${req.jwt.team.name} (ID: ${req.jwt.team._id.toString()})
Currency: ${req.jwt.team.currency}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: contextMessage },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new InvalidRequestError('Failed to generate a response. Please try again.');
    }

    return res.json({
      query: userQuery,
      response: response.trim(),
      model: completion.model,
    });
  } catch (error: unknown) {
    // Handle OpenAI-specific errors
    if (error instanceof OpenAI.APIError) {
      log.error('OpenAI API error:', {
        status: error.status,
        message: error.message,
        code: error.code,
      });
      return next(
        new InvalidRequestError(
          'Failed to process natural language query. Please check your API configuration.'
        )
      );
    }
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
