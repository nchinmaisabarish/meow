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

test.serial(`/api/intent without a JSON body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 400);
});

test.serial(`/api/intent with empty query returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: '',
    });

  t.is(res.statusCode, 400);
});

test.serial(`/api/intent with valid query returns 200`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not set
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'Show me my cards',
    });

  t.is(res.statusCode, 200);
  t.true(res.body.success !== undefined);
});

test.serial(`/api/intent requesting cards returns structured response`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not set
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'List all my deals',
    });

  t.is(res.statusCode, 200);
  t.true(res.body.success === true);
  t.true(res.body.result !== undefined);
});

test.serial(`/api/intent requesting accounts returns structured response`, async (t) => {
  // Skip this test if OPENAI_API_KEY is not set
  if (!process.env.OPENAI_API_KEY) {
    t.pass('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'Show me all accounts',
    });

  t.is(res.statusCode, 200);
  t.true(res.body.success === true);
  t.true(res.body.result !== undefined);
});

test.serial(`/api/intent without authentication returns 401`, async (t) => {
  const res = await request(URL)
    .post('/api/intent')
    .set('Content-Type', 'application/json')
    .send({
      query: 'Show me my cards',
    });

  t.is(res.statusCode, 401);
});
