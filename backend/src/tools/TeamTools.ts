import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { TeamController } from '../controllers/TeamController.js';

/**
 * Tool for creating a new team.
 * Creates a team with the specified name and currency.
 */
export const createTeamTool = new DynamicStructuredTool({
  name: 'create_team',
  description:
    'Create a new team in the system. A team is an organization or workspace that contains users, accounts, boards, and other resources. Returns the created team with its ID.',
  schema: z.object({
    name: z.string().describe('The name of the team (e.g., "Sales Team", "ACME Inc")'),
    currency: z
      .enum(['USD', 'EUR', 'SEK'])
      .describe('The currency code for the team (ISO 4217 format)'),
    isFirstTeam: z
      .boolean()
      .optional()
      .describe('Optional: Whether this is the first team in the system'),
  }),
  func: async (input: { name: string; currency: string; isFirstTeam?: boolean }) => {
    try {
      const team = await TeamController.createTeamStatic(input);
      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
          integrations: team.integrations ?? [],
          isFirstTeam: team.isFirstTeam,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
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
 * Tool for updating an existing team.
 * Updates team properties such as currency.
 */
export const updateTeamTool = new DynamicStructuredTool({
  name: 'update_team',
  description:
    'Update an existing team in the system. Can update the currency setting. Returns the updated team.',
  schema: z.object({
    teamId: z.string().describe('The ID of the team to update'),
    userId: z.string().describe('The ID of the user performing the update'),
    currency: z
      .enum(['USD', 'EUR', 'SEK'])
      .describe('The updated currency code for the team (ISO 4217 format)'),
  }),
  func: async (input: { teamId: string; userId: string; currency: string }) => {
    try {
      const team = await TeamController.updateTeamStatic(input);
      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
          integrations: team.integrations ?? [],
          isFirstTeam: team.isFirstTeam,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
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
 * Tool for deleting a team.
 * Removes a team from the system (hard delete).
 */
export const deleteTeamTool = new DynamicStructuredTool({
  name: 'delete_team',
  description:
    'Delete a team from the system. This performs a hard delete and removes the team permanently. Note: This may affect all users, accounts, and resources associated with this team. Returns the deleted team.',
  schema: z.object({
    teamId: z.string().describe('The ID of the team to delete'),
    userId: z.string().describe('The ID of the user performing the deletion'),
  }),
  func: async (input: { teamId: string; userId: string }) => {
    try {
      const team = await TeamController.deleteTeamStatic(input);
      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
          integrations: team.integrations ?? [],
          isFirstTeam: team.isFirstTeam,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
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
 * Tool for retrieving a team by its ID.
 * Fetches the full details of a specific team.
 */
export const getTeamTool = new DynamicStructuredTool({
  name: 'get_team',
  description:
    'Retrieve a team by its ID. Returns the full details of the team including name, currency, and integrations. Validates that the user has access to the team.',
  schema: z.object({
    teamId: z.string().describe('The ID of the team to retrieve'),
    userId: z.string().describe('The ID of the user requesting the team'),
  }),
  func: async (input: { teamId: string; userId: string }) => {
    try {
      const team = await TeamController.getTeamStatic(input);
      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
          integrations: team.integrations ?? [],
          isFirstTeam: team.isFirstTeam,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
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
