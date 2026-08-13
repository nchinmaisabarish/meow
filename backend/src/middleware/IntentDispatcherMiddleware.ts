import { Request, Response, NextFunction } from 'express';
import { ENABLE_INTENT_BASED_ROUTING } from '../Constants.js';
import pino from 'pino';

const log = pino({
  name: 'intent-dispatcher-middleware',
  level: process.env.LOG_LEVEL || 'info',
});

interface IntentResolutionResult {
  handled: boolean;
  intent?: string;
  confidence?: number;
}

export class IntentDispatcher {
  private static intentPatterns: Map<RegExp, string> = new Map([
    [/\b(list|get|show|fetch|retrieve)\s+(all\s+)?(cards?|opportunities?)\b/i, 'list_cards'],
    [/\b(create|add|new)\s+(card|opportunity)\b/i, 'create_card'],
    [/\b(update|modify|change|edit)\s+(card|opportunity)\b/i, 'update_card'],
    [/\b(list|get|show|fetch|retrieve)\s+(all\s+)?(accounts?)\b/i, 'list_accounts'],
    [/\b(create|add|new)\s+(account)\b/i, 'create_account'],
    [/\b(list|get|show|fetch|retrieve)\s+(all\s+)?(lanes?|stages?)\b/i, 'list_lanes'],
    [/\b(list|get|show|fetch|retrieve)\s+(all\s+)?(users?)\b/i, 'list_users'],
    [/\b(forecast|prediction|predict)\b/i, 'get_forecast'],
  ]);

  static analyzeIntent(request: Request): IntentResolutionResult {
    if (!ENABLE_INTENT_BASED_ROUTING) {
      return { handled: false };
    }

    const intentHeader = request.headers['x-intent'] as string;
    const queryIntent = request.query.intent as string;
    const bodyIntent = request.body?.intent as string;

    const intentText = intentHeader || queryIntent || bodyIntent;

    if (!intentText) {
      return { handled: false };
    }

    for (const [pattern, intent] of this.intentPatterns) {
      if (pattern.test(intentText)) {
        log.info({ intent, intentText }, 'Intent matched');
        return {
          handled: true,
          intent,
          confidence: 0.85,
        };
      }
    }

    log.debug({ intentText }, 'No intent pattern matched');
    return { handled: false };
  }

  static mapIntentToRoute(intent: string): { method: string; path: string } | null {
    const intentRouteMap: Record<string, { method: string; path: string }> = {
      list_cards: { method: 'GET', path: '/api/cards' },
      create_card: { method: 'POST', path: '/api/cards' },
      update_card: { method: 'POST', path: '/api/cards' },
      list_accounts: { method: 'GET', path: '/api/accounts' },
      create_account: { method: 'POST', path: '/api/accounts' },
      list_lanes: { method: 'GET', path: '/api/lanes' },
      list_users: { method: 'GET', path: '/api/users' },
      get_forecast: { method: 'GET', path: '/api/forecast/list' },
    };

    return intentRouteMap[intent] || null;
  }

  static async handleIntentBasedRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const result = this.analyzeIntent(req);

    if (!result.handled || !result.intent) {
      return next();
    }

    const route = this.mapIntentToRoute(result.intent);

    if (!route) {
      log.warn({ intent: result.intent }, 'Intent recognized but no route mapping found');
      return next();
    }

    log.info(
      {
        originalPath: req.path,
        originalMethod: req.method,
        mappedPath: route.path,
        mappedMethod: route.method,
        intent: result.intent,
        confidence: result.confidence,
      },
      'Routing request via intent resolution'
    );

    req.url = route.path;
    req.method = route.method;

    res.setHeader('X-Intent-Resolved', result.intent);
    res.setHeader('X-Intent-Confidence', result.confidence?.toString() || '0');

    return next();
  }
}

export function intentDispatcherMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!ENABLE_INTENT_BASED_ROUTING) {
    return next();
  }

  IntentDispatcher.handleIntentBasedRequest(req, res, next).catch((error) => {
    log.error({ error }, 'Error in intent dispatcher middleware');
    next();
  });
}
