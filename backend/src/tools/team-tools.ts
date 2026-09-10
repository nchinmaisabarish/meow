import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { NewUser, User, UserStatus } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EntityNotFoundError } from '../errors/EntityNotFoundError.js';
import { validateAndFetchTeam } from '../helpers/EntityFetchHelper.js';

/**
 * Schema for adding a team member
 */
const addTeamMemberSchema = z.object({
  teamId: z.string().describe('The ID of the team to add the member to'),
  name: z.string().describe('The name of the new team member'),
  role: z.enum(['invited', 'enabled', 'disabled']).default('invited').describe('The role/status of the team member'),
  userId: z.string().describe('The ID of the authenticated user performing this action'),
});

/**
 * Schema for getting team info
 */
const getTeamInfoSchema = z.object({
  teamId: z.string().describe('The ID of the team to retrieve information for'),
  userId: z.string().describe('The ID of the authenticated user'),
});

/**
 * Schema for listing team members
 */
const listTeamMembersSchema = z.object({
  teamId: z.string().describe('The ID of the team to list members for'),
  userId: z.string().describe('The ID of the authenticated user'),
});

/**
 * Tool for adding a team member
 */
export const addTeamMemberTool = new DynamicStructuredTool({
  name: 'add_team_member',
  description: 'Adds a new member to a team. Use this to invite users to join a team or project.',
  schema: addTeamMemberSchema,
  func: async (input: z.infer<typeof addTeamMemberSchema>): Promise<string> => {
    try {
      // Fetch the authenticated user
      const authenticatedUser = await EntityHelper.findOneById(User, input.userId);
      if (!authenticatedUser || authenticatedUser.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch and validate the team
      const team = await validateAndFetchTeam(input.teamId, authenticatedUser);

      // Parse the role/status
      let status: UserStatus;
      switch (input.role) {
        case 'invited':
          status = UserStatus.Invited;
          break;
        case 'enabled':
          status = UserStatus.Enabled;
          break;
        case 'disabled':
          status = UserStatus.Disabled;
          break;
        default:
          status = UserStatus.Invited;
      }

      // Create the new user
      const newUser = new NewUser(team, input.name, status);

      // Generate invite code if status is invited
      if (status === UserStatus.Invited) {
        const characters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          const randomIndex = Math.floor(Math.random() * characters.length);
          code += characters[randomIndex];
        }
        newUser.invite = code;
      }

      const createdUser = await EntityHelper.create(newUser, User);

      return JSON.stringify({
        success: true,
        userId: createdUser!._id.toString(),
        message: `Team member "${input.name}" added successfully to team ${team.name}`,
        user: {
          _id: createdUser!._id.toString(),
          name: createdUser!.name,
          status: createdUser!.status,
          teamId: createdUser!.teamId.toString(),
          invite: createdUser!.invite,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add team member',
      });
    }
  },
});

/**
 * Tool for getting team information
 */
export const getTeamInfoTool = new DynamicStructuredTool({
  name: 'get_team_info',
  description: 'Retrieves detailed information about a team. Use this to view team settings, currency, and integrations.',
  schema: getTeamInfoSchema,
  func: async (input: z.infer<typeof getTeamInfoSchema>): Promise<string> => {
    try {
      // Fetch the authenticated user
      const authenticatedUser = await EntityHelper.findOneById(User, input.userId);
      if (!authenticatedUser || authenticatedUser.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch and validate the team
      const team = await validateAndFetchTeam(input.teamId, authenticatedUser);

      return JSON.stringify({
        success: true,
        team: {
          _id: team._id.toString(),
          name: team.name,
          currency: team.currency,
          integrations: team.integrations?.map((integration) => ({ key: integration.key })) || [],
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve team information',
      });
    }
  },
});

/**
 * Tool for listing team members
 */
export const listTeamMembersTool = new DynamicStructuredTool({
  name: 'list_team_members',
  description: 'Lists all members of a team. Use this to view all users who are part of a team.',
  schema: listTeamMembersSchema,
  func: async (input: z.infer<typeof listTeamMembersSchema>): Promise<string> => {
    try {
      // Fetch the authenticated user
      const authenticatedUser = await EntityHelper.findOneById(User, input.userId);
      if (!authenticatedUser || authenticatedUser.teamId.toString() !== input.teamId) {
        throw new EntityNotFoundError();
      }

      // Fetch and validate the team
      const team = await validateAndFetchTeam(input.teamId, authenticatedUser);

      // Fetch all users in the team
      const users = await EntityHelper.findByTeam(User, team);

      const usersData = users.map((user: User) => ({
        _id: user._id.toString(),
        name: user.name,
        status: user.status,
        teamId: user.teamId.toString(),
        animal: user.animal,
        color: user.color,
        locale: user.locale,
        lastLoginAt: user.lastLoginAt,
      }));

      return JSON.stringify({
        success: true,
        count: usersData.length,
        members: usersData,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list team members',
      });
    }
  },
});

/**
 * Registry of all team-related tools
 */
export const teamTools = {
  addTeamMember: addTeamMemberTool,
  getTeamInfo: getTeamInfoTool,
  listTeamMembers: listTeamMembersTool,
};

/**
 * Array of all team tools for easy iteration
 */
export const teamToolsArray = [addTeamMemberTool, getTeamInfoTool, listTeamMembersTool];
