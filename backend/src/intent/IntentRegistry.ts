import { IIntentResolver } from './IntentResolver.js';

export class IntentRegistry implements IIntentResolver {
  private intentMap: Map<string, Function>;

  constructor() {
    this.intentMap = new Map<string, Function>();
  }

  public registerIntent(intent: string, handler: Function): void {
    if (!intent || typeof intent !== 'string') {
      throw new Error('Intent must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.intentMap.set(intent, handler);
  }

  public resolveIntent(intent: string): Function | undefined {
    return this.intentMap.get(intent);
  }

  public async resolve(intent: string): Promise<any> {
    const handler = this.resolveIntent(intent);
    if (!handler) {
      throw new Error(`No handler registered for intent: ${intent}`);
    }
    return handler();
  }

  public hasIntent(intent: string): boolean {
    return this.intentMap.has(intent);
  }

  public clearIntents(): void {
    this.intentMap.clear();
  }

  public getAllIntents(): string[] {
    return Array.from(this.intentMap.keys());
  }
}
