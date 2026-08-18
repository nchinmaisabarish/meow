export interface IntentMapping {
  intent: string;
  controller: string;
  method: string;
  requiredParams: string[];
  description?: string;
}

export const intentMappings: IntentMapping[] = [
  {
    intent: 'get_user_details',
    controller: 'UserController',
    method: 'list',
    requiredParams: [],
    description: 'Retrieve user details or list of users'
  },
  {
    intent: 'create_user',
    controller: 'UserController',
    method: 'create',
    requiredParams: ['email', 'name'],
    description: 'Create a new user account'
  },
  {
    intent: 'update_user',
    controller: 'UserController',
    method: 'update',
    requiredParams: ['id'],
    description: 'Update existing user information'
  },
  {
    intent: 'get_account_details',
    controller: 'AccountController',
    method: 'fetch',
    requiredParams: ['id'],
    description: 'Retrieve specific account details'
  },
  {
    intent: 'list_accounts',
    controller: 'AccountController',
    method: 'list',
    requiredParams: [],
    description: 'List all accounts'
  },
  {
    intent: 'create_account',
    controller: 'AccountController',
    method: 'create',
    requiredParams: ['name'],
    description: 'Create a new account'
  },
  {
    intent: 'update_account',
    controller: 'AccountController',
    method: 'update',
    requiredParams: ['id'],
    description: 'Update account information'
  },
  {
    intent: 'get_card_details',
    controller: 'CardController',
    method: 'get',
    requiredParams: ['id'],
    description: 'Retrieve specific card details'
  },
  {
    intent: 'list_cards',
    controller: 'CardController',
    method: 'list',
    requiredParams: [],
    description: 'List all cards'
  },
  {
    intent: 'create_card',
    controller: 'CardController',
    method: 'create',
    requiredParams: ['title', 'laneId'],
    description: 'Create a new card'
  },
  {
    intent: 'update_card',
    controller: 'CardController',
    method: 'update',
    requiredParams: ['id'],
    description: 'Update card information'
  },
  {
    intent: 'list_lanes',
    controller: 'LaneController',
    method: 'list',
    requiredParams: [],
    description: 'List all lanes'
  },
  {
    intent: 'update_lane',
    controller: 'LaneController',
    method: 'update',
    requiredParams: ['id'],
    description: 'Update lane information'
  },
  {
    intent: 'update_all_lanes',
    controller: 'LaneController',
    method: 'updateAll',
    requiredParams: ['lanes'],
    description: 'Update multiple lanes at once'
  },
  {
    intent: 'get_lane_statistics',
    controller: 'LaneStatisticsController',
    method: 'get',
    requiredParams: [],
    description: 'Retrieve lane statistics'
  }
];
