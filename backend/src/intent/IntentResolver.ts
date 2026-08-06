export interface IntentRequest {
  raw: any;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface IntentResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IntentResolver {
  resolveIntent(request: IntentRequest): Promise<IntentResponse>;
}

export interface IntentHandler {
  name: string;
  description?: string;
  handler: (request: IntentRequest) => Promise<IntentResponse>;
  priority?: number;
  matcher?: (request: IntentRequest) => boolean;
}
