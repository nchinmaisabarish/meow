import { Request, Response } from 'express';

export interface IntentResolutionContext {
  request: Request;
  response: Response;
  metadata?: Record<string, any>;
}

export interface IntentResolutionResult {
  intentType: string;
  confidence: number;
  parameters: Record<string, any>;
  handler?: string;
}

export interface IntentResolver {
  resolve(context: IntentResolutionContext): Promise<IntentResolutionResult>;
}

export abstract class BaseIntentResolver implements IntentResolver {
  abstract resolve(context: IntentResolutionContext): Promise<IntentResolutionResult>;

  protected extractParameters(request: Request): Record<string, any> {
    return {
      ...request.query,
      ...request.params,
      ...request.body,
    };
  }

  protected createResult(
    intentType: string,
    confidence: number,
    parameters: Record<string, any>,
    handler?: string
  ): IntentResolutionResult {
    return {
      intentType,
      confidence,
      parameters,
      handler,
    };
  }
}

export class DefaultIntentResolver extends BaseIntentResolver {
  async resolve(context: IntentResolutionContext): Promise<IntentResolutionResult> {
    const { request } = context;
    const method = request.method.toLowerCase();
    const path = request.path;
    const parameters = this.extractParameters(request);

    let intentType = 'unknown';
    let confidence = 0.5;

    if (method === 'get' && path.includes('/api/')) {
      intentType = 'query';
      confidence = 0.8;
    } else if (method === 'post' && path.includes('/api/')) {
      intentType = 'create';
      confidence = 0.8;
    } else if (method === 'put' && path.includes('/api/')) {
      intentType = 'update';
      confidence = 0.8;
    } else if (method === 'delete' && path.includes('/api/')) {
      intentType = 'delete';
      confidence = 0.8;
    }

    return this.createResult(intentType, confidence, parameters);
  }
}
