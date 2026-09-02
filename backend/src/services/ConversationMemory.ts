import { DatabaseHelper } from '../helpers/DatabaseHelper.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { ConversationSession, NewConversationSession } from '../entities/ConversationSession.js';
import { User } from '../entities/User.js';
import { ObjectId } from 'mongodb';

export class ConversationMemoryService {
  private initialized: boolean = false;
  private checkpointsCollection = 'conversation_checkpoints';
  private messagesCollection = 'conversation_messages';

  /**
   * Initialize the conversation memory collections and indexes
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const db = DatabaseHelper.get();
    
    // Create indexes for efficient querying
    try {
      await db.collection(this.checkpointsCollection).createIndex(
        { sessionId: 1, timestamp: -1 },
        { background: true }
      );
      
      await db.collection(this.messagesCollection).createIndex(
        { sessionId: 1, timestamp: 1 },
        { background: true }
      );

      // TTL index to auto-delete old messages after 30 days
      await db.collection(this.messagesCollection).createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: 2592000, background: true }
      );

      this.initialized = true;
    } catch (error) {
      console.error('Failed to create indexes:', error);
      // Continue anyway - indexes are optional
      this.initialized = true;
    }
  }

  /**
   * Get or create a conversation session for a user
   */
  async getOrCreateSession(user: User, sessionId?: string): Promise<ConversationSession> {
    // If no sessionId provided, generate a new one
    const actualSessionId = sessionId || new ObjectId().toString();

    // Try to find existing session
    const existingSession = await EntityHelper.findOneBy(ConversationSession, {
      userId: user._id,
      sessionId: actualSessionId,
    });

    if (existingSession) {
      // Update last accessed time
      existingSession.lastAccessedAt = new Date();
      existingSession.updatedAt = new Date();
      await EntityHelper.update(existingSession);
      return existingSession;
    }

    // Create new session
    const newSession = new NewConversationSession(user, actualSessionId);
    const createdSession = await EntityHelper.create(newSession, ConversationSession);
    return createdSession;
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string): Promise<ConversationHistory> {
    if (!this.initialized) {
      await this.initialize();
    }

    const messagesCollection = DatabaseHelper.getCollection(this.messagesCollection);
    
    const messages = await messagesCollection
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .toArray();

    const conversationMessages: ConversationMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata,
    }));

    return {
      sessionId,
      messages: conversationMessages,
      messageCount: conversationMessages.length,
    };
  }

  /**
   * Save a message to the conversation history
   */
  async saveMessage(
    sessionId: string,
    role: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const messagesCollection = DatabaseHelper.getCollection(this.messagesCollection);
    
    await messagesCollection.insertOne({
      sessionId,
      role,
      content,
      metadata: metadata || {},
      timestamp: new Date(),
    });
  }

  /**
   * Save conversation state (checkpoint)
   */
  async saveConversationState(
    sessionId: string,
    state: ConversationState,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const checkpointsCollection = DatabaseHelper.getCollection(this.checkpointsCollection);
    
    await checkpointsCollection.insertOne({
      sessionId,
      state,
      metadata: metadata || {},
      timestamp: new Date(),
    });
  }

  /**
   * Get the latest conversation state (checkpoint)
   */
  async getConversationState(sessionId: string): Promise<ConversationState | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const checkpointsCollection = DatabaseHelper.getCollection(this.checkpointsCollection);
    
    const checkpoint = await checkpointsCollection
      .findOne({ sessionId }, { sort: { timestamp: -1 } });

    if (!checkpoint) {
      return null;
    }

    return checkpoint.state;
  }

  /**
   * Delete a conversation thread and all its data
   */
  async deleteConversationThread(sessionId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const messagesCollection = DatabaseHelper.getCollection(this.messagesCollection);
    const checkpointsCollection = DatabaseHelper.getCollection(this.checkpointsCollection);

    await messagesCollection.deleteMany({ sessionId });
    await checkpointsCollection.deleteMany({ sessionId });
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(user: User): Promise<ConversationSession[]> {
    const sessions = await EntityHelper.findBy(
      ConversationSession,
      { userId: user._id },
      { lastAccessedAt: -1 }
    );
    return sessions;
  }

  /**
   * Get message count for a session
   */
  async getMessageCount(sessionId: string): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const messagesCollection = DatabaseHelper.getCollection(this.messagesCollection);
    return await messagesCollection.countDocuments({ sessionId });
  }

  /**
   * Get recent messages for a session (limited)
   */
  async getRecentMessages(sessionId: string, limit: number = 10): Promise<ConversationMessage[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const messagesCollection = DatabaseHelper.getCollection(this.messagesCollection);
    
    const messages = await messagesCollection
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    // Reverse to get chronological order
    return messages.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata,
    }));
  }
}

export interface ConversationHistory {
  sessionId: string;
  messages: ConversationMessage[];
  messageCount: number;
}

export interface ConversationMessage {
  role: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ConversationState {
  context?: Record<string, any>;
  variables?: Record<string, any>;
  lastIntent?: string;
  [key: string]: any;
}

// Export singleton instance
export const conversationMemoryService = new ConversationMemoryService();
