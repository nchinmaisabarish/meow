import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Card, CardStatus, NewCard } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { ObjectId } from 'mongodb';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';

/**
 * Tool for creating a new card in the sales pipeline.
 * Creates a card with the specified name, amount, and lane.
 */
export function createCreateCardTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'create_card',
    description: 'Create a new card (opportunity) in the sales pipeline. Use this to add a new deal or opportunity to track. Requires a card name, amount (in the team currency), and either a lane name or lane ID to place the card in.',
    schema: z.object({
      name: z.string().describe('The name or title of the card/opportunity'),
      amount: z.number().describe('The monetary value of the opportunity in the team currency'),
      laneId: z.string().optional().describe('The ID of the lane to place the card in'),
      laneName: z.string().optional().describe('The name of the lane to place the card in (alternative to laneId)'),
      attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Optional custom attributes for the card'),
      closedAt: z.string().optional().describe('Optional ISO date string when the card was/will be closed'),
      nextFollowUpAt: z.string().optional().describe('Optional ISO date string for the next follow-up date'),
    }),
    func: async (input: {
      name: string;
      amount: number;
      laneId?: string;
      laneName?: string;
      attributes?: { [key: string]: string | number | null };
      closedAt?: string;
      nextFollowUpAt?: string;
    }): Promise<string> => {
      try {
        let lane: Lane | null = null;

        // Find lane by name or ID
        if (input.laneName) {
          const query = {
            teamId: team._id,
            name: input.laneName,
          };
          lane = await EntityHelper.findOneBy(Lane, query);
        }

        if (input.laneId) {
          lane = await EntityHelper.findOneById(Lane, input.laneId);
        }

        if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
          return JSON.stringify({
            success: false,
            error: 'Lane not found or access denied',
          });
        }

        // Create the card
        const card = new NewCard(user, lane, input.name, input.amount);

        if (input.attributes) {
          card.attributes = input.attributes;
        }

        if (input.closedAt) {
          card.closedAt = new Date(input.closedAt);
        }

        if (input.nextFollowUpAt) {
          card.nextFollowUpAt = new Date(input.nextFollowUpAt);
        }

        const createdCard = await EntityHelper.create(card, Card);

        if (!createdCard) {
          return JSON.stringify({
            success: false,
            error: 'Failed to create card',
          });
        }

        // Emit events
        emitCardEvent(user, createdCard.toPlain());
        emitLaneEvent(card.laneId, card.userId);
        emitBoardEvent(lane.boardId, card.userId);

        return JSON.stringify({
          success: true,
          card: createdCard.toPlain(),
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
}

/**
 * Tool for updating a card's status (active, deleted, archived).
 */
export function createUpdateCardStatusTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'update_card_status',
    description: 'Update the status of an existing card. Use this to mark a card as active, deleted, or archived. Requires the card ID and the new status.',
    schema: z.object({
      cardId: z.string().describe('The ID of the card to update'),
      status: z.enum(['active', 'deleted', 'archived']).describe('The new status for the card'),
    }),
    func: async (input: { cardId: string; status: 'active' | 'deleted' | 'archived' }): Promise<string> => {
      try {
        // Fetch the card
        const card = await EntityHelper.findOneById(Card, input.cardId);

        if (!card || !EntityHelper.isEntityOwnedBy(card, user)) {
          return JSON.stringify({
            success: false,
            error: 'Card not found or access denied',
          });
        }

        const previous = card.toPlain();

        // Update status
        switch (input.status) {
          case 'active':
            card.status = CardStatus.Active;
            break;
          case 'deleted':
            card.status = CardStatus.Deleted;
            break;
          case 'archived':
            card.status = CardStatus.Archived;
            break;
        }

        const updatedCard = await EntityHelper.update(card);

        // Emit events
        const lane = await EntityHelper.findOneById(Lane, card.laneId);
        if (lane) {
          emitCardEvent(user, updatedCard.toPlain(), previous);
          emitBoardEvent(lane.boardId, card.userId);
        }

        return JSON.stringify({
          success: true,
          card: updatedCard.toPlain(),
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
}

/**
 * Tool for querying cards based on various filters.
 */
export function createQueryCardsTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'query_cards',
    description: 'Query and retrieve cards from the sales pipeline. Use this to search for cards, filter by status, date ranges, or get all active cards. Returns a list of matching cards.',
    schema: z.object({
      status: z.enum(['active', 'deleted', 'archived', 'all']).optional().describe('Filter by card status (defaults to active cards only)'),
      maxDaysAgo: z.number().optional().describe('Only include cards closed within the last N days'),
      startDate: z.string().optional().describe('ISO date string for the start of a date range filter (requires endDate)'),
      endDate: z.string().optional().describe('ISO date string for the end of a date range filter (requires startDate)'),
    }),
    func: async (input: {
      status?: 'active' | 'deleted' | 'archived' | 'all';
      maxDaysAgo?: number;
      startDate?: string;
      endDate?: string;
    }): Promise<string> => {
      try {
        const query: any = {
          teamId: { $eq: team._id },
        };

        // Apply status filter
        if (input.status === 'active') {
          query.status = { $eq: CardStatus.Active };
        } else if (input.status === 'deleted') {
          query.status = { $eq: CardStatus.Deleted };
        } else if (input.status === 'archived') {
          query.status = { $eq: CardStatus.Archived };
        } else if (!input.status || input.status === 'all') {
          // Default: exclude deleted cards
          query.status = { $ne: CardStatus.Deleted };
        }

        // Apply date range filter
        if (input.startDate && input.endDate) {
          const start = new Date(input.startDate);
          const end = new Date(input.endDate);
          end.setHours(23, 59, 59, 999); // End of day
          query.closedAt = { $gte: start, $lte: end };
        }

        // Apply maxDaysAgo filter
        if (input.maxDaysAgo) {
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - input.maxDaysAgo);
          limitDate.setHours(0, 0, 0, 0); // Start of day
          query.$or = [
            { closedAt: { $exists: false } },
            { closedAt: { $gte: limitDate } },
          ];
        }

        const cards = await EntityHelper.findBy(Card, query);

        return JSON.stringify({
          success: true,
          count: cards.length,
          cards: cards.map((card: Card) => card.toPlain()),
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
}

/**
 * Creates all card-related tools for a given user and team context.
 */
export function createCardTools(user: User, team: Team): DynamicStructuredTool[] {
  return [
    createCreateCardTool(user, team),
    createUpdateCardStatusTool(user, team),
    createQueryCardsTool(user, team),
  ];
}
