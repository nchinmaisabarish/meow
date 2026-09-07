import test from 'ava';
import request from 'supertest';
import { Helper } from './helpers/helper.js';
import { workflowExecutor } from '../services/WorkflowExecutor.js';
import {
  CardLifecycleStage,
  CardOperation,
  CardWorkflowState,
} from '../workflows/CardLifecycleGraph.js';

const URL = process.env.URL!;

const context = {
  token: '',
  user: Helper.createRandomUser(),
  lanes: <any>[],
  cardId: '',
};

test.serial(`Setup: Register user for workflow tests`, async (t: any) => {
  const res = await request(URL)
    .post('/public/register')
    .set('Content-Type', 'application/json')
    .send({
      name: context.user.name,
      password: context.user.password,
    });

  t.is(res.statusCode, 201);
});

test.serial(`Setup: Login user for workflow tests`, async (t: any) => {
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

test.serial(`Setup: Get lanes for workflow tests`, async (t: any) => {
  const res = await request(URL)
    .get('/api/lanes')
    .set('Content-Type', 'application/json')
    .set('Token', context.token);

  context.lanes = res.body;

  t.is(res.statusCode, 200);
  t.true(context.lanes.length > 0);
});

test.serial(`Workflow: Create card through workflow executor`, async (t: any) => {
  const card = await workflowExecutor.executeCreateCard({
    userId: context.user._id,
    teamId: context.user.teamId,
    laneId: context.lanes[0]._id,
    name: 'Workflow Test Card',
    amount: 1000,
  });

  context.cardId = card._id.toString();

  t.truthy(card);
  t.is(card.name, 'Workflow Test Card');
  t.is(card.amount, 1000);
  t.is(card.laneId.toString(), context.lanes[0]._id.toString());
});

test.serial(`Workflow: Update card through workflow executor`, async (t: any) => {
  const updatedCard = await workflowExecutor.executeUpdateCard({
    cardId: context.cardId,
    userId: context.user._id,
    name: 'Updated Workflow Card',
    amount: 2000,
    laneId: context.lanes[0]._id,
  });

  t.truthy(updatedCard);
  t.is(updatedCard.name, 'Updated Workflow Card');
  t.is(updatedCard.amount, 2000);
});

test.serial(`Workflow: Get card through workflow executor`, async (t: any) => {
  const card = await workflowExecutor.executeGetCard({
    cardId: context.cardId,
    userId: context.user._id,
  });

  t.truthy(card);
  t.is(card._id.toString(), context.cardId);
  t.is(card.name, 'Updated Workflow Card');
});

test.serial(`Workflow: Validate workflow state transitions`, async (t: any) => {
  // Initialize the workflow graph
  workflowExecutor.initializeGraph();

  // Test workflow state for create operation
  const createState: CardWorkflowState = {
    stage: CardLifecycleStage.DRAFT,
    operation: CardOperation.CREATE,
    name: 'Test Card',
    amount: 500,
    laneId: context.lanes[0]._id,
    userId: context.user._id,
    teamId: context.user.teamId,
    isValid: false,
  };

  const finalState = await workflowExecutor.getWorkflowState(createState);

  // Verify workflow completed successfully
  t.is(finalState.stage, CardLifecycleStage.COMPLETE);
  t.is(finalState.isValid, true);
  t.falsy(finalState.error);
});

test.serial(`Workflow: Validate error handling for invalid card data`, async (t: any) => {
  // Test workflow with invalid data (missing name)
  const invalidState: CardWorkflowState = {
    stage: CardLifecycleStage.DRAFT,
    operation: CardOperation.CREATE,
    name: '', // Invalid: empty name
    amount: 500,
    laneId: context.lanes[0]._id,
    userId: context.user._id,
    teamId: context.user.teamId,
    isValid: false,
  };

  const finalState = await workflowExecutor.getWorkflowState(invalidState);

  // Verify workflow failed with error
  t.is(finalState.stage, CardLifecycleStage.ERROR);
  t.is(finalState.isValid, false);
  t.truthy(finalState.error);
  t.true(finalState.error!.includes('Card name is required'));
});

test.serial(`Workflow: Validate assignment logic in workflow`, async (t: any) => {
  // Test workflow with assignment
  const assignState: CardWorkflowState = {
    stage: CardLifecycleStage.DRAFT,
    operation: CardOperation.CREATE,
    name: 'Assigned Card',
    amount: 750,
    laneId: context.lanes[0]._id,
    userId: context.user._id,
    teamId: context.user.teamId,
    assignedUserId: context.user._id, // Assign to same user
    isValid: false,
  };

  const finalState = await workflowExecutor.getWorkflowState(assignState);

  // Verify workflow completed and assignment was processed
  t.is(finalState.stage, CardLifecycleStage.COMPLETE);
  t.is(finalState.isValid, true);
  t.is(finalState.assignedUserId, context.user._id);
});

test.serial(`Workflow: Delete card through workflow executor`, async (t: any) => {
  const deletedCard = await workflowExecutor.executeDeleteCard({
    cardId: context.cardId,
    userId: context.user._id,
  });

  t.truthy(deletedCard);
  t.is(deletedCard._id.toString(), context.cardId);
  t.is(deletedCard.status, 'deleted');
});

test.serial(`Workflow: Validate update operation requires cardId`, async (t: any) => {
  // Test workflow with update operation but missing cardId
  const invalidUpdateState: CardWorkflowState = {
    stage: CardLifecycleStage.DRAFT,
    operation: CardOperation.UPDATE,
    name: 'Update Test',
    amount: 500,
    laneId: context.lanes[0]._id,
    userId: context.user._id,
    teamId: context.user.teamId,
    // Missing cardId
    isValid: false,
  };

  const finalState = await workflowExecutor.getWorkflowState(invalidUpdateState);

  // Verify workflow failed with error
  t.is(finalState.stage, CardLifecycleStage.ERROR);
  t.is(finalState.isValid, false);
  t.truthy(finalState.error);
  t.true(finalState.error!.includes('Card ID is required'));
});
