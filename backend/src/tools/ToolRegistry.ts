interface ToolSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
}

interface Tool {
  name: string;
  description: string;
  schema?: ToolSchema;
  execute: (parameters: any) => Promise<any>;
}

export class ToolRegistry {
  private static tools: Map<string, Tool> = new Map();

  static registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  static getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  static getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  static getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  static hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  static unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  static clear(): void {
    this.tools.clear();
  }
}
