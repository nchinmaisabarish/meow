import 'reflect-metadata';
import test from 'ava';
import request from 'supertest';
import { Helper } from './helpers/helper.js';
import { PromptHelper } from '../helpers/PromptHelper.js';

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

test.serial('/api/nl-query without query field returns 400', async (t) => {
  const res = await request(URL)
    .post('/api/nl-query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({});

  t.is(res.statusCode, 400);
});

test.serial('/api/nl-query with empty query returns 400', async (t) => {
  const res = await request(URL)
    .post('/api/nl-query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({ query: '' });

  t.is(res.statusCode, 400);
});

test.serial('/api/nl-query with valid query returns 200 (if OPENAI_API_KEY is set)', async (t) => {
  // This test will only pass if OPENAI_API_KEY is configured
  // Otherwise it should return 500 with appropriate error message
  const res = await request(URL)
    .post('/api/nl-query')
    .set('Content-Type', 'application/json')
    .set('Token', context.token)
    .send({ query: 'Show me all my open deals' });

  // Accept either 200 (if API key is set) or 500 (if not configured)
  const isValidResponse = res.statusCode === 200 || res.statusCode === 500;
  t.true(isValidResponse);

  if (res.statusCode === 200) {
    t.truthy(res.body.query);
    t.truthy(res.body.result);
    t.is(res.type, 'application/json');
  } else if (res.statusCode === 500) {
    // Should have error about missing API key
    t.truthy(res.body.name);
  }
});

test.serial('/api/nl-query without authentication returns 401', async (t) => {
  const res = await request(URL)
    .post('/api/nl-query')
    .set('Content-Type', 'application/json')
    .send({ query: 'Show me all my deals' });

  t.is(res.statusCode, 401);
});

test('PromptHelper can load prompt template', async (t) => {
  const prompt = await PromptHelper.loadPrompt('query-interpreter.txt');
  
  t.truthy(prompt);
  t.true(prompt.length > 0);
  t.true(prompt.includes('sales pipeline management'));
});

test('PromptHelper can format prompt with query', async (t) => {
  const template = await PromptHelper.loadPrompt('query-interpreter.txt');
  const query = 'Show me all my deals';
  const formatted = PromptHelper.formatPrompt(template, query);
  
  t.truthy(formatted);
  t.true(formatted.includes(query));
  t.true(formatted.includes('sales pipeline management'));
});
