import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface QueryResponse {
  response: string;
  intent?: string;
}

export class NaturalLanguageService {
  private openai: OpenAI;
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    // Load the prompt template
    const promptPath = join(__dirname, '..', 'prompts', 'query-translator.txt');
    this.systemPrompt = readFileSync(promptPath, 'utf-8');
  }

  async processQuery(query: string): Promise<QueryResponse> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || 'I could not process your query. Please try again.';

      return {
        response: response,
        intent: this.extractIntent(query),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to process natural language query: ${error.message}`);
      }
      throw new Error('Failed to process natural language query');
    }
  }

  private extractIntent(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('card') || lowerQuery.includes('deal') || lowerQuery.includes('opportunity')) {
      return 'cards';
    }
    if (lowerQuery.includes('lane') || lowerQuery.includes('stage') || lowerQuery.includes('pipeline')) {
      return 'lanes';
    }
    if (lowerQuery.includes('account') || lowerQuery.includes('customer') || lowerQuery.includes('company')) {
      return 'accounts';
    }
    if (lowerQuery.includes('forecast') || lowerQuery.includes('predict') || lowerQuery.includes('revenue')) {
      return 'forecast';
    }
    if (lowerQuery.includes('activity') || lowerQuery.includes('recent') || lowerQuery.includes('event')) {
      return 'activities';
    }
    if (lowerQuery.includes('user') || lowerQuery.includes('team member')) {
      return 'users';
    }
    
    return 'general';
  }
}
