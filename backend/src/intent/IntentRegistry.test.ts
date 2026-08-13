import { IntentRegistry, IntentRegistryEntry, IntentHandler } from './IntentRegistry';
import { IntentResolutionResult } from './IntentResolver';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('register', () => {
    it('should register a new intent handler', () => {
      const handler: IntentHandler = async (params) => ({ success: true });
      const entry: IntentRegistryEntry = {
        intentType: 'test_intent',
        handler,
        description: 'Test intent',
      };

      registry.register(entry);

      expect(registry.has('test_intent')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should throw error when registering without intent type', () => {
      const handler: IntentHandler = async (params) => ({ success: true });
      const entry: IntentRegistryEntry = {
        intentType: '',
        handler,
      };

      expect(() => registry.register(entry)).toThrow('Intent type is required');
    });

    it('should throw error when registering without handler', () => {
      const entry: IntentRegistryEntry = {
        intentType: 'test_intent',
        handler: null as any,
      };

      expect(() => registry.register(entry)).toThrow('Handler is required');
    });

    it('should throw error when registering duplicate intent type', () => {
      const handler: IntentHandler = async (params) => ({ success: true });
      const entry: IntentRegistryEntry = {
        intentType: 'test_intent',
        handler,
      };

      registry.register(entry);

      expect(() => registry.register(entry)).toThrow('already registered');
    });
  });

  describe('unregister', () => {
    it('should unregister an existing intent', () => {
      const handler: IntentHandler = async (params) => ({ success: true });
      const entry: IntentRegistryEntry = {
        intentType: 'test_intent',
        handler,
      };

      registry.register(entry);
      const result = registry.unregister('test_intent');

      expect(result).toBe(true);
      expect(registry.has('test_intent')).toBe(false);
      expect(registry.size()).toBe(0);
    });

    it('should return false when unregistering non-existent intent', () => {
      const result = registry.unregister('non_existent');

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve registered intent entry', () => {
      const handler: IntentHandler = async (params) => ({ success: true });
      const entry: IntentRegistryEntry = {
        intentType: 'test_intent',
        handler,
        description: 'Test description',
      };

      registry.register(entry);
      const retrieved = registry.get('test_intent');

      expect(retrieved).toBeDefined();
      expect(retrieved?.intentType).toBe('test_intent');
      expect(retrieved?.description).toBe('Test description');
    });

    it('should return undefined for non-existent intent', () => {
      const retrieved = registry.get('non_existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered intents', () => {
      const handler1: IntentHandler = async (params) => ({ success: true });
      const handler2: IntentHandler = async (params) => ({ success: true });

      registry.register({ intentType: 'intent1', handler: handler1 });
      registry.register({ intentType: 'intent2', handler: handler2 });

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((e) => e.intentType)).toContain('intent1');
      expect(all.map((e) => e.intentType)).toContain('intent2');
    });

    it('should return empty array when no intents registered', () => {
      const all = registry.getAll();

      expect(all).toHaveLength(0);
    });
  });

  describe('getAllIntentTypes', () => {
    it('should return all registered intent types', () => {
      const handler: IntentHandler = async (params) => ({ success: true });

      registry.register({ intentType: 'intent1', handler });
      registry.register({ intentType: 'intent2', handler });

      const types = registry.getAllIntentTypes();

      expect(types).toHaveLength(2);
      expect(types).toContain('intent1');
      expect(types).toContain('intent2');
    });
  });

  describe('execute', () => {
    it('should execute registered handler with parameters', async () => {
      const mockHandler: IntentHandler = jest.fn(async (params) => ({
        result: params.value * 2,
      }));

      registry.register({
        intentType: 'multiply',
        handler: mockHandler,
      });

      const resolutionResult: IntentResolutionResult = {
        intentType: 'multiply',
        confidence: 0.9,
        parameters: { value: 5 },
      };

      const result = await registry.execute(resolutionResult);

      expect(mockHandler).toHaveBeenCalledWith({ value: 5 }, undefined);
      expect(result).toEqual({ result: 10 });
    });

    it('should throw error when executing unregistered intent without fallback', async () => {
      const resolutionResult: IntentResolutionResult = {
        intentType: 'unknown',
        confidence: 0.5,
        parameters: {},
      };

      await expect(registry.execute(resolutionResult)).rejects.toThrow(
        'No handler registered for intent type: unknown'
      );
    });

    it('should use fallback handler when intent not found', async () => {
      const fallbackHandler: IntentHandler = jest.fn(async (params) => ({
        fallback: true,
      }));

      registry.setFallbackHandler(fallbackHandler);

      const resolutionResult: IntentResolutionResult = {
        intentType: 'unknown',
        confidence: 0.5,
        parameters: { test: 'value' },
      };

      const result = await registry.execute(resolutionResult);

      expect(fallbackHandler).toHaveBeenCalledWith({ test: 'value' }, undefined);
      expect(result).toEqual({ fallback: true });
    });

    it('should validate required parameters', async () => {
      const handler: IntentHandler = async (params) => ({ success: true });

      registry.register({
        intentType: 'test',
        handler,
        requiredParameters: ['id', 'name'],
      });

      const resolutionResult: IntentResolutionResult = {
        intentType: 'test',
        confidence: 0.9,
        parameters: { id: '123' },
      };

      await expect(registry.execute(resolutionResult)).rejects.toThrow(
        'Missing required parameters'
      );
    });

    it('should pass validation when all required parameters present', async () => {
      const handler: IntentHandler = async (params) => ({ success: true });

      registry.register({
        intentType: 'test',
        handler,
        requiredParameters: ['id', 'name'],
      });

      const resolutionResult: IntentResolutionResult = {
        intentType: 'test',
        confidence: 0.9,
        parameters: { id: '123', name: 'Test' },
      };

      const result = await registry.execute(resolutionResult);

      expect(result).toEqual({ success: true });
    });
  });

  describe('clear', () => {
    it('should clear all registered intents and fallback handler', () => {
      const handler: IntentHandler = async (params) => ({ success: true });
      const fallbackHandler: IntentHandler = async (params) => ({ fallback: true });

      registry.register({ intentType: 'intent1', handler });
      registry.register({ intentType: 'intent2', handler });
      registry.setFallbackHandler(fallbackHandler);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAllIntentTypes()).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return correct number of registered intents', () => {
      const handler: IntentHandler = async (params) => ({ success: true });

      expect(registry.size()).toBe(0);

      registry.register({ intentType: 'intent1', handler });
      expect(registry.size()).toBe(1);

      registry.register({ intentType: 'intent2', handler });
      expect(registry.size()).toBe(2);

      registry.unregister('intent1');
      expect(registry.size()).toBe(1);
    });
  });
});
