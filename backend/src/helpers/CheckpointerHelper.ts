import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple } from '@langchain/langgraph';
import { DatabaseHelper } from './DatabaseHelper.js';
import { Collection, Document } from 'mongodb';
import { log } from '../worker.js';

// Type alias for RunnableConfig to avoid version conflicts
type RunnableConfig = any;

/**
 * MongoDB document structure for storing checkpoints
 */
interface CheckpointDocument extends Document {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id?: string;
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  created_at: Date;
}

/**
 * MongoDB-based checkpoint saver for LangGraph workflows
 * Stores conversation state and workflow checkpoints in MongoDB
 */
export class MongoDBCheckpointSaver extends BaseCheckpointSaver {
  private collectionName: string = 'checkpoints';

  constructor() {
    super();
  }

  /**
   * Get the MongoDB collection for checkpoints
   */
  private getCollection(): Collection<CheckpointDocument> {
    return DatabaseHelper.getCollection(this.collectionName) as unknown as Collection<CheckpointDocument>;
  }

  /**
   * Get a checkpoint tuple by config
   */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    try {
      const threadId = config.configurable?.thread_id as string | undefined;
      const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) || '';
      const checkpointId = config.configurable?.checkpoint_id as string | undefined;

      if (!threadId) {
        return undefined;
      }

      const collection = this.getCollection();
      
      let query: Record<string, unknown> = {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
      };

      if (checkpointId) {
        query.checkpoint_id = checkpointId;
      }

      // Find the most recent checkpoint if no specific ID is provided
      const document = await collection.findOne(
        query,
        { sort: { created_at: -1 } }
      );

      if (!document) {
        return undefined;
      }

      // Build the config for this checkpoint
      const checkpointConfig: RunnableConfig = {
        configurable: {
          thread_id: document.thread_id,
          checkpoint_ns: document.checkpoint_ns,
          checkpoint_id: document.checkpoint_id,
        },
      };

      // Build parent config if available
      let parentConfig: RunnableConfig | undefined;
      if (document.parent_checkpoint_id) {
        parentConfig = {
          configurable: {
            thread_id: document.thread_id,
            checkpoint_ns: document.checkpoint_ns,
            checkpoint_id: document.parent_checkpoint_id,
          },
        };
      }

      return {
        config: checkpointConfig,
        checkpoint: document.checkpoint,
        metadata: document.metadata,
        parentConfig,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Error getting checkpoint: ${errorMessage}`);
      return undefined;
    }
  }

  /**
   * List checkpoints for a thread
   */
  async *list(
    config: RunnableConfig,
    limit?: number,
    before?: RunnableConfig
  ): AsyncGenerator<CheckpointTuple> {
    try {
      const threadId = config.configurable?.thread_id as string | undefined;
      const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) || '';

      if (!threadId) {
        return;
      }

      const collection = this.getCollection();
      
      let query: Record<string, unknown> = {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
      };

      // If 'before' config is provided, only get checkpoints before that one
      if (before?.configurable?.checkpoint_id) {
        const beforeDoc = await collection.findOne({
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: before.configurable.checkpoint_id as string,
        });

        if (beforeDoc) {
          query.created_at = { $lt: beforeDoc.created_at };
        }
      }

      const cursor = collection
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit || 10);

      for await (const document of cursor) {
        const checkpointConfig: RunnableConfig = {
          configurable: {
            thread_id: document.thread_id,
            checkpoint_ns: document.checkpoint_ns,
            checkpoint_id: document.checkpoint_id,
          },
        };

        let parentConfig: RunnableConfig | undefined;
        if (document.parent_checkpoint_id) {
          parentConfig = {
            configurable: {
              thread_id: document.thread_id,
              checkpoint_ns: document.checkpoint_ns,
              checkpoint_id: document.parent_checkpoint_id,
            },
          };
        }

        yield {
          config: checkpointConfig,
          checkpoint: document.checkpoint,
          metadata: document.metadata,
          parentConfig,
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Error listing checkpoints: ${errorMessage}`);
    }
  }

  /**
   * Save a checkpoint
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    try {
      const threadId = config.configurable?.thread_id as string | undefined;
      const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) || '';
      const parentCheckpointId = config.configurable?.checkpoint_id as string | undefined;

      if (!threadId) {
        throw new Error('thread_id is required in config.configurable');
      }

      const collection = this.getCollection();

      const document: CheckpointDocument = {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
        parent_checkpoint_id: parentCheckpointId,
        checkpoint,
        metadata,
        created_at: new Date(),
      };

      await collection.insertOne(document);

      return {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpoint.id,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Error saving checkpoint: ${errorMessage}`);
      throw error;
    }
  }
}

/**
 * Singleton instance of the MongoDB checkpoint saver
 */
let checkpointerInstance: MongoDBCheckpointSaver | null = null;

/**
 * Get or create the checkpoint saver instance
 */
export function getCheckpointer(): MongoDBCheckpointSaver {
  if (!checkpointerInstance) {
    checkpointerInstance = new MongoDBCheckpointSaver();
  }
  return checkpointerInstance;
}

/**
 * Reset the checkpointer instance (useful for testing)
 */
export function resetCheckpointer(): void {
  checkpointerInstance = null;
}

export const CheckpointerHelper = {
  getCheckpointer,
  resetCheckpointer,
};
