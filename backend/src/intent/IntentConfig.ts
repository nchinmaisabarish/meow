export enum IntentType {
  QUERY = 'query',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SEARCH = 'search',
  AGGREGATE = 'aggregate',
  AUTHENTICATE = 'authenticate',
  AUTHORIZE = 'authorize',
  VALIDATE = 'validate',
  TRANSFORM = 'transform',
  EXPORT = 'export',
  IMPORT = 'import',
  NOTIFY = 'notify',
  UNKNOWN = 'unknown',
}

export enum IntentCategory {
  DATA_OPERATION = 'data_operation',
  SECURITY = 'security',
  TRANSFORMATION = 'transformation',
  COMMUNICATION = 'communication',
  SYSTEM = 'system',
}

export interface IntentMappingSchema {
  intentType: IntentType;
  category: IntentCategory;
  httpMethods?: string[];
  pathPatterns?: string[];
  controllerAction?: string;
  priority?: number;
  enabled?: boolean;
}

export const DEFAULT_INTENT_MAPPINGS: IntentMappingSchema[] = [
  {
    intentType: IntentType.QUERY,
    category: IntentCategory.DATA_OPERATION,
    httpMethods: ['GET'],
    pathPatterns: ['/api/*'],
    priority: 1,
    enabled: true,
  },
  {
    intentType: IntentType.CREATE,
    category: IntentCategory.DATA_OPERATION,
    httpMethods: ['POST'],
    pathPatterns: ['/api/*'],
    priority: 1,
    enabled: true,
  },
  {
    intentType: IntentType.UPDATE,
    category: IntentCategory.DATA_OPERATION,
    httpMethods: ['PUT', 'PATCH'],
    pathPatterns: ['/api/*'],
    priority: 1,
    enabled: true,
  },
  {
    intentType: IntentType.DELETE,
    category: IntentCategory.DATA_OPERATION,
    httpMethods: ['DELETE'],
    pathPatterns: ['/api/*'],
    priority: 1,
    enabled: true,
  },
  {
    intentType: IntentType.SEARCH,
    category: IntentCategory.DATA_OPERATION,
    httpMethods: ['GET', 'POST'],
    pathPatterns: ['/api/*/search', '/api/search/*'],
    priority: 2,
    enabled: true,
  },
  {
    intentType: IntentType.AUTHENTICATE,
    category: IntentCategory.SECURITY,
    httpMethods: ['POST'],
    pathPatterns: ['/api/auth/*', '/api/login', '/api/signin'],
    priority: 3,
    enabled: true,
  },
  {
    intentType: IntentType.EXPORT,
    category: IntentCategory.TRANSFORMATION,
    httpMethods: ['GET', 'POST'],
    pathPatterns: ['/api/*/export', '/api/export/*'],
    priority: 2,
    enabled: true,
  },
  {
    intentType: IntentType.IMPORT,
    category: IntentCategory.TRANSFORMATION,
    httpMethods: ['POST'],
    pathPatterns: ['/api/*/import', '/api/import/*'],
    priority: 2,
    enabled: true,
  },
];

export interface IntentConfigOptions {
  enableDefaultMappings?: boolean;
  customMappings?: IntentMappingSchema[];
  fallbackIntent?: IntentType;
  confidenceThreshold?: number;
}

export class IntentConfig {
  private mappings: IntentMappingSchema[];
  private fallbackIntent: IntentType;
  private confidenceThreshold: number;

  constructor(options: IntentConfigOptions = {}) {
    this.mappings = [];
    this.fallbackIntent = options.fallbackIntent || IntentType.UNKNOWN;
    this.confidenceThreshold = options.confidenceThreshold || 0.5;

    if (options.enableDefaultMappings !== false) {
      this.mappings.push(...DEFAULT_INTENT_MAPPINGS);
    }

    if (options.customMappings) {
      this.mappings.push(...options.customMappings);
    }

    this.sortMappingsByPriority();
  }

  addMapping(mapping: IntentMappingSchema): void {
    this.mappings.push(mapping);
    this.sortMappingsByPriority();
  }

  removeMapping(intentType: IntentType): void {
    this.mappings = this.mappings.filter((m) => m.intentType !== intentType);
  }

  getMappings(): IntentMappingSchema[] {
    return this.mappings.filter((m) => m.enabled !== false);
  }

  getMappingByIntent(intentType: IntentType): IntentMappingSchema | undefined {
    return this.mappings.find((m) => m.intentType === intentType && m.enabled !== false);
  }

  getMappingsByCategory(category: IntentCategory): IntentMappingSchema[] {
    return this.mappings.filter((m) => m.category === category && m.enabled !== false);
  }

  getFallbackIntent(): IntentType {
    return this.fallbackIntent;
  }

  setFallbackIntent(intentType: IntentType): void {
    this.fallbackIntent = intentType;
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.confidenceThreshold = threshold;
  }

  private sortMappingsByPriority(): void {
    this.mappings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}

export const defaultIntentConfig = new IntentConfig();
