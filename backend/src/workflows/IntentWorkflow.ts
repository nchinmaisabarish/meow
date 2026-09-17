import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { StructuredToolInterface } from '@langchain/core/tools';
import { IntentClassifier, ClassifiedIntent } from '../helpers/IntentClassifier.js';
import { ToolRegistry } from '../helpers/ToolRegistry.js';
import { User } from '../entities/User.js';
import { Team } from '../entities/Team.js';
import { ApplicationError } from '../errors/ApplicationError.js';
import { StatusCodes } from 'http-status-codes';

class WorkflowExecutionError extends ApplicationError {
  constructor(description?: string) {
    super('WorkflowExecutionError', StatusCodes.INTERNAL_SERVER_ERROR, description);
  }
}

class ToolNotFoundError extends ApplicationError {
  constructor(toolName: string) {
    super('ToolNotFoundError', StatusCodes.BAD_REQUEST, `Tool not found: ${toolName}`);
  }
}

export interface WorkflowInput {
  userRequest: string;
  user: User;
  team: Team;
}

export interface WorkflowOutput {
  intent: string;
  confidence: number;
  reasoning?: string;
  toolName?: string;
  result: unknown;
  success: boolean;
  error?: string;
}

/**
 * IntentWorkflow orchestrates the process of:
 * 1. Classifying user intent from natural language
 * 2. Selecting the appropriate tool from the ToolRegistry
 * 3. Executing the tool with extracted parameters
 * 
 * This implements a RunnableSequence that chains intent classification
 * to tool selection to execution, enabling semantic intent dispatch.
 */
export class IntentWorkflow {
  private classifier: IntentClassifier;
  private workflow: RunnableSequence<WorkflowInput, WorkflowOutput>;

  constructor(openaiApiKey?: string) {
    this.classifier = new IntentClassifier(openaiApiKey);
    this.workflow = this.buildWorkflow();
  }

  /**
   * Build the workflow as a RunnableSequence
   */
  private buildWorkflow(): RunnableSequence<WorkflowInput, WorkflowOutput> {
    // Step 1: Classify the intent
    const classifyStep = RunnableLambda.from(
      async (input: WorkflowInput): Promise<WorkflowInput & { classified: ClassifiedIntent }> => {
        const classified = await this.classifier.classify(input.userRequest);
        return { ...input, classified };
      }
    );

    // Step 2: Select and execute the tool
    const executeStep = RunnableLambda.from(
      async (input: WorkflowInput & { classified: ClassifiedIntent }): Promise<WorkflowOutput> => {
        const { classified, user, team } = input;

        // Check confidence threshold
        const threshold = this.classifier.getConfidenceThreshold();
        if (classified.confidence < threshold || classified.intent === 'unknown') {
          return {
            intent: classified.intent,
            confidence: classified.confidence,
            reasoning: classified.reasoning,
            result: null,
            success: false,
            error: 'Intent confidence too low or unknown intent',
          };
        }

        // Get the tool name for this intent
        const toolName = this.classifier.getToolNameForIntent(classified.intent);
        if (!toolName) {
          return {
            intent: classified.intent,
            confidence: classified.confidence,
            reasoning: classified.reasoning,
            result: null,
            success: false,
            error: `No tool mapping found for intent: ${classified.intent}`,
          };
        }

        // Get tools from registry
        const toolRegistry = new ToolRegistry(user, team);
        const tools = toolRegistry.getTools();
        
        // Find the matching tool
        const tool = tools.find((t: StructuredToolInterface) => t.name === toolName);
        if (!tool) {
          throw new ToolNotFoundError(toolName);
        }

        try {
          // Execute the tool with the extracted parameters
          const toolResult = await tool.invoke(classified.parameters || {});
          
          // Parse the result if it's a JSON string
          let parsedResult: unknown;
          try {
            parsedResult = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
          } catch {
            parsedResult = toolResult;
          }

          return {
            intent: classified.intent,
            confidence: classified.confidence,
            reasoning: classified.reasoning,
            toolName,
            result: parsedResult,
            success: true,
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during tool execution';
          return {
            intent: classified.intent,
            confidence: classified.confidence,
            reasoning: classified.reasoning,
            toolName,
            result: null,
            success: false,
            error: errorMessage,
          };
        }
      }
    );

    // Chain the steps together
    return RunnableSequence.from([classifyStep, executeStep]);
  }

  /**
   * Invoke the workflow with a user request
   */
  async invoke(input: WorkflowInput): Promise<WorkflowOutput> {
    try {
      return await this.workflow.invoke(input);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown workflow error';
      throw new WorkflowExecutionError(errorMessage);
    }
  }

  /**
   * Get the underlying workflow for advanced usage
   */
  getWorkflow(): RunnableSequence<WorkflowInput, WorkflowOutput> {
    return this.workflow;
  }
}
