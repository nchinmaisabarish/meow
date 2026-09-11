import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let openaiClient: OpenAI | null = null;

/**
 * Initialize the OpenAI client with API key from environment variables
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
  }
  
  return openaiClient;
}

/**
 * Load a prompt template from the prompts directory
 */
function loadPromptTemplate(templateName: string): string {
  const promptPath = join(__dirname, '..', 'prompts', templateName);
  return readFileSync(promptPath, 'utf-8');
}

/**
 * Call OpenAI API with a prompt and user query
 */
export async function queryOpenAI(userQuery: string, promptTemplate: string): Promise<string> {
  const client = getOpenAIClient();
  
  const fullPrompt = `${promptTemplate}\n\n${userQuery}`;
  
  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });
  
  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from OpenAI');
  }
  
  return content;
}

/**
 * Parse natural language query and get structured intent
 */
export async function parseQueryIntent(userQuery: string): Promise<{
  operation: string;
  entity: string;
  parameters: Record<string, unknown>;
  confidence: number;
  natural_response: string;
}> {
  const promptTemplate = loadPromptTemplate('query-intent.txt');
  const response = await queryOpenAI(userQuery, promptTemplate);
  
  // Parse the JSON response
  try {
    const parsed = JSON.parse(response);
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse OpenAI response as JSON: ${response}`);
  }
}

export const OpenAIHelper = {
  queryOpenAI,
  parseQueryIntent,
  loadPromptTemplate,
};
