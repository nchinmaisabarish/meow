import { CardTools } from '../CardTools';
import { Tool } from '../types';

describe('CardTools', () => {
  let tools: Tool[];

  beforeAll(() => {
    tools = CardTools.getTools();
  });

  describe('getTools', () => {
    it('should return an array of tools', () => {
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(4);
    });

    it('should return tools with unique names', () => {
      const names = tools.map(tool => tool.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should include createCard, getCard, updateCard, and deleteCard tools', () => {
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('createCard');
      expect(toolNames).toContain('getCard');
      expect(toolNames).toContain('updateCard');
      expect(toolNames).toContain('deleteCard');
    });
  });

  describe('createCard tool', () => {
    let createCardTool: Tool;

    beforeAll(() => {
      createCardTool = tools.find(t => t.name === 'createCard')!;
    });

    it('should have valid schema structure', () => {
      expect(createCardTool).toBeDefined();
      expect(createCardTool.name).toBe('createCard');
      expect(createCardTool.description).toBeTruthy();
      expect(createCardTool.category).toBe('card_management');
      expect(Array.isArray(createCardTool.parameters)).toBe(true);
      expect(createCardTool.returns).toBeDefined();
    });

    it('should have required title parameter', () => {
      const titleParam = createCardTool.parameters.find(p => p.name === 'title');
      expect(titleParam).toBeDefined();
      expect(titleParam!.type).toBe('string');
      expect(titleParam!.required).toBe(true);
      expect(titleParam!.description).toBeTruthy();
    });

    it('should have optional description parameter', () => {
      const descParam = createCardTool.parameters.find(p => p.name === 'description');
      expect(descParam).toBeDefined();
      expect(descParam!.type).toBe('string');
      expect(descParam!.required).toBe(false);
    });

    it('should have status parameter with enum values', () => {
      const statusParam = createCardTool.parameters.find(p => p.name === 'status');
      expect(statusParam).toBeDefined();
      expect(statusParam!.enum).toBeDefined();
      expect(statusParam!.enum).toContain('todo');
      expect(statusParam!.enum).toContain('in_progress');
      expect(statusParam!.enum).toContain('done');
      expect(statusParam!.enum).toContain('archived');
    });

    it('should have priority parameter with enum values', () => {
      const priorityParam = createCardTool.parameters.find(p => p.name === 'priority');
      expect(priorityParam).toBeDefined();
      expect(priorityParam!.enum).toBeDefined();
      expect(priorityParam!.enum).toContain('low');
      expect(priorityParam!.enum).toContain('medium');
      expect(priorityParam!.enum).toContain('high');
      expect(priorityParam!.enum).toContain('urgent');
    });

    it('should have tags parameter as array type', () => {
      const tagsParam = createCardTool.parameters.find(p => p.name === 'tags');
      expect(tagsParam).toBeDefined();
      expect(tagsParam!.type).toBe('array');
      expect(tagsParam!.items).toBeDefined();
      expect(tagsParam!.items!.type).toBe('string');
    });

    it('should have valid return type specification', () => {
      expect(createCardTool.returns.type).toBe('object');
      expect(createCardTool.returns.description).toBeTruthy();
      expect(createCardTool.returns.properties).toBeDefined();
      expect(createCardTool.returns.properties!.id).toBeDefined();
      expect(createCardTool.returns.properties!.title).toBeDefined();
      expect(createCardTool.returns.properties!.createdAt).toBeDefined();
      expect(createCardTool.returns.properties!.updatedAt).toBeDefined();
    });

    it('should have at least one example', () => {
      expect(createCardTool.examples).toBeDefined();
      expect(Array.isArray(createCardTool.examples)).toBe(true);
      expect(createCardTool.examples!.length).toBeGreaterThan(0);
    });

    it('should have valid example structure', () => {
      const example = createCardTool.examples![0];
      expect(example.input).toBeDefined();
      expect(example.output).toBeDefined();
      expect(example.input.title).toBeTruthy();
      expect(example.output.id).toBeTruthy();
      expect(example.output.createdAt).toBeTruthy();
    });
  });

  describe('getCard tool', () => {
    let getCardTool: Tool;

    beforeAll(() => {
      getCardTool = tools.find(t => t.name === 'getCard')!;
    });

    it('should have valid schema structure', () => {
      expect(getCardTool).toBeDefined();
      expect(getCardTool.name).toBe('getCard');
      expect(getCardTool.description).toBeTruthy();
      expect(getCardTool.category).toBe('card_management');
    });

    it('should have required cardId parameter', () => {
      const cardIdParam = getCardTool.parameters.find(p => p.name === 'cardId');
      expect(cardIdParam).toBeDefined();
      expect(cardIdParam!.type).toBe('string');
      expect(cardIdParam!.required).toBe(true);
    });

    it('should have optional boolean parameters for includes', () => {
      const includeCommentsParam = getCardTool.parameters.find(p => p.name === 'includeComments');
      const includeHistoryParam = getCardTool.parameters.find(p => p.name === 'includeHistory');
      
      expect(includeCommentsParam).toBeDefined();
      expect(includeCommentsParam!.type).toBe('boolean');
      expect(includeCommentsParam!.required).toBe(false);
      
      expect(includeHistoryParam).toBeDefined();
      expect(includeHistoryParam!.type).toBe('boolean');
      expect(includeHistoryParam!.required).toBe(false);
    });

    it('should have valid return type with properties', () => {
      expect(getCardTool.returns.type).toBe('object');
      expect(getCardTool.returns.properties).toBeDefined();
      expect(getCardTool.returns.properties!.id).toBeDefined();
      expect(getCardTool.returns.properties!.comments).toBeDefined();
      expect(getCardTool.returns.properties!.history).toBeDefined();
    });
  });

  describe('updateCard tool', () => {
    let updateCardTool: Tool;

    beforeAll(() => {
      updateCardTool = tools.find(t => t.name === 'updateCard')!;
    });

    it('should have valid schema structure', () => {
      expect(updateCardTool).toBeDefined();
      expect(updateCardTool.name).toBe('updateCard');
      expect(updateCardTool.description).toBeTruthy();
      expect(updateCardTool.category).toBe('card_management');
    });

    it('should have required cardId parameter', () => {
      const cardIdParam = updateCardTool.parameters.find(p => p.name === 'cardId');
      expect(cardIdParam).toBeDefined();
      expect(cardIdParam!.type).toBe('string');
      expect(cardIdParam!.required).toBe(true);
    });

    it('should have optional update fields', () => {
      const titleParam = updateCardTool.parameters.find(p => p.name === 'title');
      const descParam = updateCardTool.parameters.find(p => p.name === 'description');
      const statusParam = updateCardTool.parameters.find(p => p.name === 'status');
      
      expect(titleParam).toBeDefined();
      expect(titleParam!.required).toBe(false);
      
      expect(descParam).toBeDefined();
      expect(descParam!.required).toBe(false);
      
      expect(statusParam).toBeDefined();
      expect(statusParam!.required).toBe(false);
    });

    it('should have status and priority enums', () => {
      const statusParam = updateCardTool.parameters.find(p => p.name === 'status');
      const priorityParam = updateCardTool.parameters.find(p => p.name === 'priority');
      
      expect(statusParam!.enum).toBeDefined();
      expect(statusParam!.enum!.length).toBeGreaterThan(0);
      
      expect(priorityParam!.enum).toBeDefined();
      expect(priorityParam!.enum!.length).toBeGreaterThan(0);
    });

    it('should have valid return type', () => {
      expect(updateCardTool.returns.type).toBe('object');
      expect(updateCardTool.returns.properties).toBeDefined();
      expect(updateCardTool.returns.properties!.updatedAt).toBeDefined();
    });
  });

  describe('deleteCard tool', () => {
    let deleteCardTool: Tool;

    beforeAll(() => {
      deleteCardTool = tools.find(t => t.name === 'deleteCard')!;
    });

    it('should have valid schema structure', () => {
      expect(deleteCardTool).toBeDefined();
      expect(deleteCardTool.name).toBe('deleteCard');
      expect(deleteCardTool.description).toBeTruthy();
      expect(deleteCardTool.category).toBe('card_management');
    });

    it('should have required cardId parameter', () => {
      const cardIdParam = deleteCardTool.parameters.find(p => p.name === 'cardId');
      expect(cardIdParam).toBeDefined();
      expect(cardIdParam!.type).toBe('string');
      expect(cardIdParam!.required).toBe(true);
    });

    it('should have optional force parameter', () => {
      const forceParam = deleteCardTool.parameters.find(p => p.name === 'force');
      expect(forceParam).toBeDefined();
      expect(forceParam!.type).toBe('boolean');
      expect(forceParam!.required).toBe(false);
      expect(forceParam!.default).toBe(false);
    });

    it('should have valid return type with success indicator', () => {
      expect(deleteCardTool.returns.type).toBe('object');
      expect(deleteCardTool.returns.properties).toBeDefined();
      expect(deleteCardTool.returns.properties!.success).toBeDefined();
      expect(deleteCardTool.returns.properties!.success.type).toBe('boolean');
      expect(deleteCardTool.returns.properties!.cardId).toBeDefined();
      expect(deleteCardTool.returns.properties!.deletedAt).toBeDefined();
    });
  });

  describe('All tools validation', () => {
    it('should have all tools in card_management category', () => {
      tools.forEach(tool => {
        expect(tool.category).toBe('card_management');
      });
    });

    it('should have all parameters with required fields', () => {
      tools.forEach(tool => {
        tool.parameters.forEach(param => {
          expect(param.name).toBeTruthy();
          expect(param.type).toBeTruthy();
          expect(param.description).toBeTruthy();
          expect(typeof param.required).toBe('boolean');
        });
      });
    });

    it('should have all tools with return specifications', () => {
      tools.forEach(tool => {
        expect(tool.returns).toBeDefined();
        expect(tool.returns.type).toBeTruthy();
        expect(tool.returns.description).toBeTruthy();
      });
    });

    it('should have all tools with at least one example', () => {
      tools.forEach(tool => {
        expect(tool.examples).toBeDefined();
        expect(Array.isArray(tool.examples)).toBe(true);
        expect(tool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});
