import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntentRegistry } from './IntentRegistry.js';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('registerIntent', () => {
    it('should register a simple string pattern intent', () => {
      const handler = async () => ({ result: 'test' });
      registry.registerIntent('hello', handler, 'greeting');

      const intents = registry.getRegisteredIntents();
      expect(intents).toContain('greeting');
    });

    it('should register a regex pattern intent', () => {
      const handler = async () => ({ result: 'test' });
      registry.registerIntent(/create card/i, handler, 'create_card');

      const intents = registry.getRegisteredIntents();
      expect(intents).toContain('create_card');
    });

    it('should register multiple intents', () => {
      const handler1 = async () => ({ result: 'test1' });
      const handler2 = async () => ({ result: 'test2' });

      registry.registerIntent('hello', handler1, 'greeting');
      registry.registerIntent('goodbye', handler2, 'farewell');

      const intents = registry.getRegisteredIntents();
      expect(intents).toHaveLength(2);
      expect(intents).toContain('greeting');
      expect(intents).toContain('farewell');
    });

    it('should sort intents by priority', () => {
      const handler1 = async () => ({ result: 'low' });
      const handler2 = async () => ({ result: 'high' });

      registry.registerIntent('low', handler1, 'low_priority', 1);
      registry.registerIntent('high', handler2, 'high_priority', 10);

      const intents = registry.getRegisteredIntents();
      expect(intents[0]).toBe('high_priority');
      expect(intents[1]).toBe('low_priority');
    });
  });

  describe('resolveIntent', () => {
    it('should resolve exact string match with confidence 1.0', async () => {
      const handler = async () => ({ result: 'greeting' });
      registry.registerIntent('hello', handler, 'greeting');

      const match = await registry.resolveIntent('hello');

      expect(match.intent).toBe('greeting');
      expect(match.confidence).toBe(1.0);
      expect(match.handler).toBe(handler);
    });

    it('should resolve partial string match with confidence 0.8', async () => {
      const handler = async () => ({ result: 'greeting' });
      registry.registerIntent('hello', handler, 'greeting');

      const match = await registry.resolveIntent('hello world');

      expect(match.intent).toBe('greeting');
      expect(match.confidence).toBe(0.8);
    });

    it('should resolve regex pattern match', async () => {
      const handler = async () => ({ result: 'card_created' });
      registry.registerIntent(/create card/i, handler, 'create_card');

      const match = await registry.resolveIntent('Create Card for project');

      expect(match.intent).toBe('create_card');
      expect(match.confidence).toBe(0.9);
    });

    it('should extract parameters from regex groups', async () => {
      const handler = async () => ({ result: 'card_created' });
      registry.registerIntent(
        /create card (?<title>.+)/i,
        handler,
        'create_card_with_title'
      );

      const match = await registry.resolveIntent('create card New Feature');

      expect(match.intent).toBe('create_card_with_title');
      expect(match.parameters).toHaveProperty('title');
      expect(match.parameters?.title).toBe('New Feature');
    });

    it('should return unknown intent when no match found', async () => {
      const handler = async () => ({ result: 'greeting' });
      registry.registerIntent('hello', handler, 'greeting');

      const match = await registry.resolveIntent('xyz');

      expect(match.intent).toBe('unknown');
      expect(match.confidence).toBe(0);
      expect(match.handler).toBeUndefined();
    });

    it('should match first intent when multiple patterns match', async () => {
      const handler1 = async () => ({ result: 'specific' });
      const handler2 = async () => ({ result: 'general' });

      registry.registerIntent('hello world', handler1, 'specific_greeting', 10);
      registry.registerIntent('hello', handler2, 'general_greeting', 5);

      const match = await registry.resolveIntent('hello world');

      expect(match.intent).toBe('specific_greeting');
    });

    it('should be case insensitive for string patterns', async () => {
      const handler = async () => ({ result: 'greeting' });
      registry.registerIntent('hello', handler, 'greeting');

      const match = await registry.resolveIntent('HELLO');

      expect(match.intent).toBe('greeting');
      expect(match.confidence).toBe(1.0);
    });
  });

  describe('resolve', () => {
    it('should be an alias for resolveIntent', async () => {
      const handler = async () => ({ result: 'test' });
      registry.registerIntent('test', handler, 'test_intent');

      const match = await registry.resolve('test');

      expect(match.intent).toBe('test_intent');
      expect(match.confidence).toBe(1.0);
    });
  });

  describe('clearIntents', () => {
    it('should remove all registered intents', () => {
      const handler = async () => ({ result: 'test' });
      registry.registerIntent('hello', handler, 'greeting');
      registry.registerIntent('goodbye', handler, 'farewell');

      expect(registry.getRegisteredIntents()).toHaveLength(2);

      registry.clearIntents();

      expect(registry.getRegisteredIntents()).toHaveLength(0);
    });
  });

  describe('getRegisteredIntents', () => {
    it('should return empty array when no intents registered', () => {
      const intents = registry.getRegisteredIntents();
      expect(intents).toEqual([]);
    });

    it('should return all registered intent names', () => {
      const handler = async () => ({ result: 'test' });
      registry.registerIntent('hello', handler, 'greeting');
      registry.registerIntent('goodbye', handler, 'farewell');
      registry.registerIntent(/create/i, handler, 'create');

      const intents = registry.getRegisteredIntents();
      expect(intents).toHaveLength(3);
      expect(intents).toContain('greeting');
      expect(intents).toContain('farewell');
      expect(intents).toContain('create');
    });
  });
});
