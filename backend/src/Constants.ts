import { LaneType } from './entities/Lane.js';
import { SchemaAttribute, SchemaType } from './entities/Schema.js';

export const SERVICE_NAME = 'meow-backend-service';
export const MAXIMUM_LENGTH_OF_USER_NAME = 80;
export const MINIMUM_LENGTH_OF_USER_NAME = 3;
export const MAXIMUM_LENGTH_OF_USER_PASSWORD = 40;
export const MINIMUM_LENGTH_OF_USER_PASSWORD = 3;
export const IS_ISO_8601_REGEXP =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
export const IS_ISO_8601_DATE_REGEXP = /^\d{4}-\d{2}-\d{2}$/;
export const FILTER_BY_NONE = { name: 'Everyone', key: 'all' };

export const DefaultLanes = [
  { name: 'Not Qualified', inForecast: true, tags: { type: LaneType.Normal } },
  { name: 'Qualified', inForecast: true, tags: { type: LaneType.Normal } },
  { name: 'Comitted', inForecast: true, tags: { type: LaneType.Normal } },
  {
    name: 'Closed Won',
    color: '#00b359',
    inForecast: false,
    tags: { type: LaneType.ClosedWon },
  },
  {
    name: 'Closed Lost',
    color: '#e30544',
    inForecast: false,
    tags: { type: LaneType.ClosedLost },
  },
];

export const DefaultCards = [
  { name: 'Paw Prints Photography', amount: 32000 },
  { name: 'Squirrelly Sweets', amount: 80000 },
  { name: 'Monkey Business Consulting', amount: 28000 },
  { name: 'Snail Mail Emporium', amount: 20000 },
  { name: 'Horsepower Landscaping', amount: 64000 },
];

export const DefaultCardSchema = {
  type: SchemaType.Card,
  schema: [
    {
      key: '6cdd2d99-c0c9-1f20-60eb-5ba24d548348',
      index: 0,
      type: 'text',
      name: 'Contact',
    },
    {
      key: 'c1cc9338-4d4c-f494-cbee-16f4faa9528c',
      index: 1,
      type: 'textarea',
      name: 'Notes',
    },
    {
      key: '1a3231bb-73e4-7e97-8d77-1304dd674c54',
      index: 2,
      type: 'reference',
      name: 'Account',
      entity: 'account',
      reverseName: 'Opportunities',
      relationship: 'many-to-one',
    },
  ],
} as {
  type: SchemaType;
  schema: SchemaAttribute[];
};

export const DefaultAccountSchema = {
  type: SchemaType.Account,
  schema: [
    {
      key: '6cdd2d99-c0c9-1f20-60eb-5ba24d548346',
      index: 0,
      type: 'text',
      name: 'City',
    },
    {
      key: 'c1cc9138-4d4c-f494-cbee-16f4faa95284',
      index: 1,
      type: 'textarea',
      name: 'Address',
    },
    {
      key: 'c12c9338-4d4c-f494-cbee-16f4faa91284',
      index: 2,
      type: 'text',
      name: 'Phone',
    },
  ],
} as {
  type: SchemaType;
  schema: SchemaAttribute[];
};

export const DefaultAccounts = [{ name: 'Unicorn Corporate' }];

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const ANIMALS: string[] = [
  'Squirrel',
  'Bear',
  'Raccoon',
  'Lion',
  'Penguin',
  'Walrus',
  'Monkey',
  'Tiger',
  'Elephant',
  'Giraffe',
  'Kangaroo',
  'Dolphin',
  'Shark',
  'Octopus',
  'Gorilla',
  'Leopard',
  'Wolf',
  'Zebra',
];

export const RESERVED_ATTRIBUTES = [
  'id',
  'createdat',
  'updatedat',
  'attribute',
  'teamid',
  'accountid',
  'attributes',
];

export const RESERVED_USERS = ['id', 'all'];

export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  conditions?: Record<string, any>;
  nextSteps?: string[];
  errorHandler?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  initialStep: string;
  metadata?: Record<string, any>;
}

export const WORKFLOWS: Record<string, WorkflowDefinition> = {
  card_creation_workflow: {
    id: 'card_creation_workflow',
    name: 'Card Creation Workflow',
    description: 'Workflow for creating and initializing new cards',
    version: '1.0.0',
    initialStep: 'validate_input',
    steps: [
      {
        id: 'validate_input',
        name: 'Validate Input',
        action: 'validate_card_data',
        nextSteps: ['create_card'],
        errorHandler: 'handle_validation_error',
      },
      {
        id: 'create_card',
        name: 'Create Card',
        action: 'create_card_entity',
        nextSteps: ['assign_to_lane'],
        errorHandler: 'handle_creation_error',
      },
      {
        id: 'assign_to_lane',
        name: 'Assign to Lane',
        action: 'assign_card_to_default_lane',
        nextSteps: ['notify_team'],
        errorHandler: 'handle_assignment_error',
      },
      {
        id: 'notify_team',
        name: 'Notify Team',
        action: 'send_team_notification',
        nextSteps: ['complete'],
        errorHandler: 'log_notification_error',
      },
      {
        id: 'complete',
        name: 'Complete',
        action: 'finalize_workflow',
        nextSteps: [],
      },
    ],
    metadata: {
      category: 'card_management',
      priority: 'high',
    },
  },
  account_setup_workflow: {
    id: 'account_setup_workflow',
    name: 'Account Setup Workflow',
    description: 'Workflow for setting up new accounts',
    version: '1.0.0',
    initialStep: 'validate_account',
    steps: [
      {
        id: 'validate_account',
        name: 'Validate Account',
        action: 'validate_account_data',
        nextSteps: ['create_account'],
        errorHandler: 'handle_validation_error',
      },
      {
        id: 'create_account',
        name: 'Create Account',
        action: 'create_account_entity',
        nextSteps: ['apply_schema'],
        errorHandler: 'handle_creation_error',
      },
      {
        id: 'apply_schema',
        name: 'Apply Schema',
        action: 'apply_default_account_schema',
        nextSteps: ['initialize_attributes'],
        errorHandler: 'handle_schema_error',
      },
      {
        id: 'initialize_attributes',
        name: 'Initialize Attributes',
        action: 'set_default_attributes',
        nextSteps: ['complete'],
        errorHandler: 'handle_attribute_error',
      },
      {
        id: 'complete',
        name: 'Complete',
        action: 'finalize_workflow',
        nextSteps: [],
      },
    ],
    metadata: {
      category: 'account_management',
      priority: 'medium',
    },
  },
  lane_transition_workflow: {
    id: 'lane_transition_workflow',
    name: 'Lane Transition Workflow',
    description: 'Workflow for moving cards between lanes',
    version: '1.0.0',
    initialStep: 'validate_transition',
    steps: [
      {
        id: 'validate_transition',
        name: 'Validate Transition',
        action: 'validate_lane_transition',
        conditions: {
          allowedTransitions: true,
        },
        nextSteps: ['update_card_lane'],
        errorHandler: 'handle_validation_error',
      },
      {
        id: 'update_card_lane',
        name: 'Update Card Lane',
        action: 'move_card_to_lane',
        nextSteps: ['check_forecast'],
        errorHandler: 'handle_update_error',
      },
      {
        id: 'check_forecast',
        name: 'Check Forecast',
        action: 'update_forecast_status',
        nextSteps: ['log_transition'],
        errorHandler: 'handle_forecast_error',
      },
      {
        id: 'log_transition',
        name: 'Log Transition',
        action: 'record_transition_history',
        nextSteps: ['complete'],
        errorHandler: 'log_error',
      },
      {
        id: 'complete',
        name: 'Complete',
        action: 'finalize_workflow',
        nextSteps: [],
      },
    ],
    metadata: {
      category: 'card_management',
      priority: 'high',
    },
  },
};

export function validateWorkflowDefinition(
  workflow: WorkflowDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!workflow.id || typeof workflow.id !== 'string') {
    errors.push('Workflow must have a valid id');
  }

  if (!workflow.name || typeof workflow.name !== 'string') {
    errors.push('Workflow must have a valid name');
  }

  if (!workflow.version || typeof workflow.version !== 'string') {
    errors.push('Workflow must have a valid version');
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    errors.push('Workflow must have at least one step');
  }

  if (!workflow.initialStep || typeof workflow.initialStep !== 'string') {
    errors.push('Workflow must have a valid initialStep');
  }

  const stepIds = new Set<string>();
  const referencedSteps = new Set<string>();

  workflow.steps.forEach((step, index) => {
    if (!step.id || typeof step.id !== 'string') {
      errors.push(`Step at index ${index} must have a valid id`);
    } else {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    if (!step.name || typeof step.name !== 'string') {
      errors.push(`Step ${step.id || index} must have a valid name`);
    }

    if (!step.action || typeof step.action !== 'string') {
      errors.push(`Step ${step.id || index} must have a valid action`);
    }

    if (step.nextSteps) {
      if (!Array.isArray(step.nextSteps)) {
        errors.push(`Step ${step.id || index} nextSteps must be an array`);
      } else {
        step.nextSteps.forEach((nextStep) => {
          referencedSteps.add(nextStep);
        });
      }
    }

    if (step.errorHandler && typeof step.errorHandler !== 'string') {
      errors.push(`Step ${step.id || index} errorHandler must be a string`);
    }
  });

  if (!stepIds.has(workflow.initialStep)) {
    errors.push(
      `Initial step '${workflow.initialStep}' does not exist in workflow steps`
    );
  }

  referencedSteps.forEach((refStep) => {
    if (!stepIds.has(refStep)) {
      errors.push(`Referenced step '${refStep}' does not exist in workflow`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
