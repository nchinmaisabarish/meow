import { Tool, ToolSchema, ToolExecutionContext, ToolExecutionResult } from '../Tool.js';
import { AccountController } from '../../controllers/AccountController.js';
import { Request, Response } from 'express';

interface CreateAccountInput {
  name: string;
  teamId: string;
  description?: string;
  contact?: {
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

interface CreateAccountOutput {
  account: any;
}

export class CreateAccountTool extends Tool<CreateAccountInput, CreateAccountOutput> {
  readonly schema: ToolSchema = {
    name: 'create_account',
    description: 'Creates a new account in the system for a specific team',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'The name of the account to create',
        required: true,
        schema: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
        },
      },
      {
        name: 'teamId',
        type: 'string',
        description: 'The unique identifier of the team that will own this account',
        required: true,
        schema: {
          type: 'string',
          pattern: '^[a-fA-F0-9]{24}$',
        },
      },
      {
        name: 'description',
        type: 'string',
        description: 'Optional description of the account',
        required: false,
        schema: {
          type: 'string',
          maxLength: 1000,
        },
      },
      {
        name: 'contact',
        type: 'object',
        description: 'Optional contact information for the account',
        required: false,
        schema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
            },
            phone: {
              type: 'string',
            },
          },
        },
      },
      {
        name: 'metadata',
        type: 'object',
        description: 'Optional additional metadata for the account',
        required: false,
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    returns: {
      type: 'object',
      description: 'The newly created account',
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
              metadata: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  };

  async execute(
    input: CreateAccountInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<CreateAccountOutput>> {
    try {
      const requestBody: any = {
        name: input.name,
      };

      if (input.description) {
        requestBody.description = input.description;
      }

      if (input.contact) {
        requestBody.contact = input.contact;
      }

      if (input.metadata) {
        requestBody.metadata = input.metadata;
      }

      const mockRequest = {
        body: requestBody,
        headers: {
          'x-meow-team': input.teamId,
          'content-type': 'application/json',
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

      await AccountController.create(mockRequest, mockResponse);

      if (statusCode !== 200 && statusCode !== 201) {
        return {
          success: false,
          error: `Failed to create account: HTTP ${statusCode}`,
        };
      }

      if (!responseData) {
        return {
          success: false,
          error: 'Failed to create account: No response data',
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
