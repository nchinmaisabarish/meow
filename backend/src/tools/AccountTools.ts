import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { Account } from '../entities/Account.js';
import { validateAndFetchAccount } from '../helpers/EntityFetchHelper.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { ObjectId } from 'mongodb';

/**
 * Tool for retrieving a specific account by ID
 */
export const getAccountTool = new DynamicStructuredTool({
  name: 'get_account',
  description: 'Retrieves a specific account (customer/company) by its ID. Use this when the user asks about a specific account or customer.',
  schema: z.object({
    accountId: z.string().describe('The ID of the account to retrieve'),
    userId: z.string().describe('The ID of the authenticated user'),
  }),
  func: async ({ accountId, userId }: { accountId: string; userId: string }): Promise<string> => {
    try {
      const user = await EntityHelper.findOneById(User, userId);
      if (!user) {
        return JSON.stringify({ error: 'User not found' });
      }

      const account = await validateAndFetchAccount(accountId, user);
      return JSON.stringify(account.toPlain());
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({ error: error.message });
      }
      return JSON.stringify({ error: 'Unknown error occurred' });
    }
  },
});

/**
 * Tool for listing all accounts for a team
 */
export const listAccountsTool = new DynamicStructuredTool({
  name: 'list_accounts',
  description: 'Lists all accounts (customers/companies) for the authenticated user\'s team. Use this when the user asks to see all accounts, customers, or companies.',
  schema: z.object({
    teamId: z.string().describe('The ID of the team'),
  }),
  func: async ({ teamId }: { teamId: string }): Promise<string> => {
    try {
      const team = await EntityHelper.findOneById(Team, teamId);
      if (!team) {
        return JSON.stringify({ error: 'Team not found' });
      }

      const accounts = await EntityHelper.findByTeam(Account, team);
      const plainAccounts = accounts.map((account: Account) => account.toPlain());
      
      return JSON.stringify({ accounts: plainAccounts, count: plainAccounts.length });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return JSON.stringify({ error: error.message });
      }
      return JSON.stringify({ error: 'Unknown error occurred' });
    }
  },
});

export const accountTools = [getAccountTool, listAccountsTool];
