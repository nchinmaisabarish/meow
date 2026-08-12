export type IntentType = 'create' | 'read' | 'update' | 'delete' | 'list' | 'search';

export type EntityType = 'user' | 'product' | 'order' | 'category' | 'item' | 'resource' | 'document' | 'file' | 'message' | 'notification';

export interface ClassificationRule {
  name: string;
  intent: IntentType;
  entity?: EntityType;
  confidence: number;
  method?: string;
  pathPattern?: string;
  bodyPattern?: string;
  condition?: (context: any) => boolean;
}

export interface IntentKeywords {
  create: string[];
  read: string[];
  update: string[];
  delete: string[];
  list: string[];
  search: string[];
}

export interface EntityPatterns {
  [entity: string]: string[];
}

export class IntentConfig {
  private keywords: IntentKeywords;
  private entityPatterns: EntityPatterns;
  private customRules: ClassificationRule[];
  private confidenceThreshold: number;

  constructor(
    keywords?: Partial<IntentKeywords>,
    entityPatterns?: EntityPatterns,
    customRules?: ClassificationRule[],
    confidenceThreshold?: number
  ) {
    this.keywords = this.mergeKeywords(keywords);
    this.entityPatterns = entityPatterns || this.getDefaultEntityPatterns();
    this.customRules = customRules || [];
    this.confidenceThreshold = confidenceThreshold || 0.5;
  }

  public static getDefault(): IntentConfig {
    return new IntentConfig();
  }

  private mergeKeywords(custom?: Partial<IntentKeywords>): IntentKeywords {
    const defaults: IntentKeywords = {
      create: [
        'create',
        'add',
        'new',
        'insert',
        'post',
        'register',
        'submit',
        'save',
        'store'
      ],
      read: [
        'get',
        'read',
        'fetch',
        'retrieve',
        'view',
        'show',
        'display',
        'find',
        'load'
      ],
      update: [
        'update',
        'edit',
        'modify',
        'change',
        'patch',
        'put',
        'revise',
        'alter',
        'set'
      ],
      delete: [
        'delete',
        'remove',
        'destroy',
        'erase',
        'clear',
        'drop',
        'purge',
        'cancel'
      ],
      list: [
        'list',
        'all',
        'index',
        'browse',
        'collection',
        'many',
        'multiple'
      ],
      search: [
        'search',
        'query',
        'find',
        'filter',
        'lookup',
        'match',
        'seek',
        'explore'
      ]
    };

    if (!custom) {
      return defaults;
    }

    return {
      create: [...defaults.create, ...(custom.create || [])],
      read: [...defaults.read, ...(custom.read || [])],
      update: [...defaults.update, ...(custom.update || [])],
      delete: [...defaults.delete, ...(custom.delete || [])],
      list: [...defaults.list, ...(custom.list || [])],
      search: [...defaults.search, ...(custom.search || [])]
    };
  }

  private getDefaultEntityPatterns(): EntityPatterns {
    return {
      user: [
        '/users?/',
        '/accounts?/',
        '/profiles?/',
        '/members?/',
        'user',
        'account',
        'profile'
      ],
      product: [
        '/products?/',
        '/items?/',
        '/goods?/',
        'product',
        'item'
      ],
      order: [
        '/orders?/',
        '/purchases?/',
        '/transactions?/',
        'order',
        'purchase',
        'transaction'
      ],
      category: [
        '/categories/',
        '/tags?/',
        '/groups?/',
        'category',
        'tag',
        'group'
      ],
      resource: [
        '/resources?/',
        '/assets?/',
        'resource',
        'asset'
      ],
      document: [
        '/documents?/',
        '/docs?/',
        '/files?/',
        'document',
        'doc'
      ],
      file: [
        '/files?/',
        '/uploads?/',
        '/media/',
        'file',
        'upload'
      ],
      message: [
        '/messages?/',
        '/chats?/',
        '/conversations?/',
        'message',
        'chat'
      ],
      notification: [
        '/notifications?/',
        '/alerts?/',
        'notification',
        'alert'
      ]
    };
  }

  public getKeywords(): IntentKeywords {
    return this.keywords;
  }

  public getEntityPatterns(): EntityPatterns {
    return this.entityPatterns;
  }

  public getCustomRules(): ClassificationRule[] {
    return this.customRules;
  }

  public getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  public addKeywords(intent: IntentType, keywords: string[]): void {
    this.keywords[intent] = [...this.keywords[intent], ...keywords];
  }

  public addEntityPattern(entity: EntityType, patterns: string[]): void {
    if (!this.entityPatterns[entity]) {
      this.entityPatterns[entity] = [];
    }
    this.entityPatterns[entity] = [...this.entityPatterns[entity], ...patterns];
  }

  public addCustomRule(rule: ClassificationRule): void {
    this.customRules.push(rule);
  }

  public removeCustomRule(ruleName: string): void {
    this.customRules = this.customRules.filter(r => r.name !== ruleName);
  }

  public setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.confidenceThreshold = threshold;
  }

  public toJSON(): any {
    return {
      keywords: this.keywords,
      entityPatterns: this.entityPatterns,
      customRules: this.customRules.map(rule => ({
        name: rule.name,
        intent: rule.intent,
        entity: rule.entity,
        confidence: rule.confidence,
        method: rule.method,
        pathPattern: rule.pathPattern,
        bodyPattern: rule.bodyPattern
      })),
      confidenceThreshold: this.confidenceThreshold
    };
  }

  public static fromJSON(json: any): IntentConfig {
    const config = new IntentConfig(
      json.keywords,
      json.entityPatterns,
      json.customRules,
      json.confidenceThreshold
    );
    return config;
  }

  public clone(): IntentConfig {
    return new IntentConfig(
      JSON.parse(JSON.stringify(this.keywords)),
      JSON.parse(JSON.stringify(this.entityPatterns)),
      JSON.parse(JSON.stringify(this.customRules)),
      this.confidenceThreshold
    );
  }
}
