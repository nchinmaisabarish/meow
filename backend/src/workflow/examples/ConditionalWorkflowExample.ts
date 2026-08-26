import { WorkflowExecutor, WorkflowDefinition } from '../WorkflowExecutor';
import { ExecutionContext } from '../ExecutionContext';
import { ConditionalStep, SimpleCondition, CompositeCondition } from '../ConditionalStep';
import { WorkflowStep } from '../WorkflowStep';

class SimpleStep implements WorkflowStep {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private action: (context: ExecutionContext) => Promise<void>
  ) {}

  async execute(context: ExecutionContext): Promise<void> {
    await this.action(context);
  }
}

export async function runConditionalWorkflowExample(): Promise<void> {
  console.log('\n=== Conditional Workflow Example ===\n');

  const executor = new WorkflowExecutor();

  const initStep = new SimpleStep(
    'init',
    'Initialize',
    async (context) => {
      context.log('Initializing workflow');
      context.setVariable('userAge', 25);
      context.setVariable('userRole', 'admin');
      context.setVariable('accountBalance', 1500);
    }
  );

  const ageCheckStep = new ConditionalStep(
    'ageCheck',
    'Check User Age',
    [
      {
        condition: new SimpleCondition('userAge', 'greaterThan', 18),
        nextStepId: 'roleCheck'
      },
      {
        condition: new SimpleCondition('userAge', 'lessThan', 18),
        nextStepId: 'underageHandler'
      }
    ],
    'unknownAgeHandler'
  );

  const roleCheckStep = new ConditionalStep(
    'roleCheck',
    'Check User Role',
    [
      {
        condition: new CompositeCondition(
          [
            new SimpleCondition('userRole', 'equals', 'admin'),
            new SimpleCondition('accountBalance', 'greaterThan', 1000)
          ],
          'and'
        ),
        nextStepId: 'adminHandler'
      },
      {
        condition: new SimpleCondition('userRole', 'equals', 'user'),
        nextStepId: 'userHandler'
      }
    ],
    'guestHandler'
  );

  const adminHandlerStep = new SimpleStep(
    'adminHandler',
    'Admin Handler',
    async (context) => {
      context.log('Processing as admin with sufficient balance');
      context.setVariable('accessLevel', 'full');
      context.setVariable('canApprove', true);
    }
  );

  const userHandlerStep = new SimpleStep(
    'userHandler',
    'User Handler',
    async (context) => {
      context.log('Processing as regular user');
      context.setVariable('accessLevel', 'limited');
      context.setVariable('canApprove', false);
    }
  );

  const guestHandlerStep = new SimpleStep(
    'guestHandler',
    'Guest Handler',
    async (context) => {
      context.log('Processing as guest');
      context.setVariable('accessLevel', 'minimal');
      context.setVariable('canApprove', false);
    }
  );

  const underageHandlerStep = new SimpleStep(
    'underageHandler',
    'Underage Handler',
    async (context) => {
      context.log('User is underage, restricting access');
      context.setVariable('accessLevel', 'restricted');
      context.setVariable('canApprove', false);
    }
  );

  const unknownAgeHandlerStep = new SimpleStep(
    'unknownAgeHandler',
    'Unknown Age Handler',
    async (context) => {
      context.log('Age verification required');
      context.setVariable('accessLevel', 'pending');
      context.setVariable('requiresVerification', true);
    }
  );

  const finalizeStep = new SimpleStep(
    'finalize',
    'Finalize',
    async (context) => {
      const accessLevel = context.getVariable('accessLevel');
      const canApprove = context.getVariable('canApprove');
      context.log(`Workflow completed with access level: ${accessLevel}`);
      context.log(`Approval permission: ${canApprove}`);
    }
  );

  const workflow: WorkflowDefinition = {
    id: 'conditional-example',
    name: 'Conditional Workflow Example',
    steps: [
      initStep,
      ageCheckStep,
      roleCheckStep,
      adminHandlerStep,
      userHandlerStep,
      guestHandlerStep,
      underageHandlerStep,
      unknownAgeHandlerStep,
      finalizeStep
    ],
    startStepId: 'init'
  };

  const validation = executor.validateWorkflow(workflow);
  if (!validation.valid) {
    console.error('Workflow validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    return;
  }

  executor.registerWorkflow(workflow);

  console.log('Scenario 1: Admin user with sufficient balance');
  const context1 = new ExecutionContext();
  const result1 = await executor.executeWorkflow('conditional-example', context1);
  console.log(`Success: ${result1.success}`);
  console.log(`Executed steps: ${result1.executedSteps.join(' -> ')}`);
  console.log(`Duration: ${result1.duration}ms`);
  console.log(`Access Level: ${result1.context.getVariable('accessLevel')}`);
  console.log(`Can Approve: ${result1.context.getVariable('canApprove')}`);
  console.log('\nLogs:');
  result1.context.getLogs().forEach(log => console.log(`  ${log}`));

  console.log('\n---\n');

  console.log('Scenario 2: Regular user');
  const context2 = new ExecutionContext({
    userAge: 30,
    userRole: 'user',
    accountBalance: 500
  });
  const result2 = await executor.executeWorkflow('conditional-example', context2);
  console.log(`Success: ${result2.success}`);
  console.log(`Executed steps: ${result2.executedSteps.join(' -> ')}`);
  console.log(`Duration: ${result2.duration}ms`);
  console.log(`Access Level: ${result2.context.getVariable('accessLevel')}`);
  console.log(`Can Approve: ${result2.context.getVariable('canApprove')}`);

  console.log('\n---\n');

  console.log('Scenario 3: Underage user');
  const context3 = new ExecutionContext({
    userAge: 16,
    userRole: 'user',
    accountBalance: 100
  });
  const result3 = await executor.executeWorkflow('conditional-example', context3);
  console.log(`Success: ${result3.success}`);
  console.log(`Executed steps: ${result3.executedSteps.join(' -> ')}`);
  console.log(`Duration: ${result3.duration}ms`);
  console.log(`Access Level: ${result3.context.getVariable('accessLevel')}`);

  console.log('\n---\n');

  console.log('Scenario 4: Guest user (unknown role)');
  const context4 = new ExecutionContext({
    userAge: 22,
    userRole: 'guest',
    accountBalance: 0
  });
  const result4 = await executor.executeWorkflow('conditional-example', context4);
  console.log(`Success: ${result4.success}`);
  console.log(`Executed steps: ${result4.executedSteps.join(' -> ')}`);
  console.log(`Duration: ${result4.duration}ms`);
  console.log(`Access Level: ${result4.context.getVariable('accessLevel')}`);

  console.log('\n=== Example Complete ===\n');
}

if (require.main === module) {
  runConditionalWorkflowExample().catch(console.error);
}
