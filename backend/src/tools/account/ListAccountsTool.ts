import { z } from 'zod';
import { ToolWrapper, ToolParameter } from '../ToolWrapper.js';
import { AccountController } from '../../controllers/AccountController.js';
import { Request, Response } from 'express';

interface ListAccountsInput {
  teamId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface ListAccountsOutput {
  success: boolean;
  data?: any;
  error?: string;
}

export class ListAccountsTool extends ToolWrapper<ListAccountsInput, ListAccountsOutput> {
  readonly name = 'list_accounts';
  readonly description = 'Retrieve a paginated list of accounts with optional search filtering';
  readonly parameters: ToolParameter[] = [
    {
      name: 'teamId',
      type: 'string',
      description: 'The team ID for authorization context',
      required: false,
      schema: z.string().optional(),
    },
    {
      name: 'page',
      type: 'number',
      description: 'The page number for pagination (default: 1)',
      required: false,
      schema: z.number().int().positive().optional(),
    },
    {
      name: 'limit',
      type: 'number',
      description: 'The number of items per page (default: 20)',
      required: false,
      schema: z.number().int().positive().max(100).optional(),
    },
    {
      name: 'search',
      type: 'string',
      description: 'Search query to filter accounts',
      required: false,
      schema: z.string().optional(),
    },
  ];

  async execute(input: ListAccountsInput): Promise<ListAccountsOutput> {
    try {
      const queryParams: Record<string, string> = {};
      
      if (input.page !== undefined) {
        queryParams.page = String(input.page);
      }
      if (input.limit !== undefined) {
        queryParams.limit = String(input.limit);
      }
      if (input.search) {
        queryParams.search = input.search;
      }

      const mockReq = {
        query: queryParams,
        headers: {
          'x-meow-team': input.teamId || '',
        },
      } as unknown as Request;

      let responseData: any = null;
      let statusCode = 200;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
        end: () => mockRes,
      } as unknown as Response;

      await AccountController.list(mockReq, mockRes);

      if (statusCode >= 200 && statusCode < 300) {
        return {
          success: true,
          data: responseData,
        };
      } else {
        return {
          success: false,
          error: responseData?.message || `Request failed with status ${statusCode}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
