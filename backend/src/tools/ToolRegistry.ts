import { Tool } from './types';
import { CardTools } from './CardTools';

export class ToolRegistry {
  private static tools: Map<string, Tool> = new Map();
  private static initialized: boolean = false;

  static initialize(): void {
    if (this.initialized) {
      return;
    }

    this.registerToolSet(CardTools.getTools());

    this.initialized = true;
  }

  private static registerToolSet(tools: Tool[]): void {
    tools.forEach(tool => {
      this.registerTool(tool);
    });
  }

  static registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }

    this.validateTool(tool);
    this.tools.set(tool.name, tool);
  }

  private static validateTool(tool: Tool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool '${tool.name}' must have a valid description`);
    }

    if (!tool.category || typeof tool.category !== 'string') {
      throw new Error(`Tool '${tool.name}' must have a valid category`);
    }

    if (!Array.isArray(tool.parameters)) {
      throw new Error(`Tool '${tool.name}' must have a parameters array`);
    }

    tool.parameters.forEach((param, index) => {
      if (!param.name || typeof param.name !== 'string') {
        throw new Error(`Tool '${tool.name}' parameter at index ${index} must have a valid name`);
      }

      if (!param.type || typeof param.type !== 'string') {
        throw new Error(`Tool '${tool.name}' parameter '${param.name}' must have a valid type`);
      }

      if (!param.description || typeof param.description !== 'string') {
        throw new Error(`Tool '${tool.name}' parameter '${param.name}' must have a valid description`);
      }

      if (typeof param.required !== 'boolean') {
        throw new Error(`Tool '${tool.name}' parameter '${param.name}' must have a boolean 'required' field`);
      }
    });

    if (!tool.returns || typeof tool.returns !== 'object') {
      throw new Error(`Tool '${tool.name}' must have a valid returns specification`);
    }
  }

  static getTool(name: string): Tool | undefined {
    this.ensureInitialized();
    return this.tools.get(name);
  }

  static getAllTools(): Tool[] {
    this.ensureInitialized();
    return Array.from(this.tools.values());
  }

  static getToolsByCategory(category: string): Tool[] {
    this.ensureInitialized();
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  static getToolNames(): string[] {
    this.ensureInitialized();
    return Array.from(this.tools.keys());
  }

  static hasTools(): boolean {
    this.ensureInitialized();
    return this.tools.size > 0;
  }

  static getToolCount(): number {
    this.ensureInitialized();
    return this.tools.size;
  }

  static getCategories(): string[] {
    this.ensureInitialized();
    const categories = new Set<string>();
    this.tools.forEach(tool => categories.add(tool.category));
    return Array.from(categories);
  }

  static clear(): void {
    this.tools.clear();
    this.initialized = false;
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  static toJSON(): object {
    this.ensureInitialized();
    return {
      toolCount: this.tools.size,
      categories: this.getCategories(),
      tools: this.getAllTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters.map(param => ({
          name: param.name,
          type: param.type,
          description: param.description,
          required: param.required,
          enum: param.enum,
          default: param.default,
          items: param.items
        })),
        returns: tool.returns,
        examples: tool.examples
      }))
    };
  }
}
