import { ExecutionContext } from '../ExecutionContext';

describe('ExecutionContext', () => {
  describe('initialization', () => {
    it('should create context with default values', () => {
      const context = new ExecutionContext();

      expect(context.getWorkflowId()).toBeDefined();
      expect(context.getUserId()).toBeUndefined();
      expect(context.getAllState()).toEqual({});
      expect(context.getAllMetadata()).toEqual({});
      expect(context.getStepHistory()).toEqual([]);
      expect(context.getErrors()).toEqual([]);
      expect(context.hasErrors()).toBe(false);
      expect(context.isComplete()).toBe(false);
    });

    it('should create context with provided options', () => {
      const context = new ExecutionContext({
        workflowId: 'custom-workflow-id',
        userId: 'user-123',
        initialState: { key1: 'value1' },
        metadata: { meta1: 'metavalue1' },
      });

      expect(context.getWorkflowId()).toBe('custom-workflow-id');
      expect(context.getUserId()).toBe('user-123');
      expect(context.getState('key1')).toBe('value1');
      expect(context.getMetadata('meta1')).toBe('metavalue1');
    });
  });

  describe('state management', () => {
    it('should set and get state', () => {
      const context = new ExecutionContext();

      context.setState('testKey', 'testValue');

      expect(context.getState('testKey')).toBe('testValue');
      expect(context.hasState('testKey')).toBe(true);
    });

    it('should get all state', () => {
      const context = new ExecutionContext();
      context.setState('key1', 'value1');
      context.setState('key2', 'value2');

      const allState = context.getAllState();

      expect(allState).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should delete state', () => {
      const context = new ExecutionContext();
      context.setState('key1', 'value1');

      const deleted = context.deleteState('key1');

      expect(deleted).toBe(true);
      expect(context.hasState('key1')).toBe(false);
    });

    it('should return undefined for non-existent state', () => {
      const context = new ExecutionContext();

      expect(context.getState('nonExistent')).toBeUndefined();
    });
  });

  describe('metadata management', () => {
    it('should set and get metadata', () => {
      const context = new ExecutionContext();

      context.setMetadata('metaKey', 'metaValue');

      expect(context.getMetadata('metaKey')).toBe('metaValue');
    });

    it('should get all metadata', () => {
      const context = new ExecutionContext();
      context.setMetadata('meta1', 'value1');
      context.setMetadata('meta2', 'value2');

      const allMetadata = context.getAllMetadata();

      expect(allMetadata).toEqual({ meta1: 'value1', meta2: 'value2' });
    });
  });

  describe('step history tracking', () => {
    it('should add step result to history', () => {
      const context = new ExecutionContext();
      const result = { data: 'test' };

      context.addStepResult('step1', result);

      const history = context.getStepHistory();
      expect(history.length).toBe(1);
      expect(history[0].stepName).toBe('step1');
      expect(history[0].success).toBe(true);
      expect(history[0].result).toEqual(result);
    });

    it('should get last step result', () => {
      const context = new ExecutionContext();
      context.addStepResult('step1', { data: 'first' });
      context.addStepResult('step2', { data: 'second' });

      const lastResult = context.getLastStepResult();

      expect(lastResult?.stepName).toBe('step2');
      expect(lastResult?.result).toEqual({ data: 'second' });
    });

    it('should get step result by name', () => {
      const context = new ExecutionContext();
      context.addStepResult('step1', { data: 'first' });
      context.addStepResult('step2', { data: 'second' });

      const stepResult = context.getStepResult('step1');

      expect(stepResult?.stepName).toBe('step1');
      expect(stepResult?.result).toEqual({ data: 'first' });
    });
  });

  describe('error tracking', () => {
    it('should add error to context', () => {
      const context = new ExecutionContext();
      const error = new Error('Test error');

      context.addError('failedStep', error);

      expect(context.hasErrors()).toBe(true);
      const errors = context.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].stepName).toBe('failedStep');
      expect(errors[0].error.message).toBe('Test error');
    });

    it('should track multiple errors', () => {
      const context = new ExecutionContext();
      context.addError('step1', new Error('Error 1'));
      context.addError('step2', new Error('Error 2'));

      const errors = context.getErrors();

      expect(errors.length).toBe(2);
      expect(context.hasErrors()).toBe(true);
    });
  });

  describe('workflow completion', () => {
    it('should mark workflow as complete', () => {
      const context = new ExecutionContext();

      context.markComplete();

      expect(context.isComplete()).toBe(true);
      expect(context.getEndTime()).toBeDefined();
    });

    it('should calculate duration', (done) => {
      const context = new ExecutionContext();

      setTimeout(() => {
        context.markComplete();
        const duration = context.getDuration();

        expect(duration).toBeDefined();
        expect(duration!).toBeGreaterThan(0);
        done();
      }, 10);
    });

    it('should return undefined duration if not complete', () => {
      const context = new ExecutionContext();

      expect(context.getDuration()).toBeUndefined();
    });
  });

  describe('cloning', () => {
    it('should clone context with all data', () => {
      const context = new ExecutionContext({
        workflowId: 'original-id',
        userId: 'user-123',
      });
      context.setState('key1', 'value1');
      context.setMetadata('meta1', 'metavalue1');
      context.addStepResult('step1', { data: 'test' });

      const cloned = context.clone();

      expect(cloned.getWorkflowId()).toBe(context.getWorkflowId());
      expect(cloned.getUserId()).toBe(context.getUserId());
      expect(cloned.getState('key1')).toBe('value1');
      expect(cloned.getMetadata('meta1')).toBe('metavalue1');
      expect(cloned.getStepHistory().length).toBe(1);
    });

    it('should create independent clone', () => {
      const context = new ExecutionContext();
      context.setState('key1', 'value1');

      const cloned = context.clone();
      cloned.setState('key2', 'value2');

      expect(context.hasState('key2')).toBe(false);
      expect(cloned.hasState('key2')).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const context = new ExecutionContext({
        workflowId: 'test-workflow',
        userId: 'user-123',
      });
      context.setState('key1', 'value1');
      context.setMetadata('meta1', 'metavalue1');
      context.addStepResult('step1', { data: 'test' });
      context.markComplete();

      const json = context.toJSON();

      expect(json.workflowId).toBe('test-workflow');
      expect(json.userId).toBe('user-123');
      expect(json.state).toEqual({ key1: 'value1' });
      expect(json.metadata).toEqual({ meta1: 'metavalue1' });
      expect(json.stepHistory.length).toBe(1);
      expect(json.isComplete).toBe(true);
      expect(json.hasErrors).toBe(false);
      expect(json.duration).toBeDefined();
    });

    it('should serialize errors correctly', () => {
      const context = new ExecutionContext();
      context.addError('step1', new Error('Test error'));

      const json = context.toJSON();

      expect(json.errors.length).toBe(1);
      expect(json.errors[0].stepName).toBe('step1');
      expect(json.errors[0].error).toBe('Test error');
      expect(json.hasErrors).toBe(true);
    });
  });
});
