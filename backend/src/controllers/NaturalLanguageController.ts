import { Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { ApplicationError } from '../errors/ApplicationError.js';
import { StatusCodes } from 'http-status-codes';
import { IntentRouter } from '../helpers/IntentRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class LLMIntegrationError extends ApplicationError {
  constructor(description?: string) {
    super('LLMIntegrationError', StatusCodes.INTERNAL_SERVER_ERROR, description);
  }
}

class InvalidQueryError extends ApplicationError {
  constructor(description?: string) {
    super('InvalidQueryError', StatusCodes.BAD_REQUEST, description);
  }
}

interface ParsedIntent {
  intent: string;
  parameters: Record<string, unknown>;
  confidence: number;
  natural_response: string;
}

let openaiClient: OpenAI | null = null;
let systemPrompt: string | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new LLMIntegrationError('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getSystemPrompt(): string {
  if (!systemPrompt) {
    const promptPath = join(__dirname, '..', 'prompts', 'query-parser.txt');
    systemPrompt = readFileSync(promptPath, 'utf-8');
  }
  return systemPrompt;
}

async function parseQuery(query: string): Promise<ParsedIntent> {
  const client = getOpenAIClient();
  const prompt = getSystemPrompt();

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: query }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new LLMIntegrationError('No response content from OpenAI');
    }

    const parsed = JSON.parse(responseContent) as ParsedIntent;
    
    return parsed;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new LLMIntegrationError('Failed to parse LLM response as JSON');
    }
    if (error instanceof Error) {
      throw new LLMIntegrationError(`OpenAI API error: ${error.message}`);
    }
    throw new LLMIntegrationError('Unknown error occurred while calling OpenAI API');
  }
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

    // Parse the natural language query using OpenAI
    const parsedIntent = await parseQuery(userQuery);

    // If confidence is too low or intent is unknown, return the parsed response
    if (parsedIntent.confidence < 0.5 || parsedIntent.intent === 'unknown') {
      return res.json({
        success: false,
        message: parsedIntent.natural_response,
        intent: parsedIntent.intent,
        confidence: parsedIntent.confidence,
      });
    }

    // Route the intent to the appropriate controller
    const result = await IntentRouter.route(parsedIntent.intent, parsedIntent.parameters, req);

    return res.json({
      success: true,
      message: parsedIntent.natural_response,
      intent: parsedIntent.intent,
      confidence: parsedIntent.confidence,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
