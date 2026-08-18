import { Tool, ToolRegistry as IToolRegistry, ToolParameter } from './ToolSchema.js';

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  getSchemas(): any[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.convertParametersToJsonSchema(tool.parameters),
      returns: tool.returns,
    }));
  }

  private convertParametersToJsonSchema(parameters: ToolParameter[]): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    parameters.forEach((param) => {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.type === 'object' && param.properties) {
        const nestedProps: Record<string, any> = {};
        const nestedRequired: string[] = [];

        Object.values(param.properties).forEach((nestedParam) => {
          nestedProps[nestedParam.name] = {
            type: nestedParam.type,
            description: nestedParam.description,
          };

          if (nestedParam.required) {
            nestedRequired.push(nestedParam.name);
          }
        });

        properties[param.name].properties = nestedProps;
        if (nestedRequired.length > 0) {
          properties[param.name].required = nestedRequired;
        }
      }

      if (param.type === 'array' && param.items) {
        properties[param.name].items = {
          type: param.items.type,
          description: param.items.description,
        };
      }

      if (param.required) {
        required.push(param.name);
      }
    });

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
}
