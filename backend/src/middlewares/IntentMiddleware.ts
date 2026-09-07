import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../requests/AuthenticatedRequest.js';
import { getIntentResolver } from '../services/IntentResolver.js';
import { ToolRegistry } from '../tools/index.js';
import { InvalidRequestBodyError } from '../errors/InvalidRequestBodyError.js';
import { InvalidConfigurationError } from '../errors/InvalidConfigurationError.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load intent dispatch configuration
const intentDispatchPath = join(__dirname, '..', 'workflows', 'intent-dispatch.json');
let intentDispatchConfig: any = null;

try {
  const configContent = readFileSync(intentDispatchPath, 'utf-8');
  intentDispatchConfig = JSON.parse(configContent);
} catch (error: unknown) {
  console.error('Failed to load intent-dispatch.json:', error);
}

/**
 * IntentMiddleware intercepts requests, analyzes user intent using LLM,
 * and dynamically dispatches to the appropriate tool from the registry.
 */
export const handleIntentRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { request: userRequest, context: additionalContext } = req.body;

    if (!userRequest || typeof userRequest !== 'string') {
      throw new InvalidRequestBodyError(
        'Request field is required and must be a string describing your intent'
      );
    }

    // Check if intent resolver is configured
    const intentResolver = getIntentResolver();
    if (!intentResolver.isConfigured()) {
      throw new InvalidConfigurationError(
        'Intent resolution is not configured. Please set OPENAI_API_KEY environment variable.'
      );
    }

    // Build context from authenticated request
    const context = {
      userId: req.jwt.user._id.toString(),
      teamId: req.jwt.team._id.toString(),
      ...additionalContext,
    };

    // Classify the intent using LLM
    const classification = await intentResolver.classifyIntent(userRequest, context);

    // Check confidence threshold
    if (classification.confidence < 0.5) {
      return res.status(400).json({
        success: false,
        error: 'Unable to understand request with sufficient confidence',
        intent: classification.intent,
        confidence: classification.confidence,
        suggestion: 'Please provide more specific information about what you want to do',
      });
    }

    // Find the tool in the registry
    const tool = ToolRegistry.find((t) => t.name === classification.toolName);

    if (!tool) {
      // Check if this is a known intent without a tool
      if (intentDispatchConfig) {
        const intentCategory = intentDispatchConfig.intents[classification.intent];
        if (intentCategory) {
          const actionConfig = intentCategory.actions[classification.action];
          if (actionConfig && actionConfig.toolName === null) {
            return res.status(501).json({
              success: false,
              error: 'This operation is not yet implemented',
              intent: classification.intent,
              action: classification.action,
              note: actionConfig.note || 'Tool not available',
            });
          }
        }
      }

      return res.status(404).json({
        success: false,
        error: `Tool '${classification.toolName}' not found in registry`,
        intent: classification.intent,
        action: classification.action,
      });
    }

    // Merge context parameters with classified parameters
    // Always include userId and teamId from the authenticated context
    const toolParameters = {
      userId: context.userId,
      teamId: context.teamId,
      ...classification.parameters,
    };

    // Execute the tool
    try {
      const result = await tool.invoke(toolParameters);

      // Parse the result (tools return JSON strings)
      let parsedResult;
      try {
        parsedResult = JSON.parse(result);
      } catch {
        parsedResult = { result };
      }

      return res.json({
        success: true,
        intent: classification.intent,
        action: classification.action,
        toolName: classification.toolName,
        confidence: classification.confidence,
        result: parsedResult,
      });
    } catch (toolError: unknown) {
      const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        intent: classification.intent,
        action: classification.action,
        toolName: classification.toolName,
        details: errorMessage,
      });
    }
  } catch (error: unknown) {
    return next(error);
  }
};

/**
 * Middleware to list available intents and their capabilities
 */
export const listIntents = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!intentDispatchConfig) {
      throw new Error('Intent dispatch configuration not loaded');
    }

    // Build a list of available tools from the registry
    const availableTools = ToolRegistry.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));

    return res.json({
      success: true,
      version: intentDispatchConfig.version,
      description: intentDispatchConfig.description,
      intents: intentDispatchConfig.intents,
      availableTools,
      toolCount: ToolRegistry.length,
    });
  } catch (error: unknown) {
    return next(error);
  }
};
