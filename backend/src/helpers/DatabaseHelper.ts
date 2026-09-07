import { MongoClient } from 'mongodb';
import { log } from '../worker.js';

let client: MongoClient;
let isConnected: boolean = false;

const connect = async (uri: string) => {
  client = new MongoClient(uri);

  client.on('open', () => {
    isConnected = true;
    log.debug('database connected.');
  });

  client.on('topologyClosed', () => {
    isConnected = false;
    log.debug('database disconnected.');
  });

  await client.connect();
  await client.db().command({ ping: 1 });

  // Initialize workflow checkpoints collection
  await initializeCollections();
};

const initializeCollections = async () => {
  try {
    const db = client.db();
    
    // Create workflow_checkpoints collection if it doesn't exist
    const collections = await db.listCollections({ name: 'workflow_checkpoints' }).toArray();
    
    if (collections.length === 0) {
      await db.createCollection('workflow_checkpoints');
      log.debug('workflow_checkpoints collection created.');
    }

    // Create indexes for efficient querying
    const checkpointsCollection = db.collection('workflow_checkpoints');
    await checkpointsCollection.createIndex({ thread_id: 1, created_at: -1 });
    await checkpointsCollection.createIndex({ thread_id: 1, checkpoint_id: 1 }, { unique: true });
    
    log.debug('workflow_checkpoints indexes created.');
  } catch (error: unknown) {
    log.error('Failed to initialize collections:', error);
  }
};

function get() {
  return client.db();
}

function getCollection(name: string) {
  return client.db().collection(name);
}

function close() {
  client.close();
}

function isInitialized(): boolean {
  return isConnected;
}

export const DatabaseHelper = {
  connect,
  get,
  getCollection,
  close,
  isInitialized,
};
