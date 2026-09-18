import { Pool, PoolConfig } from 'pg';
import { log } from '../worker.js';

/**
 * PostgreSQL connection configuration for checkpoint storage
 */
export interface CheckpointDbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Get checkpoint database configuration from environment variables
 */
export const getCheckpointDbConfig = (): CheckpointDbConfig => {
  // Support both connection string and individual parameters
  if (process.env.CHECKPOINT_POSTGRES_URI) {
    return {
      connectionString: process.env.CHECKPOINT_POSTGRES_URI,
      max: parseInt(process.env.CHECKPOINT_DB_POOL_MAX || '10'),
      idleTimeoutMillis: parseInt(process.env.CHECKPOINT_DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.CHECKPOINT_DB_CONNECTION_TIMEOUT || '10000'),
    };
  }

  return {
    host: process.env.CHECKPOINT_POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.CHECKPOINT_POSTGRES_PORT || '5432'),
    database: process.env.CHECKPOINT_POSTGRES_DB || 'meow_checkpoints',
    user: process.env.CHECKPOINT_POSTGRES_USER || 'postgres',
    password: process.env.CHECKPOINT_POSTGRES_PASSWORD,
    max: parseInt(process.env.CHECKPOINT_DB_POOL_MAX || '10'),
    idleTimeoutMillis: parseInt(process.env.CHECKPOINT_DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.CHECKPOINT_DB_CONNECTION_TIMEOUT || '10000'),
  };
};

/**
 * Create a PostgreSQL connection pool for checkpoint storage
 */
export const createCheckpointPool = (): Pool => {
  const config = getCheckpointDbConfig();
  
  const poolConfig: PoolConfig = config.connectionString
    ? {
        connectionString: config.connectionString,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      }
    : {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      };

  const pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err: Error) => {
    log.error('Unexpected error on checkpoint database pool:', err);
  });

  log.info('Checkpoint database pool created');

  return pool;
};
