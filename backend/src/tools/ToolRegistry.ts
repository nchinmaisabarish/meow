import { Tool } from './Tool.js';
import pino from 'pino';

const log = pino({
  name: 'ToolRegistry',
  level: process.env.LOG_LEVEL || 'info',
});

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool>;

  private constructor() {
    this.tools = new Map();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public register(tool: Tool): void {
    const name = tool.getName();
    if (this.tools.has(name)) {
      log.warn(`Tool ${name} is already registered. Overwriting.`);
    }
    this.tools.set(name, tool);
    log.info(`Registered tool: ${name}`);
  }

  public get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  public getAllSchemas(): any[] {
    return this.getAll().map((tool) => tool.getSchema());
  }

  public has(name: string): boolean {
    return this.tools.has(name);
  }

  public unregister(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      log.info(`Unregistered tool: ${name}`);
    }
    return result;
  }

  public clear(): void {
    this.tools.clear();
    log.info('Cleared all tools from registry');
  }

  public count(): number {
    return this.tools.size;
  }
}
