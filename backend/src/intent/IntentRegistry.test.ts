import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntentRegistry } from './IntentRegistry.js';
import { IIntent } from './IntentResolver.js';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('register', () => {
    it('should register a valid intent', () => {
      const intent: IIntent = {
        name: 'test_intent',
        pattern: /test/,
        handler: () => {},
        metadata: { description: 'Test intent' }
      };

      registry.register(intent);
      expect(registry.size()).toBe(1);
      expect(registry.get('test_intent')).toEqual(intent);
    });

    it('should throw error when intent name is missing', () => {
      const intent: any = {
        name: '',
        pattern: /test/,
        handler: () => {},
        metadata: {}
      };

      expect(() => registry.register(intent)).toThrow('Intent name is required');
    });

    it('should throw error when intent pattern is missing', () => {
      const intent: any = {
        name: 'test',
        pattern: null,
        handler: () => {},
        metadata: {}
      };

      expect(() => registry.register(intent)).toThrow('Intent pattern is required');
    });

    it('should throw error when intent handler is not a function', () => {
      const intent: any = {
        name: 'test',
        pattern: /test/,
        handler: 'not a function',
        metadata: {}
      };

      expect(() => registry.register(intent)).toThrow('Intent handler must be a function');
    });

    it('should allow registering multiple intents', () => {
      const intent1: IIntent = {
        name: 'intent1',
        pattern: /test1/,
        handler: () => {},
        metadata: {}
      };

      const intent2: IIntent = {
        name: 'intent2',
        pattern: /test2/,
        handler: () => {},
        metadata: {}
      };

      registry.register(intent1);
      registry.register(intent2);

      expect(registry.size()).toBe(2);
    });
  });

  describe('resolve', () => {
    beforeEach(() => {
      const intent1: IIntent = {
        name: 'get_account',
        pattern: /get.*account/i,
        handler: () => {},
        metadata: { method: 'GET', description: 'Get account information' }
      };

      const intent2: IIntent = {
        name: 'list_cards',
        pattern: /list.*cards/i,
        handler: () => {},
        metadata: { method: 'GET', description: 'List all cards' }
      };

      const intent3: IIntent = {
        name: 'create_card',
        pattern: /create.*card/i,
        handler: () => {},
        metadata: { method: 'POST', description: 'Create a new card' }
      };

      registry.register(intent1);
      registry.register(intent2);
      registry.register(intent3);
    });

    it('should resolve matching intent', () => {
      const result = registry.resolve('get account details');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('get_account');
    });

    it('should resolve case-insensitive patterns', () => {
      const result = registry.resolve('GET ACCOUNT');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('get_account');
    });

    it('should return null when no intent matches', () => {
      const result = registry.resolve('delete everything');
      expect(result).toBeNull();
    });

    it('should return first matching intent when multiple patterns match', () => {
      const result = registry.resolve('list cards');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('list_cards');
    });

    it('should handle empty input', () => {
      const result = registry.resolve('');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return empty array when no intents registered', () => {
      const intents = registry.list();
      expect(intents).toEqual([]);
      expect(intents.length).toBe(0);
    });

    it('should return all registered intents', () => {
      const intent1: IIntent = {
        name: 'intent1',
        pattern: /test1/,
        handler: () => {},
        metadata: {}
      };

      const intent2: IIntent = {
        name: 'intent2',
        pattern: /test2/,
        handler: () => {},
        metadata: {}
      };

      registry.register(intent1);
      registry.register(intent2);

      const intents = registry.list();
      expect(intents.length).toBe(2);
      expect(intents).toContainEqual(intent1);
      expect(intents).toContainEqual(intent2);
    });
  });

  describe('get', () => {
    it('should return intent by name', () => {
      const intent: IIntent = {
        name: 'test_intent',
        pattern: /test/,
        handler: () => {},
        metadata: {}
      };

      registry.register(intent);
      const result = registry.get('test_intent');
      expect(result).toEqual(intent);
    });

    it('should return undefined for non-existent intent', () => {
      const result = registry.get('non_existent');
      expect(result).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all registered intents', () => {
      const intent: IIntent = {
        name: 'test',
        pattern: /test/,
        handler: () => {},
        metadata: {}
      };

      registry.register(intent);
      expect(registry.size()).toBe(1);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count of registered intents', () => {
      const intent1: IIntent = {
        name: 'intent1',
        pattern: /test1/,
        handler: () => {},
        metadata: {}
      };

      const intent2: IIntent = {
        name: 'intent2',
        pattern: /test2/,
        handler: () => {},
        metadata: {}
      };

      registry.register(intent1);
      expect(registry.size()).toBe(1);

      registry.register(intent2);
      expect(registry.size()).toBe(2);
    });
  });
});
