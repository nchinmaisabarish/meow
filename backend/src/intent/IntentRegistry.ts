import { IntentResolver, IntentPattern } from './IntentResolver.js';

export type ControllerMethod = (...args: any[]) => Promise<any> | any;

export interface IntentMapping {
  intent: string;
  controller: string;
  method: string;
  handler?: ControllerMethod;
}

export class IntentRegistry {
  private resolver: IntentResolver;
  private mappings: Map<string, IntentMapping>;
  private handlers: Map<string, ControllerMethod>;

  constructor() {
    this.resolver = new IntentResolver();
    this.mappings = new Map();
    this.handlers = new Map();
  }

  register(
    intentKey: string,
    controller: string,
    method: string,
    handler?: ControllerMethod
  ): void {
    const mapping: IntentMapping = {
      intent: intentKey,
      controller,
      method,
      handler,
    };

    this.mappings.set(intentKey, mapping);

    if (handler) {
      const handlerKey = `${controller}.${method}`;
      this.handlers.set(handlerKey, handler);
    }
  }

  registerPattern(pattern: IntentPattern): void {
    this.resolver.registerPattern(pattern);
  }

  async resolve(intent: string) {
    return await this.resolver.resolve(intent);
  }

  getMapping(intentKey: string): IntentMapping | undefined {
    return this.mappings.get(intentKey);
  }

  getHandler(controller: string, method: string): ControllerMethod | undefined {
    const handlerKey = `${controller}.${method}`;
    return this.handlers.get(handlerKey);
  }

  getAllMappings(): IntentMapping[] {
    return Array.from(this.mappings.values());
  }

  clear(): void {
    this.mappings.clear();
    this.handlers.clear();
  }
}
