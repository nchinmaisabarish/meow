import 'reflect-metadata';
import test from 'ava';
import {
  IntentRegistry,
  Intent,
  IntentNotFoundError,
  InvalidIntentParametersError,
  IntentExecutionError,
} from '../../services/IntentResolver.js';

// Test helper: Create a simple intent handler
const createMockHandler = (returnValue: any) => {
  return async (parameters: any, context?: any) => {
    return returnValue;
  };
};

// Test helper: Create a handler that throws an error
const createErrorHandler = (errorMessage: string) => {
  return async (parameters: any, context?: any) => {
    throw new Error(errorMessage);
  };
};

test('IntentRegistry - should create an empty registry', (t) => {
  const registry = new IntentRegistry();
  t.is(registry.getAllIntents().length, 0);
});

test('IntentRegistry - should register a single intent', (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'test_intent',
    type: 'tool',
    handler: createMockHandler({ success: true }),
  };

  registry.registerIntent(intent);
  
  t.is(registry.getAllIntents().length, 1);
  t.true(registry.hasIntent('test_intent'));
});

test('IntentRegistry - should register multiple intents', (t) => {
  const registry = new IntentRegistry();
  
  const intents: Intent[] = [
    {
      name: 'intent_1',
      type: 'tool',
      handler: createMockHandler({ result: 1 }),
    },
    {
      name: 'intent_2',
      type: 'workflow',
      handler: createMockHandler({ result: 2 }),
    },
  ];

  registry.registerIntents(intents);
  
  t.is(registry.getAllIntents().length, 2);
  t.true(registry.hasIntent('intent_1'));
  t.true(registry.hasIntent('intent_2'));
});

test('IntentRegistry - should get an intent by name', (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'get_test',
    type: 'tool',
    handler: createMockHandler({ data: 'test' }),
    description: 'Test intent',
  };

  registry.registerIntent(intent);
  
  const retrieved = registry.getIntent('get_test');
  t.truthy(retrieved);
  t.is(retrieved?.name, 'get_test');
  t.is(retrieved?.type, 'tool');
  t.is(retrieved?.description, 'Test intent');
});

test('IntentRegistry - should return undefined for non-existent intent', (t) => {
  const registry = new IntentRegistry();
  
  const retrieved = registry.getIntent('non_existent');
  t.is(retrieved, undefined);
  t.false(registry.hasIntent('non_existent'));
});

test('IntentRegistry - should resolve and execute a simple intent', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'simple_intent',
    type: 'tool',
    handler: createMockHandler({ message: 'success' }),
  };

  registry.registerIntent(intent);
  
  const result = await registry.resolveIntent('simple_intent', {});
  
  t.is(result.intent, 'simple_intent');
  t.is(result.type, 'tool');
  t.true(result.success);
  t.deepEqual(result.data, { message: 'success' });
});

test('IntentRegistry - should pass parameters to handler', async (t) => {
  const registry = new IntentRegistry();
  
  const handler = async (parameters: any) => {
    return { received: parameters };
  };

  const intent: Intent = {
    name: 'param_intent',
    type: 'tool',
    handler: handler,
  };

  registry.registerIntent(intent);
  
  const params = { name: 'test', value: 123 };
  const result = await registry.resolveIntent('param_intent', params);
  
  t.deepEqual(result.data.received, params);
});

test('IntentRegistry - should pass context to handler', async (t) => {
  const registry = new IntentRegistry();
  
  const handler = async (parameters: any, context: any) => {
    return { context: context };
  };

  const intent: Intent = {
    name: 'context_intent',
    type: 'tool',
    handler: handler,
  };

  registry.registerIntent(intent);
  
  const context = { user: 'testuser', team: 'testteam' };
  const result = await registry.resolveIntent('context_intent', {}, context);
  
  t.deepEqual(result.data.context, context);
});

test('IntentRegistry - should throw IntentNotFoundError for unknown intent', async (t) => {
  const registry = new IntentRegistry();
  
  await t.throwsAsync(
    async () => {
      await registry.resolveIntent('unknown_intent', {});
    },
    { instanceOf: IntentNotFoundError }
  );
});

test('IntentRegistry - should validate required parameters', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'validated_intent',
    type: 'tool',
    handler: createMockHandler({ success: true }),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    },
  };

  registry.registerIntent(intent);
  
  // Missing required parameter
  await t.throwsAsync(
    async () => {
      await registry.resolveIntent('validated_intent', { name: 'test' });
    },
    { instanceOf: InvalidIntentParametersError }
  );
});

test('IntentRegistry - should validate parameter types', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'typed_intent',
    type: 'tool',
    handler: createMockHandler({ success: true }),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['name', 'count'],
    },
  };

  registry.registerIntent(intent);
  
  // Wrong type for count (should be number)
  await t.throwsAsync(
    async () => {
      await registry.resolveIntent('typed_intent', { name: 'test', count: 'not-a-number' });
    },
    { instanceOf: InvalidIntentParametersError }
  );
});

test('IntentRegistry - should reject additional properties when not allowed', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'strict_intent',
    type: 'tool',
    handler: createMockHandler({ success: true }),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  };

  registry.registerIntent(intent);
  
  // Additional property not allowed
  await t.throwsAsync(
    async () => {
      await registry.resolveIntent('strict_intent', { name: 'test', extra: 'field' });
    },
    { instanceOf: InvalidIntentParametersError }
  );
});

test('IntentRegistry - should allow valid parameters', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'valid_intent',
    type: 'tool',
    handler: createMockHandler({ success: true }),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  };

  registry.registerIntent(intent);
  
  const result = await registry.resolveIntent('valid_intent', {
    name: 'test',
    count: 42,
    active: true,
  });
  
  t.true(result.success);
});

test('IntentRegistry - should wrap handler errors in IntentExecutionError', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'error_intent',
    type: 'tool',
    handler: createErrorHandler('Something went wrong'),
  };

  registry.registerIntent(intent);
  
  await t.throwsAsync(
    async () => {
      await registry.resolveIntent('error_intent', {});
    },
    { instanceOf: IntentExecutionError }
  );
});

test('IntentRegistry - should not wrap validation errors', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'validation_error_intent',
    type: 'tool',
    handler: createMockHandler({ success: true }),
    schema: {
      type: 'object',
      properties: {
        required_field: { type: 'string' },
      },
      required: ['required_field'],
    },
  };

  registry.registerIntent(intent);
  
  const error = await t.throwsAsync(
    async () => {
      await registry.resolveIntent('validation_error_intent', {});
    },
    { instanceOf: InvalidIntentParametersError }
  );
  
  // Should be the original validation error, not wrapped
  t.true(error instanceof InvalidIntentParametersError);
});

test('IntentRegistry - should handle intents without schema', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'no_schema_intent',
    type: 'tool',
    handler: createMockHandler({ result: 'no validation' }),
  };

  registry.registerIntent(intent);
  
  // Should accept any parameters when no schema is defined
  const result = await registry.resolveIntent('no_schema_intent', {
    anything: 'goes',
    here: 123,
  });
  
  t.true(result.success);
  t.deepEqual(result.data, { result: 'no validation' });
});

test('IntentRegistry - should handle workflow type intents', async (t) => {
  const registry = new IntentRegistry();
  
  const intent: Intent = {
    name: 'workflow_intent',
    type: 'workflow',
    handler: createMockHandler({ workflowId: 'wf_123', status: 'running' }),
  };

  registry.registerIntent(intent);
  
  const result = await registry.resolveIntent('workflow_intent', {});
  
  t.is(result.type, 'workflow');
  t.true(result.success);
  t.is(result.data.workflowId, 'wf_123');
});
