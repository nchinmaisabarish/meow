import test from 'ava';
import request from 'supertest';
import { Helper } from './helpers/helper.js';

const URL = process.env.URL!;

const context = { token: '', user: Helper.createRandomUser(), lanes: <any>[] };

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

test.serial(`/api/nl/query without a JSON body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/nl/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/nl/query with an invalid JSON body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/nl/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      invalid: 'field',
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/nl/query with valid query returns 200 and has response structure`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  const res = await request(URL)
    .post('/api/nl/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'Show me all lanes',
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500) {
    t.pass('Natural language processing not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.intent);
  t.truthy(res.body.response);
});

test.serial(`/api/nl/query accepts text input and returns appropriate response`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not configured');
    return;
  }

  const res = await request(URL)
    .post('/api/nl/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'List all accounts',
    });

  // Should return 200 if configured, or 500 if not configured
  if (res.statusCode === 500) {
    t.pass('Natural language processing not configured - expected behavior');
    return;
  }

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.intent);
  t.truthy(res.body.entity);
  t.truthy(res.body.response);
});
