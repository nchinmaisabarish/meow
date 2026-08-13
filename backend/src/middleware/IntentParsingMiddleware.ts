import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const log = pino({
  name: 'IntentParsingMiddleware',
  level: process.env.LOG_LEVEL || 'info',
});

export interface ResolvedIntent {
  raw: string;
  type: string;
  confidence: number;
  parameters: Record<string, any>;
  source: 'header' | 'body';
}

declare global {
  namespace Express {
    interface Request {
      resolvedIntent?: ResolvedIntent;
    }
  }
}

const INTENT_PATTERNS = [
  {
    pattern: /create\s+(a\s+)?card/i,
    type: 'create_card',
    extractParams: (text: string) => {
      const titleMatch = text.match(/(?:titled|named|called)\s+["']?([^"']+)["']?/i);
      const descMatch = text.match(/(?:with description|description)\s+["']?([^"']+)["']?/i);
      return {
        title: titleMatch ? titleMatch[1].trim() : undefined,
        description: descMatch ? descMatch[1].trim() : undefined,
      };
    },
  },
  {
    pattern: /list\s+(all\s+)?(cards|accounts|users|lanes)/i,
    type: 'list_entities',
    extractParams: (text: string) => {
      const entityMatch = text.match(/list\s+(?:all\s+)?(cards|accounts|users|lanes)/i);
      return {
        entityType: entityMatch ? entityMatch[1].toLowerCase() : undefined,
      };
    },
  },
  {
    pattern: /get\s+(card|account|user|lane|team)/i,
    type: 'get_entity',
    extractParams: (text: string) => {
      const entityMatch = text.match(/get\s+(card|account|user|lane|team)/i);
      const idMatch = text.match(/(?:id|with id|identifier)\s+["']?([a-zA-Z0-9-_]+)["']?/i);
      return {
        entityType: entityMatch ? entityMatch[1].toLowerCase() : undefined,
        id: idMatch ? idMatch[1] : undefined,
      };
    },
  },
  {
    pattern: /update\s+(card|account|user|lane|team)/i,
    type: 'update_entity',
    extractParams: (text: string) => {
      const entityMatch = text.match(/update\s+(card|account|user|lane|team)/i);
      const idMatch = text.match(/(?:id|with id)\s+["']?([a-zA-Z0-9-_]+)["']?/i);
      return {
        entityType: entityMatch ? entityMatch[1].toLowerCase() : undefined,
        id: idMatch ? idMatch[1] : undefined,
      };
    },
  },
  {
    pattern: /show\s+(me\s+)?(forecast|statistics|activities)/i,
    type: 'get_analytics',
    extractParams: (text: string) => {
      const typeMatch = text.match(/show\s+(?:me\s+)?(forecast|statistics|activities)/i);
      return {
        analyticsType: typeMatch ? typeMatch[1].toLowerCase() : undefined,
      };
    },
  },
  {
    pattern: /login|authenticate|sign\s+in/i,
    type: 'authenticate',
    extractParams: () => ({}),
  },
  {
    pattern: /register|sign\s+up|create\s+account/i,
    type: 'register',
    extractParams: () => ({}),
  },
];

function parseIntent(intentText: string): Omit<ResolvedIntent, 'source'> | null {
  if (!intentText || typeof intentText !== 'string') {
    return null;
  }

  const trimmedIntent = intentText.trim();

  if (trimmedIntent.length === 0) {
    return null;
  }

  for (const intentPattern of INTENT_PATTERNS) {
    if (intentPattern.pattern.test(trimmedIntent)) {
      const parameters = intentPattern.extractParams(trimmedIntent);
      const confidence = calculateConfidence(trimmedIntent, intentPattern.pattern);

      return {
        raw: trimmedIntent,
        type: intentPattern.type,
        confidence,
        parameters,
      };
    }
  }

  return {
    raw: trimmedIntent,
    type: 'unknown',
    confidence: 0.0,
    parameters: {},
  };
}

function calculateConfidence(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  if (!match) {
    return 0.0;
  }

  const matchLength = match[0].length;
  const textLength = text.length;
  const baseConfidence = matchLength / textLength;

  const hasParameters = text.length > matchLength + 5;
  const confidenceBoost = hasParameters ? 0.1 : 0.0;

  return Math.min(baseConfidence + confidenceBoost, 1.0);
}

export function intentParsingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    let intentText: string | undefined;
    let source: 'header' | 'body' | undefined;

    const headerIntent = req.headers['x-intent'];
    if (headerIntent && typeof headerIntent === 'string') {
      intentText = headerIntent;
      source = 'header';
    } else if (req.body && typeof req.body.intent === 'string') {
      intentText = req.body.intent;
      source = 'body';
    }

    if (intentText && source) {
      const parsedIntent = parseIntent(intentText);

      if (parsedIntent) {
        req.resolvedIntent = {
          ...parsedIntent,
          source,
        };

        log.info(
          {
            intent: req.resolvedIntent,
            path: req.path,
            method: req.method,
          },
          'Intent parsed successfully'
        );
      } else {
        log.debug(
          {
            intentText,
            path: req.path,
            method: req.method,
          },
          'No intent could be parsed'
        );
      }
    }

    next();
  } catch (error) {
    log.error(
      {
        error,
        path: req.path,
        method: req.method,
      },
      'Error in intent parsing middleware'
    );
    next();
  }
}
