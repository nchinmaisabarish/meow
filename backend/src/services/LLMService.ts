import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface LLMResponse {
  intent: string;
  entity: string;
  parameters: Record<string, any>;
  response: string;
}

export class LLMService {
  private client: OpenAI | null = null;
  private systemPrompt: string;

  constructor() {
    // Load system prompt from file
    const promptPath = join(__dirname, '..', 'prompts', 'system-prompt.txt');
    this.systemPrompt = readFileSync(promptPath, 'utf-8');

    // Initialize OpenAI client only if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async processQuery(userQuery: string): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userQuery }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Parse the JSON response from the LLM
      const parsed = JSON.parse(content) as LLMResponse;
      
      return parsed;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to process query: ${error.message}`);
      }
      throw new Error('Failed to process query: Unknown error');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}

// Singleton instance
let instance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!instance) {
    instance = new LLMService();
  }
  return instance;
}
