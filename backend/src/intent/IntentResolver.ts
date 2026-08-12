export interface IIntentResolver {
  resolve(intent: string): Promise<any>;
}

export interface IntentHandler {
  (context?: any): Promise<any> | any;
}
