import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { conversationMemoryService, ConversationState } from '../services/ConversationMemory.js';

/**
 * Process a natural language query with conversation context
 */
const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    // Get or create conversation session
    const session = await conversationMemoryService.getOrCreateSession(
      req.jwt.user,
      sessionId
    );

    // Get conversation history
    const history = await conversationMemoryService.getConversationHistory(session.sessionId);

    // Save the user's message
    await conversationMemoryService.saveMessage(
      session.sessionId,
      'user',
      message,
      {
        userId: req.jwt.user._id.toString(),
        teamId: req.jwt.team._id.toString(),
      }
    );

    // TODO: Process the natural language query with the conversation context
    // This is where you would integrate with your NLP/LLM service
    // For now, we'll return a placeholder response
    const responseMessage = `Received: ${message}`;
    
    // Save the assistant's response
    await conversationMemoryService.saveMessage(
      session.sessionId,
      'assistant',
      responseMessage,
      {
        source: 'natural_language_controller',
      }
    );

    // Get the current conversation state or create a new one
    const currentState = await conversationMemoryService.getConversationState(session.sessionId);
    
    // Update conversation state
    const newState: ConversationState = {
      ...currentState,
      context: {
        ...(currentState?.context || {}),
        lastQuery: message,
        lastResponse: responseMessage,
      },
      variables: {
        ...(currentState?.variables || {}),
        messageCount: history.messageCount + 2,
      },
    };

    // Save the updated conversation state
    await conversationMemoryService.saveConversationState(
      session.sessionId,
      newState,
      {
        source: 'natural_language_controller',
        user_id: req.jwt.user._id.toString(),
        team_id: req.jwt.team._id.toString(),
        timestamp: new Date().toISOString(),
      }
    );

    const response = {
      sessionId: session.sessionId,
      message: responseMessage,
      context: {
        previousMessages: history.messageCount,
        hasHistory: history.messageCount > 0,
      },
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

/**
 * Get conversation history for a session
 */
const getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify the session belongs to the user
    const sessions = await conversationMemoryService.getUserSessions(req.jwt.user);
    const session = sessions.find((s) => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const history = await conversationMemoryService.getConversationHistory(sessionId);

    return res.json(history);
  } catch (error) {
    return next(error);
  }
};

/**
 * List all conversation sessions for the authenticated user
 */
const listSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await conversationMemoryService.getUserSessions(req.jwt.user);

    const plainSessions = sessions.map((session) => session.toPlain());

    return res.json(plainSessions);
  } catch (error) {
    return next(error);
  }
};

/**
 * Delete a conversation session and its history
 */
const deleteSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify the session belongs to the user
    const sessions = await conversationMemoryService.getUserSessions(req.jwt.user);
    const session = sessions.find((s) => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete the conversation thread from checkpointer
    await conversationMemoryService.deleteConversationThread(sessionId);

    return res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

/**
 * Create a new conversation session
 */
const createSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { metadata } = req.body;

    // Create new session (sessionId will be auto-generated)
    const session = await conversationMemoryService.getOrCreateSession(
      req.jwt.user,
      undefined
    );

    // Update metadata if provided
    if (metadata && typeof metadata === 'object') {
      session.metadata = metadata;
      await conversationMemoryService.getOrCreateSession(req.jwt.user, session.sessionId);
    }

    return res.status(201).json(session.toPlain());
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
  getHistory,
  listSessions,
  deleteSession,
  createSession,
};
