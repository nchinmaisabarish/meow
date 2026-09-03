import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Card, CardStatus } from '../entities/Card.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';

/**
 * Tool for fetching cards from the database
 */
export function createFetchCardsTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'fetch_cards',
    description: 'Fetch cards (deals/opportunities) from the sales pipeline. Use this when the user wants to see their cards, deals, opportunities, or pipeline items.',
    schema: z.object({
      maxDaysAgo: z.number().optional().describe('Maximum number of days ago to fetch cards from'),
      status: z.enum(['active', 'deleted', 'archived']).optional().describe('Filter cards by status'),
    }),
    func: async (input: { maxDaysAgo?: number; status?: string }): Promise<string> => {
      try {
        const query: any = {
          teamId: { $eq: team._id },
          status: { $ne: CardStatus.Deleted },
        };

        if (input.status) {
          switch (input.status) {
            case 'active':
              query.status = CardStatus.Active;
              break;
            case 'deleted':
              query.status = CardStatus.Deleted;
              break;
            case 'archived':
              query.status = CardStatus.Archived;
              break;
          }
        }

        if (input.maxDaysAgo) {
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - input.maxDaysAgo);
          query.$or = [
            { closedAt: { $exists: false } },
            { closedAt: { $gte: limitDate } }
          ];
        }

        const cards = await EntityHelper.findBy(Card, query);

        if (!cards || cards.length === 0) {
          return 'No cards found matching the criteria.';
        }

        const cardSummaries = cards.map((card: Card) => ({
          id: card._id.toString(),
          name: card.name,
          amount: card.amount,
          status: card.status,
          createdAt: card.createdAt,
        }));

        return JSON.stringify({
          count: cards.length,
          cards: cardSummaries,
        });
      } catch (error) {
        return `Error fetching cards: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });
}

/**
 * Tool for getting a specific card by ID
 */
export function createGetCardTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_card',
    description: 'Get details of a specific card by its ID. Use this when the user asks about a specific card, deal, or opportunity.',
    schema: z.object({
      cardId: z.string().describe('The ID of the card to retrieve'),
    }),
    func: async (input: { cardId: string }): Promise<string> => {
      try {
        const card = await EntityHelper.findOneById(Card, input.cardId);

        if (!card) {
          return `Card with ID ${input.cardId} not found.`;
        }

        // Verify ownership
        if (card.teamId.toString() !== team._id.toString()) {
          return 'Card not found or access denied.';
        }

        return JSON.stringify({
          id: card._id.toString(),
          name: card.name,
          amount: card.amount,
          status: card.status,
          laneId: card.laneId.toString(),
          userId: card.userId.toString(),
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          closedAt: card.closedAt,
          nextFollowUpAt: card.nextFollowUpAt,
          attributes: card.attributes,
        });
      } catch (error) {
        return `Error fetching card: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });
}
