import { Request, Response, NextFunction } from 'express';
import { intentParsingMiddleware, ResolvedIntent } from '../IntentParsingMiddleware';

describe('IntentParsingMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
      path: '/test',
      method: 'POST',
    };
    mockResponse = {};
    nextFunction = jest.fn();
  });

  describe('Intent extraction from header', () => {
    it('should parse intent from X-Intent header', () => {
      mockRequest.headers = {
        'x-intent': 'create a card',
      };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeDefined();
      expect(mockRequest.resolvedIntent?.type).toBe('create_card');
      expect(mockRequest.resolvedIntent?.source).toBe('header');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should parse intent with parameters from header', () => {
      mockRequest.headers = {
        'x-intent': 'create a card titled "New Feature" with description "Implement login"',
      };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeDefined();
      expect(mockRequest.resolvedIntent?.type).toBe('create_card');
      expect(mockRequest.resolvedIntent?.parameters.title).toBe('New Feature');
      expect(mockRequest.resolvedIntent?.parameters.description).toBe('Implement login');
      expect(mockRequest.resolvedIntent?.confidence).toBeGreaterThan(0);
    });
  });

  describe('Intent extraction from body', () => {
    it('should parse intent from request body', () => {
      mockRequest.body = {
        intent: 'list all cards',
        otherData: 'value',
      };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeDefined();
      expect(mockRequest.resolvedIntent?.type).toBe('list_entities');
      expect(mockRequest.resolvedIntent?.source).toBe('body');
      expect(mockRequest.resolvedIntent?.parameters.entityType).toBe('cards');
    });

    it('should prefer header over body when both present', () => {
      mockRequest.headers = {
        'x-intent': 'get card',
      };
      mockRequest.body = {
        intent: 'list all cards',
      };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('get_entity');
      expect(mockRequest.resolvedIntent?.source).toBe('header');
    });
  });

  describe('Intent pattern matching', () => {
    it('should match create card intent', () => {
      mockRequest.body = { intent: 'create a card' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('create_card');
    });

    it('should match list entities intent', () => {
      mockRequest.body = { intent: 'list all accounts' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('list_entities');
      expect(mockRequest.resolvedIntent?.parameters.entityType).toBe('accounts');
    });

    it('should match get entity intent', () => {
      mockRequest.body = { intent: 'get user with id abc123' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('get_entity');
      expect(mockRequest.resolvedIntent?.parameters.entityType).toBe('user');
      expect(mockRequest.resolvedIntent?.parameters.id).toBe('abc123');
    });

    it('should match update entity intent', () => {
      mockRequest.body = { intent: 'update lane with id lane-1' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('update_entity');
      expect(mockRequest.resolvedIntent?.parameters.entityType).toBe('lane');
      expect(mockRequest.resolvedIntent?.parameters.id).toBe('lane-1');
    });

    it('should match analytics intent', () => {
      mockRequest.body = { intent: 'show me forecast' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('get_analytics');
      expect(mockRequest.resolvedIntent?.parameters.analyticsType).toBe('forecast');
    });

    it('should match authentication intent', () => {
      mockRequest.body = { intent: 'login' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('authenticate');
    });

    it('should match registration intent', () => {
      mockRequest.body = { intent: 'register' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('register');
    });
  });

  describe('Unknown intents', () => {
    it('should handle unknown intent gracefully', () => {
      mockRequest.body = { intent: 'do something completely random' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.type).toBe('unknown');
      expect(mockRequest.resolvedIntent?.confidence).toBe(0.0);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing intent gracefully', () => {
      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle empty intent string', () => {
      mockRequest.body = { intent: '' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle whitespace-only intent', () => {
      mockRequest.body = { intent: '   ' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle non-string intent in body', () => {
      mockRequest.body = { intent: 123 };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle array header value', () => {
      mockRequest.headers = {
        'x-intent': ['create card', 'list cards'],
      };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Confidence calculation', () => {
    it('should calculate higher confidence for exact matches', () => {
      mockRequest.body = { intent: 'login' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      const confidence1 = mockRequest.resolvedIntent?.confidence || 0;

      mockRequest.body = { intent: 'login with extra parameters and text' };
      mockRequest.resolvedIntent = undefined;

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      const confidence2 = mockRequest.resolvedIntent?.confidence || 0;

      expect(confidence1).toBeGreaterThan(confidence2);
    });

    it('should have confidence between 0 and 1', () => {
      mockRequest.body = { intent: 'create a card titled "Test"' };

      intentParsingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.resolvedIntent?.confidence).toBeGreaterThanOrEqual(0);
      expect(mockRequest.resolvedIntent?.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Error handling', () => {
    it('should continue on error and call next', () => {
      mockRequest.body = null;

      expect(() => {
        intentParsingMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction
        );
      }).not.toThrow();

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
