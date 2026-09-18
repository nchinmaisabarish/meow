import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Card, CardStatus, NewCard } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { User } from '../entities/User.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { RequestParser } from '../helpers/RequestParser.js';
import { emitBoardEvent, emitCardEvent, emitLaneEvent } from '../helpers/EventHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { ObjectId } from 'mongodb';

// Zod schema for creating a card
const CreateCardSchema = z.object({
  userId: z.string().describe('The ID of the user creating the card'),
  teamId: z.string().describe('The ID of the team'),
  laneId: z.string().optional().describe('The ID of the lane to place the card in'),
  laneName: z.string().optional().describe('The name of the lane to place the card in'),
  name: z.string().describe('The name/title of the card'),
  amount: z.number().describe('The monetary amount associated with the card'),
  attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Additional attributes for the card'),
  closedAt: z.string().optional().describe('ISO date string for when the card was closed'),
  nextFollowUpAt: z.string().optional().describe('ISO date string for the next follow-up date'),
});

// Zod schema for updating a card
const UpdateCardSchema = z.object({
  cardId: z.string().describe('The ID of the card to update'),
  userId: z.string().describe('The ID of the user performing the update'),
  teamId: z.string().describe('The ID of the team'),
  name: z.string().optional().describe('The new name/title of the card'),
  amount: z.number().optional().describe('The new monetary amount'),
  laneId: z.string().optional().describe('The ID of the lane to move the card to'),
  assignedUserId: z.string().optional().describe('The ID of the user to assign the card to'),
  attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Updated attributes for the card'),
  status: z.enum(['active', 'deleted', 'archived']).optional().describe('The status of the card'),
  closedAt: z.string().optional().describe('ISO date string for when the card was closed'),
  nextFollowUpAt: z.string().optional().describe('ISO date string for the next follow-up date'),
});

// Zod schema for deleting a card
const DeleteCardSchema = z.object({
  cardId: z.string().describe('The ID of the card to delete'),
  userId: z.string().describe('The ID of the user performing the deletion'),
  teamId: z.string().describe('The ID of the team'),
});

// Zod schema for getting a card
const GetCardSchema = z.object({
  cardId: z.string().describe('The ID of the card to retrieve'),
  userId: z.string().describe('The ID of the user requesting the card'),
  teamId: z.string().describe('The ID of the team'),
});

// Zod schema for listing cards
const ListCardsSchema = z.object({
  teamId: z.string().describe('The ID of the team'),
  maxDaysAgo: z.number().optional().describe('Maximum number of days ago to include cards from'),
  start: z.string().optional().describe('ISO date string for the start of the date range'),
  end: z.string().optional().describe('ISO date string for the end of the date range'),
});

/**
 * Tool for creating a new card
 */
export const createCardTool = new DynamicStructuredTool({
  name: 'create_card',
  description: 'Creates a new card in the sales pipeline. A card represents a sales opportunity or deal. You must specify either laneId or laneName to place the card in a specific stage of the pipeline.',
  schema: CreateCardSchema,
  func: async (input: z.infer<typeof CreateCardSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      let lane: Lane | null = null;

      if (input.laneName) {
        const query = {
          teamId: new ObjectId(input.teamId),
          name: input.laneName,
        };
        lane = await EntityHelper.findOneBy(Lane, query);
      }

      if (input.laneId) {
        lane = await EntityHelper.findOneById(Lane, input.laneId);
      }

      if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
        throw new EntityNotFoundError();
      }

      const card = new NewCard(user, lane, input.name, input.amount);

      if (input.attributes) {
        card.attributes = input.attributes;
      }

      if (input.closedAt && RequestParser.isValidDateTimeString(input.closedAt)) {
        card.closedAt = RequestParser.toJsDate(input.closedAt);
      }

      if (input.nextFollowUpAt && RequestParser.isValidDateTimeString(input.nextFollowUpAt)) {
        card.nextFollowUpAt = RequestParser.toJsDate(input.nextFollowUpAt);
      }

      const latest = await EntityHelper.create(card, Card);

      emitCardEvent(user, latest!.toPlain());
      emitLaneEvent(card.laneId, card.userId);
      emitBoardEvent(lane.boardId, card.userId);

      return JSON.stringify({
        success: true,
        card: latest!.toPlain(),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for updating an existing card
 */
export const updateCardTool = new DynamicStructuredTool({
  name: 'update_card',
  description: 'Updates an existing card in the sales pipeline. You can change the card name, amount, lane (stage), assigned user, attributes, status, and dates. Moving a card to a different lane represents moving it to a different stage in the sales process.',
  schema: UpdateCardSchema,
  func: async (input: z.infer<typeof UpdateCardSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const card = await EntityHelper.findOneById(Card, input.cardId);
      if (!card || !EntityHelper.isEntityOwnedBy(card, user)) {
        throw new EntityNotFoundError();
      }

      const previous = card.toPlain();

      if (input.name !== undefined) {
        card.name = input.name;
      }

      let previousUserId: ObjectId | undefined = undefined;

      if (input.assignedUserId && card.userId.toString() !== input.assignedUserId.toString()) {
        const assignedUser = await EntityHelper.findOneById(User, input.assignedUserId);
        if (!assignedUser || !EntityHelper.isEntityOwnedBy(assignedUser, user)) {
          throw new EntityNotFoundError();
        }
        previousUserId = card.userId;
        card.userId = assignedUser._id!;
      }

      if (input.attributes !== undefined) {
        card.attributes = input.attributes;
      }

      let previousAmount: number | undefined = undefined;

      if (input.amount !== undefined && card.amount !== input.amount) {
        previousAmount = card.amount;
        card.amount = input.amount;
      }

      if (input.status) {
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
      }

      if (input.closedAt && !RequestParser.isEqualDates(input.closedAt, card.closedAt)) {
        card.closedAt = RequestParser.toJsDate(input.closedAt);
      }

      if (input.nextFollowUpAt && !RequestParser.isEqualDates(input.nextFollowUpAt, card.nextFollowUpAt)) {
        card.nextFollowUpAt = RequestParser.toJsDate(input.nextFollowUpAt);
      }

      let previousLaneId: ObjectId | undefined = undefined;

      if (input.laneId) {
        const lane = await EntityHelper.findOneById(Lane, input.laneId);
        if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
          throw new EntityNotFoundError();
        }

        if (input.laneId.toString() !== card.laneId.toString()) {
          previousLaneId = card.laneId;
          card.inLaneSince = new Date();
        }

        card.laneId = lane._id!;
      }

      const latest = await EntityHelper.update(card);

      // Emit events
      if (previousLaneId) {
        emitLaneEvent(previousLaneId, card.userId);
        emitLaneEvent(card.laneId, card.userId);
      }

      if (previousAmount !== undefined) {
        emitLaneEvent(card.laneId, card.userId);
      }

      const lane = await EntityHelper.findOneById(Lane, card.laneId);

      if (previousUserId) {
        emitLaneEvent(card.laneId, previousUserId);
        emitLaneEvent(card.laneId, card.userId);
        emitBoardEvent(lane!.boardId, previousUserId);
      }

      emitCardEvent(user, latest.toPlain(), previous);
      emitBoardEvent(lane!.boardId, card.userId);

      return JSON.stringify({
        success: true,
        card: latest.toPlain(),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for deleting a card
 */
export const deleteCardTool = new DynamicStructuredTool({
  name: 'delete_card',
  description: 'Deletes a card from the sales pipeline by setting its status to deleted. This is a soft delete operation.',
  schema: DeleteCardSchema,
  func: async (input: z.infer<typeof DeleteCardSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const card = await EntityHelper.findOneById(Card, input.cardId);
      if (!card || !EntityHelper.isEntityOwnedBy(card, user)) {
        throw new EntityNotFoundError();
      }

      const previous = card.toPlain();
      card.status = CardStatus.Deleted;

      const latest = await EntityHelper.update(card);

      const lane = await EntityHelper.findOneById(Lane, card.laneId);

      emitCardEvent(user, latest.toPlain(), previous);
      emitLaneEvent(card.laneId, card.userId);
      emitBoardEvent(lane!.boardId, card.userId);

      return JSON.stringify({
        success: true,
        message: 'Card deleted successfully',
        cardId: input.cardId,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for getting a single card
 */
export const getCardTool = new DynamicStructuredTool({
  name: 'get_card',
  description: 'Retrieves detailed information about a specific card by its ID.',
  schema: GetCardSchema,
  func: async (input: z.infer<typeof GetCardSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const card = await EntityHelper.findOneById(Card, input.cardId);
      if (!card || !EntityHelper.isEntityOwnedBy(card, user)) {
        throw new EntityNotFoundError();
      }

      return JSON.stringify({
        success: true,
        card: card.toPlain(),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});

/**
 * Tool for listing cards
 */
export const listCardsTool = new DynamicStructuredTool({
  name: 'list_cards',
  description: 'Lists all active cards for a team. Can optionally filter by date range or maximum days ago.',
  schema: ListCardsSchema,
  func: async (input: z.infer<typeof ListCardsSchema>): Promise<string> => {
    try {
      const query: any = {
        teamId: { $eq: new ObjectId(input.teamId) },
        status: { $ne: CardStatus.Deleted },
      };

      if (input.start && input.end) {
        const startDate = new Date(input.start);
        const endDate = new Date(input.end);
        endDate.setHours(23, 59, 59, 999);
        query.closedAt = { $gte: startDate, $lte: endDate };
      }

      if (input.maxDaysAgo) {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - input.maxDaysAgo);
        limitDate.setHours(0, 0, 0, 0);
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
      if (error instanceof Error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
      return JSON.stringify({
        success: false,
        error: 'Unknown error occurred',
      });
    }
  },
});
