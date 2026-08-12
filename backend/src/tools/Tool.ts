export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean;
  description?: string;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ToolMetadata {
  name: string;
  description: string;
  version?: string;
  category?: string;
  tags?: string[];
}

export interface ToolExecutionContext {
  userId?: string;
  requestId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: Record<string, any>;
}

export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  metadata?: ToolMetadata;
  execute(
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>>;
}

export abstract class BaseTool<TInput = any, TOutput = any>
  implements Tool<TInput, TOutput>
{
  abstract name: string;
  abstract description: string;
  abstract inputSchema: JSONSchema;
  abstract outputSchema: JSONSchema;
  metadata?: ToolMetadata;

  abstract execute(
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>>;

  protected createSuccessResult(
    data: TOutput,
    metadata?: Record<string, any>
  ): ToolExecutionResult<TOutput> {
    return {
      success: true,
      data,
      metadata,
    };
  }

  protected createErrorResult(
    code: string,
    message: string,
    details?: any
  ): ToolExecutionResult<TOutput> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  getMetadata(): ToolMetadata {
    return (
      this.metadata || {
        name: this.name,
        description: this.description,
      }
    );
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      metadata: this.getMetadata(),
    };
  }
}
