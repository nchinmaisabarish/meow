import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { Card, CardStatus } from '../entities/Card.js';
import { validateAndFetchCard } from '../helpers/EntityFetchHelper.js';
import { User } from '../entities/User.js';
import { ObjectId } from 'mongodb';

/**
 * Tool for retrieving a specific card by ID
 */
export const getCardTool = new DynamicStructuredTool({
  name: 'get_card',
  description: 'Retrieves a specific card (sales opportunity) by its ID. Use this when the user asks about a specific card, deal, or opportunity.',
  schema: z.object({
    cardId: z.string().describe('The ID of the card to retrieve'),
    userId: z.string().describe('The ID of the authenticated user'),
  }),
  func: async ({ cardId, userId }: { cardId: string; userId: string }): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, userId);
      if (!user) {
        return JSON.stringify({ error: 'User not found' });
      }

      const card = await validateAndFetchCard(cardId, user);
      return JSON.stringify(card.toPlain());
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({ error: error.message });
      }
      return JSON.stringify({ error: 'Unknown error occurred' });
    }
  },
});

/**
 * Tool for listing all cards for a team
 */
export const listCardsTool = new DynamicStructuredTool({
  name: 'list_cards',
  description: 'Lists all active cards (sales opportunities) for the authenticated user\'s team. Use this when the user asks to see all cards, deals, opportunities, or their pipeline.',
  schema: z.object({
    teamId: z.string().describe('The ID of the team'),
    maxDaysAgo: z.number().optional().describe('Optional: Only include cards from the last N days'),
  }),
  func: async ({ teamId, maxDaysAgo }: { teamId: string; maxDaysAgo?: number }): Promise<string> => {
    try {
      const query: any = {
        teamId: { $eq: new ObjectId(teamId) },
        status: { $ne: CardStatus.Deleted },
      };

      if (maxDaysAgo) {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - maxDaysAgo);
        query.$or = [
          { closedAt: { $exists: false } },
          { closedAt: { $gte: limitDate } }
        ];
      }

      const cards = await EntityHelper.findBy(Card, query);
      const plainCards = cards.map((card: Card) => card.toPlain());
      
      return JSON.stringify({ cards: plainCards, count: plainCards.length });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({ error: error.message });
      }
      return JSON.stringify({ error: 'Unknown error occurred' });
    }
  },
});

export const cardTools = [getCardTool, listCardsTool];
