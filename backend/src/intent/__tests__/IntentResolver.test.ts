import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntentRegistry } from '../IntentRegistry.js';
import { IntentPattern } from '../IntentResolver.js';

describe('IntentResolver', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  describe('IntentRegistry', () => {
    it('should initialize with zero patterns', () => {
      expect(registry.getPatternCount()).toBe(0);
    });

    it('should register a single intent pattern', () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card', 'add card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
        description: 'Create a new card',
      };

      registry.register(pattern);

      expect(registry.getPatternCount()).toBe(1);
    });

    it('should register multiple patterns in batch', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();

      const patterns: IntentPattern[] = [
        {
          patterns: ['create card'],
          handler: mockHandler1,
          method: 'POST',
          route: '/api/cards',
        },
        {
          patterns: ['list cards'],
          handler: mockHandler2,
          method: 'GET',
          route: '/api/cards',
        },
      ];

      registry.registerBatch(patterns);

      expect(registry.getPatternCount()).toBe(2);
    });

    it('should resolve exact intent match', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card', 'add card', 'new card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
        description: 'Create a new card',
        tags: ['card', 'write'],
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('create card');

      expect(resolution).not.toBeNull();
      expect(resolution?.handler).toBe(mockHandler);
      expect(resolution?.method).toBe('POST');
      expect(resolution?.route).toBe('/api/cards');
      expect(resolution?.confidence).toBe(1.0);
    });

    it('should resolve case-insensitive intent match', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('CREATE CARD');

      expect(resolution).not.toBeNull();
      expect(resolution?.handler).toBe(mockHandler);
      expect(resolution?.confidence).toBe(1.0);
    });

    it('should resolve intent with extra whitespace', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('  create   card  ');

      expect(resolution).not.toBeNull();
      expect(resolution?.handler).toBe(mockHandler);
    });

    it('should resolve fuzzy intent match with high confidence', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create new card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('create card');

      expect(resolution).not.toBeNull();
      expect(resolution?.handler).toBe(mockHandler);
      expect(resolution?.confidence).toBeGreaterThan(0.6);
    });

    it('should return null for unmatched intent', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('delete user');

      expect(resolution).toBeNull();
    });

    it('should return null for low confidence fuzzy match', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('completely different intent');

      expect(resolution).toBeNull();
    });

    it('should retrieve all registered patterns', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();

      const patterns: IntentPattern[] = [
        {
          patterns: ['create card'],
          handler: mockHandler1,
          method: 'POST',
          route: '/api/cards',
        },
        {
          patterns: ['list cards'],
          handler: mockHandler2,
          method: 'GET',
          route: '/api/cards',
        },
      ];

      registry.registerBatch(patterns);

      const allPatterns = registry.getAllPatterns();

      expect(allPatterns).toHaveLength(2);
    });

    it('should filter patterns by tag', () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      const mockHandler3 = jest.fn();

      const patterns: IntentPattern[] = [
        {
          patterns: ['create card'],
          handler: mockHandler1,
          method: 'POST',
          route: '/api/cards',
          tags: ['card', 'write'],
        },
        {
          patterns: ['list cards'],
          handler: mockHandler2,
          method: 'GET',
          route: '/api/cards',
          tags: ['card', 'read'],
        },
        {
          patterns: ['create account'],
          handler: mockHandler3,
          method: 'POST',
          route: '/api/accounts',
          tags: ['account', 'write'],
        },
      ];

      registry.registerBatch(patterns);

      const cardPatterns = registry.getPatternsByTag('card');
      const writePatterns = registry.getPatternsByTag('write');

      expect(cardPatterns).toHaveLength(2);
      expect(writePatterns).toHaveLength(2);
    });

    it('should clear all registered patterns', () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);
      expect(registry.getPatternCount()).toBe(1);

      registry.clear();
      expect(registry.getPatternCount()).toBe(0);
    });

    it('should handle multiple pattern variations for same handler', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card', 'add card', 'new card', 'make card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution1 = await registry.resolveIntent('create card');
      const resolution2 = await registry.resolveIntent('add card');
      const resolution3 = await registry.resolveIntent('new card');
      const resolution4 = await registry.resolveIntent('make card');

      expect(resolution1?.handler).toBe(mockHandler);
      expect(resolution2?.handler).toBe(mockHandler);
      expect(resolution3?.handler).toBe(mockHandler);
      expect(resolution4?.handler).toBe(mockHandler);
    });

    it('should include metadata in resolution', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
        description: 'Create a new card',
        tags: ['card', 'write'],
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('create card');

      expect(resolution?.metadata?.description).toBe('Create a new card');
      expect(resolution?.metadata?.tags).toEqual(['card', 'write']);
    });

    it('should handle special characters in intent', async () => {
      const mockHandler = jest.fn();
      const pattern: IntentPattern = {
        patterns: ['create card'],
        handler: mockHandler,
        method: 'POST',
        route: '/api/cards',
      };

      registry.register(pattern);

      const resolution = await registry.resolveIntent('create! card?');

      expect(resolution).not.toBeNull();
      expect(resolution?.handler).toBe(mockHandler);
    });

    it('should select best match when multiple fuzzy matches exist', async () => {
      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();

      const patterns: IntentPattern[] = [
        {
          patterns: ['create card item'],
          handler: mockHandler1,
          method: 'POST',
          route: '/api/cards',
        },
        {
          patterns: ['create card'],
          handler: mockHandler2,
          method: 'POST',
          route: '/api/cards/simple',
        },
      ];

      registry.registerBatch(patterns);

      const resolution = await registry.resolveIntent('create card');

      expect(resolution).not.toBeNull();
      expect(resolution?.handler).toBe(mockHandler2);
    });
  });
});
