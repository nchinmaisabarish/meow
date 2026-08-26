import { IntentConfig, defaultIntentConfig } from './IntentConfig.js';
import { INTENT_LOG_LEVELS } from '../Constants.js';

export interface Intent {
  name: string;
  patterns: string[];
  handler: string;
  description?: string;
  examples?: string[];
  metadata?: Record<string, any>;
}

export interface IntentMatch {
  intent: Intent;
  confidence: number;
  matchedPattern?: string;
}

export interface IntentResolutionContext {
  userId?: string;
  sessionId?: string;
  previousIntent?: string;
  metadata?: Record<string, any>;
}

export class IntentRegistry {
  private intents: Map<string, Intent>;
  private config: IntentConfig;
  private cache: Map<string, { matches: IntentMatch[]; timestamp: number }>;

  constructor(config?: IntentConfig) {
    this.intents = new Map();
    this.config = config || defaultIntentConfig;
    this.cache = new Map();
  }

  public registerIntent(intent: Intent): void {
    if (!intent.name || intent.name.trim() === '') {
      throw new Error('Intent name is required');
    }

    if (!intent.patterns || intent.patterns.length === 0) {
      throw new Error(`Intent ${intent.name} must have at least one pattern`);
    }

    if (!intent.handler || intent.handler.trim() === '') {
      throw new Error(`Intent ${intent.name} must have a handler`);
    }

    this.intents.set(intent.name, intent);
    this.log(INTENT_LOG_LEVELS.INFO, `Registered intent: ${intent.name}`);
    this.clearCache();
  }

  public unregisterIntent(intentName: string): boolean {
    const result = this.intents.delete(intentName);
    if (result) {
      this.log(INTENT_LOG_LEVELS.INFO, `Unregistered intent: ${intentName}`);
      this.clearCache();
    }
    return result;
  }

  public getIntent(intentName: string): Intent | undefined {
    return this.intents.get(intentName);
  }

  public getAllIntents(): Intent[] {
    return Array.from(this.intents.values());
  }

  public resolveIntent(
    input: string,
    context?: IntentResolutionContext
  ): IntentMatch | null {
    const matches = this.findMatches(input, context);
    
    if (matches.length === 0) {
      return this.handleNoMatch(input);
    }

    const topMatch = matches[0];
    
    if (topMatch.confidence < this.config.getConfidenceThreshold()) {
      this.log(
        INTENT_LOG_LEVELS.WARN,
        `Top match confidence ${topMatch.confidence} below threshold ${this.config.getConfidenceThreshold()}`
      );
      return this.handleLowConfidence(topMatch, input);
    }

    this.log(
      INTENT_LOG_LEVELS.INFO,
      `Resolved intent: ${topMatch.intent.name} (confidence: ${topMatch.confidence})`
    );

    return topMatch;
  }

  public resolveIntents(
    input: string,
    context?: IntentResolutionContext
  ): IntentMatch[] {
    const matches = this.findMatches(input, context);
    const threshold = this.config.getConfidenceThreshold();
    const maxMatches = this.config.getMaxIntentMatches();

    return matches
      .filter(match => match.confidence >= threshold)
      .slice(0, maxMatches);
  }

  private findMatches(
    input: string,
    context?: IntentResolutionContext
  ): IntentMatch[] {
    const cacheKey = this.getCacheKey(input, context);
    
    if (this.config.isCacheEnabled()) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.log(INTENT_LOG_LEVELS.DEBUG, `Cache hit for input: ${input}`);
        return cached;
      }
    }

    const matches: IntentMatch[] = [];
    const normalizedInput = input.toLowerCase().trim();

    for (const intent of this.intents.values()) {
      const match = this.matchIntent(intent, normalizedInput, context);
      if (match) {
        matches.push(match);
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);

    if (this.config.isCacheEnabled()) {
      this.addToCache(cacheKey, matches);
    }

    return matches;
  }

  private matchIntent(
    intent: Intent,
    normalizedInput: string,
    context?: IntentResolutionContext
  ): IntentMatch | null {
    let bestConfidence = 0;
    let matchedPattern: string | undefined;

    for (const pattern of intent.patterns) {
      const normalizedPattern = pattern.toLowerCase().trim();
      let confidence = 0;

      if (normalizedInput === normalizedPattern) {
        confidence = 1.0;
      } else if (normalizedInput.includes(normalizedPattern)) {
        confidence = 0.9;
      } else if (normalizedPattern.includes(normalizedInput)) {
        confidence = 0.8;
      } else if (this.config.isFuzzyMatchingEnabled()) {
        confidence = this.calculateFuzzyMatch(normalizedInput, normalizedPattern);
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        matchedPattern = pattern;
      }
    }

    if (bestConfidence === 0) {
      return null;
    }

    if (this.config.isContextAwarenessEnabled() && context) {
      bestConfidence = this.applyContextBoost(bestConfidence, intent, context);
    }

    return {
      intent,
      confidence: Math.min(bestConfidence, this.config.getMaxConfidenceThreshold()),
      matchedPattern,
    };
  }

  private calculateFuzzyMatch(input: string, pattern: string): number {
    const inputWords = input.split(/\s+/);
    const patternWords = pattern.split(/\s+/);
    
    let matchCount = 0;
    for (const inputWord of inputWords) {
      for (const patternWord of patternWords) {
        if (inputWord === patternWord) {
          matchCount++;
          break;
        }
      }
    }

    const similarity = matchCount / Math.max(inputWords.length, patternWords.length);
    
    return similarity >= this.config.getFuzzyMatchThreshold() ? similarity : 0;
  }

  private applyContextBoost(
    baseConfidence: number,
    intent: Intent,
    context: IntentResolutionContext
  ): number {
    const contextWeight = this.config.getContextWeight();
    let boost = 0;

    if (context.previousIntent && intent.metadata?.followsIntent === context.previousIntent) {
      boost = contextWeight;
    }

    if (context.metadata && intent.metadata?.contextKeys) {
      const contextKeys = intent.metadata.contextKeys as string[];
      const matchingKeys = contextKeys.filter(key => context.metadata?.[key] !== undefined);
      boost += (matchingKeys.length / contextKeys.length) * contextWeight * 0.5;
    }

    return Math.min(baseConfidence + boost, 1.0);
  }

  private handleNoMatch(input: string): IntentMatch | null {
    this.log(INTENT_LOG_LEVELS.WARN, `No intent match found for input: ${input}`);
    
    if (this.config.isFallbackEnabled()) {
      const fallbackIntent = this.intents.get(this.config.getFallbackIntent());
      if (fallbackIntent) {
        return {
          intent: fallbackIntent,
          confidence: 0,
        };
      }
    }

    return null;
  }

  private handleLowConfidence(match: IntentMatch, input: string): IntentMatch | null {
    if (this.config.isFallbackEnabled()) {
      const fallbackIntent = this.intents.get(this.config.getFallbackIntent());
      if (fallbackIntent) {
        this.log(
          INTENT_LOG_LEVELS.INFO,
          `Using fallback intent for low confidence match: ${input}`
        );
        return {
          intent: fallbackIntent,
          confidence: match.confidence,
        };
      }
    }

    return match;
  }

  private getCacheKey(input: string, context?: IntentResolutionContext): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${input}:${contextStr}`;
  }

  private getFromCache(key: string): IntentMatch[] | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const ttlMs = this.config.getCacheTtlSeconds() * 1000;
    
    if (now - cached.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.matches;
  }

  private addToCache(key: string, matches: IntentMatch[]): void {
    this.cache.set(key, {
      matches,
      timestamp: Date.now(),
    });
  }

  private clearCache(): void {
    this.cache.clear();
    this.log(INTENT_LOG_LEVELS.DEBUG, 'Intent cache cleared');
  }

  public updateConfig(config: IntentConfig): void {
    this.config = config;
    this.clearCache();
    this.log(INTENT_LOG_LEVELS.INFO, 'Intent configuration updated');
  }

  public getConfig(): IntentConfig {
    return this.config;
  }

  private log(level: string, message: string): void {
    if (this.config.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [IntentRegistry] [${level.toUpperCase()}] ${message}`);
    }
  }

  public getStats(): {
    totalIntents: number;
    cacheSize: number;
    cacheEnabled: boolean;
  } {
    return {
      totalIntents: this.intents.size,
      cacheSize: this.cache.size,
      cacheEnabled: this.config.isCacheEnabled(),
    };
  }
}

export const defaultIntentRegistry = new IntentRegistry();
