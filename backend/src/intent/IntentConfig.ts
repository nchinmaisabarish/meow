import { INTENT_RESOLUTION_CONFIG, INTENT_LOG_LEVELS, IntentLogLevel } from '../Constants.js';

export interface IntentConfigOptions {
  confidenceThreshold?: number;
  minConfidenceThreshold?: number;
  maxConfidenceThreshold?: number;
  fallbackEnabled?: boolean;
  fallbackIntent?: string;
  loggingEnabled?: boolean;
  logLevel?: IntentLogLevel;
  cacheEnabled?: boolean;
  cacheTtlSeconds?: number;
  maxIntentMatches?: number;
  enableFuzzyMatching?: boolean;
  fuzzyMatchThreshold?: number;
  enableContextAwareness?: boolean;
  contextWeight?: number;
  enableLearning?: boolean;
  learningFeedbackThreshold?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class IntentConfig {
  private config: Required<IntentConfigOptions>;

  constructor(options: IntentConfigOptions = {}) {
    this.config = this.loadConfiguration(options);
    this.validateConfiguration();
  }

  private loadConfiguration(options: IntentConfigOptions): Required<IntentConfigOptions> {
    const envOverrides = this.loadEnvironmentOverrides();
    
    return {
      confidenceThreshold: this.getConfigValue(
        options.confidenceThreshold,
        envOverrides.confidenceThreshold,
        INTENT_RESOLUTION_CONFIG.CONFIDENCE_THRESHOLD
      ),
      minConfidenceThreshold: this.getConfigValue(
        options.minConfidenceThreshold,
        envOverrides.minConfidenceThreshold,
        INTENT_RESOLUTION_CONFIG.MIN_CONFIDENCE_THRESHOLD
      ),
      maxConfidenceThreshold: this.getConfigValue(
        options.maxConfidenceThreshold,
        envOverrides.maxConfidenceThreshold,
        INTENT_RESOLUTION_CONFIG.MAX_CONFIDENCE_THRESHOLD
      ),
      fallbackEnabled: this.getConfigValue(
        options.fallbackEnabled,
        envOverrides.fallbackEnabled,
        INTENT_RESOLUTION_CONFIG.FALLBACK_ENABLED
      ),
      fallbackIntent: this.getConfigValue(
        options.fallbackIntent,
        envOverrides.fallbackIntent,
        INTENT_RESOLUTION_CONFIG.FALLBACK_INTENT
      ),
      loggingEnabled: this.getConfigValue(
        options.loggingEnabled,
        envOverrides.loggingEnabled,
        INTENT_RESOLUTION_CONFIG.LOGGING_ENABLED
      ),
      logLevel: this.getConfigValue(
        options.logLevel,
        envOverrides.logLevel,
        INTENT_RESOLUTION_CONFIG.LOG_LEVEL as IntentLogLevel
      ),
      cacheEnabled: this.getConfigValue(
        options.cacheEnabled,
        envOverrides.cacheEnabled,
        INTENT_RESOLUTION_CONFIG.CACHE_ENABLED
      ),
      cacheTtlSeconds: this.getConfigValue(
        options.cacheTtlSeconds,
        envOverrides.cacheTtlSeconds,
        INTENT_RESOLUTION_CONFIG.CACHE_TTL_SECONDS
      ),
      maxIntentMatches: this.getConfigValue(
        options.maxIntentMatches,
        envOverrides.maxIntentMatches,
        INTENT_RESOLUTION_CONFIG.MAX_INTENT_MATCHES
      ),
      enableFuzzyMatching: this.getConfigValue(
        options.enableFuzzyMatching,
        envOverrides.enableFuzzyMatching,
        INTENT_RESOLUTION_CONFIG.ENABLE_FUZZY_MATCHING
      ),
      fuzzyMatchThreshold: this.getConfigValue(
        options.fuzzyMatchThreshold,
        envOverrides.fuzzyMatchThreshold,
        INTENT_RESOLUTION_CONFIG.FUZZY_MATCH_THRESHOLD
      ),
      enableContextAwareness: this.getConfigValue(
        options.enableContextAwareness,
        envOverrides.enableContextAwareness,
        INTENT_RESOLUTION_CONFIG.ENABLE_CONTEXT_AWARENESS
      ),
      contextWeight: this.getConfigValue(
        options.contextWeight,
        envOverrides.contextWeight,
        INTENT_RESOLUTION_CONFIG.CONTEXT_WEIGHT
      ),
      enableLearning: this.getConfigValue(
        options.enableLearning,
        envOverrides.enableLearning,
        INTENT_RESOLUTION_CONFIG.ENABLE_LEARNING
      ),
      learningFeedbackThreshold: this.getConfigValue(
        options.learningFeedbackThreshold,
        envOverrides.learningFeedbackThreshold,
        INTENT_RESOLUTION_CONFIG.LEARNING_FEEDBACK_THRESHOLD
      ),
      timeoutMs: this.getConfigValue(
        options.timeoutMs,
        envOverrides.timeoutMs,
        INTENT_RESOLUTION_CONFIG.TIMEOUT_MS
      ),
      retryAttempts: this.getConfigValue(
        options.retryAttempts,
        envOverrides.retryAttempts,
        INTENT_RESOLUTION_CONFIG.RETRY_ATTEMPTS
      ),
      retryDelayMs: this.getConfigValue(
        options.retryDelayMs,
        envOverrides.retryDelayMs,
        INTENT_RESOLUTION_CONFIG.RETRY_DELAY_MS
      ),
    };
  }

  private loadEnvironmentOverrides(): Partial<IntentConfigOptions> {
    const overrides: Partial<IntentConfigOptions> = {};

    if (process.env.INTENT_CONFIDENCE_THRESHOLD) {
      overrides.confidenceThreshold = parseFloat(process.env.INTENT_CONFIDENCE_THRESHOLD);
    }
    if (process.env.INTENT_MIN_CONFIDENCE_THRESHOLD) {
      overrides.minConfidenceThreshold = parseFloat(process.env.INTENT_MIN_CONFIDENCE_THRESHOLD);
    }
    if (process.env.INTENT_MAX_CONFIDENCE_THRESHOLD) {
      overrides.maxConfidenceThreshold = parseFloat(process.env.INTENT_MAX_CONFIDENCE_THRESHOLD);
    }
    if (process.env.INTENT_FALLBACK_ENABLED) {
      overrides.fallbackEnabled = process.env.INTENT_FALLBACK_ENABLED === 'true';
    }
    if (process.env.INTENT_FALLBACK_INTENT) {
      overrides.fallbackIntent = process.env.INTENT_FALLBACK_INTENT;
    }
    if (process.env.INTENT_LOGGING_ENABLED) {
      overrides.loggingEnabled = process.env.INTENT_LOGGING_ENABLED === 'true';
    }
    if (process.env.INTENT_LOG_LEVEL) {
      overrides.logLevel = process.env.INTENT_LOG_LEVEL as IntentLogLevel;
    }
    if (process.env.INTENT_CACHE_ENABLED) {
      overrides.cacheEnabled = process.env.INTENT_CACHE_ENABLED === 'true';
    }
    if (process.env.INTENT_CACHE_TTL_SECONDS) {
      overrides.cacheTtlSeconds = parseInt(process.env.INTENT_CACHE_TTL_SECONDS, 10);
    }
    if (process.env.INTENT_MAX_MATCHES) {
      overrides.maxIntentMatches = parseInt(process.env.INTENT_MAX_MATCHES, 10);
    }
    if (process.env.INTENT_ENABLE_FUZZY_MATCHING) {
      overrides.enableFuzzyMatching = process.env.INTENT_ENABLE_FUZZY_MATCHING === 'true';
    }
    if (process.env.INTENT_FUZZY_MATCH_THRESHOLD) {
      overrides.fuzzyMatchThreshold = parseFloat(process.env.INTENT_FUZZY_MATCH_THRESHOLD);
    }
    if (process.env.INTENT_ENABLE_CONTEXT_AWARENESS) {
      overrides.enableContextAwareness = process.env.INTENT_ENABLE_CONTEXT_AWARENESS === 'true';
    }
    if (process.env.INTENT_CONTEXT_WEIGHT) {
      overrides.contextWeight = parseFloat(process.env.INTENT_CONTEXT_WEIGHT);
    }
    if (process.env.INTENT_ENABLE_LEARNING) {
      overrides.enableLearning = process.env.INTENT_ENABLE_LEARNING === 'true';
    }
    if (process.env.INTENT_LEARNING_FEEDBACK_THRESHOLD) {
      overrides.learningFeedbackThreshold = parseFloat(process.env.INTENT_LEARNING_FEEDBACK_THRESHOLD);
    }
    if (process.env.INTENT_TIMEOUT_MS) {
      overrides.timeoutMs = parseInt(process.env.INTENT_TIMEOUT_MS, 10);
    }
    if (process.env.INTENT_RETRY_ATTEMPTS) {
      overrides.retryAttempts = parseInt(process.env.INTENT_RETRY_ATTEMPTS, 10);
    }
    if (process.env.INTENT_RETRY_DELAY_MS) {
      overrides.retryDelayMs = parseInt(process.env.INTENT_RETRY_DELAY_MS, 10);
    }

    return overrides;
  }

  private getConfigValue<T>(optionValue: T | undefined, envValue: T | undefined, defaultValue: T): T {
    if (optionValue !== undefined) {
      return optionValue;
    }
    if (envValue !== undefined) {
      return envValue;
    }
    return defaultValue;
  }

  private validateConfiguration(): void {
    if (this.config.confidenceThreshold < this.config.minConfidenceThreshold ||
        this.config.confidenceThreshold > this.config.maxConfidenceThreshold) {
      throw new Error(
        `Confidence threshold ${this.config.confidenceThreshold} must be between ` +
        `${this.config.minConfidenceThreshold} and ${this.config.maxConfidenceThreshold}`
      );
    }

    if (this.config.fuzzyMatchThreshold < 0 || this.config.fuzzyMatchThreshold > 1) {
      throw new Error(
        `Fuzzy match threshold ${this.config.fuzzyMatchThreshold} must be between 0 and 1`
      );
    }

    if (this.config.contextWeight < 0 || this.config.contextWeight > 1) {
      throw new Error(
        `Context weight ${this.config.contextWeight} must be between 0 and 1`
      );
    }

    if (this.config.learningFeedbackThreshold < 0 || this.config.learningFeedbackThreshold > 1) {
      throw new Error(
        `Learning feedback threshold ${this.config.learningFeedbackThreshold} must be between 0 and 1`
      );
    }

    if (this.config.cacheTtlSeconds < 0) {
      throw new Error(`Cache TTL ${this.config.cacheTtlSeconds} must be non-negative`);
    }

    if (this.config.maxIntentMatches < 1) {
      throw new Error(`Max intent matches ${this.config.maxIntentMatches} must be at least 1`);
    }

    if (this.config.timeoutMs < 0) {
      throw new Error(`Timeout ${this.config.timeoutMs} must be non-negative`);
    }

    if (this.config.retryAttempts < 0) {
      throw new Error(`Retry attempts ${this.config.retryAttempts} must be non-negative`);
    }

    if (this.config.retryDelayMs < 0) {
      throw new Error(`Retry delay ${this.config.retryDelayMs} must be non-negative`);
    }

    const validLogLevels = Object.values(INTENT_LOG_LEVELS);
    if (!validLogLevels.includes(this.config.logLevel)) {
      throw new Error(
        `Invalid log level ${this.config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`
      );
    }
  }

  public getConfidenceThreshold(): number {
    return this.config.confidenceThreshold;
  }

  public getMinConfidenceThreshold(): number {
    return this.config.minConfidenceThreshold;
  }

  public getMaxConfidenceThreshold(): number {
    return this.config.maxConfidenceThreshold;
  }

  public isFallbackEnabled(): boolean {
    return this.config.fallbackEnabled;
  }

  public getFallbackIntent(): string {
    return this.config.fallbackIntent;
  }

  public isLoggingEnabled(): boolean {
    return this.config.loggingEnabled;
  }

  public getLogLevel(): IntentLogLevel {
    return this.config.logLevel;
  }

  public isCacheEnabled(): boolean {
    return this.config.cacheEnabled;
  }

  public getCacheTtlSeconds(): number {
    return this.config.cacheTtlSeconds;
  }

  public getMaxIntentMatches(): number {
    return this.config.maxIntentMatches;
  }

  public isFuzzyMatchingEnabled(): boolean {
    return this.config.enableFuzzyMatching;
  }

  public getFuzzyMatchThreshold(): number {
    return this.config.fuzzyMatchThreshold;
  }

  public isContextAwarenessEnabled(): boolean {
    return this.config.enableContextAwareness;
  }

  public getContextWeight(): number {
    return this.config.contextWeight;
  }

  public isLearningEnabled(): boolean {
    return this.config.enableLearning;
  }

  public getLearningFeedbackThreshold(): number {
    return this.config.learningFeedbackThreshold;
  }

  public getTimeoutMs(): number {
    return this.config.timeoutMs;
  }

  public getRetryAttempts(): number {
    return this.config.retryAttempts;
  }

  public getRetryDelayMs(): number {
    return this.config.retryDelayMs;
  }

  public updateConfig(options: Partial<IntentConfigOptions>): void {
    this.config = this.loadConfiguration({ ...this.config, ...options });
    this.validateConfiguration();
  }

  public getFullConfig(): Required<IntentConfigOptions> {
    return { ...this.config };
  }

  public shouldLog(level: IntentLogLevel): boolean {
    if (!this.config.loggingEnabled) {
      return false;
    }

    const levels = [INTENT_LOG_LEVELS.DEBUG, INTENT_LOG_LEVELS.INFO, INTENT_LOG_LEVELS.WARN, INTENT_LOG_LEVELS.ERROR, INTENT_LOG_LEVELS.NONE];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const requestedLevelIndex = levels.indexOf(level);

    return requestedLevelIndex >= currentLevelIndex;
  }
}

export const defaultIntentConfig = new IntentConfig();
