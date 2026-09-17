import { StructuredToolInterface } from '@langchain/core/tools';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { getCardTools } from '../tools/CardTools.js';

/**
 * ToolRegistry provides a centralized way to collect and expose
 * all available tools for a given user and team context.
 */
export class ToolRegistry {
  private user: User;
  private team: Team;

  constructor(user: User, team: Team) {
    this.user = user;
    this.team = team;
  }

  /**
   * Get all available tools for the current user and team
   */
  getTools(): StructuredToolInterface[] {
    const tools: StructuredToolInterface[] = [
      ...getCardTools(this.user, this.team),
    ];

    return tools;
  }

  /**
   * Get tool schemas in a JSON-serializable format for API responses
   * This returns the tool definitions in a format that can be consumed
   * by agents or orchestration systems
   */
  getToolSchemas(): Array<{
    name: string;
    description: string;
    schema: any;
  }> {
    const tools = this.getTools();
    
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }));
  }
}
