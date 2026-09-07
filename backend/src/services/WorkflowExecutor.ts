import { CompiledStateGraph } from '@langchain/langgraph';
import {
  createCardLifecycleGraph,
  CardWorkflowState,
  CardLifecycleStage,
  CardOperation,
} from '../workflows/CardLifecycleGraph.js';
import { Card, CardStatus } from '../entities/Card.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { User } from '../entities/User.js';
import { Lane } from '../entities/Lane.js';
import { NewCard } from '../entities/Card.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { RequestParser } from '../helpers/RequestParser.js';
import { validateAndFetchCard, validateAndFetchLane, validateAndFetchUser } from '../helpers/EntityFetchHelper.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';
import { ObjectId } from 'mongodb';
import { DateTime } from 'luxon';
import { LaneType } from '../entities/Lane.js';

/**
 * WorkflowExecutor service
 * Manages the initialization and execution of card lifecycle workflows
 */
export class WorkflowExecutor {
  private graph: CompiledStateGraph<any, any, any> | null = null;

  /**
   * Initialize the workflow graph
   */
  public initializeGraph(): void {
    const stateGraph = createCardLifecycleGraph();
    this.graph = stateGraph.compile();
  }

  /**
   * Get the compiled graph (initialize if needed)
   */
  private getGraph(): CompiledStateGraph<any, any, any> {
    if (!this.graph) {
      this.initializeGraph();
    }
    return this.graph!;
  }

  /**
   * Execute a card creation workflow
   */
  public async executeCreateCard(params: {
    userId: string;
    teamId: string;
    laneId: string;
    name: string;
    amount: number;
    attributes?: { [key: string]: string | number | null };
    closedAt?: string;
    nextFollowUpAt?: string;
  }): Promise<Card> {
    // Initialize workflow state
    const initialState: CardWorkflowState = {
      stage: CardLifecycleStage.DRAFT,
      operation: CardOperation.CREATE,
      name: params.name,
      amount: params.amount,
      laneId: params.laneId,
      userId: params.userId,
      teamId: params.teamId,
      attributes: params.attributes,
      closedAt: params.closedAt,
      nextFollowUpAt: params.nextFollowUpAt,
      isValid: false,
    };

    // Execute workflow
    const finalState = await this.executeWorkflow(initialState);

    // Check if workflow completed successfully
    if (finalState.stage === CardLifecycleStage.ERROR || !finalState.isValid) {
      throw new Error(finalState.error || 'Card creation workflow failed');
    }

    // Perform the actual database operation
    const user = await EntityHelper.findOneById(User, params.userId);
    if (!user) {
      throw new EntityNotFoundError();
    }

    const lane = await EntityHelper.findOneById(Lane, params.laneId);
    if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
      throw new EntityNotFoundError();
    }

    const card = new NewCard(user, lane, params.name, params.amount);

    if (params.attributes) {
      card.attributes = params.attributes;
    }

    if (params.closedAt && RequestParser.isValidDateTimeString(params.closedAt)) {
      card.closedAt = RequestParser.toJsDate(params.closedAt);
    }

    if (params.nextFollowUpAt && RequestParser.isValidDateTimeString(params.nextFollowUpAt)) {
      card.nextFollowUpAt = RequestParser.toJsDate(params.nextFollowUpAt);
    }

    const latest = await EntityHelper.create(card, Card);

    emitCardEvent(user, latest!.toPlain());
    emitLaneEvent(card.laneId, card.userId);
    emitBoardEvent(lane.boardId, card.userId);

    return latest!;
  }

  /**
   * Execute a card update workflow
   */
  public async executeUpdateCard(params: {
    cardId: string;
    userId: string;
    name: string;
    amount: number;
    laneId?: string;
    assignedUserId?: string;
    attributes?: { [key: string]: string | number | null };
    status?: string;
    closedAt?: string;
    nextFollowUpAt?: string;
  }): Promise<Card> {
    // Initialize workflow state
    const initialState: CardWorkflowState = {
      stage: CardLifecycleStage.DRAFT,
      operation: CardOperation.UPDATE,
      cardId: params.cardId,
      name: params.name,
      amount: params.amount,
      laneId: params.laneId || '',
      userId: params.userId,
      teamId: '', // Will be fetched from existing card
      assignedUserId: params.assignedUserId,
      attributes: params.attributes,
      status: params.status as CardStatus | undefined,
      closedAt: params.closedAt,
      nextFollowUpAt: params.nextFollowUpAt,
      isValid: false,
    };

    // Execute workflow
    const finalState = await this.executeWorkflow(initialState);

    // Check if workflow completed successfully
    if (finalState.stage === CardLifecycleStage.ERROR || !finalState.isValid) {
      throw new Error(finalState.error || 'Card update workflow failed');
    }

    // Perform the actual database operation
    const user = await EntityHelper.findOneById(User, params.userId);
    if (!user) {
      throw new EntityNotFoundError();
    }

    const card = await validateAndFetchCard(params.cardId, user);
    const previous = card.toPlain();

    card.name = params.name;

    let previousUserId = undefined;

    if (params.assignedUserId && card.userId.toString() !== params.assignedUserId.toString()) {
      const assignedUser = await validateAndFetchUser(params.assignedUserId, user);
      previousUserId = card.userId;
      card.userId = assignedUser._id!;
    }

    if (params.attributes) {
      card.attributes = params.attributes;
    }

    let previousAmount = undefined;

    if (card.amount !== params.amount) {
      previousAmount = card.amount;
      card.amount = params.amount;
    }

    if (params.status) {
      card.status = this.parseCardStatus(params.status);
    }

    if (params.closedAt && !RequestParser.isEqualDates(params.closedAt, card.closedAt)) {
      const closedAt = RequestParser.toJsDate(params.closedAt);
      card.closedAt = closedAt;
    }

    if (
      params.nextFollowUpAt &&
      !RequestParser.isEqualDates(params.nextFollowUpAt, card.nextFollowUpAt)
    ) {
      const nextFollowUpAt = RequestParser.toJsDate(params.nextFollowUpAt);
      card.nextFollowUpAt = nextFollowUpAt;
    }

    let previousLaneId: ObjectId | undefined = undefined;

    if (params.laneId) {
      const lane = await validateAndFetchLane(params.laneId, user);

      if (params.laneId.toString() !== card.laneId.toString()) {
        previousLaneId = card.laneId;
        card.inLaneSince = new Date();
      }

      card.laneId = lane._id!;

      if (lane.tags?.type && lane.tags.type !== LaneType.Normal) {
        const closedAt = DateTime.utc().startOf('day');
        card.closedAt = closedAt.toJSDate();
      }
    }

    const latest = await EntityHelper.update(card);

    /* emit events */

    /* if lane has changed emit events for the previous and current lane */
    if (previousLaneId) {
      emitLaneEvent(previousLaneId, card.userId);
      emitLaneEvent(card.laneId, card.userId);
    }

    /* if card has a changed amount update the lane and user */
    if (previousAmount) {
      emitLaneEvent(card.laneId, card.userId);
    }

    const lane = await EntityHelper.findOneById(Lane, card.laneId);

    /* if card assignment has changed update lane and both users */
    if (previousUserId) {
      emitLaneEvent(card.laneId, previousUserId);
      emitLaneEvent(card.laneId, card.userId);

      emitBoardEvent(lane!.boardId, previousUserId);
    }

    emitCardEvent(user, latest.toPlain(), previous);
    emitBoardEvent(lane!.boardId, card.userId);

    return latest;
  }

  /**
   * Execute a card get workflow
   */
  public async executeGetCard(params: { cardId: string; userId: string }): Promise<Card> {
    // Initialize workflow state
    const initialState: CardWorkflowState = {
      stage: CardLifecycleStage.DRAFT,
      operation: CardOperation.GET,
      cardId: params.cardId,
      name: '', // Not needed for get
      amount: 0, // Not needed for get
      laneId: '', // Not needed for get
      userId: params.userId,
      teamId: '', // Will be fetched from existing card
      isValid: false,
    };

    // Execute workflow
    const finalState = await this.executeWorkflow(initialState);

    // Check if workflow completed successfully
    if (finalState.stage === CardLifecycleStage.ERROR || !finalState.isValid) {
      throw new Error(finalState.error || 'Card get workflow failed');
    }

    // Perform the actual database operation
    const user = await EntityHelper.findOneById(User, params.userId);
    if (!user) {
      throw new EntityNotFoundError();
    }

    const card = await validateAndFetchCard(params.cardId, user);
    return card;
  }

  /**
   * Execute a card delete workflow
   */
  public async executeDeleteCard(params: { cardId: string; userId: string }): Promise<Card> {
    // Initialize workflow state
    const initialState: CardWorkflowState = {
      stage: CardLifecycleStage.DRAFT,
      operation: CardOperation.DELETE,
      cardId: params.cardId,
      name: '', // Not needed for delete
      amount: 0, // Not needed for delete
      laneId: '', // Not needed for delete
      userId: params.userId,
      teamId: '', // Will be fetched from existing card
      isValid: false,
    };

    // Execute workflow
    const finalState = await this.executeWorkflow(initialState);

    // Check if workflow completed successfully
    if (finalState.stage === CardLifecycleStage.ERROR || !finalState.isValid) {
      throw new Error(finalState.error || 'Card delete workflow failed');
    }

    // Perform the actual database operation
    const user = await EntityHelper.findOneById(User, params.userId);
    if (!user) {
      throw new EntityNotFoundError();
    }

    const card = await validateAndFetchCard(params.cardId, user);
    const previous = card.toPlain();

    card.status = CardStatus.Deleted;

    const latest = await EntityHelper.update(card);

    emitCardEvent(user, latest.toPlain(), previous);
    emitLaneEvent(card.laneId, card.userId);

    const lane = await EntityHelper.findOneById(Lane, card.laneId);
    emitBoardEvent(lane!.boardId, card.userId);

    return latest;
  }

  /**
   * Execute the workflow with the given initial state
   */
  private async executeWorkflow(initialState: CardWorkflowState): Promise<CardWorkflowState> {
    const graph = this.getGraph();

    try {
      // Invoke the graph with the initial state
      const result = await graph.invoke(initialState);

      return result as CardWorkflowState;
    } catch (error: unknown) {
      // Handle workflow execution errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown workflow error';
      return {
        ...initialState,
        stage: CardLifecycleStage.ERROR,
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Parse card status from string
   */
  private parseCardStatus(value: string): CardStatus {
    switch (value) {
      case 'active':
        return CardStatus.Active;
      case 'deleted':
        return CardStatus.Deleted;
      case 'archived':
        return CardStatus.Archived;
      default:
        throw new Error(`Unsupported status value: ${value}`);
    }
  }

  /**
   * Get the current state of a workflow execution
   */
  public async getWorkflowState(
    initialState: CardWorkflowState
  ): Promise<CardWorkflowState> {
    return this.executeWorkflow(initialState);
  }
}

// Export a singleton instance
export const workflowExecutor = new WorkflowExecutor();
