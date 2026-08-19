import { Tool, ToolSchema, ToolExecutionContext, ToolExecutionResult } from '../Tool.js';
import { AccountController } from '../../controllers/AccountController.js';
import { Request, Response } from 'express';

interface ListAccountsInput {
  teamId: string;
  limit?: number;
  offset?: number;
}

interface ListAccountsOutput {
  accounts: any[];
  total: number;
}

export class ListAccountsTool extends Tool<ListAccountsInput, ListAccountsOutput> {
  readonly schema: ToolSchema = {
    name: 'list_accounts',
    description: 'Retrieves a list of accounts for a specific team with optional pagination',
    parameters: [
      {
        name: 'teamId',
        type: 'string',
        description: 'The unique identifier of the team',
        required: true,
        schema: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
        },
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of accounts to return',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Number of accounts to skip for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 0,
          default: 0,
        },
      },
    ],
    returns: {
      type: 'object',
      description: 'List of accounts with pagination information',
      schema: {
        type: 'object',
        properties: {
          accounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                name: { type: 'string' },
                team: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          total: {
            type: 'number',
            description: 'Total number of accounts available',
          },
        },
      },
    },
  };

  async execute(
    input: ListAccountsInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<ListAccountsOutput>> {
    try {
      const mockRequest = {
        query: {
          limit: input.limit?.toString() || '50',
          offset: input.offset?.toString() || '0',
        },
        headers: {
          'x-meow-team': input.teamId,
        },
      } as unknown as Request;

      let responseData: any = null;
      let statusCode = 200;

      const mockResponse = {
        status: (code: number) => {
          statusCode = code;
          return mockResponse;
        },
        json: (data: any) => {
          responseData = data;
          return mockResponse;
        },
        end: () => mockResponse,
      } as unknown as Response;

      await AccountController.list(mockRequest, mockResponse);

      if (statusCode !== 200) {
        return {
          success: false,
          error: `Failed to list accounts: HTTP ${statusCode}`,
        };
      }

      return {
        success: true,
        data: {
          accounts: Array.isArray(responseData) ? responseData : [],
          total: Array.isArray(responseData) ? responseData.length : 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
