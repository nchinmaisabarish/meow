import express, { Request, Response } from 'express';
import { ToolRegistry } from '../tools/ToolRegistry';

const router = express.Router();

ToolRegistry.initialize();

router.get('/tools', (req: Request, res: Response) => {
  try {
    const toolsData = ToolRegistry.toJSON();
    res.status(200).json(toolsData);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Failed to retrieve tools' });
  }
});

router.get('/tools/:toolName', (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const tool = ToolRegistry.getTool(toolName);
    
    if (!tool) {
      return res.status(404).json({ error: `Tool '${toolName}' not found` });
    }
    
    res.status(200).json(tool);
  } catch (error) {
    console.error('Error fetching tool:', error);
    res.status(500).json({ error: 'Failed to retrieve tool' });
  }
});

router.get('/tools/category/:category', (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const tools = ToolRegistry.getToolsByCategory(category);
    
    res.status(200).json({
      category,
      count: tools.length,
      tools
    });
  } catch (error) {
    console.error('Error fetching tools by category:', error);
    res.status(500).json({ error: 'Failed to retrieve tools by category' });
  }
});

export default router;
