import test from 'ava';
import request from 'supertest';
import { Helper } from './helpers/helper.js';

const URL = process.env.URL!;

const context = { token: '', user: Helper.createRandomUser() };

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

test.serial('/api/intent/tools with valid token returns 200 and lists available tools', async (t) => {
  const res = await request(URL)
    .get('/api/intent/tools')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.true(res.body.success);
  t.true(Array.isArray(res.body.tools));
  t.true(res.body.tools.length > 0);
  
  // Verify tool structure
  const firstTool = res.body.tools[0];
  t.true(typeof firstTool.name === 'string');
  t.true(typeof firstTool.description === 'string');
});

test.serial('/api/intent without a JSON body returns 400', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
  t.false(res.body.success);
});

test.serial('/api/intent with invalid query type returns 400', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 123,
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
  t.false(res.body.success);
});

test.serial('/api/intent with valid query for listing cards returns 200', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'Show me all my cards',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  
  // The response should have intent resolution information
  t.true(typeof res.body.success !== 'undefined');
  
  // If successful, should have intent information
  if (res.body.success) {
    t.true(typeof res.body.intent === 'string');
  }
});

test.serial('/api/intent with valid query for listing accounts returns 200', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'List all accounts',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  
  // The response should have intent resolution information
  t.true(typeof res.body.success !== 'undefined');
  
  // If successful, should have intent information
  if (res.body.success) {
    t.true(typeof res.body.intent === 'string');
  }
});

test.serial('/api/intent without authentication returns 401', async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .send({
      query: 'Show me all cards',
    });

  t.is(res.statusCode, 401);
});
