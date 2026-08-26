import { Request, Response, NextFunction } from 'express';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import Ajv from 'ajv';
import { log } from '../worker.js';

const ajv = new Ajv();

export class ToolInvocationController {
  static async invoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { toolName, parameters } = req.body;

      if (!toolName || typeof toolName !== 'string') {
        res.status(400).json({
          success: false,
          error: 'toolName is required and must be a string'
        });
        return;
      }

      const tool = ToolRegistry.getTool(toolName);

      if (!tool) {
        res.status(404).json({
          success: false,
          error: `Tool '${toolName}' not found in registry`
        });
        return;
      }

      if (tool.schema && tool.schema.properties) {
        const validate = ajv.compile(tool.schema);
        const valid = validate(parameters || {});

        if (!valid) {
          res.status(400).json({
            success: false,
            error: 'Invalid parameters for tool',
            validationErrors: validate.errors
          });
          return;
        }
      }

      log.info({ toolName, parameters }, 'Invoking tool');

      const result = await tool.execute(parameters || {});

      res.status(200).json({
        success: true,
        toolName,
        result
      });
    } catch (error: any) {
      log.error({ error, body: req.body }, 'Error invoking tool');
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error during tool execution'
      });
    }
  }
}
