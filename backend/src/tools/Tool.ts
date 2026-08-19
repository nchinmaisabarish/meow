export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  schema?: any;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: {
    type: string;
    description: string;
    schema?: any;
  };
}

export interface ToolExecutionContext {
  userId?: string;
  teamId?: string;
  [key: string]: any;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export abstract class Tool<TInput = any, TOutput = any> {
  abstract readonly schema: ToolSchema;

  abstract execute(
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>>;

  getName(): string {
    return this.schema.name;
  }

  getDescription(): string {
    return this.schema.description;
  }

  getSchema(): ToolSchema {
    return this.schema;
  }
}
