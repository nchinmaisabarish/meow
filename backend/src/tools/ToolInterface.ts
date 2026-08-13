export interface ToolSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    items?: {
      type: string;
      properties?: Record<string, any>;
    };
    properties?: Record<string, any>;
    required?: string[];
    enum?: any[];
  }>;
  required?: string[];
  additionalProperties?: boolean;
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
  sessionId?: string;
  timestamp: Date;
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
  readonly metadata: ToolMetadata;
  readonly inputSchema: ToolSchema;
  readonly outputSchema: ToolSchema;
  
  execute(
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>>;
  
  validate(input: any): { valid: boolean; errors?: string[] };
  
  getSchema(): {
    metadata: ToolMetadata;
    input: ToolSchema;
    output: ToolSchema;
  };
}

export interface ToolDefinition {
  metadata: ToolMetadata;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
  handler: (input: any, context?: ToolExecutionContext) => Promise<any>;
}
