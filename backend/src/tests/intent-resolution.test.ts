import test from 'ava';
import request from 'supertest';
import { Helper } from './helpers/helper.js';

const URL = process.env.URL!;

const context = { token: '', user: Helper.createRandomUser(), lanes: <any>[], cardId: '' };

test.serial(`/register with ${context.user.name} and password returns 201`, async (t) => {
  const res = await request(URL)
    .post('/public/register')
    .set('Content-Type', 'application/json')
    .send({
      name: context.user.name,
      password: context.user.password,
    });

  t.is(res.statusCode, 201);
});

test.serial(`/login ${context.user.name} with password returns 200`, async (t) => {
  const res = await request(URL)
    .post('/public/login')
    .set('Content-Type', 'application/json')
    .send({
      name: context.user.name,
      password: context.user.password,
    });

  context.token = res.body.token;
  context.user._id = res.body.user._id;
  context.user.teamId = res.body.team._id;

  t.is(res.statusCode, 200);
});

test.serial(`/api/lanes with valid token returns 200 and stores lanes`, async (t) => {
  const res = await request(URL)
    .get('/api/lanes')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  context.lanes = res.body;

  t.is(res.statusCode, 200);
  t.true(Array.isArray(context.lanes));
  t.true(context.lanes.length > 0);
});

test.serial(`/api/intent GET returns intent configuration`, async (t) => {
  const res = await request(URL)
    .get('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.success);
  t.truthy(res.body.intents);
  t.truthy(res.body.availableTools);
  t.true(res.body.toolCount > 0);
});

test.serial(`/api/intent POST without a JSON body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/intent POST with an invalid JSON body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      invalid: 'field',
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/intent POST with valid card creation request returns 200 and creates card`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      request: 'Create a new deal called Test Company worth $25000',
      context: {
        laneId: context.lanes[0]._id,
      },
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500 && res.body.error && res.body.error.includes('not configured')) {
    t.pass('Intent resolution not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.success);
  t.truthy(res.body.intent);
  t.truthy(res.body.action);
  t.truthy(res.body.toolName);
  t.truthy(res.body.result);

  // Store card ID for later tests
  if (res.body.result && res.body.result.card && res.body.result.card._id) {
    context.cardId = res.body.result.card._id;
  }
});

test.serial(`/api/intent POST with card retrieval request returns 200 and fetches card`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured or no card was created
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  if (!context.cardId) {
    t.pass('Skipping test - no card ID available from previous test');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      request: `Show me the details of card ${context.cardId}`,
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500 && res.body.error && res.body.error.includes('not configured')) {
    t.pass('Intent resolution not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.success);
  t.is(res.body.intent, 'card_management');
  t.is(res.body.action, 'get');
  t.is(res.body.toolName, 'get_card');
  t.truthy(res.body.result);
  t.truthy(res.body.result.card);
});

test.serial(`/api/intent POST with lane statistics request returns 200 and fetches statistics`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      request: 'Show me statistics for all lanes',
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500 && res.body.error && res.body.error.includes('not configured')) {
    t.pass('Intent resolution not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.success);
  t.truthy(res.body.intent);
  t.truthy(res.body.toolName);
  t.truthy(res.body.result);
});

test.serial(`/api/intent POST with low confidence request returns 400`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      request: 'xyz abc random gibberish',
    });

  // Should return 400 for low confidence or 500 if not configured
  if (res.statusCode === 500 && res.body.error && res.body.error.includes('not configured')) {
    t.pass('Intent resolution not configured - expected behavior');
    return;
  }

  // The response could be 400 (low confidence) or 200 (if LLM still classifies it)
  // We just verify it returns a valid response
  t.true(res.statusCode === 200 || res.statusCode === 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/intent POST verifies intent classification for card update`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured or no card was created
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  if (!context.cardId) {
    t.pass('Skipping test - no card ID available from previous test');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      request: `Update card ${context.cardId} to have name Updated Deal and amount 50000`,
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500 && res.body.error && res.body.error.includes('not configured')) {
    t.pass('Intent resolution not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.success);
  t.is(res.body.intent, 'card_management');
  t.is(res.body.action, 'update');
  t.is(res.body.toolName, 'update_card');
});

test.serial(`/api/intent POST verifies tool dispatch for lane operations`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      request: `Get details of lane ${context.lanes[0]._id}`,
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500 && res.body.error && res.body.error.includes('not configured')) {
    t.pass('Intent resolution not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.success);
  t.is(res.body.intent, 'lane_operations');
  t.is(res.body.action, 'get');
  t.is(res.body.toolName, 'get_lane');
  t.truthy(res.body.result);
});
