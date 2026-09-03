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

test.serial(`/api/query without a JSON body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/query with an empty query returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: '',
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/query with an invalid body returns 400`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      invalidField: 'test',
    });

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial(`/api/query with a valid query returns 200 and has expected structure`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'Show me all my cards',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.response);
  t.is(typeof res.body.response, 'string');
  t.truthy(res.body.query);
  t.is(res.body.query, 'Show me all my cards');
});

test.serial(`/api/query with a forecast query returns 200 with forecast intent`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'What is my revenue forecast for this month?',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.response);
  t.is(typeof res.body.response, 'string');
  t.is(res.body.intent, 'forecast');
});

test.serial(`/api/query with an account query returns 200 with accounts intent`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'List all my customer accounts',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.response);
  t.is(typeof res.body.response, 'string');
  t.is(res.body.intent, 'accounts');
});

test.serial(`/api/query without authentication token returns 401`, async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .send({
      query: 'Show me all my cards',
    });

  t.is(res.statusCode, 401);
});
