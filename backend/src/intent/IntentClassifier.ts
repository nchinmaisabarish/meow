import { IntentConfig, IntentType, EntityType, ClassificationRule } from './IntentConfig';

export interface ClassificationResult {
  intent: IntentType;
  entity?: EntityType;
  confidence: number;
  matchedRules: string[];
  extractedParams?: Record<string, any>;
}

export interface ClassificationContext {
  method: string;
  path: string;
  body?: any;
  query?: Record<string, any>;
  headers?: Record<string, string>;
}

export class IntentClassifier {
  private config: IntentConfig;

  constructor(config?: IntentConfig) {
    this.config = config || IntentConfig.getDefault();
  }

  public classify(context: ClassificationContext): ClassificationResult {
    const explicitIntent = this.checkExplicitIntent(context);
    if (explicitIntent) {
      return explicitIntent;
    }

    const results: ClassificationResult[] = [];

    results.push(this.classifyByMethod(context));
    results.push(this.classifyByPath(context));
    results.push(this.classifyByBody(context));
    results.push(this.classifyByKeywords(context));
    results.push(this.classifyByCustomRules(context));

    const validResults = results.filter(r => r.confidence > 0);
    if (validResults.length === 0) {
      return this.getDefaultClassification(context);
    }

    return this.mergeResults(validResults);
  }

  private checkExplicitIntent(context: ClassificationContext): ClassificationResult | null {
    const intentHeader = context.headers?.['x-intent'] || context.headers?.['X-Intent'];
    if (intentHeader) {
      const parts = intentHeader.split(':');
      const intent = parts[0] as IntentType;
      const entity = parts[1] as EntityType | undefined;

      if (this.isValidIntent(intent)) {
        return {
          intent,
          entity,
          confidence: 1.0,
          matchedRules: ['explicit-header']
        };
      }
    }

    if (context.body?.intent) {
      const intent = context.body.intent as IntentType;
      const entity = context.body.entity as EntityType | undefined;

      if (this.isValidIntent(intent)) {
        return {
          intent,
          entity,
          confidence: 0.95,
          matchedRules: ['explicit-body']
        };
      }
    }

    return null;
  }

  private classifyByMethod(context: ClassificationContext): ClassificationResult {
    const methodMap: Record<string, IntentType> = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };

    const intent = methodMap[context.method.toUpperCase()];
    if (!intent) {
      return { intent: 'read', confidence: 0, matchedRules: [] };
    }

    const hasId = this.pathContainsId(context.path);
    if (context.method === 'GET' && !hasId) {
      return {
        intent: 'list',
        confidence: 0.7,
        matchedRules: ['method-get-no-id']
      };
    }

    return {
      intent,
      confidence: 0.6,
      matchedRules: [`method-${context.method.toLowerCase()}`]
    };
  }

  private classifyByPath(context: ClassificationContext): ClassificationResult {
    const path = context.path.toLowerCase();
    const segments = path.split('/').filter(s => s.length > 0);

    let confidence = 0;
    let intent: IntentType = 'read';
    let entity: EntityType | undefined;
    const matchedRules: string[] = [];

    if (segments.includes('search')) {
      intent = 'search';
      confidence = 0.85;
      matchedRules.push('path-search');
    }

    const entityMatch = this.extractEntityFromPath(path);
    if (entityMatch) {
      entity = entityMatch;
      confidence += 0.1;
      matchedRules.push(`path-entity-${entityMatch}`);
    }

    const hasId = this.pathContainsId(path);
    if (hasId && context.method === 'GET') {
      intent = 'read';
      confidence = Math.max(confidence, 0.75);
      matchedRules.push('path-with-id');
    }

    return { intent, entity, confidence, matchedRules };
  }

  private classifyByBody(context: ClassificationContext): ClassificationResult {
    if (!context.body || typeof context.body !== 'object') {
      return { intent: 'read', confidence: 0, matchedRules: [] };
    }

    const body = context.body;
    let confidence = 0;
    let intent: IntentType = 'create';
    const matchedRules: string[] = [];

    if (body.query || body.search || body.filter) {
      intent = 'search';
      confidence = 0.8;
      matchedRules.push('body-search-fields');
    } else if (body.id || body._id) {
      if (Object.keys(body).length > 2) {
        intent = 'update';
        confidence = 0.75;
        matchedRules.push('body-update-with-id');
      } else {
        intent = 'read';
        confidence = 0.7;
        matchedRules.push('body-read-with-id');
      }
    } else if (Object.keys(body).length > 0) {
      intent = 'create';
      confidence = 0.65;
      matchedRules.push('body-create-data');
    }

    return { intent, confidence, matchedRules };
  }

  private classifyByKeywords(context: ClassificationContext): ClassificationResult {
    const keywords = this.config.getKeywords();
    const text = this.extractTextFromContext(context);
    const lowerText = text.toLowerCase();

    let bestMatch: { intent: IntentType; confidence: number; keywords: string[] } | null = null;

    for (const [intent, intentKeywords] of Object.entries(keywords)) {
      const matchedKeywords: string[] = [];
      let score = 0;

      for (const keyword of intentKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
          score += 1;
        }
      }

      if (score > 0) {
        const confidence = Math.min(0.9, 0.5 + (score * 0.1));
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            intent: intent as IntentType,
            confidence,
            keywords: matchedKeywords
          };
        }
      }
    }

    if (bestMatch) {
      return {
        intent: bestMatch.intent,
        confidence: bestMatch.confidence,
        matchedRules: bestMatch.keywords.map(k => `keyword-${k}`)
      };
    }

    return { intent: 'read', confidence: 0, matchedRules: [] };
  }

  private classifyByCustomRules(context: ClassificationContext): ClassificationResult {
    const rules = this.config.getCustomRules();
    
    for (const rule of rules) {
      if (this.matchesRule(context, rule)) {
        return {
          intent: rule.intent,
          entity: rule.entity,
          confidence: rule.confidence,
          matchedRules: [`custom-${rule.name}`]
        };
      }
    }

    return { intent: 'read', confidence: 0, matchedRules: [] };
  }

  private matchesRule(context: ClassificationContext, rule: ClassificationRule): boolean {
    if (rule.method && rule.method !== context.method.toUpperCase()) {
      return false;
    }

    if (rule.pathPattern) {
      const regex = new RegExp(rule.pathPattern);
      if (!regex.test(context.path)) {
        return false;
      }
    }

    if (rule.bodyPattern && context.body) {
      const bodyStr = JSON.stringify(context.body);
      const regex = new RegExp(rule.bodyPattern);
      if (!regex.test(bodyStr)) {
        return false;
      }
    }

    if (rule.condition) {
      return rule.condition(context);
    }

    return true;
  }

  private mergeResults(results: ClassificationResult[]): ClassificationResult {
    results.sort((a, b) => b.confidence - a.confidence);

    const topResult = results[0];
    const allMatchedRules = results.flatMap(r => r.matchedRules);

    let finalConfidence = topResult.confidence;
    const supportingResults = results.slice(1).filter(r => r.intent === topResult.intent);
    
    if (supportingResults.length > 0) {
      const boost = supportingResults.reduce((sum, r) => sum + r.confidence, 0) * 0.1;
      finalConfidence = Math.min(1.0, finalConfidence + boost);
    }

    let entity = topResult.entity;
    if (!entity) {
      const entityResult = results.find(r => r.entity);
      if (entityResult) {
        entity = entityResult.entity;
      }
    }

    return {
      intent: topResult.intent,
      entity,
      confidence: finalConfidence,
      matchedRules: allMatchedRules
    };
  }

  private getDefaultClassification(context: ClassificationContext): ClassificationResult {
    return {
      intent: 'read',
      confidence: 0.3,
      matchedRules: ['default-fallback']
    };
  }

  private extractTextFromContext(context: ClassificationContext): string {
    const parts: string[] = [];

    parts.push(context.path);

    if (context.query) {
      parts.push(JSON.stringify(context.query));
    }

    if (context.body && typeof context.body === 'object') {
      parts.push(JSON.stringify(context.body));
    }

    return parts.join(' ');
  }

  private extractEntityFromPath(path: string): EntityType | undefined {
    const entityPatterns = this.config.getEntityPatterns();

    for (const [entity, patterns] of Object.entries(entityPatterns)) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(path)) {
          return entity as EntityType;
        }
      }
    }

    return undefined;
  }

  private pathContainsId(path: string): boolean {
    const idPatterns = [
      /\/[0-9a-f]{24}\/?$/i,
      /\/[0-9]+\/?$/,
      /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/?$/i,
      /\/id\/[^/]+\/?$/i
    ];

    return idPatterns.some(pattern => pattern.test(path));
  }

  private isValidIntent(intent: string): boolean {
    const validIntents: IntentType[] = ['create', 'read', 'update', 'delete', 'list', 'search'];
    return validIntents.includes(intent as IntentType);
  }

  public updateConfig(config: IntentConfig): void {
    this.config = config;
  }

  public getConfig(): IntentConfig {
    return this.config;
  }
}
