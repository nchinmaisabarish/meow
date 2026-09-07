import { MongoDBCheckpointer } from '../persistence/WorkflowCheckpointer.js';
import { CheckpointTuple } from '@langchain/langgraph';

/**
 * Conversation context entry
 */
export interface ConversationContext {
  threadId: string;
  checkpointId: string;
  timestamp: Date;
  state: any;
  metadata?: any;
}

/**
 * ConversationMemory service
 * Manages conversational context and memory using workflow checkpoints
 */
export class ConversationMemory {
  private checkpointer: MongoDBCheckpointer;

  constructor(checkpointer?: MongoDBCheckpointer) {
    this.checkpointer = checkpointer || new MongoDBCheckpointer();
  }

  /**
   * Get recent conversation history for a thread
   */
  async getRecentHistory(threadId: string, limit: number = 10): Promise<ConversationContext[]> {
    const contexts: ConversationContext[] = [];

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    try {
      // List recent checkpoints for this thread
      for await (const tuple of this.checkpointer.list(config, limit)) {
        contexts.push(this.tupleToContext(tuple));
      }
    } catch (error: unknown) {
      // If there's an error, return empty array
      console.error('Error fetching conversation history:', error);
    }

    return contexts;
  }

  /**
   * Get the latest checkpoint for a thread
   */
  async getLatestCheckpoint(threadId: string): Promise<ConversationContext | null> {
    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    try {
      const tuple = await this.checkpointer.getTuple(config);
      
      if (!tuple) {
        return null;
      }

      return this.tupleToContext(tuple);
    } catch (error: unknown) {
      console.error('Error fetching latest checkpoint:', error);
      return null;
    }
  }

  /**
   * Get a specific checkpoint by ID
   */
  async getCheckpoint(threadId: string, checkpointId: string): Promise<ConversationContext | null> {
    const config = {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpointId,
      },
    };

    try {
      const tuple = await this.checkpointer.getTuple(config);
      
      if (!tuple) {
        return null;
      }

      return this.tupleToContext(tuple);
    } catch (error: unknown) {
      console.error('Error fetching checkpoint:', error);
      return null;
    }
  }

  /**
   * Clear all conversation history for a thread
   */
  async clearThread(threadId: string): Promise<void> {
    try {
      await this.checkpointer.deleteThread(threadId);
    } catch (error: unknown) {
      console.error('Error clearing thread:', error);
      throw error;
    }
  }

  /**
   * Get the number of checkpoints for a thread
   */
  async getCheckpointCount(threadId: string): Promise<number> {
    try {
      return await this.checkpointer.getCheckpointCount(threadId);
    } catch (error: unknown) {
      console.error('Error getting checkpoint count:', error);
      return 0;
    }
  }

  /**
   * Build a conversation summary from recent history
   */
  async buildConversationSummary(threadId: string, limit: number = 5): Promise<string> {
    const history = await this.getRecentHistory(threadId, limit);

    if (history.length === 0) {
      return 'No previous conversation history.';
    }

    const summaryParts: string[] = [];

    for (const context of history.reverse()) {
      const timestamp = context.timestamp.toISOString();
      const step = context.metadata?.step ?? 'unknown';
      summaryParts.push(`[${timestamp}] Step ${step}: ${JSON.stringify(context.state)}`);
    }

    return summaryParts.join('\n');
  }

  /**
   * Convert a checkpoint tuple to a conversation context
   */
  private tupleToContext(tuple: CheckpointTuple): ConversationContext {
    return {
      threadId: tuple.config.configurable?.thread_id as string,
      checkpointId: tuple.checkpoint.id,
      timestamp: new Date(tuple.checkpoint.ts),
      state: tuple.checkpoint.channel_values,
      metadata: tuple.metadata,
    };
  }

  /**
   * Generate a unique thread ID for a user and conversation type
   */
  static generateThreadId(userId: string, conversationType: string = 'general'): string {
    return `${conversationType}_${userId}_${Date.now()}`;
  }

  /**
   * Generate a thread ID for a user's ongoing conversation
   */
  static getUserThreadId(userId: string, conversationType: string = 'general'): string {
    return `${conversationType}_${userId}`;
  }
}

// Export a singleton instance
let conversationMemoryInstance: ConversationMemory | null = null;

export function getConversationMemory(): ConversationMemory {
  if (!conversationMemoryInstance) {
    conversationMemoryInstance = new ConversationMemory();
  }
  return conversationMemoryInstance;
}
