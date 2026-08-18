export interface IToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  items?: {
    type: 'string' | 'number' | 'boolean' | 'object';
    properties?: Record<string, IToolParameter>;
  };
  properties?: Record<string, IToolParameter>;
  default?: any;
}

export interface IToolResponse {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';
  description: string;
  properties?: Record<string, IToolParameter>;
  items?: {
    type: 'string' | 'number' | 'boolean' | 'object';
    properties?: Record<string, IToolParameter>;
  };
}

export interface IToolSchema {
  name: string;
  description: string;
  parameters: IToolParameter[];
  returns: IToolResponse;
  category?: string;
  examples?: Array<{
    input: Record<string, any>;
    output: any;
    description?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface IToolExecutionContext {
  toolName: string;
  parameters: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface IToolExecutionResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  executionTime?: number;
}
