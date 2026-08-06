import { IntentRegistry } from '../IntentRegistry';
import { IntentHandler, IntentRequest, IntentResponse } from '../IntentResolver';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('registerIntent', () => {
    it('should register a new intent successfully', () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent);

      expect(registry.hasIntent('test-intent')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should throw error when intent name is missing', () => {
      const intent: any = {
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      expect(() => registry.registerIntent(intent)).toThrow('Intent name is required');
    });

    it('should throw error when handler is missing', () => {
      const intent: any = {
        name: 'test-intent',
      };

      expect(() => registry.registerIntent(intent)).toThrow('Intent handler must be a function');
    });

    it('should throw error when registering duplicate intent', () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent);

      expect(() => registry.registerIntent(intent)).toThrow(
        "Intent with name 'test-intent' is already registered"
      );
    });

    it('should set default priority to 0 if not provided', () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent);
      const registered = registry.getIntent('test-intent');

      expect(registered?.priority).toBe(0);
    });
  });

  describe('getIntent', () => {
    it('should retrieve a registered intent', () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        description: 'Test intent',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent);
      const retrieved = registry.getIntent('test-intent');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-intent');
      expect(retrieved?.description).toBe('Test intent');
    });

    it('should return undefined for non-existent intent', () => {
      const retrieved = registry.getIntent('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('hasIntent', () => {
    it('should return true for registered intent', () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent);

      expect(registry.hasIntent('test-intent')).toBe(true);
    });

    it('should return false for non-existent intent', () => {
      expect(registry.hasIntent('non-existent')).toBe(false);
    });
  });

  describe('unregisterIntent', () => {
    it('should unregister an existing intent', () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent);
      expect(registry.hasIntent('test-intent')).toBe(true);

      const result = registry.unregisterIntent('test-intent');

      expect(result).toBe(true);
      expect(registry.hasIntent('test-intent')).toBe(false);
      expect(registry.size()).toBe(0);
    });

    it('should return false when unregistering non-existent intent', () => {
      const result = registry.unregisterIntent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getAllIntents', () => {
    it('should return all registered intents', () => {
      const intent1: IntentHandler = {
        name: 'intent-1',
        handler: async (req: IntentRequest) => ({ success: true }),
      };
      const intent2: IntentHandler = {
        name: 'intent-2',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent1);
      registry.registerIntent(intent2);

      const allIntents = registry.getAllIntents();

      expect(allIntents).toHaveLength(2);
      expect(allIntents.map((i) => i.name)).toContain('intent-1');
      expect(allIntents.map((i) => i.name)).toContain('intent-2');
    });

    it('should return empty array when no intents registered', () => {
      const allIntents = registry.getAllIntents();

      expect(allIntents).toHaveLength(0);
    });
  });

  describe('getIntentsByPriority', () => {
    it('should return intents sorted by priority (highest first)', () => {
      const intent1: IntentHandler = {
        name: 'low-priority',
        priority: 1,
        handler: async (req: IntentRequest) => ({ success: true }),
      };
      const intent2: IntentHandler = {
        name: 'high-priority',
        priority: 10,
        handler: async (req: IntentRequest) => ({ success: true }),
      };
      const intent3: IntentHandler = {
        name: 'medium-priority',
        priority: 5,
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent1);
      registry.registerIntent(intent2);
      registry.registerIntent(intent3);

      const sorted = registry.getIntentsByPriority();

      expect(sorted).toHaveLength(3);
      expect(sorted[0].name).toBe('high-priority');
      expect(sorted[1].name).toBe('medium-priority');
      expect(sorted[2].name).toBe('low-priority');
    });
  });

  describe('resolveIntent', () => {
    it('should resolve intent using matcher', async () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({
          success: true,
          data: { message: 'Intent resolved' },
        }),
        matcher: (req: IntentRequest) => req.raw === 'test',
      };

      registry.registerIntent(intent);

      const request: IntentRequest = { raw: 'test' };
      const response = await registry.resolveIntent(request);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ message: 'Intent resolved' });
    });

    it('should return error when no matching intent found', async () => {
      const intent: IntentHandler = {
        name: 'test-intent',
        handler: async (req: IntentRequest) => ({ success: true }),
        matcher: (req: IntentRequest) => req.raw === 'test',
      };

      registry.registerIntent(intent);

      const request: IntentRequest = { raw: 'other' };
      const response = await registry.resolveIntent(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('No matching intent found');
    });

    it('should handle handler errors gracefully', async () => {
      const intent: IntentHandler = {
        name: 'error-intent',
        handler: async (req: IntentRequest) => {
          throw new Error('Handler error');
        },
        matcher: (req: IntentRequest) => true,
      };

      registry.registerIntent(intent);

      const request: IntentRequest = { raw: 'test' };
      const response = await registry.resolveIntent(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Handler error');
      expect(response.metadata?.intentName).toBe('error-intent');
    });

    it('should resolve using highest priority matching intent', async () => {
      const lowPriorityIntent: IntentHandler = {
        name: 'low-priority',
        priority: 1,
        handler: async (req: IntentRequest) => ({
          success: true,
          data: { source: 'low' },
        }),
        matcher: (req: IntentRequest) => true,
      };
      const highPriorityIntent: IntentHandler = {
        name: 'high-priority',
        priority: 10,
        handler: async (req: IntentRequest) => ({
          success: true,
          data: { source: 'high' },
        }),
        matcher: (req: IntentRequest) => true,
      };

      registry.registerIntent(lowPriorityIntent);
      registry.registerIntent(highPriorityIntent);

      const request: IntentRequest = { raw: 'test' };
      const response = await registry.resolveIntent(request);

      expect(response.success).toBe(true);
      expect(response.data?.source).toBe('high');
    });
  });

  describe('clear', () => {
    it('should clear all registered intents', () => {
      const intent1: IntentHandler = {
        name: 'intent-1',
        handler: async (req: IntentRequest) => ({ success: true }),
      };
      const intent2: IntentHandler = {
        name: 'intent-2',
        handler: async (req: IntentRequest) => ({ success: true }),
      };

      registry.registerIntent(intent1);
      registry.registerIntent(intent2);
      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAllIntents()).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return correct number of registered intents', () => {
      expect(registry.size()).toBe(0);

      const intent1: IntentHandler = {
        name: 'intent-1',
        handler: async (req: IntentRequest) => ({ success: true }),
      };
      registry.registerIntent(intent1);
      expect(registry.size()).toBe(1);

      const intent2: IntentHandler = {
        name: 'intent-2',
        handler: async (req: IntentRequest) => ({ success: true }),
      };
      registry.registerIntent(intent2);
      expect(registry.size()).toBe(2);

      registry.unregisterIntent('intent-1');
      expect(registry.size()).toBe(1);
    });
  });
});
