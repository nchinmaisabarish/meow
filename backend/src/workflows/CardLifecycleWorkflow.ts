import { ObjectId } from 'mongodb';
import { Card } from '../entities/Card.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { WorkflowEngine } from './WorkflowEngine.js';
import { IWorkflowContext, WorkflowState, WorkflowTransition } from './WorkflowTypes.js';
import cardLifecycleConfig from './card-lifecycle.json' assert { type: 'json' };

export enum CardLifecycleState {
  CREATED = 'CREATED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface CardWorkflowContext extends IWorkflowContext {
  card: Card;
  previousCard?: Partial<Card>;
  lane?: Lane;
  user?: User;
  eventType: CardEventType;
  eventData?: any;
}

export enum CardEventType {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  MOVED_TO_LANE = 'MOVED_TO_LANE',
  BLOCKED = 'BLOCKED',
  UNBLOCKED = 'UNBLOCKED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  UPDATED = 'UPDATED',
}

export class CardLifecycleWorkflow {
  private engine: WorkflowEngine;
  private workflowId: string = 'card-lifecycle';

  constructor() {
    this.engine = new WorkflowEngine();
    this.initializeWorkflow();
  }

  private initializeWorkflow(): void {
    const states: WorkflowState[] = cardLifecycleConfig.states.map((state) => ({
      id: state.id,
      name: state.name,
      metadata: state.metadata,
    }));

    const transitions: WorkflowTransition[] = cardLifecycleConfig.transitions.map(
      (transition) => ({
        id: transition.id,
        from: transition.from,
        to: transition.to,
        event: transition.event,
        condition: this.createConditionFunction(transition.condition),
        action: this.createActionFunction(transition.action),
      })
    );

    this.engine.registerWorkflow({
      id: this.workflowId,
      name: cardLifecycleConfig.name,
      initialState: cardLifecycleConfig.initialState,
      states,
      transitions,
    });
  }

  private createConditionFunction(
    conditionConfig: any
  ): ((context: IWorkflowContext) => boolean) | undefined {
    if (!conditionConfig) {
      return undefined;
    }

    return (context: IWorkflowContext): boolean => {
      const ctx = context as CardWorkflowContext;

      switch (conditionConfig.type) {
        case 'is_assigned':
          return ctx.card.userId !== undefined && ctx.card.userId !== null;

        case 'lane_type_is_completed':
          return ctx.lane?.tags?.type === LaneType.Completed;

        case 'lane_type_is_archived':
          return ctx.lane?.tags?.type === LaneType.Archived;

        case 'has_blocker_attribute':
          return (
            ctx.card.attributes !== undefined &&
            ctx.card.attributes.blocked === true
          );

        case 'no_blocker_attribute':
          return (
            ctx.card.attributes === undefined ||
            ctx.card.attributes.blocked !== true
          );

        case 'is_closed':
          return ctx.card.closedAt !== undefined && ctx.card.closedAt !== null;

        default:
          return true;
      }
    };
  }

  private createActionFunction(
    actionConfig: any
  ): ((context: IWorkflowContext) => void | Promise<void>) | undefined {
    if (!actionConfig) {
      return undefined;
    }

    return async (context: IWorkflowContext): Promise<void> => {
      const ctx = context as CardWorkflowContext;

      switch (actionConfig.type) {
        case 'set_in_lane_since':
          ctx.card.inLaneSince = new Date();
          break;

        case 'set_closed_at':
          if (!ctx.card.closedAt) {
            ctx.card.closedAt = new Date();
          }
          break;

        case 'clear_closed_at':
          ctx.card.closedAt = undefined;
          break;

        case 'log_transition':
          console.log(
            `Card ${ctx.card._id} transitioned to ${ctx.currentState} via ${ctx.eventType}`
          );
          break;

        default:
          break;
      }
    };
  }

  public async executeTransition(
    context: CardWorkflowContext
  ): Promise<CardLifecycleState> {
    const currentState = this.determineCurrentState(context.card, context.lane);
    context.currentState = currentState;

    const result = await this.engine.executeWorkflow(this.workflowId, context);

    return result.currentState as CardLifecycleState;
  }

  private determineCurrentState(card: Card, lane?: Lane): CardLifecycleState {
    if (card.status === 'deleted' || lane?.tags?.type === LaneType.Archived) {
      return CardLifecycleState.ARCHIVED;
    }

    if (card.closedAt || lane?.tags?.type === LaneType.Completed) {
      return CardLifecycleState.COMPLETED;
    }

    if (card.attributes?.blocked === true) {
      return CardLifecycleState.BLOCKED;
    }

    if (card.userId && card.inLaneSince) {
      return CardLifecycleState.IN_PROGRESS;
    }

    return CardLifecycleState.CREATED;
  }

  public getWorkflowEngine(): WorkflowEngine {
    return this.engine;
  }
}

export const cardLifecycleWorkflow = new CardLifecycleWorkflow();
