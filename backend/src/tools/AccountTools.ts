import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Account } from '../entities/Account.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';

/**
 * Tool for fetching accounts from the database
 */
export function createFetchAccountsTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'fetch_accounts',
    description: 'Fetch accounts (companies/customers) from the database. Use this when the user wants to see their accounts, companies, or customers.',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of accounts to return'),
    }),
    func: async (input: { limit?: number }): Promise<string> => {
      try {
        const accounts = await EntityHelper.findByTeam(Account, team);

        if (!accounts || accounts.length === 0) {
          return 'No accounts found.';
        }

        let accountList = accounts;
        if (input.limit && input.limit > 0) {
          accountList = accounts.slice(0, input.limit);
        }

        const accountSummaries = accountList.map((account: Account) => ({
          id: account._id.toString(),
          name: account.name,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        }));

        return JSON.stringify({
          count: accountList.length,
          total: accounts.length,
          accounts: accountSummaries,
        });
      } catch (error) {
        return `Error fetching accounts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });
}

/**
 * Tool for getting a specific account by ID
 */
export function createGetAccountTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_account',
    description: 'Get details of a specific account by its ID. Use this when the user asks about a specific account, company, or customer.',
    schema: z.object({
      accountId: z.string().describe('The ID of the account to retrieve'),
    }),
    func: async (input: { accountId: string }): Promise<string> => {
      try {
        const account = await EntityHelper.findOneById(Account, input.accountId);

        if (!account) {
          return `Account with ID ${input.accountId} not found.`;
        }

        // Verify ownership
        if (account.teamId.toString() !== team._id.toString()) {
          return 'Account not found or access denied.';
        }

        return JSON.stringify({
          id: account._id.toString(),
          name: account.name,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          attributes: account.attributes,
          references: account.references,
        });
      } catch (error) {
        return `Error fetching account: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });
}
