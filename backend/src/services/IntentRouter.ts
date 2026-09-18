import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor } from 'langchain/agents';
import { createOpenAIToolsAgent } from 'langchain/agents';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { InvalidRequestError } from '../errors/InvalidRequestError.js';
import { log } from '../worker.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for the system prompt
let systemPromptCache: string | null = null;

/**
 * Load the intent system prompt from file
 */
const getSystemPrompt = (): string => {
  if (!systemPromptCache) {
    try {
      const promptPath = join(__dirname, '..', 'prompts', 'intent-system.txt');
      systemPromptCache = readFileSync(promptPath, 'utf-8');
    } catch (error: unknown) {
      log.error('Failed to load intent system prompt:', error);
      throw new InvalidRequestError('Failed to load agent configuration.');
    }
  }
  return systemPromptCache;
};

/**
 * Create a ChatOpenAI instance for the agent
 */
const createLLM = (): ChatOpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new InvalidRequestError(
      'OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.'
    );
  }

  return new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0,
    openAIApiKey: apiKey,
  });
};

/**
 * Create the agent prompt template
 */
const createPromptTemplate = (): ChatPromptTemplate => {
  const systemPrompt = getSystemPrompt();

  return ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['system', 'Current user: {userName} (ID: {userId})\nTeam: {teamName} (ID: {teamId})\nCurrency: {currency}'],
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);
};

/**
 * Interface for agent execution input
 */
export interface AgentExecutionInput {
  input: string;
  user: User;
  team: Team;
}

/**
 * Interface for agent execution result
 */
export interface AgentExecutionResult {
  output: string;
  intermediateSteps?: Array<{
    action: string;
    observation: string;
  }>;
}

/**
 * IntentRouter service that uses a LangChain agent executor to parse
 * user requests and dynamically invoke the appropriate tools.
 */
export class IntentRouter {
  private agentExecutor: AgentExecutor | null = null;

  /**
   * Initialize the agent executor with tools and LLM
   */
  private async initializeAgent(): Promise<AgentExecutor> {
    if (this.agentExecutor) {
      return this.agentExecutor;
    }

    try {
      const llm = createLLM();
      const tools = ToolRegistry.getAllTools();
      const prompt = createPromptTemplate();

      // Create the agent
      const agent = await createOpenAIToolsAgent({
        llm,
        tools,
        prompt,
      });

      // Create the executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        returnIntermediateSteps: true,
        maxIterations: 10,
        handleParsingErrors: true,
      });

      log.info('Agent executor initialized successfully');
      return this.agentExecutor;
    } catch (error: unknown) {
      log.error('Failed to initialize agent executor:', error);
      throw new InvalidRequestError('Failed to initialize intent routing agent.');
    }
  }

  /**
   * Execute a user request through the agent
   */
  async execute(executionInput: AgentExecutionInput): Promise<AgentExecutionResult> {
    try {
      const executor = await this.initializeAgent();

      // Prepare the input with user and team context
      const input = {
        input: executionInput.input,
        userId: executionInput.user._id!.toString(),
        teamId: executionInput.team._id!.toString(),
        userName: executionInput.user.name,
        teamName: executionInput.team.name,
        currency: executionInput.team.currency,
      };

      log.info('Executing agent with input:', { input: executionInput.input });

      // Execute the agent
      const result = await executor.invoke(input);

      log.info('Agent execution completed:', { output: result.output });

      // Format the result
      const formattedResult: AgentExecutionResult = {
        output: result.output,
      };

      // Include intermediate steps if available
      if (result.intermediateSteps && Array.isArray(result.intermediateSteps)) {
        formattedResult.intermediateSteps = result.intermediateSteps.map((step: any) => ({
          action: step.action?.tool || 'unknown',
          observation: step.observation || '',
        }));
      }

      return formattedResult;
    } catch (error: unknown) {
      log.error('Agent execution failed:', error);

      // Handle specific error types
      if (error instanceof InvalidRequestError) {
        throw error;
      }

      // Generic error handling
      if (error instanceof Error) {
        throw new InvalidRequestError(
          `Failed to process request: ${error.message}`
        );
      }

      throw new InvalidRequestError('An unexpected error occurred while processing your request.');
    }
  }

  /**
   * Reset the agent executor (useful for testing or configuration changes)
   */
  reset(): void {
    this.agentExecutor = null;
    log.info('Agent executor reset');
  }
}

// Export a singleton instance
export const intentRouter = new IntentRouter();
