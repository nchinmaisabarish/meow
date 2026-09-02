import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { LLMHelper } from '../helpers/LLMHelper.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { Card, CardStatus } from '../entities/Card.js';
import { Lane } from '../entities/Lane.js';
import { Account } from '../entities/Account.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';
import { DateTime } from 'luxon';
import { ObjectId } from 'mongodb';

const query = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query: userQuery } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      throw new InvalidRequestBodyError('Query field is required and must be a string');
    }

    const intent = await LLMHelper.processNaturalLanguageQuery(userQuery);

    if (intent.intent === 'unknown') {
      return res.json({
        intent: intent.intent,
        explanation: intent.explanation,
        data: null,
      });
    }

    let data: any = null;

    switch (intent.intent) {
      case 'list_cards': {
        const query: any = {
          teamId: { $eq: req.jwt.team._id },
          status: { $ne: CardStatus.Deleted },
        };

        if (intent.filters.laneName) {
          const lane = await EntityHelper.findOneBy(Lane, {
            teamId: req.jwt.team._id,
            name: intent.filters.laneName,
          });

          if (lane) {
            query.laneId = { $eq: lane._id };
          }
        }

        if (intent.filters.laneId && ObjectId.isValid(intent.filters.laneId)) {
          query.laneId = { $eq: new ObjectId(intent.filters.laneId) };
        }

        if (intent.filters.status) {
          query.status = { $eq: intent.filters.status };
        }

        if (intent.filters.userId && ObjectId.isValid(intent.filters.userId)) {
          query.userId = { $eq: new ObjectId(intent.filters.userId) };
        }

        if (intent.filters.maxDaysAgo) {
          const limit = DateTime.utc()
            .startOf('day')
            .minus({ days: intent.filters.maxDaysAgo });
          query.$or = [
            { closedAt: { $exists: false } },
            { closedAt: { $gte: limit.toJSDate() } },
          ];
        }

        data = await EntityHelper.findBy(Card, query);
        break;
      }

      case 'list_lanes': {
        data = await EntityHelper.findByTeam(Lane, req.jwt.team);
        break;
      }

      case 'list_accounts': {
        data = await EntityHelper.findByTeam(Account, req.jwt.team);
        break;
      }

      case 'get_card': {
        if (intent.filters.laneId && ObjectId.isValid(intent.filters.laneId)) {
          const card = await EntityHelper.findOneById(Card, intent.filters.laneId);
          if (card && EntityHelper.isEntityOwnedBy(card, req.jwt.user)) {
            data = card;
          }
        }
        break;
      }

      case 'get_lane': {
        if (intent.filters.laneId && ObjectId.isValid(intent.filters.laneId)) {
          const lane = await EntityHelper.findOneById(Lane, intent.filters.laneId);
          if (lane && EntityHelper.isEntityOwnedBy(lane, req.jwt.user)) {
            data = lane;
          }
        }
        break;
      }

      case 'get_account': {
        if (intent.filters.laneId && ObjectId.isValid(intent.filters.laneId)) {
          const account = await EntityHelper.findOneById(Account, intent.filters.laneId);
          if (account && EntityHelper.isEntityOwnedBy(account, req.jwt.user)) {
            data = account;
          }
        }
        break;
      }

      default:
        break;
    }

    return res.json({
      intent: intent.intent,
      explanation: intent.explanation,
      data: data,
    });
  } catch (error) {
    return next(error);
  }
};

export const NaturalLanguageController = {
  query,
};
