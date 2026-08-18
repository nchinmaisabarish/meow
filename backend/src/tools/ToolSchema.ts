export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  properties?: Record<string, ToolParameter>;
  items?: ToolParameter;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: {
    type: string;
    description: string;
  };
  handler: (params: any) => Promise<any>;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  getSchemas(): any[];
}
