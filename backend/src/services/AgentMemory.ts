import { Pool, PoolClient } from 'pg';
import { RunnableConfig } from '@langchain/core/runnables';
import { 
  BaseCheckpointSaver, 
  Checkpoint, 
  CheckpointMetadata, 
  CheckpointTuple 
} from '@langchain/langgraph';
import { createCheckpointPool } from '../config/checkpoint-db.js';
import { log } from '../worker.js';
import { ObjectId } from 'mongodb';

/**
 * Simple serializer protocol for checkpoint data
 */
interface SerializerProtocol<D> {
  stringify(obj: D): string;
  parse(data: string): Promise<D>;
}

/**
 * Default JSON serializer for checkpoints
 */
const defaultSerializer: SerializerProtocol<unknown> = {
  stringify: (obj: unknown) => JSON.stringify(obj),
  parse: async (data: string) => JSON.parse(data),
};

/**
 * PostgreSQL-based checkpoint saver for agent conversation state persistence.
 * Compatible with LangGraph's checkpoint interface.
 */
export class PostgresSaver extends BaseCheckpointSaver {
  private pool: Pool;
  private isSetup: boolean = false;
  public serde: SerializerProtocol<unknown>;

  constructor(pool: Pool, serde?: SerializerProtocol<unknown>) {
    super();
    this.pool = pool;
    this.serde = serde || defaultSerializer;
  }

  /**
   * Create a PostgresSaver from environment configuration
   */
  static fromConfig(serde?: SerializerProtocol<unknown>): PostgresSaver {
    const pool = createCheckpointPool();
    return new PostgresSaver(pool, serde);
  }

  /**
   * Initialize the database schema if not already set up
   */
  private async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    const client = await this.pool.connect();
    try {
      // Create checkpoints table
      await client.query(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          thread_id TEXT NOT NULL,
          checkpoint_id TEXT NOT NULL,
          parent_id TEXT,
          checkpoint BYTEA NOT NULL,
          metadata BYTEA NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (thread_id, checkpoint_id)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id_checkpoint_id 
          ON checkpoints (thread_id, checkpoint_id DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_parent_id 
          ON checkpoints (parent_id) WHERE parent_id IS NOT NULL
      `);

      this.isSetup = true;
      log.info('Checkpoint database schema initialized');
    } catch (error: unknown) {
      log.error('Error setting up checkpoint database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a checkpoint tuple by thread_id and optional checkpoint_id
   */
  async getTuple(config: any): Promise<CheckpointTuple | undefined> {
    await this.setup();

    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;

    if (!threadId) {
      return undefined;
    }

    const client = await this.pool.connect();
    try {
      let result;

      if (checkpointId) {
        // Get specific checkpoint
        result = await client.query(
          `SELECT checkpoint, parent_id, metadata 
           FROM checkpoints 
           WHERE thread_id = $1 AND checkpoint_id = $2`,
          [threadId, checkpointId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const checkpoint = await this.serde.parse(row.checkpoint.toString()) as Checkpoint;
          const metadata = await this.serde.parse(row.metadata.toString()) as CheckpointMetadata;
          return {
            config: config as any,
            checkpoint,
            metadata,
            parentConfig: row.parent_id
              ? {
                  configurable: {
                    thread_id: threadId,
                    checkpoint_id: row.parent_id,
                  },
                }
              : undefined,
          };
        }
      } else {
        // Get latest checkpoint for thread
        result = await client.query(
          `SELECT thread_id, checkpoint_id, parent_id, checkpoint, metadata 
           FROM checkpoints 
           WHERE thread_id = $1 
           ORDER BY checkpoint_id DESC 
           LIMIT 1`,
          [threadId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const checkpoint = await this.serde.parse(row.checkpoint.toString()) as Checkpoint;
          const metadata = await this.serde.parse(row.metadata.toString()) as CheckpointMetadata;
          return {
            config: {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_id: row.checkpoint_id,
              },
            } as any,
            checkpoint,
            metadata,
            parentConfig: row.parent_id
              ? {
                  configurable: {
                    thread_id: row.thread_id,
                    checkpoint_id: row.parent_id,
                  },
                }
              : undefined,
          };
        }
      }

      return undefined;
    } catch (error: unknown) {
      log.error('Error retrieving checkpoint:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List checkpoints for a thread, optionally with pagination
   */
  async *list(
    config: any,
    limit?: number,
    before?: any
  ): AsyncGenerator<CheckpointTuple> {
    await this.setup();

    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return;
    }

    const client = await this.pool.connect();
    try {
      let query = `
        SELECT thread_id, checkpoint_id, parent_id, checkpoint, metadata 
        FROM checkpoints 
        WHERE thread_id = $1
      `;
      const params: string[] = [threadId];

      if (before?.configurable?.checkpoint_id) {
        query += ` AND checkpoint_id < $2`;
        params.push(before.configurable.checkpoint_id);
      }

      query += ` ORDER BY checkpoint_id DESC`;

      if (limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(limit.toString());
      }

      const result = await client.query(query, params);

      for (const row of result.rows) {
        const checkpoint = await this.serde.parse(row.checkpoint.toString()) as Checkpoint;
        const metadata = await this.serde.parse(row.metadata.toString()) as CheckpointMetadata;
        yield {
          config: {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_id: row.checkpoint_id,
            },
          } as any,
          checkpoint,
          metadata,
          parentConfig: row.parent_id
            ? {
                configurable: {
                  thread_id: row.thread_id,
                  checkpoint_id: row.parent_id,
                },
              }
            : undefined,
        };
      }
    } catch (error: unknown) {
      log.error('Error listing checkpoints:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save a checkpoint to the database
   */
  async put(
    config: any,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<any> {
    await this.setup();

    const threadId = config.configurable?.thread_id;
    const parentId = config.configurable?.checkpoint_id;

    if (!threadId) {
      throw new Error('thread_id is required in config.configurable');
    }

    const client = await this.pool.connect();
    try {
      const checkpointData = Buffer.from(this.serde.stringify(checkpoint));
      const metadataData = Buffer.from(this.serde.stringify(metadata));

      await client.query(
        `INSERT INTO checkpoints (thread_id, checkpoint_id, parent_id, checkpoint, metadata) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (thread_id, checkpoint_id) 
         DO UPDATE SET 
           parent_id = EXCLUDED.parent_id,
           checkpoint = EXCLUDED.checkpoint,
           metadata = EXCLUDED.metadata,
           created_at = CURRENT_TIMESTAMP`,
        [threadId, checkpoint.id, parentId || null, checkpointData, metadataData]
      );

      log.debug('Checkpoint saved:', { threadId, checkpointId: checkpoint.id });

      return {
        configurable: {
          thread_id: threadId,
          checkpoint_id: checkpoint.id,
        },
      };
    } catch (error: unknown) {
      log.error('Error saving checkpoint:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    log.info('Checkpoint database pool closed');
  }
}

/**
 * Session metadata for tracking active conversations
 */
export interface SessionMetadata {
  threadId: string;
  userId: string;
  teamId: string;
  lastCheckpointId?: string;
  lastActivityAt: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * AgentMemory service for managing agent conversation state and sessions
 */
export class AgentMemory {
  private checkpointer: PostgresSaver;

  constructor(checkpointer?: PostgresSaver) {
    this.checkpointer = checkpointer || PostgresSaver.fromConfig();
  }

  /**
   * Get the checkpoint saver instance
   */
  getCheckpointer(): PostgresSaver {
    return this.checkpointer;
  }

  /**
   * Create a new conversation thread
   */
  createThreadId(userId: ObjectId, teamId: ObjectId): string {
    const timestamp = Date.now();
    return `thread_${userId.toString()}_${teamId.toString()}_${timestamp}`;
  }

  /**
   * Save a session record for tracking active conversations
   */
  async saveSession(session: SessionMetadata): Promise<void> {
    const client = await this.checkpointer['pool'].connect();
    try {
      await client.query(
        `INSERT INTO checkpoint_sessions 
         (thread_id, user_id, team_id, last_checkpoint_id, last_activity_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (thread_id) 
         DO UPDATE SET 
           last_checkpoint_id = EXCLUDED.last_checkpoint_id,
           last_activity_at = EXCLUDED.last_activity_at,
           metadata = EXCLUDED.metadata`,
        [
          session.threadId,
          session.userId,
          session.teamId,
          session.lastCheckpointId || null,
          session.lastActivityAt,
          session.metadata ? JSON.stringify(session.metadata) : null,
        ]
      );
    } catch (error: unknown) {
      log.error('Error saving session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<SessionMetadata[]> {
    const client = await this.checkpointer['pool'].connect();
    try {
      const result = await client.query(
        `SELECT thread_id, user_id, team_id, last_checkpoint_id, 
                last_activity_at, created_at, metadata
         FROM checkpoint_sessions
         WHERE user_id = $1
         ORDER BY last_activity_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row: any) => ({
        threadId: row.thread_id,
        userId: row.user_id,
        teamId: row.team_id,
        lastCheckpointId: row.last_checkpoint_id,
        lastActivityAt: row.last_activity_at,
        createdAt: row.created_at,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error: unknown) {
      log.error('Error getting user sessions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the agent memory service
   */
  async close(): Promise<void> {
    await this.checkpointer.close();
  }
}

// Export a singleton instance
export const agentMemory = new AgentMemory();
