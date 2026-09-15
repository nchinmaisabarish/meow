# LangChain Tools

This directory contains structured LangChain tool definitions that expose application operations as discoverable, schema-validated tools for agent-based workflows.

## Overview

The tools in this directory wrap existing application functionality (like CardController methods) and expose them through LangChain's tool interface. This enables:

- **Discoverability**: Agents can discover available operations through tool schemas
- **Schema Validation**: Input parameters are validated using Zod schemas
- **Programmatic Access**: Operations can be invoked programmatically by agent systems
- **Context Awareness**: Tools are created with user/team context for proper authorization

## Architecture

### ToolRegistry

The `ToolRegistry` class manages all available tools and provides a centralized access point:

```typescript
import { ToolRegistry } from './tools/ToolRegistry.js';

// Create a registry for a specific user and team
const registry = ToolRegistry.create(user, team);

// Get all tools
const tools = registry.getTools();

// Get a specific tool by name
const createCardTool = registry.getToolByName('create_card');

// Get tool schemas for agent configuration
const schemas = registry.getToolSchemas();
```

### CardTools

Card management tools that wrap CardController operations:

#### create_card
Creates a new card (opportunity) in the sales pipeline.

**Parameters:**
- `name` (string): The name or title of the card/opportunity
- `amount` (number): The monetary value in the team currency
- `laneId` (string, optional): The ID of the lane to place the card in
- `laneName` (string, optional): The name of the lane (alternative to laneId)
- `attributes` (object, optional): Custom attributes for the card
- `closedAt` (string, optional): ISO date string when the card was/will be closed
- `nextFollowUpAt` (string, optional): ISO date string for next follow-up

**Returns:** JSON string with success status and created card data

#### update_card_status
Updates the status of an existing card.

**Parameters:**
- `cardId` (string): The ID of the card to update
- `status` (enum): The new status - 'active', 'deleted', or 'archived'

**Returns:** JSON string with success status and updated card data

#### query_cards
Queries and retrieves cards from the sales pipeline.

**Parameters:**
- `status` (enum, optional): Filter by status - 'active', 'deleted', 'archived', or 'all'
- `maxDaysAgo` (number, optional): Only include cards closed within the last N days
- `startDate` (string, optional): ISO date string for start of date range
- `endDate` (string, optional): ISO date string for end of date range

**Returns:** JSON string with success status, count, and array of matching cards

## Usage Example

```typescript
import { ToolRegistry } from './tools/ToolRegistry.js';

// In a controller or service with authenticated user context
async function handleAgentRequest(user: User, team: Team) {
  // Create tool registry for this user/team
  const registry = ToolRegistry.create(user, team);
  
  // Get the create card tool
  const createCardTool = registry.getToolByName('create_card');
  
  if (createCardTool) {
    // Invoke the tool
    const result = await createCardTool.invoke({
      name: 'New Sales Opportunity',
      amount: 50000,
      laneName: 'Qualified',
    });
    
    console.log(result); // JSON string with result
  }
  
  // Or pass all tools to an agent
  const allTools = registry.getTools();
  // Configure your LangChain agent with these tools...
}
```

## Adding New Tools

To add new tools:

1. Create a new file in this directory (e.g., `AccountTools.ts`)
2. Define tool creation functions that return `DynamicStructuredTool` instances
3. Import and register the tools in `ToolRegistry.ts`
4. Document the tools in this README

Example structure:

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createMyTool(user: User, team: Team): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'my_tool',
    description: 'Description of what this tool does',
    schema: z.object({
      param1: z.string().describe('Description of param1'),
      param2: z.number().optional().describe('Description of param2'),
    }),
    func: async (input) => {
      // Implementation
      return JSON.stringify({ success: true, data: result });
    },
  });
}
```

## Integration with Worker

The ToolRegistry is imported and made available in `worker.ts`. It can be used by any controller or service that needs to expose operations as LangChain tools.

## Dependencies

- `@langchain/core`: Provides the base tool classes and interfaces
- `zod`: Schema validation library (transitive dependency via @langchain/core)
