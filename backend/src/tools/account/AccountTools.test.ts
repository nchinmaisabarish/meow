import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetAccountTool } from './GetAccountTool.js';
import { ListAccountsTool } from './ListAccountsTool.js';
import { AccountController } from '../../controllers/AccountController.js';

vi.mock('../../controllers/AccountController.js');

describe('GetAccountTool', () => {
  let tool: GetAccountTool;

  beforeEach(() => {
    tool = new GetAccountTool();
    vi.clearAllMocks();
  });

  it('should have correct schema definition', () => {
    const schema = tool.getSchema();
    
    expect(schema.name).toBe('get_account');
    expect(schema.description).toBe('Retrieve a specific account by its ID');
    expect(schema.parameters).toHaveLength(2);
    expect(schema.parameters[0].name).toBe('id');
    expect(schema.parameters[0].required).toBe(true);
    expect(schema.parameters[1].name).toBe('teamId');
    expect(schema.parameters[1].required).toBe(false);
  });

  it('should validate required parameters', async () => {
    await expect(tool.invoke({})).rejects.toThrow("Required parameter 'id' is missing");
  });

  it('should validate parameter types', async () => {
    await expect(tool.invoke({ id: '' })).rejects.toThrow();
  });

  it('should execute successfully with valid input', async () => {
    const mockAccountData = { id: 'acc123', name: 'Test Account' };
    
    vi.spyOn(AccountController, 'fetch').mockImplementation(async (req, res) => {
      res.status(200).json(mockAccountData);
    });

    const result = await tool.execute({ id: 'acc123' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockAccountData);
    expect(result.error).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    vi.spyOn(AccountController, 'fetch').mockImplementation(async (req, res) => {
      res.status(404).json({ message: 'Account not found' });
    });

    const result = await tool.execute({ id: 'nonexistent' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should pass teamId in headers when provided', async () => {
    let capturedHeaders: any = null;
    
    vi.spyOn(AccountController, 'fetch').mockImplementation(async (req, res) => {
      capturedHeaders = req.headers;
      res.status(200).json({});
    });

    await tool.execute({ id: 'acc123', teamId: 'team456' });

    expect(capturedHeaders['x-meow-team']).toBe('team456');
  });
});

describe('ListAccountsTool', () => {
  let tool: ListAccountsTool;

  beforeEach(() => {
    tool = new ListAccountsTool();
    vi.clearAllMocks();
  });

  it('should have correct schema definition', () => {
    const schema = tool.getSchema();
    
    expect(schema.name).toBe('list_accounts');
    expect(schema.description).toBe('Retrieve a paginated list of accounts with optional search filtering');
    expect(schema.parameters).toHaveLength(4);
    
    const paramNames = schema.parameters.map(p => p.name);
    expect(paramNames).toContain('teamId');
    expect(paramNames).toContain('page');
    expect(paramNames).toContain('limit');
    expect(paramNames).toContain('search');
  });

  it('should execute successfully with no parameters', async () => {
    const mockAccountsList = [
      { id: 'acc1', name: 'Account 1' },
      { id: 'acc2', name: 'Account 2' },
    ];
    
    vi.spyOn(AccountController, 'list').mockImplementation(async (req, res) => {
      res.status(200).json(mockAccountsList);
    });

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockAccountsList);
  });

  it('should pass pagination parameters correctly', async () => {
    let capturedQuery: any = null;
    
    vi.spyOn(AccountController, 'list').mockImplementation(async (req, res) => {
      capturedQuery = req.query;
      res.status(200).json([]);
    });

    await tool.execute({ page: 2, limit: 10 });

    expect(capturedQuery.page).toBe('2');
    expect(capturedQuery.limit).toBe('10');
  });

  it('should pass search parameter correctly', async () => {
    let capturedQuery: any = null;
    
    vi.spyOn(AccountController, 'list').mockImplementation(async (req, res) => {
      capturedQuery = req.query;
      res.status(200).json([]);
    });

    await tool.execute({ search: 'test query' });

    expect(capturedQuery.search).toBe('test query');
  });

  it('should validate page parameter is positive integer', async () => {
    await expect(tool.invoke({ page: -1 })).rejects.toThrow();
    await expect(tool.invoke({ page: 0 })).rejects.toThrow();
  });

  it('should validate limit parameter does not exceed maximum', async () => {
    await expect(tool.invoke({ limit: 101 })).rejects.toThrow();
  });

  it('should handle errors gracefully', async () => {
    vi.spyOn(AccountController, 'list').mockImplementation(async (req, res) => {
      res.status(500).json({ message: 'Internal server error' });
    });

    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should pass teamId in headers when provided', async () => {
    let capturedHeaders: any = null;
    
    vi.spyOn(AccountController, 'list').mockImplementation(async (req, res) => {
      capturedHeaders = req.headers;
      res.status(200).json([]);
    });

    await tool.execute({ teamId: 'team789' });

    expect(capturedHeaders['x-meow-team']).toBe('team789');
  });
});
