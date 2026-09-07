import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  SerializerProtocol,
} from '@langchain/langgraph';
import { Collection, Document } from 'mongodb';
import { DatabaseHelper } from '../helpers/DatabaseHelper.js';

/**
 * MongoDB document structure for storing checkpoints
 */
interface CheckpointDocument extends Document {
  thread_id: string;
  checkpoint_id: string;
  parent_checkpoint_id?: string;
  checkpoint: string; // Serialized checkpoint
  metadata: string; // Serialized metadata
  created_at: Date;
}

/**
 * MongoDB-backed checkpointer for LangGraph workflows
 * Persists workflow state to MongoDB for resumability and conversation memory
 */
export class MongoDBCheckpointer extends BaseCheckpointSaver {
  private collectionName: string;

  constructor(collectionName: string = 'workflow_checkpoints', serde?: SerializerProtocol<unknown>) {
    super(serde);
    this.collectionName = collectionName;
  }

  /**
   * Get the MongoDB collection for checkpoints
   */
  private getCollection(): Collection {
    return DatabaseHelper.getCollection(this.collectionName);
  }

  /**
   * Get a checkpoint tuple by config
   */
  async getTuple(config: any): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;

    if (!threadId) {
      return undefined;
    }

    const collection = this.getCollection();

    let query: any = { thread_id: threadId };

    if (checkpointId) {
      query.checkpoint_id = checkpointId;
    }

    // Get the most recent checkpoint for this thread
    const doc = await collection.findOne(query, {
      sort: { created_at: -1 },
    });

    if (!doc) {
      return undefined;
    }

    // Deserialize checkpoint and metadata
    const checkpoint = (await this.serde.parse(doc.checkpoint)) as Checkpoint;
    const metadata = (await this.serde.parse(doc.metadata)) as CheckpointMetadata;

    // Build parent config if available
    let parentConfig: any | undefined;
    if (doc.parent_checkpoint_id) {
      parentConfig = {
        configurable: {
          thread_id: doc.thread_id,
          checkpoint_id: doc.parent_checkpoint_id,
        },
      };
    }

    return {
      config: {
        configurable: {
          thread_id: doc.thread_id,
          checkpoint_id: doc.checkpoint_id,
        },
      } as any,
      checkpoint,
      metadata,
      parentConfig: parentConfig as any,
    };
  }

  /**
   * List checkpoints for a given config
   */
  async *list(
    config: any,
    limit?: number,
    before?: any
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;

    if (!threadId) {
      return;
    }

    const collection = this.getCollection();

    let query: any = { thread_id: threadId };

    // If 'before' is specified, only get checkpoints before that checkpoint
    if (before?.configurable?.checkpoint_id) {
      const beforeDoc = await collection.findOne({
        thread_id: threadId,
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

    for await (const doc of cursor) {
      const checkpoint = (await this.serde.parse(doc.checkpoint)) as Checkpoint;
      const metadata = (await this.serde.parse(doc.metadata)) as CheckpointMetadata;

      let parentConfig: any | undefined;
      if (doc.parent_checkpoint_id) {
        parentConfig = {
          configurable: {
            thread_id: doc.thread_id,
            checkpoint_id: doc.parent_checkpoint_id,
          },
        };
      }

      yield {
        config: {
          configurable: {
            thread_id: doc.thread_id,
            checkpoint_id: doc.checkpoint_id,
          },
        } as any,
        checkpoint,
        metadata,
        parentConfig: parentConfig as any,
      };
    }
  }

  /**
   * Save a checkpoint to MongoDB
   */
  async put(
    config: any,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<any> {
    const threadId = config.configurable?.thread_id as string | undefined;

    if (!threadId) {
      throw new Error('thread_id is required in config.configurable');
    }

    const collection = this.getCollection();

    // Serialize checkpoint and metadata
    const serializedCheckpoint = this.serde.stringify(checkpoint);
    const serializedMetadata = this.serde.stringify(metadata);

    // Get parent checkpoint ID if available
    const parentCheckpointId = config.configurable?.checkpoint_id as string | undefined;

    const doc: CheckpointDocument = {
      thread_id: threadId,
      checkpoint_id: checkpoint.id,
      parent_checkpoint_id: parentCheckpointId,
      checkpoint: serializedCheckpoint,
      metadata: serializedMetadata,
      created_at: new Date(),
    };

    await collection.insertOne(doc);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  /**
   * Initialize the collection with indexes
   */
  async initialize(): Promise<void> {
    const collection = this.getCollection();

    // Create indexes for efficient querying
    await collection.createIndex({ thread_id: 1, created_at: -1 });
    await collection.createIndex({ thread_id: 1, checkpoint_id: 1 }, { unique: true });
  }

  /**
   * Delete all checkpoints for a given thread
   */
  async deleteThread(threadId: string): Promise<void> {
    const collection = this.getCollection();
    await collection.deleteMany({ thread_id: threadId });
  }

  /**
   * Get the number of checkpoints for a given thread
   */
  async getCheckpointCount(threadId: string): Promise<number> {
    const collection = this.getCollection();
    return await collection.countDocuments({ thread_id: threadId });
  }
}
