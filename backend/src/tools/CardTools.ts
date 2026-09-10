import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Card, CardStatus, NewCard } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { validateAndFetchCard, validateAndFetchLane, validateAndFetchUser } from '../helpers/EntityFetchHelper.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';
import { ObjectId } from 'mongodb';

/**
 * Schema for creating a card
 */
const createCardSchema = z.object({
  name: z.string().describe('The name or title of the card'),
  amount: z.number().describe('The monetary value or amount associated with the card'),
  laneId: z.string().optional().describe('The ID of the lane where the card should be created'),
  laneName: z.string().optional().describe('The name of the lane where the card should be created (alternative to laneId)'),
  attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Additional custom attributes for the card'),
  closedAt: z.string().optional().describe('ISO date string indicating when the card was closed'),
  nextFollowUpAt: z.string().optional().describe('ISO date string indicating the next follow-up date'),
});

/**
 * Creates a structured tool for creating a new card
 */
export function createCardTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'create_card',
    description: 'Creates a new card in a specified lane. A card represents a sales opportunity or deal in the pipeline.',
    schema: createCardSchema,
    func: async (input: z.infer<typeof createCardSchema>) => {
      try {
        let lane: Lane | null = null;

        if (input.laneName) {
          const query = {
            teamId: authenticatedUser.teamId,
            name: input.laneName,
          };
          lane = await EntityHelper.findOneBy(Lane, query);
        }

        if (input.laneId) {
          lane = await EntityHelper.findOneById(Lane, input.laneId);
        }

        if (!lane || !EntityHelper.isEntityOwnedBy(lane, authenticatedUser)) {
          throw new EntityNotFoundError();
        }

        const card: NewCard = new NewCard(authenticatedUser, lane, input.name, input.amount);

        if (input.attributes) {
          card.attributes = input.attributes;
        }

        if (input.closedAt) {
          card.closedAt = new Date(input.closedAt);
        }

        if (input.nextFollowUpAt) {
          card.nextFollowUpAt = new Date(input.nextFollowUpAt);
        }

        const latest: Card | null = await EntityHelper.create(card, Card);

        if (latest) {
          emitCardEvent(authenticatedUser, latest.toPlain());
          emitLaneEvent(card.laneId, card.userId);
          emitBoardEvent(lane.boardId, card.userId);

          return JSON.stringify({
            success: true,
            card: latest.toPlain(),
          });
        }

        return JSON.stringify({
          success: false,
          error: 'Failed to create card',
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}

/**
 * Schema for updating a card
 */
const updateCardSchema = z.object({
  cardId: z.string().describe('The ID of the card to update'),
  name: z.string().describe('The new name or title of the card'),
  amount: z.number().describe('The new monetary value or amount'),
  userId: z.string().optional().describe('The ID of the user to assign the card to'),
  laneId: z.string().optional().describe('The ID of the lane to move the card to'),
  status: z.enum(['active', 'deleted', 'archived']).optional().describe('The status of the card'),
  attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Updated custom attributes'),
  closedAt: z.string().optional().describe('ISO date string for when the card was closed'),
  nextFollowUpAt: z.string().optional().describe('ISO date string for the next follow-up date'),
});

/**
 * Creates a structured tool for updating an existing card
 */
export function updateCardTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'update_card',
    description: 'Updates an existing card with new information. Can update name, amount, status, attributes, dates, and assignment.',
    schema: updateCardSchema,
    func: async (input: z.infer<typeof updateCardSchema>) => {
      try {
        const card: Card = await validateAndFetchCard(input.cardId, authenticatedUser);
        const previous = card.toPlain();

        card.name = input.name;

        let previousUserId: ObjectId | undefined = undefined;

        if (input.userId && card.userId.toString() !== input.userId.toString()) {
          const user = await validateAndFetchUser(input.userId, authenticatedUser);
          previousUserId = card.userId;
          card.userId = user._id!;
        }

        if (input.attributes) {
          card.attributes = input.attributes;
        }

        let previousAmount: number | undefined = undefined;

        if (card.amount !== input.amount) {
          previousAmount = card.amount;
          card.amount = input.amount;
        }

        if (input.status) {
          card.status = input.status as CardStatus;
        }

        if (input.closedAt) {
          card.closedAt = new Date(input.closedAt);
        }

        if (input.nextFollowUpAt) {
          card.nextFollowUpAt = new Date(input.nextFollowUpAt);
        }

        let previousLaneId: ObjectId | undefined = undefined;

        if (input.laneId) {
          const lane = await validateAndFetchLane(input.laneId, authenticatedUser);

          if (input.laneId.toString() !== card.laneId.toString()) {
            previousLaneId = card.laneId;
            card.inLaneSince = new Date();
          }

          card.laneId = lane._id!;
        }

        const latest: Card = await EntityHelper.update(card);

        // Emit events
        if (previousLaneId) {
          emitLaneEvent(previousLaneId, card.userId);
          emitLaneEvent(card.laneId, card.userId);
        }

        if (previousAmount !== undefined) {
          emitLaneEvent(card.laneId, card.userId);
        }

        const lane = await EntityHelper.findOneById(Lane, card.laneId);

        if (previousUserId && lane) {
          emitLaneEvent(card.laneId, previousUserId);
          emitLaneEvent(card.laneId, card.userId);
          emitBoardEvent(lane.boardId, previousUserId);
        }

        emitCardEvent(authenticatedUser, latest.toPlain(), previous);
        
        if (lane) {
          emitBoardEvent(lane.boardId, card.userId);
        }

        return JSON.stringify({
          success: true,
          card: latest.toPlain(),
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}

/**
 * Schema for getting a card
 */
const getCardSchema = z.object({
  cardId: z.string().describe('The ID of the card to retrieve'),
});

/**
 * Creates a structured tool for retrieving a card by ID
 */
export function getCardTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'get_card',
    description: 'Retrieves detailed information about a specific card by its ID.',
    schema: getCardSchema,
    func: async (input: z.infer<typeof getCardSchema>) => {
      try {
        const card: Card = await validateAndFetchCard(input.cardId, authenticatedUser);

        return JSON.stringify({
          success: true,
          card: card.toPlain(),
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}

/**
 * Schema for moving a card to a lane
 */
const moveCardToLaneSchema = z.object({
  cardId: z.string().describe('The ID of the card to move'),
  laneId: z.string().describe('The ID of the destination lane'),
});

/**
 * Creates a structured tool for moving a card to a different lane
 */
export function moveCardToLaneTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'move_card_to_lane',
    description: 'Moves a card from its current lane to a different lane in the pipeline.',
    schema: moveCardToLaneSchema,
    func: async (input: z.infer<typeof moveCardToLaneSchema>) => {
      try {
        const card: Card = await validateAndFetchCard(input.cardId, authenticatedUser);
        const lane = await validateAndFetchLane(input.laneId, authenticatedUser);

        const previous = card.toPlain();
        const previousLaneId = card.laneId;

        if (input.laneId.toString() !== card.laneId.toString()) {
          card.inLaneSince = new Date();
        }

        card.laneId = lane._id!;

        const latest: Card = await EntityHelper.update(card);

        // Emit events for both lanes
        emitLaneEvent(previousLaneId, card.userId);
        emitLaneEvent(card.laneId, card.userId);
        emitCardEvent(authenticatedUser, latest.toPlain(), previous);
        emitBoardEvent(lane.boardId, card.userId);

        return JSON.stringify({
          success: true,
          card: latest.toPlain(),
          message: `Card moved from lane ${previousLaneId.toString()} to lane ${lane._id!.toString()}`,
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}
