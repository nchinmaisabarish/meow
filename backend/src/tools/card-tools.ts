import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Card, NewCard } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { validateAndFetchCard, validateAndFetchLane } from '../helpers/EntityFetchHelper.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';

/**
 * Schema for creating a new card
 */
const createCardSchema = z.object({
  title: z.string().describe('The title/name of the card'),
  description: z.string().optional().describe('Optional description for the card'),
  laneId: z.string().describe('The ID of the lane where the card should be created'),
  amount: z.number().default(0).describe('The monetary amount associated with the card'),
  userId: z.string().describe('The ID of the user creating the card'),
  teamId: z.string().describe('The ID of the team the card belongs to'),
});

/**
 * Schema for retrieving card details
 */
const getCardSchema = z.object({
  cardId: z.string().describe('The ID of the card to retrieve'),
  userId: z.string().describe('The ID of the authenticated user'),
  teamId: z.string().describe('The ID of the team the user belongs to'),
});

/**
 * Schema for updating card status (moving to a different lane)
 */
const updateCardStatusSchema = z.object({
  cardId: z.string().describe('The ID of the card to update'),
  newLaneId: z.string().describe('The ID of the lane to move the card to'),
  userId: z.string().describe('The ID of the authenticated user'),
  teamId: z.string().describe('The ID of the team the user belongs to'),
});

/**
 * Tool for creating a new card
 */
export const createCardTool = new DynamicStructuredTool({
  name: 'create_card',
  description: 'Creates a new card in the specified lane. Use this to add new opportunities, deals, or tasks to the sales pipeline.',
  schema: createCardSchema,
  func: async (input: z.infer<typeof createCardSchema>): Promise<string> => {
    try {
      // Fetch the user
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch the lane
      const lane = await EntityHelper.findOneById(Lane, input.laneId);
      if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
        throw new EntityNotFoundError();
      }

      // Create the card
      const card = new NewCard(user, lane, input.title, input.amount);

      const createdCard = await EntityHelper.create(card, Card);

      // Emit events
      emitCardEvent(user, createdCard!.toPlain());
      emitLaneEvent(card.laneId, card.userId);
      emitBoardEvent(lane.boardId, card.userId);

      return JSON.stringify({
        success: true,
        cardId: createdCard!._id.toString(),
        message: `Card "${input.title}" created successfully in lane ${lane.name}`,
        card: createdCard!.toPlain(),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create card',
      });
    }
  },
});

/**
 * Tool for retrieving card details
 */
export const getCardTool = new DynamicStructuredTool({
  name: 'get_card',
  description: 'Retrieves detailed information about a specific card by its ID. Use this to view card details, status, and attributes.',
  schema: getCardSchema,
  func: async (input: z.infer<typeof getCardSchema>): Promise<string> => {
    try {
      // Fetch the user
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch and validate the card
      const card = await validateAndFetchCard(input.cardId, user);

      return JSON.stringify({
        success: true,
        card: card.toPlain(),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve card',
      });
    }
  },
});

/**
 * Tool for updating card status by moving it to a different lane
 */
export const updateCardStatusTool = new DynamicStructuredTool({
  name: 'update_card_status',
  description: 'Updates a card status by moving it to a different lane. Use this to progress deals through the sales pipeline or change card status.',
  schema: updateCardStatusSchema,
  func: async (input: z.infer<typeof updateCardStatusSchema>): Promise<string> => {
    try {
      // Fetch the user
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch and validate the card
      const card = await validateAndFetchCard(input.cardId, user);

      // Store previous state
      const previousLaneId = card.laneId;
      const previous = card.toPlain();

      // Fetch and validate the new lane
      const newLane = await validateAndFetchLane(input.newLaneId, user);

      // Update the card
      if (input.newLaneId !== card.laneId.toString()) {
        card.laneId = newLane._id!;
        card.inLaneSince = new Date();
      }

      const updatedCard = await EntityHelper.update(card);

      // Emit events for both lanes if lane changed
      if (previousLaneId.toString() !== card.laneId.toString()) {
        emitLaneEvent(previousLaneId, card.userId);
        emitLaneEvent(card.laneId, card.userId);
      }

      emitCardEvent(user, updatedCard.toPlain(), previous);
      emitBoardEvent(newLane.boardId, card.userId);

      return JSON.stringify({
        success: true,
        message: `Card moved to lane ${newLane.name}`,
        card: updatedCard.toPlain(),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update card status',
      });
    }
  },
});

/**
 * Registry of all card-related tools
 */
export const cardTools = {
  createCard: createCardTool,
  getCard: getCardTool,
  updateCardStatus: updateCardStatusTool,
};

/**
 * Array of all card tools for easy iteration
 */
export const cardToolsArray = [createCardTool, getCardTool, updateCardStatusTool];
