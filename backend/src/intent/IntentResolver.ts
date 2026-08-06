export interface IIntentResolver {
  resolve(intent: string): Promise<IntentResolution>;
}

export interface IntentResolution {
  action: string;
  controller?: string;
  method?: string;
  parameters?: Record<string, any>;
  confidence: number;
}

export interface IntentPattern {
  pattern: string | RegExp;
  action: string;
  controller?: string;
  method?: string;
  extractParams?: (intent: string) => Record<string, any>;
}

export class IntentResolver implements IIntentResolver {
  private patterns: IntentPattern[] = [];

  registerPattern(pattern: IntentPattern): void {
    this.patterns.push(pattern);
  }

  async resolve(intent: string): Promise<IntentResolution> {
    const normalizedIntent = intent.toLowerCase().trim();

    for (const pattern of this.patterns) {
      let match = false;
      let params: Record<string, any> = {};

      if (typeof pattern.pattern === 'string') {
        match = normalizedIntent.includes(pattern.pattern.toLowerCase());
      } else {
        const regexMatch = normalizedIntent.match(pattern.pattern);
        match = regexMatch !== null;
        if (match && regexMatch && pattern.extractParams) {
          params = pattern.extractParams(normalizedIntent);
        }
      }

      if (match) {
        return {
          action: pattern.action,
          controller: pattern.controller,
          method: pattern.method,
          parameters: params,
          confidence: 1.0,
        };
      }
    }

    return {
      action: 'unknown',
      confidence: 0.0,
    };
  }
}
