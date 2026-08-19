import { Request, Response, NextFunction } from 'express';
import { IntentResolver, IntentResolution } from '../intent/IntentResolver';
import { IntentToolMapper } from '../intent/IntentToolMapper';
import { ToolRegistry } from '../tools/ToolRegistry';

export interface IntentRequest extends Request {
  intent?: IntentResolution;
  intentResult?: any;
}

export class IntentMiddleware {
  private intentResolver: IntentResolver;
  private intentToolMapper: IntentToolMapper;
  private enabled: boolean;

  constructor(intentResolver: IntentResolver, toolRegistry: ToolRegistry) {
    this.intentResolver = intentResolver;
    this.intentToolMapper = new IntentToolMapper(toolRegistry);
    this.enabled = true;
  }

  public middleware() {
    return async (req: IntentRequest, res: Response, next: NextFunction) => {
      if (!this.enabled) {
        return next();
      }

      try {
        const shouldProcessIntent = this.shouldProcessRequest(req);
        
        if (!shouldProcessIntent) {
          return next();
        }

        const userInput = this.extractUserInput(req);
        
        if (!userInput) {
          return next();
        }

        const intent = await this.intentResolver.resolveIntent(userInput, {
          userId: req.headers['x-user-id'] as string,
          sessionId: req.headers['x-session-id'] as string,
          requestId: req.headers['x-request-id'] as string
        });

        req.intent = intent;

        if (intent.confidence < 0.7) {
          return next();
        }

        const mappingResult = await this.intentToolMapper.mapIntentToTool(intent);

        if (!mappingResult.validated) {
          return res.status(400).json({
            error: 'Intent validation failed',
            details: mappingResult.errors,
            intent: intent.intent,
            confidence: intent.confidence
          });
        }

        const result = await mappingResult.tool.execute(mappingResult.parameters);
        req.intentResult = result;

        return res.status(200).json({
          success: true,
          intent: intent.intent,
          confidence: intent.confidence,
          result: result
        });

      } catch (error) {
        console.error('Intent middleware error:', error);
        return next();
      }
    };
  }

  private shouldProcessRequest(req: Request): boolean {
    const intentHeader = req.headers['x-intent-enabled'];
    if (intentHeader === 'false') {
      return false;
    }

    const contentType = req.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
      return true;
    }

    return false;
  }

  private extractUserInput(req: Request): string | null {
    if (req.body && req.body.query) {
      return req.body.query;
    }

    if (req.body && req.body.message) {
      return req.body.message;
    }

    if (req.body && req.body.input) {
      return req.body.input;
    }

    if (req.query && req.query.q) {
      return req.query.q as string;
    }

    return null;
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async executeIntent(userInput: string, context?: any): Promise<any> {
    const intent = await this.intentResolver.resolveIntent(userInput, context);
    
    if (intent.confidence < 0.7) {
      throw new Error(`Low confidence intent resolution: ${intent.confidence}`);
    }

    return await this.intentToolMapper.executeIntent(intent);
  }

  public registerIntentMapping(intentType: string, toolName: string, parameterMapping: Record<string, string>): void {
    this.intentToolMapper.registerMapping({
      intentType,
      toolName,
      parameterMapping
    });
  }

  public getIntentToolMapper(): IntentToolMapper {
    return this.intentToolMapper;
  }
}
