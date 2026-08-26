import { IntentConfig } from '../IntentConfig.js';
import { INTENT_LOG_LEVELS } from '../../Constants.js';

describe('IntentConfig', () => {
  beforeEach(() => {
    delete process.env.INTENT_CONFIDENCE_THRESHOLD;
    delete process.env.INTENT_FALLBACK_ENABLED;
    delete process.env.INTENT_LOG_LEVEL;
  });

  describe('constructor', () => {
    it('should create config with default values', () => {
      const config = new IntentConfig();
      
      expect(config.getConfidenceThreshold()).toBe(0.7);
      expect(config.isFallbackEnabled()).toBe(true);
      expect(config.getFallbackIntent()).toBe('unknown');
      expect(config.isLoggingEnabled()).toBe(true);
      expect(config.getLogLevel()).toBe('info');
    });

    it('should create config with custom options', () => {
      const config = new IntentConfig({
        confidenceThreshold: 0.8,
        fallbackEnabled: false,
        logLevel: INTENT_LOG_LEVELS.DEBUG,
      });
      
      expect(config.getConfidenceThreshold()).toBe(0.8);
      expect(config.isFallbackEnabled()).toBe(false);
      expect(config.getLogLevel()).toBe(INTENT_LOG_LEVELS.DEBUG);
    });

    it('should load environment variable overrides', () => {
      process.env.INTENT_CONFIDENCE_THRESHOLD = '0.85';
      process.env.INTENT_FALLBACK_ENABLED = 'false';
      process.env.INTENT_LOG_LEVEL = 'warn';
      
      const config = new IntentConfig();
      
      expect(config.getConfidenceThreshold()).toBe(0.85);
      expect(config.isFallbackEnabled()).toBe(false);
      expect(config.getLogLevel()).toBe('warn');
    });

    it('should prioritize constructor options over environment variables', () => {
      process.env.INTENT_CONFIDENCE_THRESHOLD = '0.85';
      
      const config = new IntentConfig({
        confidenceThreshold: 0.9,
      });
      
      expect(config.getConfidenceThreshold()).toBe(0.9);
    });
  });

  describe('validation', () => {
    it('should throw error if confidence threshold is below minimum', () => {
      expect(() => {
        new IntentConfig({ confidenceThreshold: 0.3 });
      }).toThrow('Confidence threshold 0.3 must be between');
    });

    it('should throw error if confidence threshold is above maximum', () => {
      expect(() => {
        new IntentConfig({ confidenceThreshold: 1.5 });
      }).toThrow('Confidence threshold 1.5 must be between');
    });

    it('should throw error if fuzzy match threshold is invalid', () => {
      expect(() => {
        new IntentConfig({ fuzzyMatchThreshold: 1.5 });
      }).toThrow('Fuzzy match threshold 1.5 must be between 0 and 1');
    });

    it('should throw error if context weight is invalid', () => {
      expect(() => {
        new IntentConfig({ contextWeight: -0.1 });
      }).toThrow('Context weight -0.1 must be between 0 and 1');
    });

    it('should throw error if cache TTL is negative', () => {
      expect(() => {
        new IntentConfig({ cacheTtlSeconds: -10 });
      }).toThrow('Cache TTL -10 must be non-negative');
    });

    it('should throw error if max intent matches is less than 1', () => {
      expect(() => {
        new IntentConfig({ maxIntentMatches: 0 });
      }).toThrow('Max intent matches 0 must be at least 1');
    });

    it('should throw error if log level is invalid', () => {
      expect(() => {
        new IntentConfig({ logLevel: 'invalid' as any });
      }).toThrow('Invalid log level invalid');
    });
  });

  describe('getters', () => {
    it('should return all configuration values', () => {
      const config = new IntentConfig({
        confidenceThreshold: 0.75,
        cacheEnabled: false,
        maxIntentMatches: 10,
        enableFuzzyMatching: false,
      });
      
      expect(config.getConfidenceThreshold()).toBe(0.75);
      expect(config.isCacheEnabled()).toBe(false);
      expect(config.getMaxIntentMatches()).toBe(10);
      expect(config.isFuzzyMatchingEnabled()).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration values', () => {
      const config = new IntentConfig();
      
      config.updateConfig({ confidenceThreshold: 0.8 });
      
      expect(config.getConfidenceThreshold()).toBe(0.8);
    });

    it('should validate updated configuration', () => {
      const config = new IntentConfig();
      
      expect(() => {
        config.updateConfig({ confidenceThreshold: 1.5 });
      }).toThrow('Confidence threshold 1.5 must be between');
    });
  });

  describe('shouldLog', () => {
    it('should return false if logging is disabled', () => {
      const config = new IntentConfig({ loggingEnabled: false });
      
      expect(config.shouldLog(INTENT_LOG_LEVELS.ERROR)).toBe(false);
    });

    it('should respect log level hierarchy', () => {
      const config = new IntentConfig({ logLevel: INTENT_LOG_LEVELS.WARN });
      
      expect(config.shouldLog(INTENT_LOG_LEVELS.DEBUG)).toBe(false);
      expect(config.shouldLog(INTENT_LOG_LEVELS.INFO)).toBe(false);
      expect(config.shouldLog(INTENT_LOG_LEVELS.WARN)).toBe(true);
      expect(config.shouldLog(INTENT_LOG_LEVELS.ERROR)).toBe(true);
    });
  });

  describe('getFullConfig', () => {
    it('should return complete configuration object', () => {
      const config = new IntentConfig({
        confidenceThreshold: 0.8,
        fallbackEnabled: false,
      });
      
      const fullConfig = config.getFullConfig();
      
      expect(fullConfig.confidenceThreshold).toBe(0.8);
      expect(fullConfig.fallbackEnabled).toBe(false);
      expect(fullConfig).toHaveProperty('minConfidenceThreshold');
      expect(fullConfig).toHaveProperty('maxConfidenceThreshold');
      expect(fullConfig).toHaveProperty('loggingEnabled');
    });
  });
});
