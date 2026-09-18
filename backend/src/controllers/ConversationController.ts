import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { agentMemory } from '../services/AgentMemory.js';
import { log } from '../worker.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';

/**
 * Get all conversations for the authenticated user
 * Supports filtering by date range and status
 */
const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.jwt.user._id!.toString();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new InvalidRequestError('Limit must be between 1 and 100');
    }

    // Validate dates if provided
    if (startDate && isNaN(startDate.getTime())) {
      throw new InvalidRequestError('Invalid startDate format');
    }
    if (endDate && isNaN(endDate.getTime())) {
      throw new InvalidRequestError('Invalid endDate format');
    }

    log.info('Fetching conversations for user:', { userId, limit });

    // Get user sessions
    const sessions = await agentMemory.getUserSessions(userId, limit);

    // Filter by date range if provided
    let filteredSessions = sessions;
    if (startDate || endDate) {
      filteredSessions = sessions.filter((session: any) => {
        const activityDate = new Date(session.lastActivityAt);
        if (startDate && activityDate < startDate) {
          return false;
        }
        if (endDate && activityDate > endDate) {
          return false;
        }
        return true;
      });
    }

    // Format response
    const conversations = filteredSessions.map((session: any) => ({
      threadId: session.threadId,
      userId: session.userId,
      teamId: session.teamId,
      lastCheckpointId: session.lastCheckpointId,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      metadata: session.metadata,
    }));

    return res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (error: unknown) {
    log.error('Error fetching conversations:', error);
    return next(error);
  }
};

/**
 * Get a specific conversation by thread ID
 * Returns the conversation history with all checkpoints
 */
const get = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const threadId = req.params.threadId;
    const userId = req.jwt.user._id!.toString();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 200) {
      throw new InvalidRequestError('Limit must be between 1 and 200');
    }

    if (!threadId) {
      throw new InvalidRequestError('Thread ID is required');
    }

    log.info('Fetching conversation history:', { threadId, userId, limit });

    // Verify the thread belongs to the user by checking sessions
    const userSessions = await agentMemory.getUserSessions(userId, 1000);
    const session = userSessions.find((s: any) => s.threadId === threadId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found or access denied',
      });
    }

    // Get checkpoints for this thread
    const checkpointer = agentMemory.getCheckpointer();
    const checkpoints: any[] = [];

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    // Collect checkpoints using the async generator
    for await (const checkpoint of checkpointer.list(config, limit)) {
      if (checkpoint.config.configurable) {
        checkpoints.push({
          checkpointId: checkpoint.config.configurable.checkpoint_id,
          threadId: checkpoint.config.configurable.thread_id,
          parentCheckpointId: checkpoint.parentConfig?.configurable?.checkpoint_id,
          checkpoint: checkpoint.checkpoint,
          metadata: checkpoint.metadata,
        });
      }
    }

    return res.json({
      success: true,
      threadId,
      session: {
        threadId: session.threadId,
        userId: session.userId,
        teamId: session.teamId,
        lastCheckpointId: session.lastCheckpointId,
        lastActivityAt: session.lastActivityAt,
        createdAt: session.createdAt,
        metadata: session.metadata,
      },
      checkpointCount: checkpoints.length,
      checkpoints,
    });
  } catch (error: unknown) {
    log.error('Error fetching conversation:', error);
    return next(error);
  }
};

export const ConversationController = {
  list,
  get,
};
