import { OpenAI } from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { log } from '../worker.js';

let openaiClient: OpenAI | null = null;
let systemPrompt: string | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const initializeClient = (): OpenAI => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    openaiClient = new OpenAI({
      apiKey: apiKey,
    });

    log.info('OpenAI client initialized');
  }

  return openaiClient;
};

const loadPromptTemplate = (templateName: string): string => {
  if (templateName === 'query-processor' && systemPrompt) {
    return systemPrompt;
  }

  try {
    const promptPath = join(__dirname, '..', 'prompts', `${templateName}.txt`);
    const content = readFileSync(promptPath, 'utf-8');

    if (templateName === 'query-processor') {
      systemPrompt = content;
    }

    log.debug(`Loaded prompt template: ${templateName}`);
    return content;
  } catch (error) {
    log.error(`Failed to load prompt template: ${templateName}`, error);
    throw new Error(`Failed to load prompt template: ${templateName}`);
  }
};

const processQuery = async (userQuery: string): Promise<string> => {
  const client = initializeClient();
  const systemPromptContent = loadPromptTemplate('query-processor');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPromptContent,
        },
        {
          role: 'user',
          content: userQuery,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const message = response.choices[0]?.message?.content;

    if (!message) {
      throw new Error('No response from OpenAI');
    }

    return message;
  } catch (error) {
    log.error('Error processing query with OpenAI', error);
    throw error;
  }
};

export const LLMHelper = {
  initializeClient,
  loadPromptTemplate,
  processQuery,
};
