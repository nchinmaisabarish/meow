import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { CardController } from '../controllers/CardController.js';

/**
 * Tool for creating a new card in the sales pipeline.
 * Creates a card with the specified name, amount, and lane assignment.
 */
export const createCardTool = new DynamicStructuredTool({
  name: 'create_card',
  description:
    'Create a new card (opportunity/deal) in the sales pipeline. A card represents a sales opportunity with a name, monetary amount, and is placed in a specific lane (stage) of the pipeline. Returns the created card with its ID.',
  schema: z.object({
    userId: z.string().describe('The ID of the user creating the card'),
    teamId: z.string().describe('The ID of the team the card belongs to'),
    laneId: z.string().describe('The ID of the lane (pipeline stage) where the card will be placed'),
    name: z.string().describe('The name/title of the card (e.g., "Acme Corp Deal")'),
    amount: z.number().describe('The monetary value/amount of the opportunity'),
    attributes: z
      .record(z.union([z.string(), z.number(), z.null()]))
      .optional()
      .describe('Optional custom attributes for the card'),
    closedAt: z
      .string()
      .optional()
      .describe('Optional ISO 8601 date string when the card was/will be closed'),
    nextFollowUpAt: z
      .string()
      .optional()
      .describe('Optional ISO 8601 date string for the next follow-up date'),
  }),
  func: async (input: {
    userId: string;
    teamId: string;
    laneId: string;
    name: string;
    amount: number;
    attributes?: { [key: string]: string | number | null };
    closedAt?: string;
    nextFollowUpAt?: string;
  }) => {
    try {
      const card = await CardController.createCardStatic(input);
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

/**
 * Tool for retrieving a card by its ID.
 * Fetches the full details of a specific card.
 */
export const getCardTool = new DynamicStructuredTool({
  name: 'get_card',
  description:
    'Retrieve a card (opportunity/deal) by its ID. Returns the full details of the card including name, amount, lane, status, attributes, and dates. Validates that the user has access to the card.',
  schema: z.object({
    cardId: z.string().describe('The ID of the card to retrieve'),
    userId: z.string().describe('The ID of the user requesting the card'),
  }),
  func: async (input: { cardId: string; userId: string }) => {
    try {
      const card = await CardController.getCardStatic(input);
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

/**
 * Tool for updating an existing card.
 * Updates card properties such as name, amount, lane, status, and dates.
 */
export const updateCardTool = new DynamicStructuredTool({
  name: 'update_card',
  description:
    'Update an existing card (opportunity/deal) in the sales pipeline. Can update the name, amount, lane (move to different stage), assigned user, status, attributes, and dates. Returns the updated card.',
  schema: z.object({
    cardId: z.string().describe('The ID of the card to update'),
    userId: z.string().describe('The ID of the user performing the update'),
    name: z.string().describe('The updated name/title of the card'),
    amount: z.number().describe('The updated monetary value/amount'),
    laneId: z.string().optional().describe('Optional: ID of the lane to move the card to'),
    assignedUserId: z
      .string()
      .optional()
      .describe('Optional: ID of the user to assign the card to'),
    attributes: z
      .record(z.union([z.string(), z.number(), z.null()]))
      .optional()
      .describe('Optional: Updated custom attributes'),
    status: z
      .enum(['active', 'deleted', 'archived'])
      .optional()
      .describe('Optional: Updated status of the card'),
    closedAt: z
      .string()
      .optional()
      .describe('Optional: ISO 8601 date string when the card was/will be closed'),
    nextFollowUpAt: z
      .string()
      .optional()
      .describe('Optional: ISO 8601 date string for the next follow-up date'),
  }),
  func: async (input: {
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
  }) => {
    try {
      const card = await CardController.updateCardStatic(input);
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

/**
 * Tool for deleting a card.
 * Marks a card as deleted (soft delete).
 */
export const deleteCardTool = new DynamicStructuredTool({
  name: 'delete_card',
  description:
    'Delete a card (opportunity/deal) from the sales pipeline. This performs a soft delete by marking the card status as deleted. The card data is preserved but will not appear in active lists. Returns the deleted card.',
  schema: z.object({
    cardId: z.string().describe('The ID of the card to delete'),
    userId: z.string().describe('The ID of the user performing the deletion'),
  }),
  func: async (input: { cardId: string; userId: string }) => {
    try {
      const card = await CardController.deleteCardStatic(input);
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
