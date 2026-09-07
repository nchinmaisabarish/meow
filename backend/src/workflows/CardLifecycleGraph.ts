import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { Card, CardStatus } from '../entities/Card.js';
import { ObjectId } from 'mongodb';

/**
 * Card workflow state schema
 * Represents the state of a card as it moves through the lifecycle workflow
 */
export interface CardWorkflowState {
  // Current lifecycle stage
  stage: CardLifecycleStage;
  
  // Card data
  cardId?: string;
  name: string;
  amount: number;
  laneId: string;
  userId: string;
  teamId: string;
  assignedUserId?: string;
  attributes?: { [key: string]: string | number | null };
  status?: CardStatus;
  closedAt?: string;
  nextFollowUpAt?: string;
  
  // Validation results
  validationErrors?: string[];
  isValid: boolean;
  
  // Operation type
  operation: CardOperation;
  
  // Result
  result?: Card;
  error?: string;
}

/**
 * Lifecycle stages for a card
 */
export enum CardLifecycleStage {
  DRAFT = 'draft',
  VALIDATE = 'validate',
  ASSIGN = 'assign',
  PROGRESS = 'progress',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/**
 * Card operations supported by the workflow
 */
export enum CardOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GET = 'get',
}

/**
 * Define the state annotation for LangGraph
 */
const CardWorkflowAnnotation = Annotation.Root({
  stage: Annotation<CardLifecycleStage>(),
  cardId: Annotation<string | undefined>(),
  name: Annotation<string>(),
  amount: Annotation<number>(),
  laneId: Annotation<string>(),
  userId: Annotation<string>(),
  teamId: Annotation<string>(),
  assignedUserId: Annotation<string | undefined>(),
  attributes: Annotation<{ [key: string]: string | number | null } | undefined>(),
  status: Annotation<CardStatus | undefined>(),
  closedAt: Annotation<string | undefined>(),
  nextFollowUpAt: Annotation<string | undefined>(),
  validationErrors: Annotation<string[] | undefined>(),
  isValid: Annotation<boolean>(),
  operation: Annotation<CardOperation>(),
  result: Annotation<Card | undefined>(),
  error: Annotation<string | undefined>(),
});

/**
 * Node: Create/Draft - Initial stage for card creation
 */
async function createNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  // For create operations, move to validation
  if (state.operation === CardOperation.CREATE) {
    return {
      stage: CardLifecycleStage.VALIDATE,
    };
  }
  
  // For other operations, also validate
  return {
    stage: CardLifecycleStage.VALIDATE,
  };
}

/**
 * Node: Validate - Validate card data and business rules
 */
async function validateNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  const errors: string[] = [];
  
  // Validate required fields
  if (!state.name || state.name.trim().length === 0) {
    errors.push('Card name is required');
  }
  
  if (state.amount === undefined || state.amount === null) {
    errors.push('Card amount is required');
  }
  
  if (!state.laneId) {
    errors.push('Lane ID is required');
  }
  
  if (!state.userId) {
    errors.push('User ID is required');
  }
  
  // For update/delete operations, cardId is required
  if ((state.operation === CardOperation.UPDATE || state.operation === CardOperation.DELETE || state.operation === CardOperation.GET) && !state.cardId) {
    errors.push('Card ID is required for update/delete/get operations');
  }
  
  const isValid = errors.length === 0;
  
  return {
    stage: isValid ? CardLifecycleStage.ASSIGN : CardLifecycleStage.ERROR,
    validationErrors: errors.length > 0 ? errors : undefined,
    isValid,
    error: errors.length > 0 ? errors.join(', ') : undefined,
  };
}

/**
 * Node: Assign - Handle card assignment logic
 */
async function assignNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  // If assignedUserId is provided, use it; otherwise use the current userId
  const finalUserId = state.assignedUserId || state.userId;
  
  return {
    stage: CardLifecycleStage.PROGRESS,
    assignedUserId: finalUserId,
  };
}

/**
 * Node: Progress - Execute the actual card operation
 */
async function progressNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  // This node signals that the card is ready for the actual database operation
  // The WorkflowExecutor will handle the actual operation after this stage
  return {
    stage: CardLifecycleStage.COMPLETE,
  };
}

/**
 * Node: Complete - Finalize the workflow
 */
async function completeNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  // Workflow completed successfully
  return {
    stage: CardLifecycleStage.COMPLETE,
  };
}

/**
 * Node: Error - Handle workflow errors
 */
async function errorNode(state: CardWorkflowState): Promise<Partial<CardWorkflowState>> {
  // Error state - workflow will terminate here
  return {
    stage: CardLifecycleStage.ERROR,
  };
}

/**
 * Create and configure the card lifecycle state graph
 */
export function createCardLifecycleGraph() {
  // Create the workflow and add all nodes first
  const workflow = new StateGraph(CardWorkflowAnnotation)
    .addNode('create', createNode)
    .addNode('validate', validateNode)
    .addNode('assign', assignNode)
    .addNode('progress', progressNode)
    .addNode('complete', completeNode)
    .addNode('error', errorNode);
  
  // Define edges (transitions between stages)
  // Start -> Create (entry point)
  workflow.addEdge(START, 'create');
  
  // Create -> Validate
  workflow.addEdge('create', 'validate');
  
  // Validate -> Assign (if valid) or Error (if invalid)
  // Use conditional routing based on validation result
  workflow.addConditionalEdges('validate', (state: CardWorkflowState) => {
    return state.isValid ? 'assign' : 'error';
  });
  
  // Assign -> Progress
  workflow.addEdge('assign', 'progress');
  
  // Progress -> Complete
  workflow.addEdge('progress', 'complete');
  
  // Complete -> END
  workflow.addEdge('complete', END);
  
  // Error -> END
  workflow.addEdge('error', END);
  
  return workflow;
}

/**
 * Determine the next node based on current state
 */
export function getNextNode(state: CardWorkflowState): string {
  switch (state.stage) {
    case CardLifecycleStage.DRAFT:
      return 'create';
    case CardLifecycleStage.VALIDATE:
      return state.isValid ? 'assign' : 'error';
    case CardLifecycleStage.ASSIGN:
      return 'progress';
    case CardLifecycleStage.PROGRESS:
      return 'complete';
    case CardLifecycleStage.COMPLETE:
      return '__end__';
    case CardLifecycleStage.ERROR:
      return '__end__';
    default:
      return 'error';
  }
}
