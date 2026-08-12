import { IIntentResolver, IntentMatch, IntentHandler } from './IntentResolver.js';

export interface IntentPattern {
  pattern: string | RegExp;
  intent: string;
  handler: IntentHandler;
  priority?: number;
}

export class IntentRegistry implements IIntentResolver {
  private intents: IntentPattern[] = [];

  public registerIntent(
    pattern: string | RegExp,
    handler: IntentHandler,
    intent?: string,
    priority: number = 0
  ): void {
    const intentName = intent || (typeof pattern === 'string' ? pattern : pattern.source);
    
    this.intents.push({
      pattern,
      intent: intentName,
      handler,
      priority,
    });

    this.intents.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  public async resolveIntent(input: string): Promise<IntentMatch> {
    for (const intentPattern of this.intents) {
      const match = this.matchPattern(input, intentPattern.pattern);
      
      if (match.matched) {
        return {
          intent: intentPattern.intent,
          confidence: match.confidence,
          parameters: match.parameters,
          handler: intentPattern.handler,
        };
      }
    }

    return {
      intent: 'unknown',
      confidence: 0,
      parameters: {},
    };
  }

  public async resolve(input: string): Promise<IntentMatch> {
    return this.resolveIntent(input);
  }

  private matchPattern(
    input: string,
    pattern: string | RegExp
  ): { matched: boolean; confidence: number; parameters?: Record<string, any> } {
    if (typeof pattern === 'string') {
      const normalizedInput = input.toLowerCase().trim();
      const normalizedPattern = pattern.toLowerCase().trim();

      if (normalizedInput === normalizedPattern) {
        return { matched: true, confidence: 1.0 };
      }

      if (normalizedInput.includes(normalizedPattern)) {
        return { matched: true, confidence: 0.8 };
      }

      return { matched: false, confidence: 0 };
    }

    const regexMatch = input.match(pattern);
    if (regexMatch) {
      const parameters: Record<string, any> = {};
      
      if (regexMatch.groups) {
        Object.assign(parameters, regexMatch.groups);
      }

      return {
        matched: true,
        confidence: 0.9,
        parameters,
      };
    }

    return { matched: false, confidence: 0 };
  }

  public getRegisteredIntents(): string[] {
    return this.intents.map((i) => i.intent);
  }

  public clearIntents(): void {
    this.intents = [];
  }
}
