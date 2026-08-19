import { Tool, ToolSchema, ToolExecutionContext, ToolExecutionResult } from '../Tool.js';
import { AccountController } from '../../controllers/AccountController.js';
import { Request, Response } from 'express';

interface GetAccountInput {
  accountId: string;
  teamId: string;
}

interface GetAccountOutput {
  account: any;
}

export class GetAccountTool extends Tool<GetAccountInput, GetAccountOutput> {
  readonly schema: ToolSchema = {
    name: 'get_account',
    description: 'Retrieves detailed information about a specific account by its ID',
    parameters: [
      {
        name: 'accountId',
        type: 'string',
        description: 'The unique identifier of the account to retrieve',
        required: true,
        schema: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
        },
      },
      {
        name: 'teamId',
        type: 'string',
        description: 'The unique identifier of the team that owns the account',
        required: true,
        schema: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
        },
      },
    ],
    returns: {
      type: 'object',
      description: 'Detailed account information',
      schema: {
        type: 'object',
        properties: {
          account: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              team: { type: 'string' },
              description: { type: 'string' },
              contact: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  phone: { type: 'string' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  };

  async execute(
    input: GetAccountInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<GetAccountOutput>> {
    try {
      const mockRequest = {
        params: {
          id: input.accountId,
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

      await AccountController.fetch(mockRequest, mockResponse);

      if (statusCode !== 200) {
        return {
          success: false,
          error: `Failed to fetch account: HTTP ${statusCode}`,
        };
      }

      if (!responseData) {
        return {
          success: false,
          error: 'Account not found',
        };
      }

      return {
        success: true,
        data: {
          account: responseData,
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
