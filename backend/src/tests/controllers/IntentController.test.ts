import 'reflect-metadata';
import test from 'ava';
import request from 'supertest';
import { Helper } from '../helpers/helper.js';

const URL = process.env.URL!;

const context = {
  token: '',
  user: Helper.createRandomUser(),
  accountId: '',
  laneId: '',
};

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
  context.user._id = res.body.user.id;
  context.user.teamId = res.body.team.id;

  t.is(res.statusCode, 200);
});

test.serial('/api/intent GET - should list all available intents', async (t) => {
  const res = await request(URL)
    .get('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.intents);
  t.true(Array.isArray(res.body.intents));
  t.true(res.body.count > 0);
  
  // Verify expected intents are registered
  const intentNames = res.body.intents.map((intent: any) => intent.name);
  t.true(intentNames.includes('create_account'));
  t.true(intentNames.includes('list_accounts'));
  t.true(intentNames.includes('get_account'));
  t.true(intentNames.includes('create_card'));
  t.true(intentNames.includes('list_cards'));
  t.true(intentNames.includes('run_card_workflow'));
});

test.serial('/api/intent POST - should reject request without intent field', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      parameters: {},
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial('/api/intent POST - should reject request with invalid content type', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'text/plain')
    .set('Token', context.token)
    .send('invalid');

  t.is(res.statusCode, 400);
});

test.serial('/api/intent POST - should reject request without authentication', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .send({
      intent: 'list_accounts',
      parameters: {},
    });

  t.is(res.statusCode, 401);
});

test.serial('/api/intent POST - should return 404 for unknown intent', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'unknown_intent',
      parameters: {},
    });

  t.is(res.statusCode, 404);
  t.is(res.type, 'application/json');
});

test.serial('/api/intent POST - should execute list_accounts intent', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'list_accounts',
      parameters: {},
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.is(res.body.intent, 'list_accounts');
  t.is(res.body.type, 'tool');
  t.is(res.body.success, true);
  t.truthy(res.body.data);
  t.truthy(res.body.data.accounts);
  t.true(Array.isArray(res.body.data.accounts));
});

test.serial('/api/intent POST - should execute create_account intent', async (t) => {
  const accountName = `Test Account ${Helper.generateRandomString(6)}`;
  
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'create_account',
      parameters: {
        name: accountName,
        attributes: {
          industry: 'Technology',
          size: 'Medium',
        },
      },
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.is(res.body.intent, 'create_account');
  t.is(res.body.type, 'tool');
  t.is(res.body.success, true);
  t.truthy(res.body.data);
  t.truthy(res.body.data.account);
  t.is(res.body.data.account.name, accountName);
  t.truthy(res.body.data.account._id);
  
  // Save account ID for later tests
  context.accountId = res.body.data.account._id;
});

test.serial('/api/intent POST - should reject create_account without required parameters', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'create_account',
      parameters: {
        // Missing required 'name' parameter
        attributes: {},
      },
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial('/api/intent POST - should execute get_account intent', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'get_account',
      parameters: {
        accountId: context.accountId,
      },
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.is(res.body.intent, 'get_account');
  t.is(res.body.type, 'tool');
  t.is(res.body.success, true);
  t.truthy(res.body.data);
  t.truthy(res.body.data.account);
  t.is(res.body.data.account._id, context.accountId);
});

test.serial('/api/intent POST - should execute list_cards intent', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'list_cards',
      parameters: {},
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.is(res.body.intent, 'list_cards');
  t.is(res.body.type, 'tool');
  t.is(res.body.success, true);
  t.truthy(res.body.data);
  t.truthy(res.body.data.cards);
  t.true(Array.isArray(res.body.data.cards));
});

test.serial('/api/intent POST - should get lane ID for card creation', async (t) => {
  const res = await request(URL)
    .get('/api/lanes')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 200);
  t.true(Array.isArray(res.body));
  t.true(res.body.length > 0);
  
  // Save first lane ID for card creation test
  context.laneId = res.body[0]._id;
});

test.serial('/api/intent POST - should execute create_card intent', async (t) => {
  const cardName = `Test Card ${Helper.generateRandomString(6)}`;
  
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'create_card',
      parameters: {
        name: cardName,
        amount: 5000,
        laneId: context.laneId,
      },
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.is(res.body.intent, 'create_card');
  t.is(res.body.type, 'tool');
  t.is(res.body.success, true);
  t.truthy(res.body.data);
  t.truthy(res.body.data.card);
  t.is(res.body.data.card.name, cardName);
  t.is(res.body.data.card.amount, 5000);
});

test.serial('/api/intent POST - should reject create_card with invalid parameters', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'create_card',
      parameters: {
        name: 'Test Card',
        // Missing required 'amount' parameter
        laneId: context.laneId,
      },
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial('/api/intent POST - should reject create_card with additional properties', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'create_card',
      parameters: {
        name: 'Test Card',
        amount: 1000,
        laneId: context.laneId,
        invalidField: 'should not be allowed',
      },
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial('/api/intent POST - should execute run_card_workflow intent (placeholder)', async (t) => {
  // First create a card to use in the workflow
  const createRes = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'create_card',
      parameters: {
        name: 'Workflow Test Card',
        amount: 3000,
        laneId: context.laneId,
      },
    });

  const cardId = createRes.body.data.card._id;

  // Execute workflow intent
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'run_card_workflow',
      parameters: {
        cardId: cardId,
        workflowType: 'test_workflow',
      },
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.is(res.body.intent, 'run_card_workflow');
  t.is(res.body.type, 'workflow');
  t.is(res.body.success, true);
  t.truthy(res.body.data);
  t.truthy(res.body.data.workflowId);
  t.is(res.body.data.cardId, cardId);
  t.is(res.body.data.status, 'initiated');
});

test.serial('/api/intent POST - should handle intent execution errors gracefully', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      intent: 'get_account',
      parameters: {
        accountId: 'invalid_id_format',
      },
    });

  // Should return 500 for execution errors
  t.true(res.statusCode >= 400);
  t.is(res.type, 'application/json');
});
