import { Tool, ToolExecutionContext, ToolExecutionResult } from '../Tool.js';
import { CardController } from '../../controllers/CardController.js';
import { Request, Response } from 'express';

export interface CreateCardParams {
  title: string;
  description?: string;
  laneId: string;
  assignedTo?: string;
  priority?: string;
  dueDate?: string;
  tags?: string[];
}

export class CreateCardTool implements Tool {
  name = 'create_card';
  description = 'Creates a new card in the system with the specified properties';
  
  parameters = {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title of the card'
      },
      description: {
        type: 'string',
        description: 'The description of the card'
      },
      laneId: {
        type: 'string',
        description: 'The ID of the lane where the card will be created'
      },
      assignedTo: {
        type: 'string',
        description: 'The ID of the user to assign the card to'
      },
      priority: {
        type: 'string',
        description: 'The priority level of the card',
        enum: ['low', 'medium', 'high', 'critical']
      },
      dueDate: {
        type: 'string',
        description: 'The due date for the card in ISO 8601 format'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Array of tags to associate with the card'
      }
    },
    required: ['title', 'laneId']
  };

  async execute(params: CreateCardParams, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const mockReq = {
        body: params,
        headers: context.headers || {},
        user: context.user
      } as Request;

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

      await CardController.create(mockReq, mockRes);

      if (statusCode >= 200 && statusCode < 300) {
        return {
          success: true,
          data: responseData,
          message: 'Card created successfully'
        };
      } else {
        return {
          success: false,
          error: responseData?.message || 'Failed to create card',
          data: responseData
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while creating the card'
      };
    }
  }

  validate(params: any): boolean {
    if (!params || typeof params !== 'object') {
      return false;
    }

    if (!params.title || typeof params.title !== 'string' || params.title.trim().length === 0) {
      return false;
    }

    if (!params.laneId || typeof params.laneId !== 'string' || params.laneId.trim().length === 0) {
      return false;
    }

    if (params.description !== undefined && typeof params.description !== 'string') {
      return false;
    }

    if (params.assignedTo !== undefined && typeof params.assignedTo !== 'string') {
      return false;
    }

    if (params.priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(params.priority)) {
        return false;
      }
    }

    if (params.dueDate !== undefined && typeof params.dueDate !== 'string') {
      return false;
    }

    if (params.tags !== undefined) {
      if (!Array.isArray(params.tags)) {
        return false;
      }
      if (!params.tags.every((tag: any) => typeof tag === 'string')) {
        return false;
      }
    }

    return true;
  }
}
