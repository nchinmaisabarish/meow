import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface QueryIntent {
  intent: string;
  entity: string | null;
  action: string | null;
  parameters: Record<string, any>;
  confidence: number;
  natural_response: string;
}

export class NaturalLanguageService {
  private client: OpenAI;
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });

    // Load the prompt template
    const promptPath = join(__dirname, '..', 'prompts', 'query-understanding.txt');
    this.systemPrompt = readFileSync(promptPath, 'utf-8');
  }

  async processQuery(userQuery: string): Promise<QueryIntent> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: userQuery,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const intent = JSON.parse(responseContent) as QueryIntent;

      return intent;
    } catch (error) {
      // If parsing fails or API call fails, return a default unknown intent
      return {
        intent: 'unknown',
        entity: null,
        action: null,
        parameters: {},
        confidence: 0,
        natural_response: 'I apologize, but I had trouble understanding your query. Please try rephrasing it.',
      };
    }
  }
}
