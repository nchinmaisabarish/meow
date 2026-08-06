import { IntentHandler, IntentRequest, IntentResponse } from './IntentResolver';

export class IntentRegistry {
  private intents: Map<string, IntentHandler>;
  private priorityIndex: IntentHandler[];

  constructor() {
    this.intents = new Map();
    this.priorityIndex = [];
  }

  public registerIntent(intent: IntentHandler): void {
    if (!intent.name) {
      throw new Error('Intent name is required');
    }

    if (!intent.handler || typeof intent.handler !== 'function') {
      throw new Error('Intent handler must be a function');
    }

    if (this.intents.has(intent.name)) {
      throw new Error(`Intent with name '${intent.name}' is already registered`);
    }

    const intentWithDefaults: IntentHandler = {
      ...intent,
      priority: intent.priority ?? 0,
      matcher: intent.matcher ?? (() => false),
    };

    this.intents.set(intent.name, intentWithDefaults);
    this.rebuildPriorityIndex();
  }

  public getIntent(name: string): IntentHandler | undefined {
    return this.intents.get(name);
  }

  public hasIntent(name: string): boolean {
    return this.intents.has(name);
  }

  public unregisterIntent(name: string): boolean {
    const result = this.intents.delete(name);
    if (result) {
      this.rebuildPriorityIndex();
    }
    return result;
  }

  public getAllIntents(): IntentHandler[] {
    return Array.from(this.intents.values());
  }

  public getIntentsByPriority(): IntentHandler[] {
    return [...this.priorityIndex];
  }

  public async resolveIntent(request: IntentRequest): Promise<IntentResponse> {
    for (const intent of this.priorityIndex) {
      if (intent.matcher && intent.matcher(request)) {
        try {
          return await intent.handler(request);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            metadata: {
              intentName: intent.name,
            },
          };
        }
      }
    }

    return {
      success: false,
      error: 'No matching intent found',
    };
  }

  public clear(): void {
    this.intents.clear();
    this.priorityIndex = [];
  }

  public size(): number {
    return this.intents.size;
  }

  private rebuildPriorityIndex(): void {
    this.priorityIndex = Array.from(this.intents.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }
}

export const globalIntentRegistry = new IntentRegistry();
