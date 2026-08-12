import { Request, Response, NextFunction } from 'express';
import { log } from '../worker.js';

interface IntentResolutionRequest {
  input: string;
  context?: Record<string, any>;
}

interface IntentResolutionResponse {
  matched: boolean;
  intent?: string;
  controller?: string;
  method?: string;
  parameters?: Record<string, any>;
  confidence?: number;
  alternatives?: Array<{
    intent: string;
    controller: string;
    method: string;
    confidence: number;
  }>;
}

interface IntentPattern {
  intent: string;
  controller: string;
  method: string;
  patterns: RegExp[];
  parameterExtractors?: Array<{
    name: string;
    pattern: RegExp;
    transform?: (value: string) => any;
  }>;
}

class IntentResolver {
  private intentPatterns: IntentPattern[] = [
    {
      intent: 'list_cards',
      controller: 'CardController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(cards?|tasks?)$/i,
        /^(what|which)\s+(cards?|tasks?)\s+(do\s+)?(i\s+have|exist|are\s+there)$/i,
      ],
    },
    {
      intent: 'create_card',
      controller: 'CardController',
      method: 'create',
      patterns: [
        /^(create|add|new|make)\s+(a\s+)?(card|task)\s+(.+)$/i,
        /^(create|add|new|make)\s+(.+)\s+(card|task)$/i,
      ],
      parameterExtractors: [
        {
          name: 'title',
          pattern: /(?:create|add|new|make)\s+(?:a\s+)?(?:card|task)\s+(?:called|named|titled)?\s*["']?([^"']+)["']?/i,
          transform: (value: string) => value.trim(),
        },
      ],
    },
    {
      intent: 'get_card',
      controller: 'CardController',
      method: 'get',
      patterns: [
        /^(show|get|fetch|display|view)\s+(card|task)\s+([a-f0-9]{24})$/i,
        /^(card|task)\s+([a-f0-9]{24})$/i,
      ],
      parameterExtractors: [
        {
          name: 'id',
          pattern: /([a-f0-9]{24})/i,
          transform: (value: string) => value,
        },
      ],
    },
    {
      intent: 'update_card',
      controller: 'CardController',
      method: 'update',
      patterns: [
        /^(update|modify|change|edit)\s+(card|task)\s+([a-f0-9]{24})$/i,
        /^(update|modify|change|edit)\s+(.+)\s+(for|in|on)\s+(card|task)\s+([a-f0-9]{24})$/i,
      ],
      parameterExtractors: [
        {
          name: 'id',
          pattern: /([a-f0-9]{24})/i,
          transform: (value: string) => value,
        },
      ],
    },
    {
      intent: 'list_accounts',
      controller: 'AccountController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(accounts?|customers?|clients?)$/i,
        /^(what|which)\s+(accounts?|customers?|clients?)\s+(do\s+)?(i\s+have|exist|are\s+there)$/i,
      ],
    },
    {
      intent: 'create_account',
      controller: 'AccountController',
      method: 'create',
      patterns: [
        /^(create|add|new|make)\s+(an?\s+)?(account|customer|client)\s+(.+)$/i,
        /^(create|add|new|make)\s+(.+)\s+(account|customer|client)$/i,
      ],
      parameterExtractors: [
        {
          name: 'name',
          pattern: /(?:create|add|new|make)\s+(?:an?\s+)?(?:account|customer|client)\s+(?:called|named)?\s*["']?([^"']+)["']?/i,
          transform: (value: string) => value.trim(),
        },
      ],
    },
    {
      intent: 'get_account',
      controller: 'AccountController',
      method: 'fetch',
      patterns: [
        /^(show|get|fetch|display|view)\s+(account|customer|client)\s+([a-f0-9]{24})$/i,
        /^(account|customer|client)\s+([a-f0-9]{24})$/i,
      ],
      parameterExtractors: [
        {
          name: 'id',
          pattern: /([a-f0-9]{24})/i,
          transform: (value: string) => value,
        },
      ],
    },
    {
      intent: 'list_lanes',
      controller: 'LaneController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(lanes?|columns?|stages?)$/i,
        /^(what|which)\s+(lanes?|columns?|stages?)\s+(do\s+)?(i\s+have|exist|are\s+there)$/i,
      ],
    },
    {
      intent: 'get_lane_statistics',
      controller: 'LaneStatisticsController',
      method: 'get',
      patterns: [
        /^(show|get|fetch|display)\s+(lane|column|stage)\s+(statistics?|stats?|metrics?)$/i,
        /^(statistics?|stats?|metrics?)\s+(for|of)\s+(lanes?|columns?|stages?)$/i,
      ],
    },
    {
      intent: 'list_users',
      controller: 'UserController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(users?|members?|people)$/i,
        /^(what|which|who)\s+(users?|members?|people)\s+(do\s+)?(i\s+have|exist|are\s+there)$/i,
      ],
    },
    {
      intent: 'create_user',
      controller: 'UserController',
      method: 'create',
      patterns: [
        /^(create|add|new|invite)\s+(a\s+)?(user|member|person)\s+(.+)$/i,
        /^(create|add|new|invite)\s+(.+)\s+(user|member|person)$/i,
      ],
      parameterExtractors: [
        {
          name: 'email',
          pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
          transform: (value: string) => value.toLowerCase(),
        },
      ],
    },
    {
      intent: 'get_forecast_achieved',
      controller: 'ForecastController',
      method: 'achieved',
      patterns: [
        /^(show|get|fetch|display)\s+(achieved|completed|done)\s+(forecast|prediction)$/i,
        /^(what|how\s+much)\s+(was|is)\s+(achieved|completed|done)$/i,
      ],
    },
    {
      intent: 'get_forecast_predicted',
      controller: 'ForecastController',
      method: 'predicted',
      patterns: [
        /^(show|get|fetch|display)\s+(predicted|forecasted|expected)\s+(forecast|prediction)$/i,
        /^(what|how\s+much)\s+(is|will\s+be)\s+(predicted|forecasted|expected)$/i,
      ],
    },
    {
      intent: 'list_forecast',
      controller: 'ForecastController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(forecasts?|predictions?)$/i,
        /^(what|which)\s+(forecasts?|predictions?)\s+(do\s+)?(i\s+have|exist|are\s+there)$/i,
      ],
    },
    {
      intent: 'get_forecast_timeseries',
      controller: 'ForecastController',
      method: 'series',
      patterns: [
        /^(show|get|fetch|display)\s+(forecast|prediction)\s+(time\s*series|timeline|trend)$/i,
        /^(time\s*series|timeline|trend)\s+(for|of)\s+(forecast|prediction)$/i,
      ],
    },
    {
      intent: 'list_schemas',
      controller: 'SchemaController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(schemas?|templates?)$/i,
        /^(what|which)\s+(schemas?|templates?)\s+(do\s+)?(i\s+have|exist|are\s+there)$/i,
      ],
    },
    {
      intent: 'create_schema',
      controller: 'SchemaController',
      method: 'create',
      patterns: [
        /^(create|add|new|make)\s+(a\s+)?(schema|template)\s+(.+)$/i,
        /^(create|add|new|make)\s+(.+)\s+(schema|template)$/i,
      ],
    },
    {
      intent: 'list_activities',
      controller: 'ActivityController',
      method: 'list',
      patterns: [
        /^(list|show|get|fetch|display)\s+(all\s+)?(activities?|activity\s+log)$/i,
        /^(what|which)\s+(activities?|activity)\s+(happened|occurred|took\s+place)$/i,
      ],
    },
    {
      intent: 'get_team',
      controller: 'TeamController',
      method: 'get',
      patterns: [
        /^(show|get|fetch|display|view)\s+(team|organization)\s+([a-f0-9]{24})$/i,
        /^(team|organization)\s+([a-f0-9]{24})$/i,
      ],
      parameterExtractors: [
        {
          name: 'id',
          pattern: /([a-f0-9]{24})/i,
          transform: (value: string) => value,
        },
      ],
    },
  ];

  public resolve(input: string, context?: Record<string, any>): IntentResolutionResponse {
    const normalizedInput = input.trim();

    if (!normalizedInput) {
      return {
        matched: false,
      };
    }

    const matches: Array<{
      intent: string;
      controller: string;
      method: string;
      confidence: number;
      parameters?: Record<string, any>;
    }> = [];

    for (const intentPattern of this.intentPatterns) {
      for (const pattern of intentPattern.patterns) {
        const match = normalizedInput.match(pattern);
        if (match) {
          const confidence = this.calculateConfidence(normalizedInput, pattern, match);
          const parameters = this.extractParameters(normalizedInput, intentPattern, match);

          matches.push({
            intent: intentPattern.intent,
            controller: intentPattern.controller,
            method: intentPattern.method,
            confidence,
            parameters,
          });
        }
      }
    }

    if (matches.length === 0) {
      return {
        matched: false,
      };
    }

    matches.sort((a, b) => b.confidence - a.confidence);

    const bestMatch = matches[0];
    const alternatives = matches.slice(1, 4).map((m) => ({
      intent: m.intent,
      controller: m.controller,
      method: m.method,
      confidence: m.confidence,
    }));

    return {
      matched: true,
      intent: bestMatch.intent,
      controller: bestMatch.controller,
      method: bestMatch.method,
      parameters: bestMatch.parameters,
      confidence: bestMatch.confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  private calculateConfidence(input: string, pattern: RegExp, match: RegExpMatchArray): number {
    let confidence = 0.5;

    const matchLength = match[0].length;
    const inputLength = input.length;
    const coverageRatio = matchLength / inputLength;
    confidence += coverageRatio * 0.3;

    const exactMatch = input.toLowerCase() === match[0].toLowerCase();
    if (exactMatch) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  private extractParameters(
    input: string,
    intentPattern: IntentPattern,
    match: RegExpMatchArray
  ): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (!intentPattern.parameterExtractors) {
      return parameters;
    }

    for (const extractor of intentPattern.parameterExtractors) {
      const paramMatch = input.match(extractor.pattern);
      if (paramMatch && paramMatch[1]) {
        const value = extractor.transform
          ? extractor.transform(paramMatch[1])
          : paramMatch[1];
        parameters[extractor.name] = value;
      }
    }

    return parameters;
  }

  public listIntents(): Array<{
    intent: string;
    controller: string;
    method: string;
    examplePatterns: string[];
  }> {
    return this.intentPatterns.map((pattern) => ({
      intent: pattern.intent,
      controller: pattern.controller,
      method: pattern.method,
      examplePatterns: pattern.patterns.map((p) => p.source),
    }));
  }
}

const intentResolver = new IntentResolver();

export class IntentController {
  public static async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { input, context } = req.body as IntentResolutionRequest;

      if (!input || typeof input !== 'string') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Input must be a non-empty string',
        });
        return;
      }

      log.info({ input, context }, 'Resolving intent');

      const result = intentResolver.resolve(input, context);

      log.info({ result }, 'Intent resolution result');

      res.status(200).json(result);
    } catch (error) {
      log.error({ error }, 'Error resolving intent');
      next(error);
    }
  }

  public static async listIntents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      log.info('Listing available intents');

      const intents = intentResolver.listIntents();

      res.status(200).json({
        count: intents.length,
        intents,
      });
    } catch (error) {
      log.error({ error }, 'Error listing intents');
      next(error);
    }
  }
}
