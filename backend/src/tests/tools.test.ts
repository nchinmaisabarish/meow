import test from 'ava';
import { createCardTool } from '../tools/CardTools.js';
import { tools } from '../tools/index.js';

test('tools registry exports at least one tool', (t: any) => {
  t.true(tools.length > 0, 'Tools registry should contain at least one tool');
});

test('createCardTool has required properties', (t: any) => {
  t.is(createCardTool.name, 'create_card', 'Tool should have correct name');
  t.truthy(createCardTool.description, 'Tool should have a description');
  t.truthy(createCardTool.schema, 'Tool should have a schema');
});

test('createCardTool schema validates correct input', (t: any) => {
  const validInput = {
    cardTitle: 'Test Card',
    laneId: '507f1f77bcf86cd799439011',
    accountId: '507f1f77bcf86cd799439012',
    amount: 1000,
  };

  const result = createCardTool.schema.safeParse(validInput);
  t.true(result.success, 'Valid input should pass schema validation');
});

test('createCardTool schema rejects invalid input', (t: any) => {
  const invalidInput = {
    cardTitle: 'Test Card',
    // missing required laneId and accountId
  };

  const result = createCardTool.schema.safeParse(invalidInput);
  t.false(result.success, 'Invalid input should fail schema validation');
});

test('createCardTool schema has correct default values', (t: any) => {
  const inputWithDefaults = {
    cardTitle: 'Test Card',
    laneId: '507f1f77bcf86cd799439011',
    accountId: '507f1f77bcf86cd799439012',
  };

  const result = createCardTool.schema.safeParse(inputWithDefaults);
  if (result.success) {
    t.is(result.data.amount, 0, 'Amount should default to 0');
  } else {
    t.fail('Schema parsing should succeed');
  }
});

test('createCardTool is callable', (t: any) => {
  t.is(typeof createCardTool.invoke, 'function', 'Tool should have an invoke method');
  t.is(typeof createCardTool.call, 'function', 'Tool should have a call method');
});
