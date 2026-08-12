import { IntentRegistry } from '../IntentRegistry.js';
import { IntentHandler } from '../IntentResolver.js';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('registerIntent', () => {
    it('should register an intent with a handler', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('test.intent', handler);

      expect(registry.hasIntent('test.intent')).toBe(true);
    });

    it('should normalize intent names to lowercase', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('TEST.INTENT', handler);

      expect(registry.hasIntent('test.intent')).toBe(true);
      expect(registry.hasIntent('TEST.INTENT')).toBe(true);
    });

    it('should trim whitespace from intent names', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('  test.intent  ', handler);

      expect(registry.hasIntent('test.intent')).toBe(true);
    });

    it('should throw error for empty intent', () => {
      const handler: IntentHandler = () => 'test';

      expect(() => registry.registerIntent('', handler)).toThrow(
        'Intent must be a non-empty string'
      );
    });

    it('should throw error for non-function handler', () => {
      expect(() => registry.registerIntent('test.intent', 'not a function' as any)).toThrow(
        'Handler must be a function'
      );
    });

    it('should allow overwriting existing intent', () => {
      const handler1: IntentHandler = () => 'first';
      const handler2: IntentHandler = () => 'second';

      registry.registerIntent('test.intent', handler1);
      registry.registerIntent('test.intent', handler2);

      const resolved = registry.resolveIntent('test.intent');
      expect(resolved).toBe(handler2);
    });
  });

  describe('resolveIntent', () => {
    it('should resolve registered intent', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('test.intent', handler);

      const resolved = registry.resolveIntent('test.intent');
      expect(resolved).toBe(handler);
    });

    it('should return undefined for unregistered intent', () => {
      const resolved = registry.resolveIntent('unknown.intent');
      expect(resolved).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('test.intent', handler);

      const resolved = registry.resolveIntent('TEST.INTENT');
      expect(resolved).toBe(handler);
    });

    it('should handle whitespace in intent names', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('test.intent', handler);

      const resolved = registry.resolveIntent('  test.intent  ');
      expect(resolved).toBe(handler);
    });

    it('should return undefined for empty intent', () => {
      const resolved = registry.resolveIntent('');
      expect(resolved).toBeUndefined();
    });
  });

  describe('hasIntent', () => {
    it('should return true for registered intent', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('test.intent', handler);

      expect(registry.hasIntent('test.intent')).toBe(true);
    });

    it('should return false for unregistered intent', () => {
      expect(registry.hasIntent('unknown.intent')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('test.intent', handler);

      expect(registry.hasIntent('TEST.INTENT')).toBe(true);
    });

    it('should return false for empty intent', () => {
      expect(registry.hasIntent('')).toBe(false);
    });
  });

  describe('getAllIntents', () => {
    it('should return empty array when no intents registered', () => {
      expect(registry.getAllIntents()).toEqual([]);
    });

    it('should return all registered intent names', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('intent.one', handler);
      registry.registerIntent('intent.two', handler);
      registry.registerIntent('intent.three', handler);

      const intents = registry.getAllIntents();
      expect(intents).toHaveLength(3);
      expect(intents).toContain('intent.one');
      expect(intents).toContain('intent.two');
      expect(intents).toContain('intent.three');
    });

    it('should return normalized intent names', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('TEST.INTENT', handler);

      const intents = registry.getAllIntents();
      expect(intents).toContain('test.intent');
    });
  });

  describe('clear', () => {
    it('should remove all registered intents', () => {
      const handler: IntentHandler = () => 'test';
      registry.registerIntent('intent.one', handler);
      registry.registerIntent('intent.two', handler);

      expect(registry.getAllIntents()).toHaveLength(2);

      registry.clear();

      expect(registry.getAllIntents()).toHaveLength(0);
      expect(registry.hasIntent('intent.one')).toBe(false);
      expect(registry.hasIntent('intent.two')).toBe(false);
    });
  });

  describe('handler execution', () => {
    it('should execute synchronous handler', () => {
      const handler: IntentHandler = () => 'sync result';
      registry.registerIntent('sync.intent', handler);

      const resolved = registry.resolveIntent('sync.intent');
      const result = resolved?.();

      expect(result).toBe('sync result');
    });

    it('should execute asynchronous handler', async () => {
      const handler: IntentHandler = async () => 'async result';
      registry.registerIntent('async.intent', handler);

      const resolved = registry.resolveIntent('async.intent');
      const result = await resolved?.();

      expect(result).toBe('async result');
    });

    it('should pass context to handler', () => {
      const handler: IntentHandler = (context: any) => context.value;
      registry.registerIntent('context.intent', handler);

      const resolved = registry.resolveIntent('context.intent');
      const result = resolved?.({ value: 'context data' });

      expect(result).toBe('context data');
    });
  });
});
