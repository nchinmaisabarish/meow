import { z } from 'zod';
import { ToolWrapper, ToolParameter } from '../ToolWrapper.js';
import { AccountController } from '../../controllers/AccountController.js';
import { Request, Response } from 'express';

interface GetAccountInput {
  id: string;
  teamId?: string;
}

interface GetAccountOutput {
  success: boolean;
  data?: any;
  error?: string;
}

export class GetAccountTool extends ToolWrapper<GetAccountInput, GetAccountOutput> {
  readonly name = 'get_account';
  readonly description = 'Retrieve a specific account by its ID';
  readonly parameters: ToolParameter[] = [
    {
      name: 'id',
      type: 'string',
      description: 'The unique identifier of the account to retrieve',
      required: true,
      schema: z.string().min(1),
    },
    {
      name: 'teamId',
      type: 'string',
      description: 'The team ID for authorization context',
      required: false,
      schema: z.string().optional(),
    },
  ];

  async execute(input: GetAccountInput): Promise<GetAccountOutput> {
    try {
      const mockReq = {
        params: { id: input.id },
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

      await AccountController.fetch(mockReq, mockRes);

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
