export interface IntentMatch {
  intent: string;
  confidence: number;
  parameters?: Record<string, any>;
  handler?: IntentHandler;
}

export type IntentHandler = (parameters?: Record<string, any>) => Promise<any>;

export interface IIntentResolver {
  resolve(input: string): Promise<IntentMatch>;
}
