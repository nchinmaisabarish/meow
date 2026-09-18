-- Migration: Create checkpoint tables for agent conversation state persistence
-- This schema is compatible with LangGraph's checkpoint interface

-- Create checkpoints table
CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_id TEXT,
  checkpoint BYTEA NOT NULL,
  metadata BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, checkpoint_id)
);

-- Create index for efficient lookup of latest checkpoint per thread
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id_checkpoint_id 
  ON checkpoints (thread_id, checkpoint_id DESC);

-- Create index for parent_id lookups
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent_id 
  ON checkpoints (parent_id) WHERE parent_id IS NOT NULL;

-- Create index for created_at for cleanup/archival operations
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at 
  ON checkpoints (created_at);

-- Optional: Create a table to track active sessions/threads
CREATE TABLE IF NOT EXISTS checkpoint_sessions (
  thread_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  last_checkpoint_id TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Create index for user and team lookups
CREATE INDEX IF NOT EXISTS idx_checkpoint_sessions_user_id 
  ON checkpoint_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_checkpoint_sessions_team_id 
  ON checkpoint_sessions (team_id);

CREATE INDEX IF NOT EXISTS idx_checkpoint_sessions_last_activity 
  ON checkpoint_sessions (last_activity_at DESC);

-- Add comments for documentation
COMMENT ON TABLE checkpoints IS 'Stores agent conversation checkpoints for state persistence and resumption';
COMMENT ON COLUMN checkpoints.thread_id IS 'Unique identifier for the conversation thread';
COMMENT ON COLUMN checkpoints.checkpoint_id IS 'Unique identifier for this specific checkpoint (typically a UUID)';
COMMENT ON COLUMN checkpoints.parent_id IS 'Reference to the parent checkpoint_id for conversation history';
COMMENT ON COLUMN checkpoints.checkpoint IS 'Serialized checkpoint data containing agent state';
COMMENT ON COLUMN checkpoints.metadata IS 'Serialized metadata about the checkpoint (source, step, writes)';

COMMENT ON TABLE checkpoint_sessions IS 'Tracks active conversation sessions and their metadata';
COMMENT ON COLUMN checkpoint_sessions.thread_id IS 'Unique identifier for the conversation thread';
COMMENT ON COLUMN checkpoint_sessions.user_id IS 'MongoDB ObjectId of the user who owns this session';
COMMENT ON COLUMN checkpoint_sessions.team_id IS 'MongoDB ObjectId of the team context for this session';
COMMENT ON COLUMN checkpoint_sessions.last_checkpoint_id IS 'Most recent checkpoint_id for this session';
COMMENT ON COLUMN checkpoint_sessions.metadata IS 'Additional session metadata (e.g., initial request, tags)';
