export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
  default?: any;
  items?: {
    type: string;
  };
}

export interface ToolReturns {
  type: string;
  description: string;
  properties?: Record<string, {
    type: string;
    description: string;
  }>;
}

export interface ToolExample {
  input: Record<string, any>;
  output: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  returns: ToolReturns;
  examples?: ToolExample[];
}
