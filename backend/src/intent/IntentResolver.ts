/**
 * IntentResolver interface defines the contract for intent resolution mechanisms.
 * This abstraction enables semantic routing by mapping natural language intents
 * to controller actions.
 */
export interface IntentResolver {
  /**
   * Resolves a semantic intent string to a controller action.
   * @param intent - The semantic intent to resolve (e.g., "create card", "list accounts")
   * @returns Promise resolving to the resolved action metadata or null if no match found
   */
  resolveIntent(intent: string): Promise<IntentResolution | null>;
}

/**
 * IntentResolution represents the result of intent resolution,
 * containing metadata about the matched controller action.
 */
export interface IntentResolution {
  /**
   * The controller method to invoke
   */
  handler: Function;

  /**
   * The HTTP method associated with this intent (GET, POST, DELETE, etc.)
   */
  method: string;

  /**
   * The original route path pattern
   */
  route: string;

  /**
   * Confidence score of the intent match (0-1)
   */
  confidence: number;

  /**
   * Extracted parameters from the intent
   */
  parameters?: Record<string, any>;

  /**
   * Additional metadata about the resolution
   */
  metadata?: Record<string, any>;
}

/**
 * IntentPattern defines a mapping between semantic patterns and controller actions.
 */
export interface IntentPattern {
  /**
   * Array of semantic patterns that match this intent
   * (e.g., ["create card", "add new card", "make card"])
   */
  patterns: string[];

  /**
   * The controller handler function
   */
  handler: Function;

  /**
   * HTTP method for this action
   */
  method: string;

  /**
   * Route path pattern
   */
  route: string;

  /**
   * Optional description of what this intent does
   */
  description?: string;

  /**
   * Optional tags for categorization
   */
  tags?: string[];
}
