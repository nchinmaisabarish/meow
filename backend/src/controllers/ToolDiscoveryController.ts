import { Request, Response, NextFunction } from 'express';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { log } from '../worker.js';

export interface ToolSchemaJSON {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  returns?: {
    type: string;
    description: string;
  };
}

export interface ToolsResponseJSON {
  tools: ToolSchemaJSON[];
  count: number;
  timestamp: string;
}

export class ToolDiscoveryController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registry = ToolRegistry.getInstance();
      const tools = registry.getAllTools();

      const serializedTools: ToolSchemaJSON[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || [],
        },
        returns: tool.returns
          ? {
              type: tool.returns.type,
              description: tool.returns.description,
            }
          : undefined,
      }));

      const response: ToolsResponseJSON = {
        tools: serializedTools,
        count: serializedTools.length,
        timestamp: new Date().toISOString(),
      };

      log.info(`Tool discovery request served: ${serializedTools.length} tools available`);

      res.status(200).json(response);
    } catch (error) {
      log.error('Error in ToolDiscoveryController.list:', error);
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const registry = ToolRegistry.getInstance();
      const tool = registry.getTool(name);

      if (!tool) {
        res.status(404).json({
          error: 'Tool not found',
          message: `No tool registered with name: ${name}`,
        });
        return;
      }

      const serializedTool: ToolSchemaJSON = {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || [],
        },
        returns: tool.returns
          ? {
              type: tool.returns.type,
              description: tool.returns.description,
            }
          : undefined,
      };

      log.info(`Tool discovery request for specific tool: ${name}`);

      res.status(200).json(serializedTool);
    } catch (error) {
      log.error('Error in ToolDiscoveryController.get:', error);
      next(error);
    }
  }
}
