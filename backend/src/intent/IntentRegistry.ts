import { IntentResolver, IntentResolution, IntentPattern } from './IntentResolver.js';

/**
 * IntentRegistry implements the IntentResolver interface and provides
 * a registry-based approach to mapping semantic intents to controller actions.
 * This class serves as the foundation for intent-based routing.
 */
export class IntentRegistry implements IntentResolver {
  private patterns: Map<string, IntentPattern>;
  private normalizedPatterns: Map<string, string>;

  constructor() {
    this.patterns = new Map();
    this.normalizedPatterns = new Map();
  }

  /**
   * Registers an intent pattern with its associated controller action.
   * @param pattern - The intent pattern configuration
   */
  register(pattern: IntentPattern): void {
    const key = this.generateKey(pattern.route, pattern.method);
    this.patterns.set(key, pattern);

    // Create normalized pattern mappings for faster lookup
    pattern.patterns.forEach((p) => {
      const normalized = this.normalizeIntent(p);
      this.normalizedPatterns.set(normalized, key);
    });
  }

  /**
   * Registers multiple intent patterns at once.
   * @param patterns - Array of intent pattern configurations
   */
  registerBatch(patterns: IntentPattern[]): void {
    patterns.forEach((pattern) => this.register(pattern));
  }

  /**
   * Resolves a semantic intent to a controller action.
   * @param intent - The semantic intent string to resolve
   * @returns Promise resolving to IntentResolution or null if no match
   */
  async resolveIntent(intent: string): Promise<IntentResolution | null> {
    const normalized = this.normalizeIntent(intent);

    // Try exact match first
    const exactMatch = this.normalizedPatterns.get(normalized);
    if (exactMatch) {
      const pattern = this.patterns.get(exactMatch);
      if (pattern) {
        return this.createResolution(pattern, 1.0, {});
      }
    }

    // Try fuzzy matching
    const fuzzyMatch = this.findFuzzyMatch(normalized);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    return null;
  }

  /**
   * Retrieves all registered intent patterns.
   * @returns Array of all registered patterns
   */
  getAllPatterns(): IntentPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Retrieves patterns filtered by tag.
   * @param tag - The tag to filter by
   * @returns Array of patterns matching the tag
   */
  getPatternsByTag(tag: string): IntentPattern[] {
    return Array.from(this.patterns.values()).filter(
      (pattern) => pattern.tags && pattern.tags.includes(tag)
    );
  }

  /**
   * Clears all registered patterns.
   */
  clear(): void {
    this.patterns.clear();
    this.normalizedPatterns.clear();
  }

  /**
   * Gets the count of registered patterns.
   * @returns Number of registered patterns
   */
  getPatternCount(): number {
    return this.patterns.size;
  }

  /**
   * Normalizes an intent string for consistent matching.
   * @param intent - The intent string to normalize
   * @returns Normalized intent string
   */
  private normalizeIntent(intent: string): string {
    return intent
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Generates a unique key for a route and method combination.
   * @param route - The route path
   * @param method - The HTTP method
   * @returns Unique key string
   */
  private generateKey(route: string, method: string): string {
    return `${method.toUpperCase()}:${route}`;
  }

  /**
   * Creates an IntentResolution object from a pattern.
   * @param pattern - The matched pattern
   * @param confidence - Confidence score of the match
   * @param parameters - Extracted parameters
   * @returns IntentResolution object
   */
  private createResolution(
    pattern: IntentPattern,
    confidence: number,
    parameters: Record<string, any>
  ): IntentResolution {
    return {
      handler: pattern.handler,
      method: pattern.method,
      route: pattern.route,
      confidence,
      parameters,
      metadata: {
        description: pattern.description,
        tags: pattern.tags,
      },
    };
  }

  /**
   * Performs fuzzy matching to find the best intent match.
   * @param normalizedIntent - The normalized intent string
   * @returns IntentResolution or null if no match found
   */
  private findFuzzyMatch(normalizedIntent: string): IntentResolution | null {
    let bestMatch: { pattern: IntentPattern; confidence: number } | null = null;
    let highestConfidence = 0;

    for (const [patternStr, key] of this.normalizedPatterns.entries()) {
      const confidence = this.calculateSimilarity(normalizedIntent, patternStr);

      // Only consider matches with confidence above threshold (0.6)
      if (confidence > 0.6 && confidence > highestConfidence) {
        const pattern = this.patterns.get(key);
        if (pattern) {
          highestConfidence = confidence;
          bestMatch = { pattern, confidence };
        }
      }
    }

    if (bestMatch) {
      return this.createResolution(bestMatch.pattern, bestMatch.confidence, {});
    }

    return null;
  }

  /**
   * Calculates similarity between two strings using a simple word-based approach.
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }
}
