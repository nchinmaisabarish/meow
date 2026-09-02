import 'reflect-metadata';
import test from 'ava';
import { ConversationMemoryManager, ConversationMessage } from '../memory/ConversationMemoryManager.js';
import { DatabaseHelper } from '../helpers/DatabaseHelper.js';

// Skip tests if database is not connected
const skipIfNotConnected = (t: any) => {
  if (!DatabaseHelper.isInitialized()) {
    t.log('Skipping test: Database not connected');
    t.pass();
    return true;
  }
  return false;
};

test.serial('ConversationMemoryManager can be instantiated', async (t) => {
  if (skipIfNotConnected(t)) return;

  const manager = new ConversationMemoryManager();
  t.truthy(manager);
  t.is(typeof manager.getCheckpoint, 'function');
  t.is(typeof manager.saveCheckpoint, 'function');
  t.is(typeof manager.deleteSession, 'function');
  t.is(typeof manager.addMessages, 'function');
});

test.serial('ConversationMemoryManager can save and retrieve checkpoint', async (t) => {
  if (skipIfNotConnected(t)) return;

  const manager = new ConversationMemoryManager();

  const sessionId = `test-session-${Date.now()}`;
  const messages: ConversationMessage[] = [
    { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
  ];

  // Save checkpoint
  const saved = await manager.saveCheckpoint(sessionId, messages, {
    test: true,
    timestamp: new Date().toISOString(),
  });

  t.truthy(saved);
  t.is(saved.sessionId, sessionId);
  t.is(saved.messages.length, 2);

  // Retrieve checkpoint
  const retrieved = await manager.getCheckpoint(sessionId);

  t.truthy(retrieved);
  if (retrieved) {
    t.is(retrieved.sessionId, sessionId);
    t.is(retrieved.messages.length, 2);
    t.is(retrieved.messages[0]?.content, 'Hello');
    t.is(retrieved.messages[1]?.content, 'Hi there!');
    t.truthy(retrieved.metadata.test);
  }

  // Clean up
  await manager.deleteSession(sessionId);
});

test.serial('ConversationMemoryManager returns undefined for non-existent session', async (t) => {
  if (skipIfNotConnected(t)) return;

  const manager = new ConversationMemoryManager();

  const sessionId = `non-existent-session-${Date.now()}`;
  const retrieved = await manager.getCheckpoint(sessionId);

  t.is(retrieved, undefined);
});

test.serial('ConversationMemoryManager can maintain conversation history across multiple saves', async (t) => {
  if (skipIfNotConnected(t)) return;

  const manager = new ConversationMemoryManager();

  const sessionId = `multi-save-session-${Date.now()}`;

  // First interaction
  const messages1: ConversationMessage[] = [
    { role: 'user', content: 'What is the weather?', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'It is sunny.', timestamp: new Date().toISOString() },
  ];
  await manager.saveCheckpoint(sessionId, messages1);

  // Second interaction - add more messages
  const messages2: ConversationMessage[] = [
    { role: 'user', content: 'What about tomorrow?', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'It will be cloudy.', timestamp: new Date().toISOString() },
  ];
  await manager.addMessages(sessionId, messages2);

  // Verify final state
  const retrieved = await manager.getCheckpoint(sessionId);
  t.truthy(retrieved);

  if (retrieved) {
    t.is(retrieved.messages.length, 4);
    t.is(retrieved.messages[0]?.content, 'What is the weather?');
    t.is(retrieved.messages[1]?.content, 'It is sunny.');
    t.is(retrieved.messages[2]?.content, 'What about tomorrow?');
    t.is(retrieved.messages[3]?.content, 'It will be cloudy.');
  }

  // Clean up
  await manager.deleteSession(sessionId);
});

test.serial('ConversationMemoryManager can delete session', async (t) => {
  if (skipIfNotConnected(t)) return;

  const manager = new ConversationMemoryManager();

  const sessionId = `delete-session-${Date.now()}`;
  const messages: ConversationMessage[] = [
    { role: 'user', content: 'Test', timestamp: new Date().toISOString() },
  ];

  // Save checkpoint
  await manager.saveCheckpoint(sessionId, messages);

  // Verify it exists
  const retrieved1 = await manager.getCheckpoint(sessionId);
  t.truthy(retrieved1);

  // Delete session
  await manager.deleteSession(sessionId);

  // Verify it's gone
  const retrieved2 = await manager.getCheckpoint(sessionId);
  t.is(retrieved2, undefined);
});

test.serial('ConversationMemoryManager can get all sessions', async (t) => {
  if (skipIfNotConnected(t)) return;

  const manager = new ConversationMemoryManager();

  const sessionId1 = `session-list-1-${Date.now()}`;
  const sessionId2 = `session-list-2-${Date.now()}`;

  const messages: ConversationMessage[] = [
    { role: 'user', content: 'Test', timestamp: new Date().toISOString() },
  ];

  // Create two sessions
  await manager.saveCheckpoint(sessionId1, messages);
  await manager.saveCheckpoint(sessionId2, messages);

  // Get all sessions
  const sessions = await manager.getAllSessions();

  t.truthy(sessions);
  t.true(Array.isArray(sessions));
  t.true(sessions.includes(sessionId1));
  t.true(sessions.includes(sessionId2));

  // Clean up
  await manager.deleteSession(sessionId1);
  await manager.deleteSession(sessionId2);
});
