import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { LLMProcessingError } from '../errors/LLMProcessingError.js';
import { log } from '../worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let openaiClient: OpenAI | null = null;
let systemPrompt: string | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new LLMProcessingError('OPENAI_API_KEY environment variable is not set');
    }

    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
  }

  return openaiClient;
}

function getSystemPrompt(): string {
  if (!systemPrompt) {
    try {
      const promptPath = join(__dirname, '..', 'prompts', 'query-translator.txt');
      systemPrompt = readFileSync(promptPath, 'utf-8');
    } catch (error) {
      log.error('Failed to load system prompt', error);
      throw new LLMProcessingError('Failed to load system prompt template');
    }
  }

  return systemPrompt;
}

export interface QueryIntent {
  intent: 'list_cards' | 'list_lanes' | 'list_accounts' | 'get_card' | 'get_lane' | 'get_account' | 'unknown';
  entity: 'card' | 'lane' | 'account' | 'user';
  filters: {
    laneName?: string;
    laneId?: string;
    status?: 'active' | 'deleted' | 'archived';
    userId?: string;
    maxDaysAgo?: number;
  };
  explanation: string;
}

async function processNaturalLanguageQuery(userQuery: string): Promise<QueryIntent> {
  try {
    const client = getClient();
    const prompt = getSystemPrompt();

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: userQuery,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new LLMProcessingError('No response from LLM');
    }

    try {
      const parsed = JSON.parse(content) as QueryIntent;
      return parsed;
    } catch (parseError) {
      log.error('Failed to parse LLM response', { content, parseError });
      throw new LLMProcessingError('Failed to parse LLM response as JSON');
    }
  } catch (error) {
    if (error instanceof LLMProcessingError) {
      throw error;
    }

    log.error('Error processing natural language query', error);
    throw new LLMProcessingError('Failed to process natural language query');
  }
}

export const LLMHelper = {
  processNaturalLanguageQuery,
  getClient,
};
