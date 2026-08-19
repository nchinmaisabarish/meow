export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  items?: {
    type: string;
  };
}

export interface ToolParameters {
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolReturns {
  type: string;
  description: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameters;
  returns?: ToolReturns;
  handler?: (...args: any[]) => Promise<any>;
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolSchema>;

  private constructor() {
    this.tools = new Map();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: ToolSchema): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolSchema | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolSchema[] {
    return Array.from(this.tools.values());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }

  getToolCount(): number {
    return this.tools.size;
  }
}
