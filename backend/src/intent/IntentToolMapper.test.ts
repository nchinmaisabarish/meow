import { IntentToolMapper, IntentToToolMapping } from './IntentToolMapper';
import { IntentResolution } from './IntentResolver';
import { Tool, ToolParameter } from '../tools/Tool';
import { ToolRegistry } from '../tools/ToolRegistry';

describe('IntentToolMapper', () => {
  let toolRegistry: ToolRegistry;
  let intentToolMapper: IntentToolMapper;
  let mockTool: Tool;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    
    mockTool = {
      name: 'createTask',
      description: 'Creates a new task',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Task title',
          required: true
        },
        {
          name: 'description',
          type: 'string',
          description: 'Task description',
          required: false
        },
        {
          name: 'priority',
          type: 'string',
          description: 'Task priority',
          required: false,
          enum: ['low', 'medium', 'high']
        }
      ],
      execute: jest.fn().mockResolvedValue({ id: '123', title: 'Test Task' })
    };

    toolRegistry.registerTool(mockTool);
    intentToolMapper = new IntentToolMapper(toolRegistry);
  });

  describe('registerMapping', () => {
    it('should register a new intent-to-tool mapping', () => {
      const mapping: IntentToToolMapping = {
        intentType: 'test_intent',
        toolName: 'createTask',
        parameterMapping: {
          taskTitle: 'title'
        }
      };

      intentToolMapper.registerMapping(mapping);
      const retrieved = intentToolMapper.getMapping('test_intent');
      
      expect(retrieved).toEqual(mapping);
    });
  });

  describe('mapIntentToTool', () => {
    it('should successfully map intent to tool with valid parameters', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 'New Task',
          description: 'Task description',
          priority: 'high'
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.validated).toBe(true);
      expect(result.tool).toBe(mockTool);
      expect(result.parameters).toEqual({
        title: 'New Task',
        description: 'Task description',
        priority: 'high'
      });
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation when required parameter is missing', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          description: 'Task description'
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.validated).toBe(false);
      expect(result.errors).toContain('Required parameter missing: title');
    });

    it('should fail validation when parameter type is incorrect', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 123
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.validated).toBe(false);
      expect(result.errors?.some(e => e.includes('must be a string'))).toBe(true);
    });

    it('should fail validation when enum value is invalid', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 'New Task',
          priority: 'urgent'
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.validated).toBe(false);
      expect(result.errors?.some(e => e.includes('must be one of'))).toBe(true);
    });

    it('should return error when intent mapping not found', async () => {
      const intent: IntentResolution = {
        intent: 'unknown_intent',
        confidence: 0.95,
        entities: {},
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.validated).toBe(false);
      expect(result.errors).toContain('No mapping found for intent type: unknown_intent');
    });

    it('should return error when tool not found in registry', async () => {
      intentToolMapper.registerMapping({
        intentType: 'test_intent',
        toolName: 'nonexistentTool',
        parameterMapping: {}
      });

      const intent: IntentResolution = {
        intent: 'test_intent',
        confidence: 0.95,
        entities: {},
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.validated).toBe(false);
      expect(result.errors).toContain('Tool not found: nonexistentTool');
    });
  });

  describe('extractParameters', () => {
    it('should extract parameters from intent entities', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 'Task Title',
          description: 'Task Description'
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.parameters.title).toBe('Task Title');
      expect(result.parameters.description).toBe('Task Description');
    });

    it('should extract parameters from intent context', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {},
        context: {
          title: 'Context Title',
          priority: 'high'
        }
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.parameters.title).toBe('Context Title');
      expect(result.parameters.priority).toBe('high');
    });

    it('should prioritize entities over context', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 'Entity Title'
        },
        context: {
          title: 'Context Title'
        }
      };

      const result = await intentToolMapper.mapIntentToTool(intent);

      expect(result.parameters.title).toBe('Entity Title');
    });
  });

  describe('executeIntent', () => {
    it('should execute tool with mapped parameters', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 'Execute Test',
          description: 'Test Description'
        },
        context: {}
      };

      const result = await intentToolMapper.executeIntent(intent);

      expect(mockTool.execute).toHaveBeenCalledWith({
        title: 'Execute Test',
        description: 'Test Description'
      });
      expect(result).toEqual({ id: '123', title: 'Test Task' });
    });

    it('should throw error when validation fails', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {},
        context: {}
      };

      await expect(intentToolMapper.executeIntent(intent)).rejects.toThrow('Intent validation failed');
    });
  });

  describe('validateParameterType', () => {
    it('should validate string type correctly', async () => {
      const intent: IntentResolution = {
        intent: 'create_task',
        confidence: 0.95,
        entities: {
          title: 'Valid String'
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);
      expect(result.validated).toBe(true);
    });

    it('should validate number type correctly', async () => {
      const numberTool: Tool = {
        name: 'numberTool',
        description: 'Test tool',
        parameters: [
          {
            name: 'count',
            type: 'number',
            description: 'Count',
            required: true
          }
        ],
        execute: jest.fn()
      };

      toolRegistry.registerTool(numberTool);
      intentToolMapper.registerMapping({
        intentType: 'number_test',
        toolName: 'numberTool',
        parameterMapping: { count: 'count' }
      });

      const intent: IntentResolution = {
        intent: 'number_test',
        confidence: 0.95,
        entities: {
          count: 42
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);
      expect(result.validated).toBe(true);
    });

    it('should validate boolean type correctly', async () => {
      const boolTool: Tool = {
        name: 'boolTool',
        description: 'Test tool',
        parameters: [
          {
            name: 'active',
            type: 'boolean',
            description: 'Active flag',
            required: true
          }
        ],
        execute: jest.fn()
      };

      toolRegistry.registerTool(boolTool);
      intentToolMapper.registerMapping({
        intentType: 'bool_test',
        toolName: 'boolTool',
        parameterMapping: { active: 'active' }
      });

      const intent: IntentResolution = {
        intent: 'bool_test',
        confidence: 0.95,
        entities: {
          active: true
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);
      expect(result.validated).toBe(true);
    });

    it('should validate array type correctly', async () => {
      const arrayTool: Tool = {
        name: 'arrayTool',
        description: 'Test tool',
        parameters: [
          {
            name: 'tags',
            type: 'array',
            description: 'Tags',
            required: true
          }
        ],
        execute: jest.fn()
      };

      toolRegistry.registerTool(arrayTool);
      intentToolMapper.registerMapping({
        intentType: 'array_test',
        toolName: 'arrayTool',
        parameterMapping: { tags: 'tags' }
      });

      const intent: IntentResolution = {
        intent: 'array_test',
        confidence: 0.95,
        entities: {
          tags: ['tag1', 'tag2']
        },
        context: {}
      };

      const result = await intentToolMapper.mapIntentToTool(intent);
      expect(result.validated).toBe(true);
    });
  });

  describe('getAllMappings', () => {
    it('should return all registered mappings', () => {
      const mappings = intentToolMapper.getAllMappings();
      
      expect(mappings.length).toBeGreaterThan(0);
      expect(mappings.some(m => m.intentType === 'create_task')).toBe(true);
      expect(mappings.some(m => m.intentType === 'update_task')).toBe(true);
      expect(mappings.some(m => m.intentType === 'delete_task')).toBe(true);
    });
  });
});
