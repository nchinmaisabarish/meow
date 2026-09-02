import { DatabaseHelper } from '../helpers/DatabaseHelper.js';
import { Collection } from 'mongodb';

/**
 * Represents a message in the conversation history.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Represents a conversation checkpoint stored in the database.
 */
export interface ConversationCheckpoint {
  sessionId: string;
  messages: ConversationMessage[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ConversationMemoryManager provides a high-level interface for managing
 * conversational state using MongoDB for persistence.
 */
export class ConversationMemoryManager {
  private readonly collectionName = 'conversation_checkpoints';

  /**
   * Get the MongoDB collection for conversation checkpoints.
   */
  private getCollection(): Collection<ConversationCheckpoint> {
    return DatabaseHelper.getCollection(this.collectionName) as unknown as Collection<ConversationCheckpoint>;
  }

  /**
   * Retrieve the latest checkpoint for a given session.
   * @param sessionId - The unique identifier for the conversation session
   * @returns The checkpoint or undefined if no checkpoint exists
   */
  async getCheckpoint(sessionId: string): Promise<ConversationCheckpoint | undefined> {
    const collection = this.getCollection();
    const checkpoint = await collection.findOne({ sessionId });
    
    if (!checkpoint) {
      return undefined;
    }

    return checkpoint;
  }

  /**
   * Save a checkpoint for a given session.
   * @param sessionId - The unique identifier for the conversation session
   * @param messages - The conversation messages to save
   * @param metadata - Optional metadata associated with the checkpoint
   * @returns The saved checkpoint
   */
  async saveCheckpoint(
    sessionId: string,
    messages: ConversationMessage[],
    metadata: Record<string, any> = {}
  ): Promise<ConversationCheckpoint> {
    const collection = this.getCollection();
    const now = new Date();

    const checkpoint: ConversationCheckpoint = {
      sessionId,
      messages,
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    await collection.updateOne(
      { sessionId },
      {
        $set: {
          messages,
          metadata,
          updatedAt: now,
        },
        $setOnInsert: {
          sessionId,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return checkpoint;
  }

  /**
   * Add messages to an existing checkpoint or create a new one.
   * @param sessionId - The unique identifier for the conversation session
   * @param newMessages - The new messages to add
   * @param metadata - Optional metadata to merge with existing metadata
   * @returns The updated checkpoint
   */
  async addMessages(
    sessionId: string,
    newMessages: ConversationMessage[],
    metadata: Record<string, any> = {}
  ): Promise<ConversationCheckpoint> {
    const existing = await this.getCheckpoint(sessionId);
    
    const messages = existing ? [...existing.messages, ...newMessages] : newMessages;
    const mergedMetadata = existing ? { ...existing.metadata, ...metadata } : metadata;

    return await this.saveCheckpoint(sessionId, messages, mergedMetadata);
  }

  /**
   * Delete all checkpoints for a given session.
   * @param sessionId - The unique identifier for the conversation session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const collection = this.getCollection();
    await collection.deleteOne({ sessionId });
  }

  /**
   * Get all sessions (useful for debugging or admin purposes).
   * @param limit - Maximum number of sessions to return
   * @returns Array of session IDs
   */
  async getAllSessions(limit: number = 100): Promise<string[]> {
    const collection = this.getCollection();
    const checkpoints = await collection
      .find({}, { projection: { sessionId: 1 } })
      .limit(limit)
      .toArray();
    
    return checkpoints.map((cp: any) => cp.sessionId);
  }
}
