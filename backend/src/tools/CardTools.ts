import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { CardController } from '../controllers/CardController.js';

/**
 * Input schema for the createCard tool
 */
const createCardSchema = z.object({
  name: z.string().describe('The name/title of the card'),
  amount: z.number().describe('The monetary amount associated with the card'),
  laneId: z.string().describe('The ID of the lane where the card should be created'),
  userId: z.string().describe('The ID of the user who owns the card'),
  attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Optional custom attributes for the card'),
  closedAt: z.string().optional().describe('Optional ISO date string when the card was closed'),
  nextFollowUpAt: z.string().optional().describe('Optional ISO date string for next follow-up'),
});

/**
 * LangChain structured tool for creating cards
 */
export const createCardTool = new DynamicStructuredTool({
  name: 'create_card',
  description: 'Creates a new card in the sales pipeline. A card represents a sales opportunity or deal. It must be placed in a specific lane (stage) and assigned to a user. You can optionally set custom attributes, a closed date, and a follow-up date.',
  schema: createCardSchema,
  func: async (input: z.infer<typeof createCardSchema>): Promise<string> => {
    try {
      const card = await CardController.createCardFromTool(input);
      const plainCard = card.toPlain();
      return JSON.stringify({
        success: true,
        card: plainCard,
        message: `Card "${plainCard.name}" created successfully with ID ${plainCard._id}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to create card: ${errorMessage}`,
      });
    }
  },
});
