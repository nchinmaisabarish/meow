import { StatusCodes } from 'http-status-codes';
import { ApplicationError } from '../errors/ApplicationError.js';

/**
 * Error thrown when an intent is not found in the registry
 */
export class IntentNotFoundError extends ApplicationError {
  constructor(intentName: string) {
    super('IntentNotFoundError', StatusCodes.NOT_FOUND, `Intent '${intentName}' not found`);
  }
}

/**
 * Error thrown when intent parameters fail validation
 */
export class InvalidIntentParametersError extends ApplicationError {
  constructor(description: string) {
    super('InvalidIntentParametersError', StatusCodes.BAD_REQUEST, description);
  }
}

/**
 * Error thrown when intent execution fails
 */
export class IntentExecutionError extends ApplicationError {
  constructor(description: string) {
    super('IntentExecutionError', StatusCodes.INTERNAL_SERVER_ERROR, description);
  }
}

/**
 * Intent type - either a tool or a workflow
 */
export type IntentType = 'tool' | 'workflow';

/**
 * Intent handler function signature
 */
export type IntentHandler = (parameters: any, context?: any) => Promise<any>;

/**
 * JSON Schema for parameter validation
 */
export interface IntentSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Intent definition
 */
export interface Intent {
  name: string;
  type: IntentType;
  handler: IntentHandler;
  schema?: IntentSchema;
  description?: string;
}

/**
 * Intent execution result
 */
export interface IntentResult {
  intent: string;
  type: IntentType;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * IntentRegistry manages registration and resolution of intents
 */
export class IntentRegistry {
  private intents: Map<string, Intent>;

  constructor() {
    this.intents = new Map();
  }

  /**
   * Register a new intent
   */
  registerIntent(intent: Intent): void {
    this.intents.set(intent.name, intent);
  }

  /**
   * Register multiple intents at once
   */
  registerIntents(intents: Intent[]): void {
    intents.forEach((intent: Intent) => this.registerIntent(intent));
  }

  /**
   * Get an intent by name
   */
  getIntent(name: string): Intent | undefined {
    return this.intents.get(name);
  }

  /**
   * Check if an intent exists
   */
  hasIntent(name: string): boolean {
    return this.intents.has(name);
  }

  /**
   * Get all registered intents
   */
  getAllIntents(): Intent[] {
    return Array.from(this.intents.values());
  }

  /**
   * Validate parameters against intent schema
   */
  private validateParameters(intent: Intent, parameters: any): void {
    if (!intent.schema) {
      return; // No schema means no validation required
    }

    const schema = intent.schema;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (parameters[field] === undefined || parameters[field] === null) {
          throw new InvalidIntentParametersError(
            `Missing required parameter: ${field}`
          );
        }
      }
    }

    // Check for additional properties if not allowed
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = Object.keys(schema.properties);
      const providedKeys = Object.keys(parameters);
      
      for (const key of providedKeys) {
        if (!allowedKeys.includes(key)) {
          throw new InvalidIntentParametersError(
            `Unexpected parameter: ${key}`
          );
        }
      }
    }

    // Basic type checking for properties
    if (schema.properties) {
      for (const [key, value] of Object.entries(parameters)) {
        const propSchema = schema.properties[key];
        if (propSchema && propSchema.type) {
          const actualType = typeof value;
          const expectedType = propSchema.type;
          
          if (expectedType === 'string' && actualType !== 'string') {
            throw new InvalidIntentParametersError(
              `Parameter '${key}' must be a string`
            );
          }
          if (expectedType === 'number' && actualType !== 'number') {
            throw new InvalidIntentParametersError(
              `Parameter '${key}' must be a number`
            );
          }
          if (expectedType === 'boolean' && actualType !== 'boolean') {
            throw new InvalidIntentParametersError(
              `Parameter '${key}' must be a boolean`
            );
          }
          if (expectedType === 'object' && (actualType !== 'object' || value === null)) {
            throw new InvalidIntentParametersError(
              `Parameter '${key}' must be an object`
            );
          }
        }
      }
    }
  }

  /**
   * Resolve and execute an intent
   */
  async resolveIntent(
    intentName: string,
    parameters: any = {},
    context?: any
  ): Promise<IntentResult> {
    // Check if intent exists
    const intent = this.intents.get(intentName);
    if (!intent) {
      throw new IntentNotFoundError(intentName);
    }

    try {
      // Validate parameters
      this.validateParameters(intent, parameters);

      // Execute the handler
      const data = await intent.handler(parameters, context);

      return {
        intent: intentName,
        type: intent.type,
        success: true,
        data,
      };
    } catch (error) {
      // Re-throw validation errors
      if (error instanceof InvalidIntentParametersError) {
        throw error;
      }

      // Wrap other errors in IntentExecutionError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new IntentExecutionError(
        `Failed to execute intent '${intentName}': ${errorMessage}`
      );
    }
  }
}
