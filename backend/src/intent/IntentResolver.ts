export interface IIntent {
  name: string;
  pattern: RegExp;
  handler: Function;
  metadata: {
    method?: string;
    description?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface IIntentResolver {
  resolve(input: string): IIntent | null;
}
