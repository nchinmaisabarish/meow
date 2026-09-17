import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ApplicationError } from '../errors/ApplicationError.js';
import { StatusCodes } from 'http-status-codes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class IntentClassificationError extends ApplicationError {
  constructor(description?: string) {
    super('IntentClassificationError', StatusCodes.INTERNAL_SERVER_ERROR, description);
  }
}

export interface ClassifiedIntent {
  intent: string;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning?: string;
}

interface WorkflowConfig {
  intents: Array<{
    name: string;
    description: string;
    toolName: string;
    keywords: string[];
    examples: string[];
  }>;
  defaultIntent: string;
  confidenceThreshold: number;
}

/**
 * IntentClassifier uses OpenAI to classify user requests into intents
 * that can be mapped to tools in the ToolRegistry
 */
export class IntentClassifier {
  private openaiClient: OpenAI;
  private workflowConfig: WorkflowConfig;
  private systemPrompt: string;

  constructor(openaiApiKey?: string) {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new IntentClassificationError('OPENAI_API_KEY environment variable is not set');
    }
    this.openaiClient = new OpenAI({ apiKey });
    
    // Load workflow configuration
    const configPath = join(__dirname, '..', 'workflows', 'workflow-config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    this.workflowConfig = JSON.parse(configContent) as WorkflowConfig;
    
    // Build system prompt from configuration
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Build a system prompt that includes all available intents and their descriptions
   */
  private buildSystemPrompt(): string {
    const intentDescriptions = this.workflowConfig.intents
      .map(intent => {
        const examples = intent.examples.join('\n  - ');
        return `
Intent: ${intent.name}
Description: ${intent.description}
Keywords: ${intent.keywords.join(', ')}
Examples:
  - ${examples}`;
      })
      .join('\n');

    return `You are an intent classification system for a sales pipeline management application.

Your task is to analyze user requests and classify them into one of the following intents:

${intentDescriptions}

For each user request, you must:
1. Identify the most appropriate intent from the list above
2. Extract any parameters mentioned in the request (e.g., IDs, filters, values)
3. Assign a confidence score between 0 and 1
4. If the request doesn't match any intent clearly, use intent "unknown" with low confidence

Respond ONLY with valid JSON in this exact format:
{
  "intent": "intent_name",
  "parameters": {},
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this intent was chosen"
}

Do not include any text outside the JSON object.`;
  }

  /**
   * Classify a user request into an intent with parameters
   */
  async classify(userRequest: string): Promise<ClassifiedIntent> {
    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userRequest }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new IntentClassificationError('No response content from OpenAI');
      }

      const classified = JSON.parse(responseContent) as ClassifiedIntent;
      
      // Validate the response structure
      if (!classified.intent || typeof classified.confidence !== 'number') {
        throw new IntentClassificationError('Invalid response structure from OpenAI');
      }

      // Ensure parameters is an object
      if (!classified.parameters) {
        classified.parameters = {};
      }

      return classified;
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new IntentClassificationError('Failed to parse LLM response as JSON');
      }
      if (error instanceof IntentClassificationError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new IntentClassificationError(`OpenAI API error: ${error.message}`);
      }
      throw new IntentClassificationError('Unknown error occurred while classifying intent');
    }
  }

  /**
   * Get the tool name for a given intent
   */
  getToolNameForIntent(intent: string): string | null {
    const intentConfig = this.workflowConfig.intents.find(i => i.name === intent);
    return intentConfig ? intentConfig.toolName : null;
  }

  /**
   * Check if an intent is valid according to the configuration
   */
  isValidIntent(intent: string): boolean {
    return this.workflowConfig.intents.some(i => i.name === intent);
  }

  /**
   * Get the confidence threshold from configuration
   */
  getConfidenceThreshold(): number {
    return this.workflowConfig.confidenceThreshold;
  }
}
