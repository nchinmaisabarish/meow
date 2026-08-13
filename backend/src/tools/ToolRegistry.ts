import { Tool, ToolMetadata } from './ToolInterface';

export interface ToolRegistryEntry {
  tool: Tool;
  registeredAt: Date;
}

export interface ToolSearchCriteria {
  name?: string;
  category?: string;
  tags?: string[];
  version?: string;
}

export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry>;
  private static instance: ToolRegistry;

  private constructor() {
    this.tools = new Map();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: Tool): void {
    const toolName = tool.metadata.name;

    if (this.tools.has(toolName)) {
      throw new Error(`Tool with name '${toolName}' is already registered`);
    }

    this.tools.set(toolName, {
      tool,
      registeredAt: new Date(),
    });
  }

  unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  get(toolName: string): Tool | undefined {
    const entry = this.tools.get(toolName);
    return entry?.tool;
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  getAllMetadata(): ToolMetadata[] {
    return this.getAll().map((tool) => tool.metadata);
  }

  search(criteria: ToolSearchCriteria): Tool[] {
    return this.getAll().filter((tool) => {
      const metadata = tool.metadata;

      if (criteria.name && metadata.name !== criteria.name) {
        return false;
      }

      if (criteria.category && metadata.category !== criteria.category) {
        return false;
      }

      if (criteria.version && metadata.version !== criteria.version) {
        return false;
      }

      if (criteria.tags && criteria.tags.length > 0) {
        const toolTags = metadata.tags || [];
        const hasAllTags = criteria.tags.every((tag) => toolTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      return true;
    });
  }

  getByCategory(category: string): Tool[] {
    return this.search({ category });
  }

  getByTags(tags: string[]): Tool[] {
    return this.search({ tags });
  }

  clear(): void {
    this.tools.clear();
  }

  count(): number {
    return this.tools.size;
  }

  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolSchemas(): Array<{
    name: string;
    schema: {
      metadata: ToolMetadata;
      input: any;
      output: any;
    };
  }> {
    return this.getAll().map((tool) => ({
      name: tool.metadata.name,
      schema: tool.getSchema(),
    }));
  }

  exportRegistry(): {
    tools: Array<{
      metadata: ToolMetadata;
      inputSchema: any;
      outputSchema: any;
    }>;
    exportedAt: Date;
    totalCount: number;
  } {
    return {
      tools: this.getAll().map((tool) => ({
        metadata: tool.metadata,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      })),
      exportedAt: new Date(),
      totalCount: this.count(),
    };
  }
}

export const toolRegistry = ToolRegistry.getInstance();
