import { IntentResolution } from './IntentResolver';
import { Tool, ToolParameter } from '../tools/Tool';
import { ToolRegistry } from '../tools/ToolRegistry';

export interface MappingResult {
  tool: Tool;
  parameters: Record<string, any>;
  validated: boolean;
  errors?: string[];
}

export interface IntentToToolMapping {
  intentType: string;
  toolName: string;
  parameterMapping: Record<string, string>;
}

export class IntentToolMapper {
  private mappings: Map<string, IntentToToolMapping>;
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
    this.mappings = new Map();
    this.initializeDefaultMappings();
  }

  private initializeDefaultMappings(): void {
    this.registerMapping({
      intentType: 'create_task',
      toolName: 'createTask',
      parameterMapping: {
        title: 'title',
        description: 'description',
        priority: 'priority',
        assignee: 'assignee',
        dueDate: 'dueDate'
      }
    });

    this.registerMapping({
      intentType: 'update_task',
      toolName: 'updateTask',
      parameterMapping: {
        taskId: 'id',
        title: 'title',
        description: 'description',
        status: 'status',
        priority: 'priority'
      }
    });

    this.registerMapping({
      intentType: 'delete_task',
      toolName: 'deleteTask',
      parameterMapping: {
        taskId: 'id'
      }
    });

    this.registerMapping({
      intentType: 'list_tasks',
      toolName: 'listTasks',
      parameterMapping: {
        status: 'status',
        assignee: 'assignee',
        limit: 'limit',
        offset: 'offset'
      }
    });

    this.registerMapping({
      intentType: 'search_tasks',
      toolName: 'searchTasks',
      parameterMapping: {
        query: 'query',
        filters: 'filters'
      }
    });
  }

  public registerMapping(mapping: IntentToToolMapping): void {
    this.mappings.set(mapping.intentType, mapping);
  }

  public async mapIntentToTool(intent: IntentResolution): Promise<MappingResult> {
    const mapping = this.mappings.get(intent.intent);
    
    if (!mapping) {
      return {
        tool: null as any,
        parameters: {},
        validated: false,
        errors: [`No mapping found for intent type: ${intent.intent}`]
      };
    }

    const tool = this.toolRegistry.getTool(mapping.toolName);
    
    if (!tool) {
      return {
        tool: null as any,
        parameters: {},
        validated: false,
        errors: [`Tool not found: ${mapping.toolName}`]
      };
    }

    const parameters = this.extractParameters(intent, mapping);
    const validationResult = this.validateParameters(parameters, tool);

    return {
      tool,
      parameters,
      validated: validationResult.valid,
      errors: validationResult.errors
    };
  }

  private extractParameters(
    intent: IntentResolution,
    mapping: IntentToToolMapping
  ): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const [intentParam, toolParam] of Object.entries(mapping.parameterMapping)) {
      if (intent.entities && intent.entities[intentParam] !== undefined) {
        parameters[toolParam] = intent.entities[intentParam];
      }
    }

    if (intent.context) {
      for (const [key, value] of Object.entries(intent.context)) {
        if (mapping.parameterMapping[key]) {
          parameters[mapping.parameterMapping[key]] = value;
        }
      }
    }

    return parameters;
  }

  private validateParameters(
    parameters: Record<string, any>,
    tool: Tool
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const param of tool.parameters) {
      if (param.required && parameters[param.name] === undefined) {
        errors.push(`Required parameter missing: ${param.name}`);
      }

      if (parameters[param.name] !== undefined) {
        const typeError = this.validateParameterType(parameters[param.name], param);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    const allowedParams = new Set(tool.parameters.map(p => p.name));
    for (const paramName of Object.keys(parameters)) {
      if (!allowedParams.has(paramName)) {
        errors.push(`Unknown parameter: ${paramName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateParameterType(value: any, param: ToolParameter): string | null {
    const actualType = typeof value;
    
    if (param.type === 'string' && actualType !== 'string') {
      return `Parameter ${param.name} must be a string, got ${actualType}`;
    }
    
    if (param.type === 'number' && actualType !== 'number') {
      return `Parameter ${param.name} must be a number, got ${actualType}`;
    }
    
    if (param.type === 'boolean' && actualType !== 'boolean') {
      return `Parameter ${param.name} must be a boolean, got ${actualType}`;
    }
    
    if (param.type === 'object' && (actualType !== 'object' || value === null)) {
      return `Parameter ${param.name} must be an object, got ${actualType}`;
    }
    
    if (param.type === 'array' && !Array.isArray(value)) {
      return `Parameter ${param.name} must be an array`;
    }

    if (param.enum && !param.enum.includes(value)) {
      return `Parameter ${param.name} must be one of: ${param.enum.join(', ')}`;
    }

    return null;
  }

  public async executeIntent(intent: IntentResolution): Promise<any> {
    const mappingResult = await this.mapIntentToTool(intent);

    if (!mappingResult.validated) {
      throw new Error(`Intent validation failed: ${mappingResult.errors?.join(', ')}`);
    }

    return await mappingResult.tool.execute(mappingResult.parameters);
  }

  public getMapping(intentType: string): IntentToToolMapping | undefined {
    return this.mappings.get(intentType);
  }

  public getAllMappings(): IntentToToolMapping[] {
    return Array.from(this.mappings.values());
  }
}
