export interface IIntentResolver {
  resolve(intent: string): Promise<any>;
}
