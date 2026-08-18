import { ObjectId } from 'mongodb';
import { Card } from '../entities/Card.js';
import { User } from '../entities/User.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { EntityHelper } from '../helpers/EntityHelper.js';

export enum CardLifecycleState {
  Created = 'created',
  InProgress = 'in_progress',
  Review = 'review',
  Done = 'done',
}

export interface WorkflowTransition {
  from: CardLifecycleState;
  to: CardLifecycleState;
  guards?: TransitionGuard[];
}

export interface TransitionGuard {
  name: string;
  validate: (card: Card, user: User, context?: any) => Promise<boolean>;
  errorMessage: string;
}

export interface WorkflowContext {
  card: Card;
  user: User;
  previousState?: CardLifecycleState;
  metadata?: Record<string, any>;
}

export class WorkflowStateMachine {
  private transitions: Map<string, WorkflowTransition[]>;

  constructor(transitions: WorkflowTransition[]) {
    this.transitions = new Map();
    this.buildTransitionMap(transitions);
  }

  private buildTransitionMap(transitions: WorkflowTransition[]): void {
    for (const transition of transitions) {
      const key = transition.from;
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    }
  }

  async canTransition(
    from: CardLifecycleState,
    to: CardLifecycleState,
    card: Card,
    user: User,
    context?: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    const possibleTransitions = this.transitions.get(from) || [];
    const transition = possibleTransitions.find((t) => t.to === to);

    if (!transition) {
      return {
        allowed: false,
        reason: `No transition defined from ${from} to ${to}`,
      };
    }

    if (transition.guards) {
      for (const guard of transition.guards) {
        const isValid = await guard.validate(card, user, context);
        if (!isValid) {
          return {
            allowed: false,
            reason: guard.errorMessage,
          };
        }
      }
    }

    return { allowed: true };
  }

  getAvailableTransitions(from: CardLifecycleState): CardLifecycleState[] {
    const transitions = this.transitions.get(from) || [];
    return transitions.map((t) => t.to);
  }
}

export class CardLifecycleWorkflow {
  private stateMachine: WorkflowStateMachine;

  constructor() {
    this.stateMachine = this.createStateMachine();
  }

  private createStateMachine(): WorkflowStateMachine {
    const transitions: WorkflowTransition[] = [
      {
        from: CardLifecycleState.Created,
        to: CardLifecycleState.InProgress,
        guards: [
          {
            name: 'hasName',
            validate: async (card: Card) => {
              return card.name !== undefined && card.name.trim().length > 0;
            },
            errorMessage: 'Card must have a name to move to in progress',
          },
          {
            name: 'hasAssignedUser',
            validate: async (card: Card) => {
              return card.userId !== undefined;
            },
            errorMessage: 'Card must be assigned to a user to move to in progress',
          },
        ],
      },
      {
        from: CardLifecycleState.InProgress,
        to: CardLifecycleState.Review,
        guards: [
          {
            name: 'hasMinimumProgress',
            validate: async (card: Card) => {
              return card.inLaneSince !== undefined;
            },
            errorMessage: 'Card must have been in progress before moving to review',
          },
        ],
      },
      {
        from: CardLifecycleState.InProgress,
        to: CardLifecycleState.Created,
        guards: [],
      },
      {
        from: CardLifecycleState.Review,
        to: CardLifecycleState.Done,
        guards: [
          {
            name: 'canComplete',
            validate: async (card: Card, user: User) => {
              return card.userId.equals(user._id!);
            },
            errorMessage: 'Only the assigned user can mark the card as done',
          },
        ],
      },
      {
        from: CardLifecycleState.Review,
        to: CardLifecycleState.InProgress,
        guards: [],
      },
      {
        from: CardLifecycleState.Done,
        to: CardLifecycleState.InProgress,
        guards: [
          {
            name: 'canReopen',
            validate: async (card: Card, user: User) => {
              return card.userId.equals(user._id!);
            },
            errorMessage: 'Only the assigned user can reopen a completed card',
          },
        ],
      },
    ];

    return new WorkflowStateMachine(transitions);
  }

  async getCurrentState(card: Card): Promise<CardLifecycleState> {
    if (card.closedAt) {
      return CardLifecycleState.Done;
    }

    const lane = await EntityHelper.findOneById(Lane, card.laneId);

    if (!lane) {
      return CardLifecycleState.Created;
    }

    if (lane.tags?.type === LaneType.Done) {
      return CardLifecycleState.Done;
    }

    const laneNameLower = lane.name.toLowerCase();

    if (laneNameLower.includes('review') || laneNameLower.includes('testing')) {
      return CardLifecycleState.Review;
    }

    if (
      laneNameLower.includes('progress') ||
      laneNameLower.includes('doing') ||
      laneNameLower.includes('development')
    ) {
      return CardLifecycleState.InProgress;
    }

    if (card.inLaneSince && card.inLaneSince.getTime() !== card.createdAt.getTime()) {
      return CardLifecycleState.InProgress;
    }

    return CardLifecycleState.Created;
  }

  async validateTransition(
    card: Card,
    targetLane: Lane,
    user: User
  ): Promise<{ valid: boolean; reason?: string; fromState?: CardLifecycleState; toState?: CardLifecycleState }> {
    const currentState = await this.getCurrentState(card);
    const targetState = await this.inferStateFromLane(targetLane, card);

    if (currentState === targetState) {
      return { valid: true, fromState: currentState, toState: targetState };
    }

    const canTransition = await this.stateMachine.canTransition(
      currentState,
      targetState,
      card,
      user
    );

    return {
      valid: canTransition.allowed,
      reason: canTransition.reason,
      fromState: currentState,
      toState: targetState,
    };
  }

  private async inferStateFromLane(lane: Lane, card: Card): Promise<CardLifecycleState> {
    if (lane.tags?.type === LaneType.Done) {
      return CardLifecycleState.Done;
    }

    const laneNameLower = lane.name.toLowerCase();

    if (laneNameLower.includes('review') || laneNameLower.includes('testing')) {
      return CardLifecycleState.Review;
    }

    if (
      laneNameLower.includes('progress') ||
      laneNameLower.includes('doing') ||
      laneNameLower.includes('development')
    ) {
      return CardLifecycleState.InProgress;
    }

    if (laneNameLower.includes('backlog') || laneNameLower.includes('todo')) {
      return CardLifecycleState.Created;
    }

    return CardLifecycleState.InProgress;
  }

  getAvailableTransitions(currentState: CardLifecycleState): CardLifecycleState[] {
    return this.stateMachine.getAvailableTransitions(currentState);
  }

  async executeTransition(
    card: Card,
    targetState: CardLifecycleState,
    user: User
  ): Promise<WorkflowContext> {
    const currentState = await this.getCurrentState(card);

    const context: WorkflowContext = {
      card,
      user,
      previousState: currentState,
      metadata: {
        transitionedAt: new Date(),
        transitionedBy: user._id,
      },
    };

    return context;
  }
}

export const cardLifecycleWorkflow = new CardLifecycleWorkflow();
