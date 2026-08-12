import { ToolWrapper } from './ToolWrapper.js';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolWrapper>;

  private constructor() {
    this.tools = new Map();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: ToolWrapper): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolWrapper | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolWrapper[] {
    return Array.from(this.tools.values());
  }

  getAllSchemas() {
    return Array.from(this.tools.values()).map((tool) => tool.getSchema());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
  }
}
