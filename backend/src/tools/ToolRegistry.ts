import { Tool, ToolMetadata } from './Tool';

export interface ToolRegistryEntry {
  tool: Tool;
  registeredAt: Date;
  enabled: boolean;
}

export interface ToolSearchCriteria {
  name?: string;
  category?: string;
  tags?: string[];
  enabled?: boolean;
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

  register(tool: Tool, enabled: boolean = true): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, {
      tool,
      registeredAt: new Date(),
      enabled,
    });
  }

  unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  get(toolName: string): Tool | undefined {
    const entry = this.tools.get(toolName);
    return entry?.enabled ? entry.tool : undefined;
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
      .filter((entry) => entry.enabled)
      .map((entry) => entry.tool);
  }

  search(criteria: ToolSearchCriteria): Tool[] {
    return Array.from(this.tools.values())
      .filter((entry) => {
        if (criteria.enabled !== undefined && entry.enabled !== criteria.enabled) {
          return false;
        }

        const tool = entry.tool;

        if (criteria.name && tool.name !== criteria.name) {
          return false;
        }

        if (criteria.category && tool.metadata?.category !== criteria.category) {
          return false;
        }

        if (criteria.tags && criteria.tags.length > 0) {
          const toolTags = tool.metadata?.tags || [];
          const hasAllTags = criteria.tags.every((tag) => toolTags.includes(tag));
          if (!hasAllTags) {
            return false;
          }
        }

        return true;
      })
      .map((entry) => entry.tool);
  }

  enable(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    if (entry) {
      entry.enabled = true;
      return true;
    }
    return false;
  }

  disable(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    if (entry) {
      entry.enabled = false;
      return true;
    }
    return false;
  }

  isRegistered(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  isEnabled(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    return entry?.enabled || false;
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    this.tools.forEach((entry) => {
      if (entry.tool.metadata?.category) {
        categories.add(entry.tool.metadata.category);
      }
    });
    return Array.from(categories);
  }

  getTags(): string[] {
    const tags = new Set<string>();
    this.tools.forEach((entry) => {
      if (entry.tool.metadata?.tags) {
        entry.tool.metadata.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags);
  }

  getToolSchemas(): Record<string, any>[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      metadata: tool.metadata,
    }));
  }

  clear(): void {
    this.tools.clear();
  }

  size(): number {
    return this.tools.size;
  }

  getEnabledCount(): number {
    return Array.from(this.tools.values()).filter((entry) => entry.enabled).length;
  }
}

export const toolRegistry = ToolRegistry.getInstance();
