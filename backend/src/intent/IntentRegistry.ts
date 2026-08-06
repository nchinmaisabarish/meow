import { IIntent, IIntentResolver } from './IntentResolver.js';

export class IntentRegistry implements IIntentResolver {
  private intents: Map<string, IIntent>;

  constructor() {
    this.intents = new Map<string, IIntent>();
  }

  public register(intent: IIntent): void {
    if (!intent.name) {
      throw new Error('Intent name is required');
    }
    if (!intent.pattern) {
      throw new Error('Intent pattern is required');
    }
    if (!intent.handler || typeof intent.handler !== 'function') {
      throw new Error('Intent handler must be a function');
    }
    this.intents.set(intent.name, intent);
  }

  public resolve(input: string): IIntent | null {
    for (const [name, intent] of this.intents.entries()) {
      if (intent.pattern.test(input)) {
        return intent;
      }
    }
    return null;
  }

  public list(): IIntent[] {
    return Array.from(this.intents.values());
  }

  public get(name: string): IIntent | undefined {
    return this.intents.get(name);
  }

  public clear(): void {
    this.intents.clear();
  }

  public size(): number {
    return this.intents.size;
  }
}
