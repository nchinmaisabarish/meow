import { Tool, ToolExecutionContext, ToolExecutionResult } from '../Tool.js';
import { CardController } from '../../controllers/CardController.js';
import { Request, Response } from 'express';

export interface GetCardParams {
  id: string;
  includeEvents?: boolean;
}

export class GetCardTool implements Tool {
  name = 'get_card';
  description = 'Retrieves a card by its ID with optional event history';
  
  parameters = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The unique identifier of the card to retrieve'
      },
      includeEvents: {
        type: 'boolean',
        description: 'Whether to include the event history of the card',
        default: false
      }
    },
    required: ['id']
  };

  async execute(params: GetCardParams, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const mockReq = {
        params: {
          id: params.id
        },
        query: {
          includeEvents: params.includeEvents ? 'true' : 'false'
        },
        headers: context.headers || {},
        user: context.user
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
        send: (data: any) => {
          responseData = data;
          return mockRes;
        },
        end: () => mockRes
      } as unknown as Response;

      await CardController.get(mockReq, mockRes);

      if (statusCode >= 200 && statusCode < 300) {
        return {
          success: true,
          data: responseData,
          message: 'Card retrieved successfully'
        };
      } else if (statusCode === 404) {
        return {
          success: false,
          error: 'Card not found',
          data: { id: params.id }
        };
      } else {
        return {
          success: false,
          error: responseData?.message || 'Failed to retrieve card',
          data: responseData
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while retrieving the card'
      };
    }
  }

  validate(params: any): boolean {
    if (!params || typeof params !== 'object') {
      return false;
    }

    if (!params.id || typeof params.id !== 'string' || params.id.trim().length === 0) {
      return false;
    }

    if (params.includeEvents !== undefined && typeof params.includeEvents !== 'boolean') {
      return false;
    }

    return true;
  }
}
