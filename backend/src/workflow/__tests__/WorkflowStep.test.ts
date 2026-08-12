import { BaseWorkflowStep, WorkflowStepResult } from '../WorkflowStep';
import { ExecutionContext } from '../ExecutionContext';

class TestWorkflowStep extends BaseWorkflowStep {
  constructor(
    name: string,
    private readonly shouldSucceed: boolean = true,
    private readonly resultData?: any
  ) {
    super(name, `Test step: ${name}`);
  }

  async execute(context: ExecutionContext): Promise<WorkflowStepResult> {
    if (!this.shouldSucceed) {
      throw new Error('Step execution failed');
    }

    return {
      success: true,
      data: this.resultData || { message: 'Step executed successfully' },
      metadata: {
        executedAt: new Date().toISOString(),
      },
    };
  }
}

describe('WorkflowStep', () => {
  describe('BaseWorkflowStep', () => {
    it('should execute successfully and add result to context', async () => {
      const context = new ExecutionContext();
      const step = new TestWorkflowStep('test-step', true, { value: 42 });

      const result = await step.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
      expect(result.metadata).toBeDefined();
    });

    it('should handle execution errors', async () => {
      const context = new ExecutionContext();
      const step = new TestWorkflowStep('failing-step', false);

      await expect(step.execute(context)).rejects.toThrow('Step execution failed');
    });

    it('should call onSuccess hook after successful execution', async () => {
      const context = new ExecutionContext();
      const step = new TestWorkflowStep('success-step');
      const result = await step.execute(context);

      await step.onSuccess(context, result);

      const stepHistory = context.getStepHistory();
      expect(stepHistory.length).toBe(1);
      expect(stepHistory[0].stepName).toBe('success-step');
      expect(stepHistory[0].success).toBe(true);
    });

    it('should call onError hook after failed execution', async () => {
      const context = new ExecutionContext();
      const step = new TestWorkflowStep('error-step', false);
      const error = new Error('Test error');

      await step.onError(context, error);

      const errors = context.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].stepName).toBe('error-step');
      expect(errors[0].error.message).toBe('Test error');
    });

    it('should check if step can execute', async () => {
      const context = new ExecutionContext();
      const step = new TestWorkflowStep('conditional-step');

      const canExecute = await step.canExecute(context);

      expect(canExecute).toBe(true);
    });

    it('should have name and description', () => {
      const step = new TestWorkflowStep('named-step');

      expect(step.name).toBe('named-step');
      expect(step.description).toBe('Test step: named-step');
    });
  });

  describe('WorkflowStepResult', () => {
    it('should create a successful result', () => {
      const result: WorkflowStepResult = {
        success: true,
        data: { key: 'value' },
        metadata: { timestamp: Date.now() },
      };

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.metadata).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should create a failed result with error', () => {
      const error = new Error('Operation failed');
      const result: WorkflowStepResult = {
        success: false,
        error,
        metadata: { timestamp: Date.now() },
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.data).toBeUndefined();
    });
  });
});
