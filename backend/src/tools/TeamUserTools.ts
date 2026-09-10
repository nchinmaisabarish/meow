import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { validateAndFetchUser } from '../helpers/EntityFetchHelper.js';

/**
 * Schema for getting user information
 */
const getUserSchema = z.object({
  userId: z.string().describe('The ID of the user to retrieve'),
});

/**
 * Creates a structured tool for retrieving user information by ID
 */
export function getUserTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'get_user',
    description: 'Retrieves detailed information about a specific user by their ID. Returns user profile including name, status, animal, color, and other attributes.',
    schema: getUserSchema,
    func: async (input: z.infer<typeof getUserSchema>) => {
      try {
        const user: User = await validateAndFetchUser(input.userId, authenticatedUser);

        return JSON.stringify({
          success: true,
          user: user.toJSON(),
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}

/**
 * Schema for listing team members
 */
const listTeamMembersSchema = z.object({
  includeDeleted: z.boolean().optional().describe('Whether to include deleted users in the results'),
});

/**
 * Creates a structured tool for listing all team members
 */
export function listTeamMembersTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'list_team_members',
    description: 'Lists all members of the authenticated user\'s team. Returns an array of user profiles with their details.',
    schema: listTeamMembersSchema,
    func: async (input: z.infer<typeof listTeamMembersSchema>) => {
      try {
        const team = await EntityHelper.findOneById(Team, authenticatedUser.teamId);
        
        if (!team) {
          return JSON.stringify({
            success: false,
            error: 'Team not found',
          });
        }

        const users = await EntityHelper.findByTeam(User, team);

        let filteredUsers = users;
        
        if (!input.includeDeleted) {
          filteredUsers = users.filter((user: User) => user.status !== 'deleted');
        }

        return JSON.stringify({
          success: true,
          users: filteredUsers.map((user: User) => user.toJSON()),
          count: filteredUsers.length,
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}

/**
 * Schema for updating user profile
 */
const updateUserProfileSchema = z.object({
  userId: z.string().describe('The ID of the user to update'),
  animal: z.string().optional().describe('The animal avatar for the user'),
  color: z.string().optional().describe('The color theme for the user'),
});

/**
 * Creates a structured tool for updating user profile information
 */
export function updateUserProfileTool(authenticatedUser: User) {
  return new DynamicStructuredTool({
    name: 'update_user_profile',
    description: 'Updates a user\'s profile information such as their animal avatar and color theme. Only profile attributes can be updated, not status or authentication.',
    schema: updateUserProfileSchema,
    func: async (input: z.infer<typeof updateUserProfileSchema>) => {
      try {
        const user: User = await validateAndFetchUser(input.userId, authenticatedUser);

        if (input.animal) {
          user.animal = input.animal;
        }

        if (input.color) {
          user.color = input.color;
        }

        const updated = await EntityHelper.update(user);

        return JSON.stringify({
          success: true,
          user: updated.toJSON(),
        });
      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    },
  });
}
