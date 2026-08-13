import { IntentResolutionResult } from './IntentResolver';

export type IntentHandler = (parameters: Record<string, any>, context?: any) => Promise<any>;

export interface IntentRegistryEntry {
  intentType: string;
  handler: IntentHandler;
  description?: string;
  requiredParameters?: string[];
  optionalParameters?: string[];
}

export class IntentRegistry {
  private registry: Map<string, IntentRegistryEntry>;
  private fallbackHandler?: IntentHandler;

  constructor() {
    this.registry = new Map();
  }

  register(entry: IntentRegistryEntry): void {
    if (!entry.intentType) {
      throw new Error('Intent type is required for registration');
    }
    if (!entry.handler) {
      throw new Error('Handler is required for registration');
    }
    if (this.registry.has(entry.intentType)) {
      throw new Error(`Intent type '${entry.intentType}' is already registered`);
    }
    this.registry.set(entry.intentType, entry);
  }

  unregister(intentType: string): boolean {
    return this.registry.delete(intentType);
  }

  get(intentType: string): IntentRegistryEntry | undefined {
    return this.registry.get(intentType);
  }

  has(intentType: string): boolean {
    return this.registry.has(intentType);
  }

  getAll(): IntentRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  getAllIntentTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  setFallbackHandler(handler: IntentHandler): void {
    this.fallbackHandler = handler;
  }

  async execute(
    resolutionResult: IntentResolutionResult,
    context?: any
  ): Promise<any> {
    const entry = this.registry.get(resolutionResult.intentType);

    if (!entry) {
      if (this.fallbackHandler) {
        return this.fallbackHandler(resolutionResult.parameters, context);
      }
      throw new Error(`No handler registered for intent type: ${resolutionResult.intentType}`);
    }

    this.validateParameters(entry, resolutionResult.parameters);

    return entry.handler(resolutionResult.parameters, context);
  }

  private validateParameters(
    entry: IntentRegistryEntry,
    parameters: Record<string, any>
  ): void {
    if (!entry.requiredParameters || entry.requiredParameters.length === 0) {
      return;
    }

    const missingParameters = entry.requiredParameters.filter(
      (param) => !(param in parameters) || parameters[param] === undefined
    );

    if (missingParameters.length > 0) {
      throw new Error(
        `Missing required parameters for intent '${entry.intentType}': ${missingParameters.join(', ')}`
      );
    }
  }

  clear(): void {
    this.registry.clear();
    this.fallbackHandler = undefined;
  }

  size(): number {
    return this.registry.size;
  }
}

export const globalIntentRegistry = new IntentRegistry();
