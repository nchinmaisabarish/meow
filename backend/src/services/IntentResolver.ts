import OpenAI from 'openai';
import { z } from 'zod';

/**
 * Schema for intent classification response from the LLM
 */
const IntentClassificationSchema = z.object({
  intent: z.string().describe('The primary intent category (e.g., card_management, lane_operations, team_administration)'),
  action: z.string().describe('The specific action to perform (e.g., create, get, update, delete, list)'),
  toolName: z.string().describe('The name of the tool to invoke from the registry'),
  parameters: z.record(z.any()).describe('Extracted parameters for the tool invocation'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the classification (0-1)'),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

/**
 * IntentResolver analyzes incoming requests using an LLM to determine user intent
 * and maps it to appropriate tool invocations.
 */
export class IntentResolver {
  private client: OpenAI | null = null;
  private systemPrompt: string;

  constructor() {
    // Initialize OpenAI client only if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }

    // System prompt for intent classification
    this.systemPrompt = `You are an intent classification system for a sales pipeline management application.

Your task is to analyze user requests and classify them into structured intents that map to specific tools.

Available intent categories:
- card_management: Operations on cards (opportunities/deals) in the sales pipeline
- lane_operations: Operations on lanes (pipeline stages)
- team_administration: Operations on teams, users, and settings
- account_management: Operations on accounts (companies/contacts)
- analytics: Retrieving statistics, forecasts, and reports

Available tools and their purposes:
- create_card: Create a new card/opportunity
- get_card: Retrieve a specific card by ID
- update_card: Update an existing card
- delete_card: Delete a card
- create_lane: Create a new pipeline stage
- get_lane: Retrieve a specific lane by ID
- update_lane: Update an existing lane
- delete_lane: Delete a lane
- get_lane_statistics: Get statistics for lanes

When analyzing a request:
1. Identify the primary intent category
2. Determine the specific action (create, get, update, delete, list)
3. Select the appropriate tool name from the registry
4. Extract relevant parameters from the request (IDs, names, amounts, etc.)
5. Assign a confidence score (0-1) based on how clear the intent is

Respond ONLY with valid JSON matching this schema:
{
  "intent": "intent_category",
  "action": "action_name",
  "toolName": "tool_name",
  "parameters": { "param1": "value1", "param2": "value2" },
  "confidence": 0.95
}

Examples:
User: "Create a new deal for Acme Corp worth $50,000"
Response: {"intent": "card_management", "action": "create", "toolName": "create_card", "parameters": {"name": "Acme Corp", "amount": 50000}, "confidence": 0.9}

User: "Show me the details of card 123"
Response: {"intent": "card_management", "action": "get", "toolName": "get_card", "parameters": {"cardId": "123"}, "confidence": 0.95}

User: "Update the Negotiation stage to include it in forecasts"
Response: {"intent": "lane_operations", "action": "update", "toolName": "update_lane", "parameters": {"inForecast": true}, "confidence": 0.85}`;
  }

  /**
   * Analyzes a user request and classifies the intent using an LLM
   * @param requestContent The user's request content (text, query, or description)
   * @param context Additional context like userId, teamId, available entities
   * @returns IntentClassification with tool name and parameters
   */
  async classifyIntent(
    requestContent: string,
    context: { userId?: string; teamId?: string; [key: string]: any }
  ): Promise<IntentClassification> {
    if (!this.client) {
      throw new Error(
        'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
      );
    }

    try {
      // Build the user message with context
      let userMessage = requestContent;
      if (context.userId || context.teamId) {
        userMessage = `Context: userId=${context.userId || 'unknown'}, teamId=${context.teamId || 'unknown'}\n\nRequest: ${requestContent}`;
      }

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3, // Lower temperature for more consistent classification
        max_tokens: 300,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from LLM');
      }

      // Parse and validate the JSON response
      const parsed = JSON.parse(content);
      const validated = IntentClassificationSchema.parse(parsed);

      return validated;
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid intent classification response: ${error.message}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to classify intent: ${error.message}`);
      }
      throw new Error('Failed to classify intent: Unknown error');
    }
  }

  /**
   * Checks if the IntentResolver is properly configured with an API key
   */
  isConfigured(): boolean {
    return this.client !== null;
  }
}

// Singleton instance
let instance: IntentResolver | null = null;

/**
 * Gets the singleton instance of IntentResolver
 */
export function getIntentResolver(): IntentResolver {
  if (!instance) {
    instance = new IntentResolver();
  }
  return instance;
}
