import { WorkflowRegistry, WorkflowRegistryError, getDefaultRegistry, resetDefaultRegistry } from '../WorkflowRegistry.js';
import { WorkflowDefinition } from '../WorkflowSchema.js';

describe('WorkflowRegistry', () => {
  let registry: WorkflowRegistry;

  const createValidWorkflow = (id: string, name: string, version: string): WorkflowDefinition => ({
    id,
    name,
    version,
    description: `Test workflow ${name}`,
    states: [
      { id: 'start', name: 'Start', type: 'initial' },
      { id: 'processing', name: 'Processing', type: 'intermediate' },
      { id: 'end', name: 'End', type: 'final' },
    ],
    transitions: [
      { from: 'start', to: 'processing', event: 'begin' },
      { from: 'processing', to: 'end', event: 'complete' },
    ],
    initialState: 'start',
  });

  beforeEach(() => {
    registry = new WorkflowRegistry();
  });

  describe('register', () => {
    it('should register a valid workflow', () => {
      const workflow = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      registry.register(workflow);

      expect(registry.has('wf-1')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should throw error when registering duplicate workflow without overwrite', () => {
      const workflow = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      registry.register(workflow);

      expect(() => registry.register(workflow)).toThrow(WorkflowRegistryError);
    });

    it('should allow overwrite when option is enabled', () => {
      const registryWithOverwrite = new WorkflowRegistry({ allowOverwrite: true });
      const workflow1 = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      const workflow2 = createValidWorkflow('wf-1', 'test-workflow', '1.0.1');

      registryWithOverwrite.register(workflow1);
      registryWithOverwrite.register(workflow2);

      const retrieved = registryWithOverwrite.get('wf-1');
      expect(retrieved?.version).toBe('1.0.1');
    });

    it('should throw error for invalid workflow when validation is enabled', () => {
      const invalidWorkflow = {
        id: 'wf-1',
        name: 'test',
        version: '1.0.0',
        states: [],
        transitions: [],
        initialState: 'start',
      } as WorkflowDefinition;

      expect(() => registry.register(invalidWorkflow)).toThrow(WorkflowRegistryError);
    });

    it('should add timestamps to registered workflow', () => {
      const workflow = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      registry.register(workflow);

      const retrieved = registry.get('wf-1');
      expect(retrieved?.createdAt).toBeDefined();
      expect(retrieved?.updatedAt).toBeDefined();
    });
  });

  describe('registerBatch', () => {
    it('should register multiple workflows', () => {
      const workflows = [
        createValidWorkflow('wf-1', 'workflow-1', '1.0.0'),
        createValidWorkflow('wf-2', 'workflow-2', '1.0.0'),
        createValidWorkflow('wf-3', 'workflow-3', '1.0.0'),
      ];

      registry.registerBatch(workflows);
      expect(registry.count()).toBe(3);
    });

    it('should throw error if any workflow is invalid', () => {
      const workflows = [
        createValidWorkflow('wf-1', 'workflow-1', '1.0.0'),
        { id: 'wf-2', name: 'invalid', version: '1.0.0', states: [], transitions: [], initialState: 'x' } as WorkflowDefinition,
      ];

      expect(() => registry.registerBatch(workflows)).toThrow(WorkflowRegistryError);
    });
  });

  describe('get', () => {
    it('should retrieve workflow by id', () => {
      const workflow = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      registry.register(workflow);

      const retrieved = registry.get('wf-1');
      expect(retrieved?.id).toBe('wf-1');
      expect(retrieved?.name).toBe('test-workflow');
    });

    it('should return undefined for non-existent workflow', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getByName', () => {
    it('should retrieve workflow by name and version', () => {
      const workflow = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      registry.register(workflow);

      const retrieved = registry.getByName('test-workflow', '1.0.0');
      expect(retrieved?.id).toBe('wf-1');
    });

    it('should retrieve latest version when version not specified', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'test-workflow', '1.1.0'));
      registry.register(createValidWorkflow('wf-3', 'test-workflow', '1.0.5'));

      const retrieved = registry.getByName('test-workflow');
      expect(retrieved?.version).toBe('1.1.0');
    });

    it('should return undefined for non-existent workflow name', () => {
      expect(registry.getByName('non-existent')).toBeUndefined();
    });
  });

  describe('getVersions', () => {
    it('should return all versions for a workflow name', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'test-workflow', '1.1.0'));
      registry.register(createValidWorkflow('wf-3', 'test-workflow', '2.0.0'));

      const versions = registry.getVersions('test-workflow');
      expect(versions).toEqual(['2.0.0', '1.1.0', '1.0.0']);
    });

    it('should return empty array for non-existent workflow', () => {
      expect(registry.getVersions('non-existent')).toEqual([]);
    });
  });

  describe('list', () => {
    it('should return all registered workflows', () => {
      registry.register(createValidWorkflow('wf-1', 'workflow-1', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'workflow-2', '1.0.0'));

      const workflows = registry.list();
      expect(workflows).toHaveLength(2);
    });

    it('should return empty array when no workflows registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('listByName', () => {
    it('should group workflows by name', () => {
      registry.register(createValidWorkflow('wf-1', 'workflow-a', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'workflow-a', '1.1.0'));
      registry.register(createValidWorkflow('wf-3', 'workflow-b', '1.0.0'));

      const byName = registry.listByName();
      expect(byName.size).toBe(2);
      expect(byName.get('workflow-a')).toHaveLength(2);
      expect(byName.get('workflow-b')).toHaveLength(1);
    });
  });

  describe('has', () => {
    it('should return true for existing workflow', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      expect(registry.has('wf-1')).toBe(true);
    });

    it('should return false for non-existent workflow', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('hasByName', () => {
    it('should return true for existing workflow name', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      expect(registry.hasByName('test-workflow')).toBe(true);
    });

    it('should return true for existing workflow name and version', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      expect(registry.hasByName('test-workflow', '1.0.0')).toBe(true);
    });

    it('should return false for non-existent version', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      expect(registry.hasByName('test-workflow', '2.0.0')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should remove workflow by id', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      const result = registry.unregister('wf-1');

      expect(result).toBe(true);
      expect(registry.has('wf-1')).toBe(false);
    });

    it('should return false for non-existent workflow', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('unregisterByName', () => {
    it('should remove specific version', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'test-workflow', '1.1.0'));

      const count = registry.unregisterByName('test-workflow', '1.0.0');
      expect(count).toBe(1);
      expect(registry.hasByName('test-workflow', '1.0.0')).toBe(false);
      expect(registry.hasByName('test-workflow', '1.1.0')).toBe(true);
    });

    it('should remove all versions when version not specified', () => {
      registry.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'test-workflow', '1.1.0'));

      const count = registry.unregisterByName('test-workflow');
      expect(count).toBe(2);
      expect(registry.hasByName('test-workflow')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all workflows', () => {
      registry.register(createValidWorkflow('wf-1', 'workflow-1', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'workflow-2', '1.0.0'));

      registry.clear();
      expect(registry.count()).toBe(0);
    });
  });

  describe('getWorkflowNames', () => {
    it('should return sorted list of workflow names', () => {
      registry.register(createValidWorkflow('wf-1', 'zebra-workflow', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'alpha-workflow', '1.0.0'));
      registry.register(createValidWorkflow('wf-3', 'beta-workflow', '1.0.0'));

      const names = registry.getWorkflowNames();
      expect(names).toEqual(['alpha-workflow', 'beta-workflow', 'zebra-workflow']);
    });
  });

  describe('validate', () => {
    it('should validate workflow definition', () => {
      const workflow = createValidWorkflow('wf-1', 'test-workflow', '1.0.0');
      const result = registry.validate(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid workflow', () => {
      const invalidWorkflow = {
        id: 'wf-1',
        name: 'test',
        version: '1.0.0',
        states: [],
        transitions: [],
        initialState: 'start',
      } as WorkflowDefinition;

      const result = registry.validate(invalidWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('export and import', () => {
    it('should export all workflows', () => {
      registry.register(createValidWorkflow('wf-1', 'workflow-1', '1.0.0'));
      registry.register(createValidWorkflow('wf-2', 'workflow-2', '1.0.0'));

      const exported = registry.export();
      expect(exported).toHaveLength(2);
    });

    it('should import workflows', () => {
      const workflows = [
        createValidWorkflow('wf-1', 'workflow-1', '1.0.0'),
        createValidWorkflow('wf-2', 'workflow-2', '1.0.0'),
      ];

      registry.import(workflows);
      expect(registry.count()).toBe(2);
    });

    it('should import with overwrite option', () => {
      registry.register(createValidWorkflow('wf-1', 'workflow-1', '1.0.0'));

      const workflows = [
        createValidWorkflow('wf-1', 'workflow-1', '1.1.0'),
      ];

      registry.import(workflows, { overwrite: true });
      const retrieved = registry.get('wf-1');
      expect(retrieved?.version).toBe('1.1.0');
    });
  });

  describe('default registry', () => {
    afterEach(() => {
      resetDefaultRegistry();
    });

    it('should return singleton instance', () => {
      const registry1 = getDefaultRegistry();
      const registry2 = getDefaultRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should persist workflows across calls', () => {
      const registry1 = getDefaultRegistry();
      registry1.register(createValidWorkflow('wf-1', 'test-workflow', '1.0.0'));

      const registry2 = getDefaultRegistry();
      expect(registry2.has('wf-1')).toBe(true);
    });
  });
});
