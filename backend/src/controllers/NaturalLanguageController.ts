import { Request, Response } from 'express';
import { ConversationMemoryManager, ConversationMessage } from '../memory/ConversationMemoryManager.js';

/**
 * NaturalLanguageController handles natural language queries with conversational memory.
 */
export class NaturalLanguageController {
  private memoryManager: ConversationMemoryManager;

  constructor(memoryManager: ConversationMemoryManager) {
    this.memoryManager = memoryManager;
  }

  /**
   * Process a natural language query with optional session context.
   * @param req - Express request object
   * @param res - Express response object
   */
  async processQuery(req: Request, res: Response): Promise<void> {
    try {
      const { query, sessionId } = req.body as { query: string; sessionId?: string };

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      let previousMessages: ConversationMessage[] = [];

      // Load previous conversation context if sessionId is provided
      if (sessionId) {
        const checkpoint = await this.memoryManager.getCheckpoint(sessionId);
        if (checkpoint) {
          previousMessages = checkpoint.messages;
        }
      }

      // Process the query (placeholder for actual NLP processing)
      // In a real implementation, this would use an LLM or other NLP service
      const responseText = await this.generateResponse(query, previousMessages);

      // Save updated conversation context if sessionId is provided
      if (sessionId) {
        const newMessages: ConversationMessage[] = [
          {
            role: 'user',
            content: query,
            timestamp: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString(),
          },
        ];

        await this.memoryManager.addMessages(sessionId, newMessages, {
          lastQuery: query,
          lastQueryTimestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        response: responseText,
        sessionId,
        messageCount: previousMessages.length + 2,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to process query: ${errorMessage}` });
    }
  }

  /**
   * Generate a response based on the query and conversation context.
   * This is a placeholder implementation.
   */
  private async generateResponse(
    query: string,
    previousMessages: ConversationMessage[]
  ): Promise<string> {
    // Placeholder implementation
    // In a real system, this would integrate with an LLM or NLP service
    if (previousMessages.length > 0) {
      return `Processed query "${query}" with ${previousMessages.length} previous messages in context.`;
    }
    return `Processed query "${query}" without previous context.`;
  }
}
