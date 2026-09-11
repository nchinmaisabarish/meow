import { DatabaseHelper } from '../helpers/DatabaseHelper.js';
import { log } from '../worker.js';

/**
 * Migration to create checkpoint collection and indexes for LangGraph state persistence
 * 
 * This migration creates:
 * - checkpoints collection: stores workflow state snapshots
 * - Indexes for efficient querying by thread_id, checkpoint_ns, and checkpoint_id
 */
export async function createCheckpointCollections(): Promise<void> {
  try {
    const db = DatabaseHelper.get();
    
    // Create checkpoints collection if it doesn't exist
    const collections = await db.listCollections({ name: 'checkpoints' }).toArray();
    
    if (collections.length === 0) {
      await db.createCollection('checkpoints');
      log.info('Created checkpoints collection');
    } else {
      log.info('Checkpoints collection already exists');
    }

    const checkpointsCollection = db.collection('checkpoints');

    // Create indexes for efficient querying
    // Index on thread_id and checkpoint_ns for finding checkpoints by conversation
    await checkpointsCollection.createIndex(
      { thread_id: 1, checkpoint_ns: 1, created_at: -1 },
      { name: 'thread_checkpoint_time_idx' }
    );
    log.info('Created index: thread_checkpoint_time_idx');

    // Index on thread_id, checkpoint_ns, and checkpoint_id for finding specific checkpoints
    await checkpointsCollection.createIndex(
      { thread_id: 1, checkpoint_ns: 1, checkpoint_id: 1 },
      { name: 'thread_checkpoint_id_idx', unique: true }
    );
    log.info('Created index: thread_checkpoint_id_idx');

    // Index on created_at for cleanup/archival operations
    await checkpointsCollection.createIndex(
      { created_at: 1 },
      { name: 'created_at_idx' }
    );
    log.info('Created index: created_at_idx');

    log.info('Checkpoint collections migration completed successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Error creating checkpoint collections: ${errorMessage}`);
    throw error;
  }
}

/**
 * Rollback migration - drops the checkpoints collection
 * WARNING: This will delete all checkpoint data
 */
export async function dropCheckpointCollections(): Promise<void> {
  try {
    const db = DatabaseHelper.get();
    
    const collections = await db.listCollections({ name: 'checkpoints' }).toArray();
    
    if (collections.length > 0) {
      await db.dropCollection('checkpoints');
      log.info('Dropped checkpoints collection');
    } else {
      log.info('Checkpoints collection does not exist, nothing to drop');
    }

    log.info('Checkpoint collections rollback completed successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Error dropping checkpoint collections: ${errorMessage}`);
    throw error;
  }
}

/**
 * Check if the migration has been applied
 */
export async function isCheckpointMigrationApplied(): Promise<boolean> {
  try {
    const db = DatabaseHelper.get();
    const collections = await db.listCollections({ name: 'checkpoints' }).toArray();
    return collections.length > 0;
  } catch (error: unknown) {
    return false;
  }
}
