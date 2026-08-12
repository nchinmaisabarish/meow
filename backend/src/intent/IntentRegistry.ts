import { IntentHandler } from './IntentResolver.js';

export class IntentRegistry {
  private intentMap: Map<string, IntentHandler>;

  constructor() {
    this.intentMap = new Map<string, IntentHandler>();
  }

  public registerIntent(intent: string, handler: IntentHandler): void {
    if (!intent || typeof intent !== 'string') {
      throw new Error('Intent must be a non-empty string');
    }

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.intentMap.set(intent.toLowerCase().trim(), handler);
  }

  public resolveIntent(intent: string): IntentHandler | undefined {
    if (!intent || typeof intent !== 'string') {
      return undefined;
    }

    return this.intentMap.get(intent.toLowerCase().trim());
  }

  public hasIntent(intent: string): boolean {
    if (!intent || typeof intent !== 'string') {
      return false;
    }

    return this.intentMap.has(intent.toLowerCase().trim());
  }

  public getAllIntents(): string[] {
    return Array.from(this.intentMap.keys());
  }

  public clear(): void {
    this.intentMap.clear();
  }
}
