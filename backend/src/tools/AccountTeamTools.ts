import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AccountController } from '../controllers/AccountController.js';
import { TeamController } from '../controllers/TeamController.js';
import { UserController } from '../controllers/UserController.js';

/**
 * Input schema for the createAccount tool
 */
const createAccountSchema = z.object({
  teamId: z.string().describe('The ID of the team that owns the account'),
  name: z.string().describe('The name of the account/customer'),
  attributes: z.record(z.union([z.string(), z.number(), z.null()])).optional().describe('Optional custom attributes for the account'),
});

/**
 * Input schema for the addUserToTeam tool
 */
const addUserToTeamSchema = z.object({
  teamId: z.string().describe('The ID of the team to add the user to'),
  name: z.string().describe('The name of the new user'),
});

/**
 * Input schema for the updateTeamSettings tool
 */
const updateTeamSettingsSchema = z.object({
  teamId: z.string().describe('The ID of the team to update'),
  currency: z.enum(['USD', 'EUR', 'SEK']).describe('The currency code for the team (ISO 4217)'),
});

/**
 * LangChain structured tool for creating accounts
 */
export const createAccountTool = new DynamicStructuredTool({
  name: 'create_account',
  description: 'Creates a new account (customer/company) in the system. Accounts represent customers or companies that you do business with. You can optionally set custom attributes to store additional information about the account.',
  schema: createAccountSchema,
  func: async (input: z.infer<typeof createAccountSchema>): Promise<string> => {
    try {
      const account = await AccountController.createAccountFromTool(input);
      const plainAccount = account.toPlain();
      return JSON.stringify({
        success: true,
        account: plainAccount,
        message: `Account "${plainAccount.name}" created successfully with ID ${plainAccount._id}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to create account: ${errorMessage}`,
      });
    }
  },
});

/**
 * LangChain structured tool for adding users to teams
 */
export const addUserToTeamTool = new DynamicStructuredTool({
  name: 'add_user_to_team',
  description: 'Adds a new user to a team. The user will be created with an invited status and will receive an invite code. This is useful for onboarding new team members or sales representatives.',
  schema: addUserToTeamSchema,
  func: async (input: z.infer<typeof addUserToTeamSchema>): Promise<string> => {
    try {
      const user = await UserController.addUserToTeamFromTool(input);
      return JSON.stringify({
        success: true,
        user: {
          _id: user._id.toString(),
          name: user.name,
          status: user.status,
          invite: user.invite,
        },
        message: `User "${user.name}" added to team successfully with ID ${user._id.toString()}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to add user to team: ${errorMessage}`,
      });
    }
  },
});

/**
 * LangChain structured tool for updating team settings
 */
export const updateTeamSettingsTool = new DynamicStructuredTool({
  name: 'update_team_settings',
  description: 'Updates team settings, specifically the currency code used for financial calculations and forecasts. The currency affects how monetary amounts are displayed and calculated throughout the system.',
  schema: updateTeamSettingsSchema,
  func: async (input: z.infer<typeof updateTeamSettingsSchema>): Promise<string> => {
    try {
      const team = await TeamController.updateTeamSettingsFromTool(input);
      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
        },
        message: `Team settings updated successfully. Currency set to ${team.currency}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        success: false,
        error: errorMessage,
        message: `Failed to update team settings: ${errorMessage}`,
      });
    }
  },
});
