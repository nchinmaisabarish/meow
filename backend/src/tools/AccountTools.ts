import { AccountController } from '../controllers/AccountController.js';
import { Request, Response } from 'express';

export interface IToolSchema {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute(params: Record<string, any>): Promise<any>;
}

export interface ToolParameter {
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

export class GetAccountTool implements IToolSchema {
  name = 'get_account';
  description = 'Retrieve a specific account by its ID';
  parameters = {
    accountId: {
      type: 'string',
      description: 'The unique identifier of the account to retrieve',
      required: true,
    },
  };

  async execute(params: Record<string, any>): Promise<any> {
    const { accountId } = params;

    if (!accountId) {
      throw new Error('accountId parameter is required');
    }

    return new Promise((resolve, reject) => {
      const mockReq = {
        params: { id: accountId },
        headers: {},
      } as unknown as Request;

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 200) {
              resolve(data);
            } else {
              reject(new Error(`Failed to get account: ${JSON.stringify(data)}`));
            }
          },
          end: () => {
            reject(new Error(`Failed to get account with status ${code}`));
          },
        }),
        json: (data: any) => {
          resolve(data);
        },
      } as unknown as Response;

      AccountController.fetch(mockReq, mockRes, (error: any) => {
        if (error) {
          reject(error);
        }
      });
    });
  }
}

export class ListAccountsTool implements IToolSchema {
  name = 'list_accounts';
  description = 'List all accounts with optional filtering';
  parameters = {
    limit: {
      type: 'number',
      description: 'Maximum number of accounts to return',
      required: false,
      default: 100,
    },
    offset: {
      type: 'number',
      description: 'Number of accounts to skip for pagination',
      required: false,
      default: 0,
    },
    search: {
      type: 'string',
      description: 'Search term to filter accounts by name or other fields',
      required: false,
    },
  };

  async execute(params: Record<string, any>): Promise<any> {
    const { limit = 100, offset = 0, search } = params;

    return new Promise((resolve, reject) => {
      const mockReq = {
        query: {
          limit: limit.toString(),
          offset: offset.toString(),
          ...(search && { search }),
        },
        headers: {},
      } as unknown as Request;

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 200) {
              resolve(data);
            } else {
              reject(new Error(`Failed to list accounts: ${JSON.stringify(data)}`));
            }
          },
          end: () => {
            reject(new Error(`Failed to list accounts with status ${code}`));
          },
        }),
        json: (data: any) => {
          resolve(data);
        },
      } as unknown as Response;

      AccountController.list(mockReq, mockRes, (error: any) => {
        if (error) {
          reject(error);
        }
      });
    });
  }
}

export class ToolRegistry {
  private static tools: Map<string, IToolSchema> = new Map();

  static register(tool: IToolSchema): void {
    this.tools.set(tool.name, tool);
  }

  static get(name: string): IToolSchema | undefined {
    return this.tools.get(name);
  }

  static list(): IToolSchema[] {
    return Array.from(this.tools.values());
  }

  static getSchemas(): Array<{ name: string; description: string; parameters: Record<string, ToolParameter> }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  static async execute(name: string, params: Record<string, any>): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found in registry`);
    }

    const missingParams = Object.entries(tool.parameters)
      .filter(([_, param]) => param.required && !(param in params))
      .map(([name]) => name);

    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }

    return tool.execute(params);
  }
}
