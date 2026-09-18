import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Team, CurrencyCode, Integration } from '../entities/Team.js';
import { User } from '../entities/User.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';

// Zod schema for getting a team
const GetTeamSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the team information'),
  teamId: z.string().describe('The ID of the team to retrieve'),
});

// Zod schema for updating a team
const UpdateTeamSchema = z.object({
  userId: z.string().describe('The ID of the user performing the update'),
  teamId: z.string().describe('The ID of the team to update'),
  currency: z.enum(['USD', 'EUR', 'SEK']).optional().describe('The currency code for the team (ISO 4217)'),
});

// Zod schema for updating team integration
const UpdateTeamIntegrationSchema = z.object({
  userId: z.string().describe('The ID of the user performing the update'),
  teamId: z.string().describe('The ID of the team to update'),
  integrationKey: z.string().describe('The key identifying the integration (e.g., "slack", "zapier")'),
  integrationAttributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).describe('The attributes/configuration for the integration'),
});

/**
 * Tool for getting team information
 */
export const getTeamTool = new DynamicStructuredTool({
  name: 'get_team',
  description: 'Retrieves detailed information about a team including its name, currency, and configured integrations. Teams are the top-level organizational unit that contains users, boards, lanes, and cards.',
  schema: GetTeamSchema,
  func: async (input: z.infer<typeof GetTeamSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const team = await EntityHelper.findOneById(Team, input.teamId);
      if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
        throw new EntityNotFoundError();
      }

      // Filter integrations to only show keys (not sensitive data)
      const filteredIntegrations = team.integrations?.map((integration: Integration) => ({
        key: integration.key,
      })) || [];

      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
          integrations: filteredIntegrations,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
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
 * Tool for updating team information
 */
export const updateTeamTool = new DynamicStructuredTool({
  name: 'update_team',
  description: 'Updates team information such as the currency code. The currency affects how monetary amounts are displayed and formatted throughout the application.',
  schema: UpdateTeamSchema,
  func: async (input: z.infer<typeof UpdateTeamSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const team = await EntityHelper.findOneById(Team, input.teamId);
      if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
        throw new EntityNotFoundError();
      }

      if (input.currency !== undefined) {
        // Validate currency code
        if (!(input.currency in CurrencyCode)) {
          throw new InvalidRequestBodyError('invalid currency code');
        }
        team.currency = input.currency as CurrencyCode;
      }

      const updated = await EntityHelper.update(team);

      // Filter integrations to only show keys (not sensitive data)
      const filteredIntegrations = updated.integrations?.map((integration: Integration) => ({
        key: integration.key,
      })) || [];

      return JSON.stringify({
        success: true,
        team: {
          _id: updated._id.toString(),
          name: updated.name,
          currency: updated.currency,
          integrations: filteredIntegrations,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
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
 * Tool for updating team integrations
 */
export const updateTeamIntegrationTool = new DynamicStructuredTool({
  name: 'update_team_integration',
  description: 'Adds or updates an integration configuration for a team. Integrations allow the team to connect with external services. If an integration with the same key exists, it will be replaced.',
  schema: UpdateTeamIntegrationSchema,
  func: async (input: z.infer<typeof UpdateTeamIntegrationSchema>): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, input.userId);
      if (!user || user.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      const team = await EntityHelper.findOneById(Team, input.teamId);
      if (!team || !EntityHelper.isEntityOwnedBy(team, user)) {
        throw new EntityNotFoundError();
      }

      const integrations = team.integrations || [];

      // Remove existing integration with the same key
      const updatedIntegrations = integrations.filter(
        (integration: Integration) => integration.key !== input.integrationKey
      );

      // Add the new/updated integration
      updatedIntegrations.push({
        key: input.integrationKey,
        attributes: input.integrationAttributes,
      });

      team.integrations = updatedIntegrations;

      const updated = await EntityHelper.update(team);

      // Filter integrations to only show keys (not sensitive data)
      const filteredIntegrations = updated.integrations?.map((integration: Integration) => ({
        key: integration.key,
      })) || [];

      return JSON.stringify({
        success: true,
        team: {
          _id: updated._id.toString(),
          name: updated.name,
          currency: updated.currency,
          integrations: filteredIntegrations,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
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
