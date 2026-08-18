import { Tool, ToolParameter } from './ToolSchema.js';
import { AccountController } from '../controllers/AccountController.js';

const getAccountTool: Tool = {
  name: 'getAccount',
  description: 'Retrieve account information by account ID',
  parameters: [
    {
      name: 'id',
      type: 'string',
      description: 'The unique identifier of the account to retrieve',
      required: true,
    },
  ],
  returns: {
    type: 'object',
    description: 'Account object containing account details',
  },
  handler: async (params: { id: string }) => {
    const mockReq: any = {
      params: { id: params.id },
      headers: {},
    };
    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => data,
        end: () => null,
      }),
      json: (data: any) => data,
    };
    return AccountController.fetch(mockReq, mockRes, () => {});
  },
};

const updateAccountTool: Tool = {
  name: 'updateAccount',
  description: 'Update account information',
  parameters: [
    {
      name: 'id',
      type: 'string',
      description: 'The unique identifier of the account to update',
      required: true,
    },
    {
      name: 'data',
      type: 'object',
      description: 'Account data to update',
      required: true,
      properties: {
        name: {
          name: 'name',
          type: 'string',
          description: 'Account name',
          required: false,
        },
        email: {
          name: 'email',
          type: 'string',
          description: 'Account email address',
          required: false,
        },
        phone: {
          name: 'phone',
          type: 'string',
          description: 'Account phone number',
          required: false,
        },
        address: {
          name: 'address',
          type: 'string',
          description: 'Account address',
          required: false,
        },
      },
    },
  ],
  returns: {
    type: 'object',
    description: 'Updated account object',
  },
  handler: async (params: { id: string; data: any }) => {
    const mockReq: any = {
      params: { id: params.id },
      body: params.data,
      headers: {},
    };
    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => data,
        end: () => null,
      }),
      json: (data: any) => data,
    };
    return AccountController.update(mockReq, mockRes, () => {});
  },
};

export const accountTools: Tool[] = [getAccountTool, updateAccountTool];
