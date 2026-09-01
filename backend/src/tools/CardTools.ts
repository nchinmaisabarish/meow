import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { NewCard, Card } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';

/**
 * Input schema for creating a card
 */
const createCardSchema = z.object({
  cardTitle: z.string().describe('The title/name of the card'),
  laneId: z.string().describe('The ID of the lane where the card will be created'),
  accountId: z.string().describe('The ID of the user account creating the card'),
  amount: z.number().optional().default(0).describe('The monetary amount associated with the card'),
  attributes: z.record(z.any()).optional().describe('Additional attributes for the card'),
  closedAt: z.string().optional().describe('ISO date string for when the card was closed'),
  nextFollowUpAt: z.string().optional().describe('ISO date string for next follow-up'),
});

/**
 * Structured tool for creating a card in the system.
 * This tool enables agent-based invocation of card creation operations.
 */
export const createCardTool = new DynamicStructuredTool({
  name: 'create_card',
  description: 'Creates a new card in a specified lane with the given title, amount, and optional attributes. Returns the created card details as a JSON string.',
  schema: createCardSchema,
  func: async (input: z.infer<typeof createCardSchema>): Promise<string> => {
    try {
      // Validate and fetch the lane
      const lane = await EntityHelper.findOneById(Lane, input.laneId);
      
      if (!lane) {
        throw new EntityNotFoundError();
      }

      // Validate and fetch the user
      const user = await EntityHelper.findOneById(User, input.accountId);
      
      if (!user) {
        throw new EntityNotFoundError();
      }

      // Verify ownership
      if (!EntityHelper.isEntityOwnedBy(lane, user)) {
        throw new EntityNotFoundError();
      }

      // Create the new card
      const card = new NewCard(user, lane, input.cardTitle, input.amount || 0);

      // Set optional attributes
      if (input.attributes) {
        card.attributes = input.attributes;
      }

      if (input.closedAt) {
        card.closedAt = new Date(input.closedAt);
      }

      if (input.nextFollowUpAt) {
        card.nextFollowUpAt = new Date(input.nextFollowUpAt);
      }

      // Persist the card
      const createdCard = await EntityHelper.create(card, Card);

      // Emit events for real-time updates
      emitCardEvent(user, createdCard!.toPlain());
      emitLaneEvent(card.laneId, card.userId);
      emitBoardEvent(lane.boardId, card.userId);

      // Return the created card as JSON string
      return JSON.stringify(createdCard!.toPlain());
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create card: ${error.message}`);
      }
      throw new Error('Failed to create card: Unknown error');
    }
  },
});
