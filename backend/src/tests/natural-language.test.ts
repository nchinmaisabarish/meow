import 'reflect-metadata';
import test from 'ava';
import request from 'supertest';
import { Helper } from './helpers/helper.js';

const URL = process.env.URL!;

const context = {
  token: '',
  user: Helper.createRandomUser(),
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

test.serial('/api/query without a query body returns 400', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({});

  t.is(res.statusCode, 400);
  t.is(res.type, 'application/json');
});

test.serial('/api/query with invalid content type returns 400', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'text/plain')
    .set('Token', context.token)
    .send('show me my deals');

  t.is(res.statusCode, 400);
});

test.serial('/api/query without token returns 401', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .send({
      query: 'show me my deals',
    });

  t.is(res.statusCode, 401);
});

test.serial('/api/query with valid query about deals returns 200', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'show me all my deals',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.true(Array.isArray(res.body) || typeof res.body === 'object');
});

test.serial('/api/query with valid query about accounts returns 200', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'what accounts do we have?',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.true(Array.isArray(res.body) || typeof res.body === 'object');
});

test.serial('/api/query with valid query about forecast returns 200', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'show me the sales forecast',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
});

test.serial('/api/query with unrelated query returns appropriate response', async (t) => {
  const res = await request(URL)
    .post('/api/query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({
      query: 'what is the weather today?',
    });

  t.is(res.statusCode, 200);
  t.is(res.type, 'application/json');
  t.truthy(res.body.message || res.body.natural_response);
});
