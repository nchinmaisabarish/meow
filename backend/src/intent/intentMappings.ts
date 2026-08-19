import { AccountController } from '../controllers/AccountController.js';
import { CardController } from '../controllers/CardController.js';
import { UserController } from '../controllers/UserController.js';
import { LaneController } from '../controllers/LaneController.js';
import { TeamController } from '../controllers/TeamController.js';
import { ForecastController } from '../controllers/ForecastController.js';
import { SchemaController } from '../controllers/SchemaController.js';
import { ActivityController } from '../controllers/ActivityController.js';
import { LaneStatisticsController } from '../controllers/LaneStatisticsController.js';
import { CardEventController } from '../controllers/CardEventController.js';
import { AccountEventController } from '../controllers/AccountEventController.js';

export interface IntentMapping {
  intent: string;
  patterns: string[];
  controller: any;
  method: string;
  description: string;
  requiresAuth: boolean;
  httpMethod: 'GET' | 'POST' | 'DELETE';
}

export const intentMappings: IntentMapping[] = [
  {
    intent: 'retrieve_accounts',
    patterns: [
      'get all accounts',
      'list accounts',
      'show accounts',
      'fetch accounts',
      'retrieve accounts',
      'display all accounts'
    ],
    controller: AccountController,
    method: 'list',
    description: 'Retrieve all accounts',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'create_account',
    patterns: [
      'create account',
      'add account',
      'new account',
      'create new account',
      'add new account',
      'register account'
    ],
    controller: AccountController,
    method: 'create',
    description: 'Create a new account',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_account_details',
    patterns: [
      'get account',
      'show account',
      'fetch account',
      'retrieve account',
      'account details',
      'view account'
    ],
    controller: AccountController,
    method: 'fetch',
    description: 'Get details of a specific account',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'update_account',
    patterns: [
      'update account',
      'modify account',
      'edit account',
      'change account',
      'update account details'
    ],
    controller: AccountController,
    method: 'update',
    description: 'Update an existing account',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_account_events',
    patterns: [
      'get account events',
      'list account events',
      'show account events',
      'account event history',
      'account activity'
    ],
    controller: AccountEventController,
    method: 'list',
    description: 'Get events for a specific account',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'create_account_event',
    patterns: [
      'create account event',
      'add account event',
      'log account event',
      'record account event'
    ],
    controller: AccountEventController,
    method: 'create',
    description: 'Create an event for an account',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'retrieve_cards',
    patterns: [
      'get all cards',
      'list cards',
      'show cards',
      'fetch cards',
      'retrieve cards',
      'display all cards'
    ],
    controller: CardController,
    method: 'list',
    description: 'Retrieve all cards',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'create_card',
    patterns: [
      'create card',
      'add card',
      'new card',
      'create new card',
      'add new card',
      'make card'
    ],
    controller: CardController,
    method: 'create',
    description: 'Create a new card',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_card_details',
    patterns: [
      'get card',
      'show card',
      'fetch card',
      'retrieve card',
      'card details',
      'view card'
    ],
    controller: CardController,
    method: 'get',
    description: 'Get details of a specific card',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'update_card',
    patterns: [
      'update card',
      'modify card',
      'edit card',
      'change card',
      'update card details'
    ],
    controller: CardController,
    method: 'update',
    description: 'Update an existing card',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_card_events',
    patterns: [
      'get card events',
      'list card events',
      'show card events',
      'card event history',
      'card activity'
    ],
    controller: CardEventController,
    method: 'list',
    description: 'Get events for a specific card',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'create_card_event',
    patterns: [
      'create card event',
      'add card event',
      'log card event',
      'record card event'
    ],
    controller: CardEventController,
    method: 'create',
    description: 'Create an event for a card',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'retrieve_users',
    patterns: [
      'get all users',
      'list users',
      'show users',
      'fetch users',
      'retrieve users',
      'display all users'
    ],
    controller: UserController,
    method: 'list',
    description: 'Retrieve all users',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'create_user',
    patterns: [
      'create user',
      'add user',
      'new user',
      'create new user',
      'add new user',
      'register user'
    ],
    controller: UserController,
    method: 'create',
    description: 'Create a new user',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'update_user',
    patterns: [
      'update user',
      'modify user',
      'edit user',
      'change user',
      'update user details'
    ],
    controller: UserController,
    method: 'update',
    description: 'Update an existing user',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_user_flags',
    patterns: [
      'get user flags',
      'show user flags',
      'user flags',
      'fetch user flags'
    ],
    controller: UserController,
    method: 'flags',
    description: 'Get flags for a specific user',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'update_user_password',
    patterns: [
      'update password',
      'change password',
      'modify password',
      'reset password',
      'set password'
    ],
    controller: UserController,
    method: 'password',
    description: 'Update user password',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'update_user_board',
    patterns: [
      'update board',
      'change board',
      'modify board',
      'set board',
      'update user board'
    ],
    controller: UserController,
    method: 'board',
    description: 'Update user board settings',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'retrieve_lanes',
    patterns: [
      'get all lanes',
      'list lanes',
      'show lanes',
      'fetch lanes',
      'retrieve lanes',
      'display all lanes'
    ],
    controller: LaneController,
    method: 'list',
    description: 'Retrieve all lanes',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'update_lane',
    patterns: [
      'update lane',
      'modify lane',
      'edit lane',
      'change lane',
      'update lane details'
    ],
    controller: LaneController,
    method: 'update',
    description: 'Update an existing lane',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'update_all_lanes',
    patterns: [
      'update all lanes',
      'modify all lanes',
      'bulk update lanes',
      'update lanes',
      'change all lanes'
    ],
    controller: LaneController,
    method: 'updateAll',
    description: 'Update multiple lanes',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_lane_statistics',
    patterns: [
      'get lane statistics',
      'show lane stats',
      'lane statistics',
      'lane stats',
      'fetch lane statistics'
    ],
    controller: LaneStatisticsController,
    method: 'get',
    description: 'Get statistics for lanes',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'get_team_details',
    patterns: [
      'get team',
      'show team',
      'fetch team',
      'retrieve team',
      'team details',
      'view team'
    ],
    controller: TeamController,
    method: 'get',
    description: 'Get details of a specific team',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'update_team',
    patterns: [
      'update team',
      'modify team',
      'edit team',
      'change team',
      'update team details'
    ],
    controller: TeamController,
    method: 'update',
    description: 'Update an existing team',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'update_team_integration',
    patterns: [
      'update team integration',
      'modify team integration',
      'change team integration',
      'set team integration'
    ],
    controller: TeamController,
    method: 'updateIntegration',
    description: 'Update team integration settings',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'allow_team_registration',
    patterns: [
      'allow team registration',
      'enable team registration',
      'permit team registration',
      'toggle team registration'
    ],
    controller: TeamController,
    method: 'allowTeamRegistration',
    description: 'Allow or disallow team registration',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'get_forecast_achieved',
    patterns: [
      'get achieved forecast',
      'show achieved forecast',
      'achieved forecast',
      'forecast achieved'
    ],
    controller: ForecastController,
    method: 'achieved',
    description: 'Get achieved forecast data',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'get_forecast_predicted',
    patterns: [
      'get predicted forecast',
      'show predicted forecast',
      'predicted forecast',
      'forecast predicted'
    ],
    controller: ForecastController,
    method: 'predicted',
    description: 'Get predicted forecast data',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'get_forecast_list',
    patterns: [
      'get forecast list',
      'list forecasts',
      'show forecasts',
      'forecast list'
    ],
    controller: ForecastController,
    method: 'list',
    description: 'Get list of forecasts',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'get_forecast_time_series',
    patterns: [
      'get forecast time series',
      'show forecast time series',
      'forecast time series',
      'time series forecast'
    ],
    controller: ForecastController,
    method: 'series',
    description: 'Get forecast time series data',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'get_forecast_generated',
    patterns: [
      'get generated forecast',
      'show generated forecast',
      'generated forecast',
      'forecast generated'
    ],
    controller: ForecastController,
    method: 'generated',
    description: 'Get generated forecast data',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'retrieve_schemas',
    patterns: [
      'get all schemas',
      'list schemas',
      'show schemas',
      'fetch schemas',
      'retrieve schemas'
    ],
    controller: SchemaController,
    method: 'list',
    description: 'Retrieve all schemas',
    requiresAuth: true,
    httpMethod: 'GET'
  },
  {
    intent: 'create_schema',
    patterns: [
      'create schema',
      'add schema',
      'new schema',
      'create new schema',
      'add new schema'
    ],
    controller: SchemaController,
    method: 'create',
    description: 'Create a new schema',
    requiresAuth: true,
    httpMethod: 'POST'
  },
  {
    intent: 'retrieve_activities',
    patterns: [
      'get all activities',
      'list activities',
      'show activities',
      'fetch activities',
      'retrieve activities',
      'display all activities'
    ],
    controller: ActivityController,
    method: 'list',
    description: 'Retrieve all activities',
    requiresAuth: true,
    httpMethod: 'GET'
  }
];

export function validateIntentMappings(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  intentMappings.forEach((mapping, index) => {
    if (!mapping.intent || typeof mapping.intent !== 'string') {
      errors.push(`Mapping at index ${index}: intent is required and must be a string`);
    }

    if (!Array.isArray(mapping.patterns) || mapping.patterns.length === 0) {
      errors.push(`Mapping at index ${index}: patterns must be a non-empty array`);
    }

    if (!mapping.controller) {
      errors.push(`Mapping at index ${index}: controller is required`);
    }

    if (!mapping.method || typeof mapping.method !== 'string') {
      errors.push(`Mapping at index ${index}: method is required and must be a string`);
    }

    if (mapping.controller && mapping.method) {
      if (typeof mapping.controller[mapping.method] !== 'function') {
        errors.push(
          `Mapping at index ${index}: controller method '${mapping.method}' does not exist or is not a function`
        );
      }
    }

    if (!mapping.description || typeof mapping.description !== 'string') {
      errors.push(`Mapping at index ${index}: description is required and must be a string`);
    }

    if (typeof mapping.requiresAuth !== 'boolean') {
      errors.push(`Mapping at index ${index}: requiresAuth must be a boolean`);
    }

    if (!['GET', 'POST', 'DELETE'].includes(mapping.httpMethod)) {
      errors.push(
        `Mapping at index ${index}: httpMethod must be one of GET, POST, or DELETE`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getIntentByPattern(pattern: string): IntentMapping | undefined {
  const normalizedPattern = pattern.toLowerCase().trim();

  return intentMappings.find((mapping) =>
    mapping.patterns.some(
      (p) => p.toLowerCase() === normalizedPattern || normalizedPattern.includes(p.toLowerCase())
    )
  );
}

export function getIntentByName(intentName: string): IntentMapping | undefined {
  return intentMappings.find((mapping) => mapping.intent === intentName);
}

export function getAllIntents(): string[] {
  return intentMappings.map((mapping) => mapping.intent);
}
