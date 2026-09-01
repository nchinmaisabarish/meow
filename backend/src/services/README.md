# Services

This directory contains service layer components that provide business logic and orchestration capabilities.

## Intent Resolution Pattern

The Intent Resolution system provides a dynamic, semantic request routing mechanism that enables intent-centric execution. Instead of hardcoded procedural routes, requests are interpreted based on their semantic intent and dynamically dispatched to the appropriate tools or workflows.

### Architecture Overview

The Intent Resolution layer consists of three main components:

1. **IntentResolver** (`IntentResolver.ts`) - Core service that manages intent registration, validation, and execution
2. **IntentController** (`../controllers/IntentController.ts`) - HTTP endpoint that exposes intent execution via REST API
3. **Intent Registry** - In-memory registry of available intents with their handlers and schemas

### Key Concepts

#### Intent

An intent represents a user's goal or desired action. Each intent has:

- **name**: Unique identifier (e.g., `create_card`, `get_account`)
- **type**: Either `tool` (single operation) or `workflow` (multi-step orchestration)
- **handler**: Async function that executes the intent
- **schema**: Optional JSON schema for parameter validation
- **description**: Human-readable description of what the intent does

#### Intent Types

- **Tool**: Single-purpose operation that performs a specific task (e.g., create an account, fetch data)
- **Workflow**: Multi-step orchestration that coordinates multiple operations (integrates with LangGraph workflows)

### Usage

#### Registering a New Intent

To register a new intent, add it to the `initializeIntentRegistry()` function in `IntentController.ts`:

```typescript
import { Intent } from '../services/IntentResolver.js';

// Define your intent handler
async function myCustomIntent(parameters: any, context: any): Promise<any> {
  const { param1, param2 } = parameters;
  const { user, team } = context;
  
  // Your business logic here
  const result = await performOperation(param1, param2, user, team);
  
  return {
    message: 'Operation completed successfully',
    data: result,
  };
}

// Register the intent
registry.registerIntent({
  name: 'my_custom_intent',
  type: 'tool',
  description: 'Performs a custom operation',
  handler: myCustomIntent,
  schema: {
    type: 'object',
    properties: {
      param1: { type: 'string' },
      param2: { type: 'number' },
    },
    required: ['param1', 'param2'],
    additionalProperties: false,
  },
});
```

#### Executing an Intent via API

**List Available Intents:**

```bash
GET /api/intent
Headers:
  Token: <jwt-token>
  Content-Type: application/json

Response:
{
  "intents": [
    {
      "name": "create_card",
      "type": "tool",
      "description": "Create a new card in a lane",
      "schema": { ... }
    },
    ...
  ],
  "count": 6
}
```

**Execute an Intent:**

```bash
POST /api/intent
Headers:
  Token: <jwt-token>
  Content-Type: application/json

Body:
{
  "intent": "create_account",
  "parameters": {
    "name": "Acme Corporation",
    "attributes": {
      "industry": "Technology",
      "size": "Enterprise"
    }
  }
}

Response:
{
  "intent": "create_account",
  "type": "tool",
  "success": true,
  "data": {
    "account": {
      "_id": "...",
      "name": "Acme Corporation",
      "attributes": { ... },
      ...
    },
    "message": "Account created successfully"
  }
}
```

### Built-in Intents

The system comes with the following pre-registered intents:

#### Tool Intents

1. **create_account** - Create a new account
   - Parameters: `name` (required), `attributes` (optional)
   
2. **get_account** - Retrieve account by ID
   - Parameters: `accountId` (required)
   
3. **list_accounts** - List all accounts for the team
   - Parameters: none
   
4. **create_card** - Create a new card in a lane
   - Parameters: `name` (required), `amount` (required), `laneId` or `laneName`
   
5. **list_cards** - List all active cards for the team
   - Parameters: none

#### Workflow Intents

1. **run_card_workflow** - Execute a workflow for a card (placeholder for LangGraph integration)
   - Parameters: `cardId` (required), `workflowType` (optional)

### Parameter Validation

The Intent Resolver automatically validates parameters against the intent's schema before execution:

- **Required fields**: Ensures all required parameters are present
- **Type checking**: Validates parameter types (string, number, boolean, object)
- **Additional properties**: Rejects unexpected parameters when `additionalProperties: false`

Validation errors return HTTP 400 with descriptive error messages.

### Error Handling

The system provides three types of errors:

1. **IntentNotFoundError** (404) - Intent name not found in registry
2. **InvalidIntentParametersError** (400) - Parameter validation failed
3. **IntentExecutionError** (500) - Error occurred during intent execution

All errors extend `ApplicationError` and return structured JSON responses.

### Context

Intent handlers receive a context object containing:

```typescript
{
  user: User,  // Authenticated user from JWT
  team: Team   // User's team from JWT
}
```

This context is automatically populated from the authenticated request and passed to all intent handlers.

### Integration with Tools and Workflows

The Intent Resolution layer is designed to integrate with:

1. **Tool Registry** (from recommendation 1) - Structured tool definitions that can be registered as intents
2. **LangGraph Workflows** (from recommendation 2) - Multi-step workflows that can be invoked as workflow-type intents

To integrate a tool or workflow:

```typescript
// Import your tool or workflow
import { MyTool } from '../tools/MyTool.js';
import { MyWorkflow } from '../workflows/MyWorkflow.js';

// Wrap as intent handler
async function toolIntentHandler(parameters: any, context: any): Promise<any> {
  const tool = new MyTool();
  return await tool.execute(parameters, context);
}

async function workflowIntentHandler(parameters: any, context: any): Promise<any> {
  const workflow = new MyWorkflow();
  return await workflow.run(parameters, context);
}

// Register as intents
registry.registerIntent({
  name: 'my_tool',
  type: 'tool',
  handler: toolIntentHandler,
  schema: MyTool.schema,
});

registry.registerIntent({
  name: 'my_workflow',
  type: 'workflow',
  handler: workflowIntentHandler,
  schema: MyWorkflow.schema,
});
```

### Future Enhancements

The Intent Resolution system is designed to support future enhancements:

1. **Natural Language Processing** - Parse natural language requests and map them to intents
2. **Intent Chaining** - Execute multiple intents in sequence based on dependencies
3. **Intent Suggestions** - Recommend intents based on context and user history
4. **Dynamic Intent Discovery** - Load intents from external sources or plugins
5. **Intent Analytics** - Track intent usage and performance metrics

### Testing

The Intent Resolution system includes comprehensive tests:

- **Unit Tests** (`tests/services/IntentResolver.test.ts`) - Test intent registration, validation, and execution logic
- **Integration Tests** (`tests/controllers/IntentController.test.ts`) - Test end-to-end intent execution via HTTP API

Run tests with:

```bash
npm run build
npm test
```

### Best Practices

1. **Keep handlers focused** - Each intent should do one thing well
2. **Validate thoroughly** - Define comprehensive schemas for all intents
3. **Return structured data** - Always return consistent, well-structured responses
4. **Handle errors gracefully** - Catch and wrap errors with meaningful messages
5. **Document intents** - Provide clear descriptions for all registered intents
6. **Use context wisely** - Leverage the context object for authentication and authorization
7. **Test extensively** - Write both unit and integration tests for new intents

### Example: Adding a Complex Intent

Here's a complete example of adding a new intent that performs multiple operations:

```typescript
// Define the handler
async function createCardWithAccountIntent(
  parameters: any,
  context: any
): Promise<any> {
  const { cardName, cardAmount, accountName, laneId } = parameters;
  const { user, team } = context;

  // Step 1: Create or find account
  let account = await EntityHelper.findOneBy(Account, {
    teamId: team._id,
    name: accountName,
  });

  if (!account) {
    const newAccount = new NewAccount(team, accountName);
    account = await EntityHelper.create(newAccount, Account);
  }

  // Step 2: Get lane
  const lane = await EntityHelper.findOneById(Lane, laneId);
  if (!lane || !EntityHelper.isEntityOwnedBy(lane, user)) {
    throw new EntityNotFoundError();
  }

  // Step 3: Create card
  const card = new NewCard(user, lane, cardName, cardAmount);
  const createdCard = await EntityHelper.create(card, Card);

  // Step 4: Emit events
  EventHelper.get().emit('account', {
    user: user,
    latest: account.toPlain(),
  });
  EventHelper.get().emit('card', {
    user: user,
    latest: createdCard.toPlain(),
  });

  return {
    card: createdCard.toPlain(),
    account: account.toPlain(),
    message: 'Card and account created successfully',
  };
}

// Register the intent
registry.registerIntent({
  name: 'create_card_with_account',
  type: 'tool',
  description: 'Create a card and associate it with an account (creates account if needed)',
  handler: createCardWithAccountIntent,
  schema: {
    type: 'object',
    properties: {
      cardName: { type: 'string' },
      cardAmount: { type: 'number' },
      accountName: { type: 'string' },
      laneId: { type: 'string' },
    },
    required: ['cardName', 'cardAmount', 'accountName', 'laneId'],
    additionalProperties: false,
  },
});
```

This intent demonstrates:
- Multi-step operations
- Conditional logic (create account if not exists)
- Entity validation and authorization
- Event emission
- Structured response with multiple entities
- Comprehensive parameter validation

---

For more information or questions, please refer to the implementation in `IntentResolver.ts` and `IntentController.ts`.
