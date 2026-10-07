import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntentRegistry } from './IntentRegistry.js';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('registerIntent', () => {
    it('should register an intent with a handler', () => {
      const handler = () => 'test';
      registry.registerIntent('test.intent', handler);
      expect(registry.hasIntent('test.intent')).toBe(true);
    });

    it('should throw error when intent is empty', () => {
      const handler = () => 'test';
      expect(() => registry.registerIntent('', handler)).toThrow('Intent must be a non-empty string');
    });

    it('should throw error when handler is not a function', () => {
      expect(() => registry.registerIntent('test.intent', 'not a function' as any)).toThrow('Handler must be a function');
    });

    it('should allow overwriting an existing intent', () => {
      const handler1 = () => 'first';
      const handler2 = () => 'second';
      registry.registerIntent('test.intent', handler1);
      registry.registerIntent('test.intent', handler2);
      const resolved = registry.resolveIntent('test.intent');
      expect(resolved).toBe(handler2);
    });
  });

  describe('resolveIntent', () => {
    it('should return the registered handler for an intent', () => {
      const handler = () => 'test';
      registry.registerIntent('test.intent', handler);
      const resolved = registry.resolveIntent('test.intent');
      expect(resolved).toBe(handler);
    });

    it('should return undefined for unregistered intent', () => {
      const resolved = registry.resolveIntent('nonexistent.intent');
      expect(resolved).toBeUndefined();
    });
  });

  describe('resolve', () => {
    it('should execute the handler and return result', async () => {
      const handler = () => 'test result';
      registry.registerIntent('test.intent', handler);
      const result = await registry.resolve('test.intent');
      expect(result).toBe('test result');
    });

    it('should throw error for unregistered intent', async () => {
      await expect(registry.resolve('nonexistent.intent')).rejects.toThrow('No handler registered for intent: nonexistent.intent');
    });

    it('should handle async handlers', async () => {
      const handler = async () => {
        return new Promise((resolve) => setTimeout(() => resolve('async result'), 10));
      };
      registry.registerIntent('async.intent', handler);
      const result = await registry.resolve('async.intent');
      expect(result).toBe('async result');
    });
  });

  describe('hasIntent', () => {
    it('should return true for registered intent', () => {
      const handler = () => 'test';
      registry.registerIntent('test.intent', handler);
      expect(registry.hasIntent('test.intent')).toBe(true);
    });

    it('should return false for unregistered intent', () => {
      expect(registry.hasIntent('nonexistent.intent')).toBe(false);
    });
  });

  describe('clearIntents', () => {
    it('should remove all registered intents', () => {
      registry.registerIntent('intent1', () => 'test1');
      registry.registerIntent('intent2', () => 'test2');
      registry.clearIntents();
      expect(registry.hasIntent('intent1')).toBe(false);
      expect(registry.hasIntent('intent2')).toBe(false);
    });
  });

  describe('getAllIntents', () => {
    it('should return empty array when no intents registered', () => {
      expect(registry.getAllIntents()).toEqual([]);
    });

    it('should return all registered intent names', () => {
      registry.registerIntent('intent1', () => 'test1');
      registry.registerIntent('intent2', () => 'test2');
      registry.registerIntent('intent3', () => 'test3');
      const intents = registry.getAllIntents();
      expect(intents).toHaveLength(3);
      expect(intents).toContain('intent1');
      expect(intents).toContain('intent2');
      expect(intents).toContain('intent3');
    });
  });
});
