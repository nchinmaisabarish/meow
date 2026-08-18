import { IToolSchema, IToolParameter } from './ToolSchema';

export class ToolRegistry {
  private tools: Map<string, IToolSchema>;
  private static instance: ToolRegistry;

  private constructor() {
    this.tools = new Map<string, IToolSchema>();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public registerTool(schema: IToolSchema): void {
    if (!schema.name || schema.name.trim() === '') {
      throw new Error('Tool name is required');
    }

    if (!schema.description || schema.description.trim() === '') {
      throw new Error('Tool description is required');
    }

    if (!Array.isArray(schema.parameters)) {
      throw new Error('Tool parameters must be an array');
    }

    if (!schema.returns || !schema.returns.type) {
      throw new Error('Tool return type is required');
    }

    this.validateParameters(schema.parameters);

    if (this.tools.has(schema.name)) {
      throw new Error(`Tool with name '${schema.name}' is already registered`);
    }

    this.tools.set(schema.name, schema);
  }

  public getTool(name: string): IToolSchema | undefined {
    return this.tools.get(name);
  }

  public getToolSchemas(): Record<string, IToolSchema> {
    const schemas: Record<string, IToolSchema> = {};
    this.tools.forEach((schema, name) => {
      schemas[name] = schema;
    });
    return schemas;
  }

  public getAllTools(): IToolSchema[] {
    return Array.from(this.tools.values());
  }

  public getToolsByCategory(category: string): IToolSchema[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.category === category
    );
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  public clear(): void {
    this.tools.clear();
  }

  public getToolCount(): number {
    return this.tools.size;
  }

  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  public toOpenAIFormat(): Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, any>;
        required: string[];
      };
    };
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.convertParametersToProperties(tool.parameters),
          required: tool.parameters
            .filter((p) => p.required)
            .map((p) => p.name),
        },
      },
    }));
  }

  private validateParameters(parameters: IToolParameter[]): void {
    const paramNames = new Set<string>();

    for (const param of parameters) {
      if (!param.name || param.name.trim() === '') {
        throw new Error('Parameter name is required');
      }

      if (paramNames.has(param.name)) {
        throw new Error(`Duplicate parameter name: ${param.name}`);
      }
      paramNames.add(param.name);

      if (!param.type) {
        throw new Error(`Parameter type is required for: ${param.name}`);
      }

      const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
      if (!validTypes.includes(param.type)) {
        throw new Error(
          `Invalid parameter type '${param.type}' for: ${param.name}`
        );
      }

      if (!param.description || param.description.trim() === '') {
        throw new Error(`Parameter description is required for: ${param.name}`);
      }

      if (param.type === 'array' && param.items) {
        if (!param.items.type) {
          throw new Error(
            `Array items type is required for parameter: ${param.name}`
          );
        }
      }

      if (param.type === 'object' && param.properties) {
        this.validateNestedProperties(param.properties, param.name);
      }
    }
  }

  private validateNestedProperties(
    properties: Record<string, IToolParameter>,
    parentName: string
  ): void {
    for (const [propName, propSchema] of Object.entries(properties)) {
      if (!propSchema.type) {
        throw new Error(
          `Property type is required for: ${parentName}.${propName}`
        );
      }

      if (propSchema.type === 'object' && propSchema.properties) {
        this.validateNestedProperties(
          propSchema.properties,
          `${parentName}.${propName}`
        );
      }
    }
  }

  private convertParametersToProperties(
    parameters: IToolParameter[]
  ): Record<string, any> {
    const properties: Record<string, any> = {};

    for (const param of parameters) {
      const property: any = {
        type: param.type,
        description: param.description,
      };

      if (param.enum) {
        property.enum = param.enum;
      }

      if (param.default !== undefined) {
        property.default = param.default;
      }

      if (param.type === 'array' && param.items) {
        property.items = {
          type: param.items.type,
        };
        if (param.items.properties) {
          property.items.properties = this.convertNestedProperties(
            param.items.properties
          );
        }
      }

      if (param.type === 'object' && param.properties) {
        property.properties = this.convertNestedProperties(param.properties);
      }

      properties[param.name] = property;
    }

    return properties;
  }

  private convertNestedProperties(
    properties: Record<string, IToolParameter>
  ): Record<string, any> {
    const converted: Record<string, any> = {};

    for (const [name, param] of Object.entries(properties)) {
      const property: any = {
        type: param.type,
        description: param.description,
      };

      if (param.enum) {
        property.enum = param.enum;
      }

      if (param.default !== undefined) {
        property.default = param.default;
      }

      if (param.type === 'object' && param.properties) {
        property.properties = this.convertNestedProperties(param.properties);
      }

      if (param.type === 'array' && param.items) {
        property.items = {
          type: param.items.type,
        };
        if (param.items.properties) {
          property.items.properties = this.convertNestedProperties(
            param.items.properties
          );
        }
      }

      converted[name] = property;
    }

    return converted;
  }
}

export default ToolRegistry.getInstance();
