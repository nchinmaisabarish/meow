# Database Migrations

This directory contains SQL migration scripts for the Meow backend.

## Checkpoint Database Setup

### Prerequisites

The agent conversation checkpointing feature requires a PostgreSQL database. You can use a separate PostgreSQL instance or the same instance as your main application database.

### Environment Variables

Configure the checkpoint database connection using one of the following approaches:

#### Option 1: Connection String
```bash
CHECKPOINT_POSTGRES_URI=postgresql://user:password@localhost:5432/meow_checkpoints
```

#### Option 2: Individual Parameters
```bash
CHECKPOINT_POSTGRES_HOST=localhost
CHECKPOINT_POSTGRES_PORT=5432
CHECKPOINT_POSTGRES_DB=meow_checkpoints
CHECKPOINT_POSTGRES_USER=postgres
CHECKPOINT_POSTGRES_PASSWORD=your_password
```

#### Optional Configuration
```bash
CHECKPOINT_DB_POOL_MAX=10                    # Maximum pool connections (default: 10)
CHECKPOINT_DB_IDLE_TIMEOUT=30000             # Idle timeout in ms (default: 30000)
CHECKPOINT_DB_CONNECTION_TIMEOUT=10000       # Connection timeout in ms (default: 10000)
```

### Running Migrations

To set up the checkpoint tables, run the SQL migration script:

```bash
psql -h localhost -U postgres -d meow_checkpoints -f backend/src/migrations/001_create_checkpoint_tables.sql
```

Or using the connection string:

```bash
psql postgresql://user:password@localhost:5432/meow_checkpoints -f backend/src/migrations/001_create_checkpoint_tables.sql
```

### Migration Files

- **001_create_checkpoint_tables.sql**: Creates the checkpoint storage tables and indexes for agent conversation state persistence.

## Features

The checkpoint system provides:

1. **Conversation Continuity**: Agents can resume conversations across sessions without losing context
2. **Audit Trail**: All agent interactions are logged with timestamps and metadata
3. **Session Tracking**: Active conversation sessions are tracked with user and team context
4. **State Persistence**: Agent decision-making state is preserved for long-running workflows

## Usage

The checkpoint system is automatically integrated into the `IntentRouter` service. When executing agent requests:

```typescript
// Create a new conversation
const result = await intentRouter.execute({
  input: "Show me all opportunities",
  user: currentUser,
  team: currentTeam,
});

// Continue an existing conversation
const followUp = await intentRouter.execute({
  input: "Filter by high value deals",
  user: currentUser,
  team: currentTeam,
  threadId: result.threadId, // Use the thread ID from previous interaction
});
```

## Database Schema

### checkpoints table
- `thread_id`: Unique identifier for the conversation thread
- `checkpoint_id`: Unique identifier for this specific checkpoint (UUID)
- `parent_id`: Reference to the parent checkpoint for conversation history
- `checkpoint`: Serialized checkpoint data containing agent state (BYTEA)
- `metadata`: Serialized metadata about the checkpoint (BYTEA)
- `created_at`: Timestamp of checkpoint creation

### checkpoint_sessions table
- `thread_id`: Unique identifier for the conversation thread
- `user_id`: MongoDB ObjectId of the user who owns this session
- `team_id`: MongoDB ObjectId of the team context for this session
- `last_checkpoint_id`: Most recent checkpoint_id for this session
- `last_activity_at`: Timestamp of last activity
- `created_at`: Timestamp of session creation
- `metadata`: Additional session metadata (JSONB)

## Maintenance

### Cleanup Old Checkpoints

To clean up old checkpoints (older than 30 days):

```sql
DELETE FROM checkpoints 
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Archive Old Sessions

To archive inactive sessions (no activity for 90 days):

```sql
DELETE FROM checkpoint_sessions 
WHERE last_activity_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Connection Issues

If you encounter connection errors:

1. Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
2. Check credentials and database exist
3. Ensure firewall allows connections to PostgreSQL port
4. Review logs in the application for detailed error messages

### Performance

If checkpoint operations are slow:

1. Ensure indexes are created (they're included in the migration)
2. Monitor database connection pool usage
3. Consider increasing `CHECKPOINT_DB_POOL_MAX` if needed
4. Regularly clean up old checkpoints to reduce table size
