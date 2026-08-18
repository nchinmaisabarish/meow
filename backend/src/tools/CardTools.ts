import { Tool, ToolParameter } from './types';

export class CardTools {
  static getTools(): Tool[] {
    return [
      CardTools.createCardTool(),
      CardTools.getCardTool(),
      CardTools.updateCardTool(),
      CardTools.deleteCardTool()
    ];
  }

  private static createCardTool(): Tool {
    return {
      name: 'createCard',
      description: 'Create a new card with specified details including title, description, and status',
      category: 'card_management',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'The title of the card',
          required: true
        },
        {
          name: 'description',
          type: 'string',
          description: 'Detailed description of the card',
          required: false
        },
        {
          name: 'status',
          type: 'string',
          description: 'Current status of the card (e.g., todo, in_progress, done)',
          required: false,
          enum: ['todo', 'in_progress', 'done', 'archived']
        },
        {
          name: 'assigneeId',
          type: 'string',
          description: 'ID of the user assigned to this card',
          required: false
        },
        {
          name: 'dueDate',
          type: 'string',
          description: 'Due date for the card in ISO 8601 format',
          required: false
        },
        {
          name: 'priority',
          type: 'string',
          description: 'Priority level of the card',
          required: false,
          enum: ['low', 'medium', 'high', 'urgent']
        },
        {
          name: 'tags',
          type: 'array',
          description: 'Array of tags associated with the card',
          required: false,
          items: {
            type: 'string'
          }
        }
      ],
      returns: {
        type: 'object',
        description: 'The created card object with generated ID and metadata',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the card' },
          title: { type: 'string', description: 'Title of the card' },
          description: { type: 'string', description: 'Description of the card' },
          status: { type: 'string', description: 'Current status' },
          assigneeId: { type: 'string', description: 'Assigned user ID' },
          dueDate: { type: 'string', description: 'Due date' },
          priority: { type: 'string', description: 'Priority level' },
          tags: { type: 'array', description: 'Associated tags' },
          createdAt: { type: 'string', description: 'Creation timestamp' },
          updatedAt: { type: 'string', description: 'Last update timestamp' }
        }
      },
      examples: [
        {
          input: {
            title: 'Implement user authentication',
            description: 'Add JWT-based authentication to the API',
            status: 'todo',
            priority: 'high',
            tags: ['backend', 'security']
          },
          output: {
            id: '507f1f77bcf86cd799439011',
            title: 'Implement user authentication',
            description: 'Add JWT-based authentication to the API',
            status: 'todo',
            priority: 'high',
            tags: ['backend', 'security'],
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          }
        }
      ]
    };
  }

  private static getCardTool(): Tool {
    return {
      name: 'getCard',
      description: 'Retrieve a card by its unique identifier',
      category: 'card_management',
      parameters: [
        {
          name: 'cardId',
          type: 'string',
          description: 'The unique identifier of the card to retrieve',
          required: true
        },
        {
          name: 'includeComments',
          type: 'boolean',
          description: 'Whether to include comments in the response',
          required: false,
          default: false
        },
        {
          name: 'includeHistory',
          type: 'boolean',
          description: 'Whether to include change history in the response',
          required: false,
          default: false
        }
      ],
      returns: {
        type: 'object',
        description: 'The card object with all its details',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the card' },
          title: { type: 'string', description: 'Title of the card' },
          description: { type: 'string', description: 'Description of the card' },
          status: { type: 'string', description: 'Current status' },
          assigneeId: { type: 'string', description: 'Assigned user ID' },
          dueDate: { type: 'string', description: 'Due date' },
          priority: { type: 'string', description: 'Priority level' },
          tags: { type: 'array', description: 'Associated tags' },
          comments: { type: 'array', description: 'Card comments (if requested)' },
          history: { type: 'array', description: 'Change history (if requested)' },
          createdAt: { type: 'string', description: 'Creation timestamp' },
          updatedAt: { type: 'string', description: 'Last update timestamp' }
        }
      },
      examples: [
        {
          input: {
            cardId: '507f1f77bcf86cd799439011',
            includeComments: true
          },
          output: {
            id: '507f1f77bcf86cd799439011',
            title: 'Implement user authentication',
            description: 'Add JWT-based authentication to the API',
            status: 'in_progress',
            priority: 'high',
            tags: ['backend', 'security'],
            comments: [
              {
                id: '507f1f77bcf86cd799439012',
                text: 'Started working on this',
                authorId: '507f1f77bcf86cd799439013',
                createdAt: '2024-01-15T11:00:00Z'
              }
            ],
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T11:00:00Z'
          }
        }
      ]
    };
  }

  private static updateCardTool(): Tool {
    return {
      name: 'updateCard',
      description: 'Update an existing card with new information',
      category: 'card_management',
      parameters: [
        {
          name: 'cardId',
          type: 'string',
          description: 'The unique identifier of the card to update',
          required: true
        },
        {
          name: 'title',
          type: 'string',
          description: 'Updated title of the card',
          required: false
        },
        {
          name: 'description',
          type: 'string',
          description: 'Updated description of the card',
          required: false
        },
        {
          name: 'status',
          type: 'string',
          description: 'Updated status of the card',
          required: false,
          enum: ['todo', 'in_progress', 'done', 'archived']
        },
        {
          name: 'assigneeId',
          type: 'string',
          description: 'Updated assignee user ID',
          required: false
        },
        {
          name: 'dueDate',
          type: 'string',
          description: 'Updated due date in ISO 8601 format',
          required: false
        },
        {
          name: 'priority',
          type: 'string',
          description: 'Updated priority level',
          required: false,
          enum: ['low', 'medium', 'high', 'urgent']
        },
        {
          name: 'tags',
          type: 'array',
          description: 'Updated array of tags',
          required: false,
          items: {
            type: 'string'
          }
        }
      ],
      returns: {
        type: 'object',
        description: 'The updated card object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the card' },
          title: { type: 'string', description: 'Title of the card' },
          description: { type: 'string', description: 'Description of the card' },
          status: { type: 'string', description: 'Current status' },
          assigneeId: { type: 'string', description: 'Assigned user ID' },
          dueDate: { type: 'string', description: 'Due date' },
          priority: { type: 'string', description: 'Priority level' },
          tags: { type: 'array', description: 'Associated tags' },
          createdAt: { type: 'string', description: 'Creation timestamp' },
          updatedAt: { type: 'string', description: 'Last update timestamp' }
        }
      },
      examples: [
        {
          input: {
            cardId: '507f1f77bcf86cd799439011',
            status: 'done',
            priority: 'medium'
          },
          output: {
            id: '507f1f77bcf86cd799439011',
            title: 'Implement user authentication',
            description: 'Add JWT-based authentication to the API',
            status: 'done',
            priority: 'medium',
            tags: ['backend', 'security'],
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T15:45:00Z'
          }
        }
      ]
    };
  }

  private static deleteCardTool(): Tool {
    return {
      name: 'deleteCard',
      description: 'Delete a card permanently from the system',
      category: 'card_management',
      parameters: [
        {
          name: 'cardId',
          type: 'string',
          description: 'The unique identifier of the card to delete',
          required: true
        },
        {
          name: 'force',
          type: 'boolean',
          description: 'Force deletion even if card has dependencies',
          required: false,
          default: false
        }
      ],
      returns: {
        type: 'object',
        description: 'Deletion confirmation response',
        properties: {
          success: { type: 'boolean', description: 'Whether deletion was successful' },
          cardId: { type: 'string', description: 'ID of the deleted card' },
          deletedAt: { type: 'string', description: 'Timestamp of deletion' },
          message: { type: 'string', description: 'Confirmation message' }
        }
      },
      examples: [
        {
          input: {
            cardId: '507f1f77bcf86cd799439011'
          },
          output: {
            success: true,
            cardId: '507f1f77bcf86cd799439011',
            deletedAt: '2024-01-15T16:00:00Z',
            message: 'Card successfully deleted'
          }
        }
      ]
    };
  }
}
