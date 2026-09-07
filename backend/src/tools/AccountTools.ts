import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AccountController } from '../controllers/AccountController.js';
import { AccountEventController } from '../controllers/AccountEventController.js';

/**
 * Tool for creating a new account.
 * Creates an account with the specified name and optional attributes.
 */
export const createAccountTool = new DynamicStructuredTool({
  name: 'create_account',
  description:
    'Create a new account in the system. An account represents a customer, company, or organization that can be associated with cards and opportunities. Returns the created account with its ID.',
  schema: z.object({
    userId: z.string().describe('The ID of the user creating the account'),
    teamId: z.string().describe('The ID of the team the account belongs to'),
    name: z.string().describe('The name of the account (e.g., "Acme Corporation")'),
    attributes: z
      .record(z.union([z.string(), z.number(), z.null()]))
      .optional()
      .describe('Optional custom attributes for the account'),
  }),
  func: async (input: {
    userId: string;
    teamId: string;
    name: string;
    attributes?: { [key: string]: string | number | null };
  }) => {
    try {
      const account = await AccountController.createAccountStatic(input);
      return JSON.stringify({
        success: true,
        account: account.toPlain(),
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
 * Tool for updating an existing account.
 * Updates account properties such as name and attributes.
 */
export const updateAccountTool = new DynamicStructuredTool({
  name: 'update_account',
  description:
    'Update an existing account in the system. Can update the name and custom attributes. Returns the updated account.',
  schema: z.object({
    accountId: z.string().describe('The ID of the account to update'),
    userId: z.string().describe('The ID of the user performing the update'),
    name: z.string().describe('The updated name of the account'),
    attributes: z
      .record(z.union([z.string(), z.number(), z.null()]))
      .optional()
      .describe('Optional: Updated custom attributes'),
  }),
  func: async (input: {
    accountId: string;
    userId: string;
    name: string;
    attributes?: { [key: string]: string | number | null };
  }) => {
    try {
      const account = await AccountController.updateAccountStatic(input);
      return JSON.stringify({
        success: true,
        account: account.toPlain(),
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
 * Tool for deleting an account.
 * Removes an account from the system (hard delete).
 */
export const deleteAccountTool = new DynamicStructuredTool({
  name: 'delete_account',
  description:
    'Delete an account from the system. This performs a hard delete and removes the account permanently. Returns the deleted account.',
  schema: z.object({
    accountId: z.string().describe('The ID of the account to delete'),
    userId: z.string().describe('The ID of the user performing the deletion'),
  }),
  func: async (input: { accountId: string; userId: string }) => {
    try {
      const account = await AccountController.deleteAccountStatic(input);
      return JSON.stringify({
        success: true,
        account: account.toPlain(),
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
 * Tool for retrieving account events.
 * Fetches the event history for a specific account.
 */
export const getAccountEventsTool = new DynamicStructuredTool({
  name: 'get_account_events',
  description:
    'Retrieve the event history for an account. Returns a list of events including comments, updates, and other activities associated with the account. Events are sorted by most recent first.',
  schema: z.object({
    accountId: z.string().describe('The ID of the account to get events for'),
    userId: z.string().describe('The ID of the user requesting the events'),
    teamId: z.string().describe('The ID of the team the account belongs to'),
  }),
  func: async (input: { accountId: string; userId: string; teamId: string }) => {
    try {
      const events = await AccountEventController.getAccountEventsStatic(input);
      return JSON.stringify({
        success: true,
        events: events.map((event) => ({
          _id: event._id.toString(),
          teamId: event.teamId.toString(),
          accountId: event.accountId.toString(),
          userId: event.userId.toString(),
          type: event.type,
          body: event.body,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        })),
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
