import { ToolRegistry } from './ToolRegistry.js';
import { log } from '../worker.js';

export function registerDefaultTools(): void {
  const registry = ToolRegistry.getInstance();

  registry.register({
    name: 'create_card',
    description: 'Creates a new card in the system with specified properties',
    parameters: {
      properties: {
        title: {
          type: 'string',
          description: 'The title of the card',
          required: true,
        },
        description: {
          type: 'string',
          description: 'Detailed description of the card',
        },
        laneId: {
          type: 'string',
          description: 'ID of the lane where the card should be created',
          required: true,
        },
        assignedTo: {
          type: 'string',
          description: 'User ID of the person assigned to this card',
        },
        priority: {
          type: 'string',
          description: 'Priority level of the card',
          enum: ['low', 'medium', 'high', 'urgent'],
        },
      },
      required: ['title', 'laneId'],
    },
    returns: {
      type: 'object',
      description: 'The created card object with generated ID',
    },
  });

  registry.register({
    name: 'list_cards',
    description: 'Retrieves a list of cards with optional filtering',
    parameters: {
      properties: {
        laneId: {
          type: 'string',
          description: 'Filter cards by lane ID',
        },
        assignedTo: {
          type: 'string',
          description: 'Filter cards by assigned user ID',
        },
        status: {
          type: 'string',
          description: 'Filter cards by status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of cards to return',
        },
      },
      required: [],
    },
    returns: {
      type: 'array',
      description: 'Array of card objects matching the filter criteria',
    },
  });

  registry.register({
    name: 'update_card',
    description: 'Updates an existing card with new properties',
    parameters: {
      properties: {
        id: {
          type: 'string',
          description: 'ID of the card to update',
          required: true,
        },
        title: {
          type: 'string',
          description: 'New title for the card',
        },
        description: {
          type: 'string',
          description: 'New description for the card',
        },
        laneId: {
          type: 'string',
          description: 'Move card to a different lane',
        },
        assignedTo: {
          type: 'string',
          description: 'Reassign card to a different user',
        },
      },
      required: ['id'],
    },
    returns: {
      type: 'object',
      description: 'The updated card object',
    },
  });

  registry.register({
    name: 'create_account',
    description: 'Creates a new account in the system',
    parameters: {
      properties: {
        name: {
          type: 'string',
          description: 'Name of the account',
          required: true,
        },
        email: {
          type: 'string',
          description: 'Email address for the account',
        },
        phone: {
          type: 'string',
          description: 'Phone number for the account',
        },
        type: {
          type: 'string',
          description: 'Type of account',
          enum: ['customer', 'partner', 'vendor'],
        },
      },
      required: ['name'],
    },
    returns: {
      type: 'object',
      description: 'The created account object with generated ID',
    },
  });

  registry.register({
    name: 'list_accounts',
    description: 'Retrieves a list of accounts with optional filtering',
    parameters: {
      properties: {
        type: {
          type: 'string',
          description: 'Filter accounts by type',
        },
        search: {
          type: 'string',
          description: 'Search accounts by name or email',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of accounts to return',
        },
      },
      required: [],
    },
    returns: {
      type: 'array',
      description: 'Array of account objects matching the filter criteria',
    },
  });

  registry.register({
    name: 'create_lane',
    description: 'Creates a new lane in the board',
    parameters: {
      properties: {
        name: {
          type: 'string',
          description: 'Name of the lane',
          required: true,
        },
        order: {
          type: 'number',
          description: 'Display order of the lane',
        },
        wipLimit: {
          type: 'number',
          description: 'Work-in-progress limit for the lane',
        },
      },
      required: ['name'],
    },
    returns: {
      type: 'object',
      description: 'The created lane object with generated ID',
    },
  });

  registry.register({
    name: 'list_lanes',
    description: 'Retrieves all lanes in the board',
    parameters: {
      properties: {},
      required: [],
    },
    returns: {
      type: 'array',
      description: 'Array of all lane objects',
    },
  });

  registry.register({
    name: 'get_lane_statistics',
    description: 'Retrieves statistics for lanes including card counts and metrics',
    parameters: {
      properties: {
        laneId: {
          type: 'string',
          description: 'ID of specific lane to get statistics for',
        },
      },
      required: [],
    },
    returns: {
      type: 'object',
      description: 'Statistics object containing lane metrics',
    },
  });

  registry.register({
    name: 'create_user',
    description: 'Creates a new user in the system',
    parameters: {
      properties: {
        email: {
          type: 'string',
          description: 'Email address of the user',
          required: true,
        },
        name: {
          type: 'string',
          description: 'Full name of the user',
          required: true,
        },
        role: {
          type: 'string',
          description: 'Role of the user',
          enum: ['admin', 'member', 'viewer'],
        },
      },
      required: ['email', 'name'],
    },
    returns: {
      type: 'object',
      description: 'The created user object with generated ID',
    },
  });

  registry.register({
    name: 'list_users',
    description: 'Retrieves a list of users in the system',
    parameters: {
      properties: {
        role: {
          type: 'string',
          description: 'Filter users by role',
        },
        search: {
          type: 'string',
          description: 'Search users by name or email',
        },
      },
      required: [],
    },
    returns: {
      type: 'array',
      description: 'Array of user objects matching the filter criteria',
    },
  });

  registry.register({
    name: 'get_forecast',
    description: 'Retrieves forecast data for cards and lanes',
    parameters: {
      properties: {
        type: {
          type: 'string',
          description: 'Type of forecast to retrieve',
          enum: ['achieved', 'predicted', 'time-series'],
          required: true,
        },
        startDate: {
          type: 'string',
          description: 'Start date for forecast period (ISO 8601 format)',
        },
        endDate: {
          type: 'string',
          description: 'End date for forecast period (ISO 8601 format)',
        },
      },
      required: ['type'],
    },
    returns: {
      type: 'object',
      description: 'Forecast data object with predictions and metrics',
    },
  });

  registry.register({
    name: 'list_activities',
    description: 'Retrieves activity log entries from the system',
    parameters: {
      properties: {
        entityType: {
          type: 'string',
          description: 'Filter activities by entity type',
          enum: ['card', 'account', 'lane', 'user'],
        },
        entityId: {
          type: 'string',
          description: 'Filter activities by specific entity ID',
        },
        userId: {
          type: 'string',
          description: 'Filter activities by user who performed the action',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of activities to return',
        },
      },
      required: [],
    },
    returns: {
      type: 'array',
      description: 'Array of activity log entries',
    },
  });

  log.info(`Registered ${registry.getToolCount()} default tools`);
}
