import { WorkflowStepAdapter, createWorkflowStepAdapter, wrapControllerMethod } from '../WorkflowStepAdapter';
import { ExecutionContext } from '../ExecutionContext';
import { WorkflowStepResult } from '../WorkflowStep';

describe('WorkflowStepAdapter', () => {
  describe('basic adapter functionality', () => {
    it('should wrap a simple controller method', async () => {
      const controllerMethod = async (name: string) => {
        return { message: `Hello, ${name}!` };
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'greet-user',
        inputMapper: (context) => [context.getState('userName')],
      });

      const context = new ExecutionContext();
      context.setState('userName', 'Alice');

      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello, Alice!' });
    });

    it('should handle synchronous controller methods', async () => {
      const controllerMethod = (a: number, b: number) => {
        return a + b;
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'add-numbers',
        inputMapper: (context) => [context.getState('a'), context.getState('b')],
      });

      const context = new ExecutionContext();
      context.setState('a', 5);
      context.setState('b', 3);

      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBe(8);
    });

    it('should use default input mapper when not provided', async () => {
      const controllerMethod = async () => {
        return { status: 'ok' };
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'no-input-step',
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'ok' });
    });
  });

  describe('custom output mapping', () => {
    it('should use custom output mapper', async () => {
      const controllerMethod = async () => {
        return { rawData: 'test' };
      };

      const outputMapper = (result: any, context: ExecutionContext): WorkflowStepResult => {
        return {
          success: true,
          data: { transformed: result.rawData.toUpperCase() },
          metadata: { transformedAt: new Date().toISOString() },
        };
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'transform-step',
        outputMapper,
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ transformed: 'TEST' });
      expect(result.metadata?.transformedAt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle errors from controller method', async () => {
      const controllerMethod = async () => {
        throw new Error('Controller error');
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'failing-step',
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Controller error');
    });

    it('should use custom error handler', async () => {
      const controllerMethod = async () => {
        throw new Error('Original error');
      };

      const errorHandler = (error: Error, context: ExecutionContext): WorkflowStepResult => {
        return {
          success: false,
          error: new Error('Custom handled error'),
          metadata: { originalError: error.message },
        };
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'custom-error-step',
        errorHandler,
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Custom handled error');
      expect(result.metadata?.originalError).toBe('Original error');
    });

    it('should handle non-Error exceptions', async () => {
      const controllerMethod = async () => {
        throw 'String error';
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'string-error-step',
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('String error');
    });
  });

  describe('lifecycle hooks', () => {
    it('should call onSuccess hook', async () => {
      const controllerMethod = async () => ({ data: 'test' });
      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'success-hook-step',
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);
      await adapter.onSuccess(context, result);

      const history = context.getStepHistory();
      expect(history.length).toBe(1);
      expect(history[0].stepName).toBe('success-hook-step');
    });

    it('should call onError hook', async () => {
      const controllerMethod = async () => ({ data: 'test' });
      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'error-hook-step',
      });

      const context = new ExecutionContext();
      const error = new Error('Test error');
      await adapter.onError(context, error);

      const errors = context.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].stepName).toBe('error-hook-step');
    });

    it('should always return true for canExecute', async () => {
      const controllerMethod = async () => ({ data: 'test' });
      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'can-execute-step',
      });

      const context = new ExecutionContext();
      const canExecute = await adapter.canExecute(context);

      expect(canExecute).toBe(true);
    });
  });

  describe('factory functions', () => {
    it('should create adapter using createWorkflowStepAdapter', async () => {
      const controllerMethod = async (value: number) => value * 2;
      const adapter = createWorkflowStepAdapter(controllerMethod, {
        name: 'double-value',
        inputMapper: (context) => [context.getState('value')],
      });

      const context = new ExecutionContext();
      context.setState('value', 21);

      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should create adapter using wrapControllerMethod', async () => {
      const controllerMethod = async (name: string) => `Processed: ${name}`;
      const adapter = wrapControllerMethod(
        'process-name',
        controllerMethod,
        (context) => [context.getState('name')]
      );

      const context = new ExecutionContext();
      context.setState('name', 'TestName');

      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Processed: TestName');
    });
  });

  describe('metadata and properties', () => {
    it('should have correct name and description', () => {
      const controllerMethod = async () => ({});
      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'test-step',
        description: 'This is a test step',
      });

      expect(adapter.name).toBe('test-step');
      expect(adapter.description).toBe('This is a test step');
    });

    it('should include metadata in result', async () => {
      const controllerMethod = async () => ({ value: 123 });
      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'metadata-step',
      });

      const context = new ExecutionContext();
      const result = await adapter.execute(context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.stepName).toBe('metadata-step');
      expect(result.metadata?.executedAt).toBeDefined();
    });
  });

  describe('complex scenarios', () => {
    it('should handle multi-parameter controller methods', async () => {
      const controllerMethod = async (a: number, b: number, c: string) => {
        return { sum: a + b, message: c };
      };

      const adapter = new WorkflowStepAdapter(controllerMethod, {
        name: 'multi-param-step',
        inputMapper: (context) => [
          context.getState('num1'),
          context.getState('num2'),
          context.getState('text'),
        ],
      });

      const context = new ExecutionContext();
      context.setState('num1', 10);
      context.setState('num2', 20);
      context.setState('text', 'Result');

      const result = await adapter.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ sum: 30, message: 'Result' });
    });

    it('should chain multiple adapted steps', async () => {
      const step1Method = async (input: number) => input * 2;
      const step2Method = async (input: number) => input + 10;

      const step1 = new WorkflowStepAdapter(step1Method, {
        name: 'multiply-step',
        inputMapper: (context) => [context.getState('input')],
        outputMapper: (result, context) => {
          context.setState('step1Result', result);
          return { success: true, data: result };
        },
      });

      const step2 = new WorkflowStepAdapter(step2Method, {
        name: 'add-step',
        inputMapper: (context) => [context.getState('step1Result')],
      });

      const context = new ExecutionContext();
      context.setState('input', 5);

      const result1 = await step1.execute(context);
      step1.outputMapper?.(result1.data, context);

      const result2 = await step2.execute(context);

      expect(result2.success).toBe(true);
      expect(result2.data).toBe(20);
    });
  });
});
