import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ObjectId } from 'mongodb';
import { Card, CardStatus, NewCard } from '../entities/Card.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { Attribute } from '../entities/Attribute.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';

/**
 * CardWorkflowState defines the state structure for the card lifecycle workflow.
 * This state is passed through each node in the workflow graph.
 */
export interface CardWorkflowState {
  // Input data
  user: User;
  lane: Lane;
  name: string;
  amount: number;
  attributes?: Attribute;
  closedAt?: Date;
  nextFollowUpAt?: Date;

  // Workflow state
  validationStatus: 'pending' | 'valid' | 'invalid';
  validationErrors: string[];
  currentPhase: 'create' | 'validate' | 'assign_lane' | 'notify' | 'complete';
  nextActions: string[];

  // Output data
  card?: Card;
  newCard?: NewCard;
  error?: string;
}

/**
 * Define the state annotation for LangGraph.
 * Each field uses Annotation() which creates a reducer that replaces the previous value.
 */
const CardWorkflowAnnotation = Annotation.Root({
  user: Annotation<User>(),
  lane: Annotation<Lane>(),
  name: Annotation<string>(),
  amount: Annotation<number>(),
  attributes: Annotation<Attribute | undefined>(),
  closedAt: Annotation<Date | undefined>(),
  nextFollowUpAt: Annotation<Date | undefined>(),
  validationStatus: Annotation<'pending' | 'valid' | 'invalid'>(),
  validationErrors: Annotation<string[]>(),
  currentPhase: Annotation<'create' | 'validate' | 'assign_lane' | 'notify' | 'complete'>(),
  nextActions: Annotation<string[]>(),
  card: Annotation<Card | undefined>(),
  newCard: Annotation<NewCard | undefined>(),
  error: Annotation<string | undefined>(),
});

/**
 * Create node: Initialize the NewCard entity
 */
async function createNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  try {
    const newCard = new NewCard(state.user, state.lane, state.name, state.amount);

    if (state.attributes) {
      newCard.attributes = state.attributes;
    }

    if (state.closedAt) {
      newCard.closedAt = state.closedAt;
    }

    if (state.nextFollowUpAt) {
      newCard.nextFollowUpAt = state.nextFollowUpAt;
    }

    return {
      newCard,
      currentPhase: 'validate',
      nextActions: ['validate_card_data'],
    };
  } catch (error: unknown) {
    return {
      validationStatus: 'invalid',
      validationErrors: [error instanceof Error ? error.message : 'Unknown error in create phase'],
      currentPhase: 'complete',
      error: 'Failed to create card entity',
    };
  }
}

/**
 * Validate node: Validate card data and lane constraints
 */
async function validateNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  const errors: string[] = [];

  // Validate card name
  if (!state.name || state.name.trim().length === 0) {
    errors.push('Card name cannot be empty');
  }

  // Validate amount
  if (state.amount < 0) {
    errors.push('Card amount cannot be negative');
  }

  // Validate lane exists and is accessible
  if (!state.lane || !state.lane._id) {
    errors.push('Invalid lane');
  }

  // Check if lane belongs to the same team as the user
  if (state.lane && state.user && state.lane.teamId.toString() !== state.user.teamId.toString()) {
    errors.push('Lane does not belong to user team');
  }

  if (errors.length > 0) {
    return {
      validationStatus: 'invalid',
      validationErrors: errors,
      currentPhase: 'complete',
      error: 'Validation failed',
    };
  }

  return {
    validationStatus: 'valid',
    validationErrors: [],
    currentPhase: 'assign_lane',
    nextActions: ['assign_to_lane'],
  };
}

/**
 * Assign Lane node: Handle lane-specific logic and persist the card
 */
async function assignLaneNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  try {
    if (!state.newCard) {
      return {
        validationStatus: 'invalid',
        validationErrors: ['No card entity to persist'],
        currentPhase: 'complete',
        error: 'Missing card entity',
      };
    }

    // Check if lane is a closed lane and set closedAt accordingly
    if (state.lane.tags?.type && state.lane.tags.type !== LaneType.Normal) {
      const now = new Date();
      state.newCard.closedAt = now;
    }

    // Persist the card to the database
    const card = await EntityHelper.create(state.newCard, Card);

    if (!card) {
      return {
        validationStatus: 'invalid',
        validationErrors: ['Failed to persist card to database'],
        currentPhase: 'complete',
        error: 'Database error',
      };
    }

    return {
      card,
      currentPhase: 'notify',
      nextActions: ['emit_events'],
    };
  } catch (error: unknown) {
    return {
      validationStatus: 'invalid',
      validationErrors: [
        error instanceof Error ? error.message : 'Unknown error in assign_lane phase',
      ],
      currentPhase: 'complete',
      error: 'Failed to assign card to lane',
    };
  }
}

/**
 * Notify node: Emit events to notify other parts of the system
 */
async function notifyNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  try {
    if (!state.card) {
      return {
        currentPhase: 'complete',
        error: 'No card to emit events for',
      };
    }

    // Emit card event
    emitCardEvent(state.user, state.card.toPlain());

    // Emit lane event
    emitLaneEvent(state.card.laneId, state.card.userId);

    // Emit board event
    emitBoardEvent(state.lane.boardId, state.card.userId);

    return {
      currentPhase: 'complete',
      nextActions: [],
    };
  } catch (error: unknown) {
    // Don't fail the workflow if event emission fails
    console.error('Failed to emit events:', error);
    return {
      currentPhase: 'complete',
      nextActions: [],
    };
  }
}

/**
 * Conditional edge function: Determines the next node based on current state
 */
function routeAfterCreate(state: CardWorkflowState): string {
  if (state.error) {
    return END;
  }
  return 'validate';
}

function routeAfterValidate(state: CardWorkflowState): string {
  if (state.validationStatus === 'invalid') {
    return END;
  }
  return 'assign_lane';
}

function routeAfterAssignLane(state: CardWorkflowState): string {
  if (state.error || !state.card) {
    return END;
  }
  return 'notify';
}

function routeAfterNotify(state: CardWorkflowState): string {
  return END;
}

/**
 * Build and return the card lifecycle workflow graph
 */
export function createCardLifecycleWorkflow() {
  // Create the state graph
  const workflow = new StateGraph(CardWorkflowAnnotation)
    // Add nodes for each phase
    .addNode('create', createNode)
    .addNode('validate', validateNode)
    .addNode('assign_lane', assignLaneNode)
    .addNode('notify', notifyNode);

  // Set the entry point using addEdge (setEntryPoint is deprecated)
  workflow.addEdge('__start__', 'create');

  // Add conditional edges
  workflow.addConditionalEdges('create', routeAfterCreate);
  workflow.addConditionalEdges('validate', routeAfterValidate);
  workflow.addConditionalEdges('assign_lane', routeAfterAssignLane);
  workflow.addConditionalEdges('notify', routeAfterNotify);

  return workflow;
}
