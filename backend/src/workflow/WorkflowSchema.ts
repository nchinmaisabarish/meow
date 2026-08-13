export interface WorkflowTransition {
  from: string;
  to: string;
  event: string;
  condition?: string;
  actions?: string[];
}

export interface WorkflowState {
  id: string;
  name: string;
  type: 'initial' | 'intermediate' | 'final';
  metadata?: Record<string, any>;
  onEntry?: string[];
  onExit?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  initialState: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export const WorkflowSchemaValidator = {
  validateWorkflowDefinition(workflow: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workflow) {
      errors.push('Workflow definition is required');
      return { valid: false, errors };
    }

    if (!workflow.id || typeof workflow.id !== 'string') {
      errors.push('Workflow id is required and must be a string');
    }

    if (!workflow.name || typeof workflow.name !== 'string') {
      errors.push('Workflow name is required and must be a string');
    }

    if (!workflow.version || typeof workflow.version !== 'string') {
      errors.push('Workflow version is required and must be a string');
    }

    if (!Array.isArray(workflow.states) || workflow.states.length === 0) {
      errors.push('Workflow must have at least one state');
    } else {
      const stateIds = new Set<string>();
      let hasInitialState = false;

      workflow.states.forEach((state: any, index: number) => {
        if (!state.id || typeof state.id !== 'string') {
          errors.push(`State at index ${index} must have a valid id`);
        } else {
          if (stateIds.has(state.id)) {
            errors.push(`Duplicate state id: ${state.id}`);
          }
          stateIds.add(state.id);
        }

        if (!state.name || typeof state.name !== 'string') {
          errors.push(`State at index ${index} must have a valid name`);
        }

        if (!['initial', 'intermediate', 'final'].includes(state.type)) {
          errors.push(`State at index ${index} must have type: initial, intermediate, or final`);
        }

        if (state.type === 'initial') {
          hasInitialState = true;
        }

        if (state.onEntry && !Array.isArray(state.onEntry)) {
          errors.push(`State ${state.id} onEntry must be an array`);
        }

        if (state.onExit && !Array.isArray(state.onExit)) {
          errors.push(`State ${state.id} onExit must be an array`);
        }
      });

      if (!hasInitialState) {
        errors.push('Workflow must have at least one initial state');
      }
    }

    if (!workflow.initialState || typeof workflow.initialState !== 'string') {
      errors.push('Workflow must specify an initialState');
    } else if (workflow.states) {
      const initialStateExists = workflow.states.some(
        (state: any) => state.id === workflow.initialState
      );
      if (!initialStateExists) {
        errors.push(`Initial state ${workflow.initialState} not found in states`);
      }
    }

    if (!Array.isArray(workflow.transitions)) {
      errors.push('Workflow transitions must be an array');
    } else {
      const stateIds = new Set(workflow.states?.map((s: any) => s.id) || []);

      workflow.transitions.forEach((transition: any, index: number) => {
        if (!transition.from || typeof transition.from !== 'string') {
          errors.push(`Transition at index ${index} must have a valid from state`);
        } else if (!stateIds.has(transition.from)) {
          errors.push(`Transition at index ${index} references unknown from state: ${transition.from}`);
        }

        if (!transition.to || typeof transition.to !== 'string') {
          errors.push(`Transition at index ${index} must have a valid to state`);
        } else if (!stateIds.has(transition.to)) {
          errors.push(`Transition at index ${index} references unknown to state: ${transition.to}`);
        }

        if (!transition.event || typeof transition.event !== 'string') {
          errors.push(`Transition at index ${index} must have a valid event`);
        }

        if (transition.condition && typeof transition.condition !== 'string') {
          errors.push(`Transition at index ${index} condition must be a string`);
        }

        if (transition.actions && !Array.isArray(transition.actions)) {
          errors.push(`Transition at index ${index} actions must be an array`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  validateState(state: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!state) {
      errors.push('State is required');
      return { valid: false, errors };
    }

    if (!state.id || typeof state.id !== 'string') {
      errors.push('State id is required and must be a string');
    }

    if (!state.name || typeof state.name !== 'string') {
      errors.push('State name is required and must be a string');
    }

    if (!['initial', 'intermediate', 'final'].includes(state.type)) {
      errors.push('State type must be: initial, intermediate, or final');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  validateTransition(transition: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!transition) {
      errors.push('Transition is required');
      return { valid: false, errors };
    }

    if (!transition.from || typeof transition.from !== 'string') {
      errors.push('Transition from is required and must be a string');
    }

    if (!transition.to || typeof transition.to !== 'string') {
      errors.push('Transition to is required and must be a string');
    }

    if (!transition.event || typeof transition.event !== 'string') {
      errors.push('Transition event is required and must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

export const WorkflowJSONSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'name', 'version', 'states', 'transitions', 'initialState'],
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the workflow',
    },
    name: {
      type: 'string',
      description: 'Human-readable name of the workflow',
    },
    version: {
      type: 'string',
      description: 'Version of the workflow definition',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
    },
    description: {
      type: 'string',
      description: 'Optional description of the workflow',
    },
    states: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'type'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the state',
          },
          name: {
            type: 'string',
            description: 'Human-readable name of the state',
          },
          type: {
            type: 'string',
            enum: ['initial', 'intermediate', 'final'],
            description: 'Type of state',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata for the state',
          },
          onEntry: {
            type: 'array',
            items: { type: 'string' },
            description: 'Actions to execute when entering the state',
          },
          onExit: {
            type: 'array',
            items: { type: 'string' },
            description: 'Actions to execute when exiting the state',
          },
        },
      },
    },
    transitions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'event'],
        properties: {
          from: {
            type: 'string',
            description: 'Source state id',
          },
          to: {
            type: 'string',
            description: 'Target state id',
          },
          event: {
            type: 'string',
            description: 'Event that triggers the transition',
          },
          condition: {
            type: 'string',
            description: 'Optional condition for the transition',
          },
          actions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Actions to execute during the transition',
          },
        },
      },
    },
    initialState: {
      type: 'string',
      description: 'Id of the initial state',
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the workflow',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when the workflow was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when the workflow was last updated',
    },
  },
};
