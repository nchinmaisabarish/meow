import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Card, CardStatus } from '../entities/Card.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { ObjectId } from 'mongodb';

/**
 * Tool for listing cards with optional filters
 */
export const createListCardsTool = (user: User, team: Team) => {
  return new DynamicStructuredTool({
    name: 'list_cards',
    description: 'List all active cards for the authenticated team. Returns an array of cards with their details including name, amount, lane, and status.',
    schema: z.object({
      maxDaysAgo: z.number().optional().describe('Filter cards to only those created or updated within the last N days'),
      status: z.enum(['active', 'deleted', 'archived']).optional().describe('Filter cards by status (defaults to active)'),
    }),
    func: async (input: { maxDaysAgo?: number; status?: string }) => {
      try {
        const query: any = {
          teamId: { $eq: team._id! },
          status: { $ne: CardStatus.Deleted },
        };

        // Apply status filter if provided
        if (input.status) {
          query.status = { $eq: input.status };
        }

        // Apply date filter if provided
        if (input.maxDaysAgo) {
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - input.maxDaysAgo);
          query.$or = [
            { closedAt: { $exists: false } },
            { closedAt: { $gte: limitDate } }
          ];
        }

        const cards = await EntityHelper.findBy(Card, query);
        
        return JSON.stringify({
          success: true,
          count: cards.length,
          cards: cards.map(card => card.toPlain()),
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
};

/**
 * Tool for getting a specific card by ID
 */
export const createGetCardTool = (user: User, team: Team) => {
  return new DynamicStructuredTool({
    name: 'get_card',
    description: 'Get detailed information about a specific card by its ID. Returns the card details including name, amount, lane assignment, attributes, and dates.',
    schema: z.object({
      cardId: z.string().describe('The unique identifier (ObjectId) of the card to retrieve'),
    }),
    func: async (input: { cardId: string }) => {
      try {
        // Validate ObjectId format
        if (!ObjectId.isValid(input.cardId)) {
          return JSON.stringify({
            success: false,
            error: 'Invalid card ID format',
          });
        }

        const card = await EntityHelper.findOneById(Card, input.cardId);
        
        if (!card) {
          return JSON.stringify({
            success: false,
            error: 'Card not found',
          });
        }

        // Verify ownership
        if (!EntityHelper.isEntityOwnedBy(card, user)) {
          return JSON.stringify({
            success: false,
            error: 'Access denied: Card does not belong to your team',
          });
        }

        return JSON.stringify({
          success: true,
          card: card.toPlain(),
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
};

/**
 * Tool for moving a card to a different lane
 */
export const createMoveCardTool = (user: User, team: Team) => {
  return new DynamicStructuredTool({
    name: 'move_card_to_lane',
    description: 'Move a card to a different lane in the pipeline. This updates the card\'s lane assignment and tracks when it entered the new lane.',
    schema: z.object({
      cardId: z.string().describe('The unique identifier (ObjectId) of the card to move'),
      laneId: z.string().describe('The unique identifier (ObjectId) of the destination lane'),
    }),
    func: async (input: { cardId: string; laneId: string }) => {
      try {
        // Validate ObjectId formats
        if (!ObjectId.isValid(input.cardId)) {
          return JSON.stringify({
            success: false,
            error: 'Invalid card ID format',
          });
        }

        if (!ObjectId.isValid(input.laneId)) {
          return JSON.stringify({
            success: false,
            error: 'Invalid lane ID format',
          });
        }

        // Fetch and validate card
        const card = await EntityHelper.findOneById(Card, input.cardId);
        
        if (!card) {
          return JSON.stringify({
            success: false,
            error: 'Card not found',
          });
        }

        // Verify card ownership
        if (!EntityHelper.isEntityOwnedBy(card, user)) {
          return JSON.stringify({
            success: false,
            error: 'Access denied: Card does not belong to your team',
          });
        }

        // Fetch and validate lane
        const { validateAndFetchLane } = await import('../helpers/EntityFetchHelper.js');
        const lane = await validateAndFetchLane(input.laneId, user);

        // Update card's lane
        const previousLaneId = card.laneId;
        card.laneId = lane._id!;
        
        // Only update inLaneSince if actually moving to a different lane
        if (previousLaneId.toString() !== lane._id!.toString()) {
          card.inLaneSince = new Date();
        }

        const updatedCard = await EntityHelper.update(card);

        return JSON.stringify({
          success: true,
          message: 'Card moved successfully',
          card: updatedCard.toPlain(),
          previousLaneId: previousLaneId.toString(),
          newLaneId: lane._id!.toString(),
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
};

/**
 * Get all card tools for a given user and team context
 */
export const getCardTools = (user: User, team: Team) => {
  return [
    createListCardsTool(user, team),
    createGetCardTool(user, team),
    createMoveCardTool(user, team),
  ];
};
