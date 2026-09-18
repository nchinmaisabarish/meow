import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ObjectId } from 'mongodb';
import { CardStatus } from '../entities/Card.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { DatabaseHelper } from '../helpers/DatabaseHelper.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { EventType } from '../entities/EventType.js';

/**
 * ForecastWorkflowState defines the state structure for the forecast generation workflow.
 * This state is passed through each node in the workflow graph.
 */
export interface ForecastWorkflowState {
  // Input parameters
  laneType: LaneType;
  teamId: ObjectId;
  start: Date;
  end: Date;
  userId?: ObjectId;

  // Workflow state
  currentPhase: 'collect_data' | 'calculate_prediction' | 'score_confidence' | 'persist_results' | 'complete';
  nextActions: string[];

  // Intermediate data
  lanes: Lane[];
  historicalData: any[];
  aggregationResult: any[];

  // Output data
  prediction: {
    amount: number;
    count: number;
  };
  confidence?: number;
  error?: string;
  validationErrors: string[];
}

/**
 * Define the state annotation for LangGraph.
 * Each field uses Annotation() which creates a reducer that replaces the previous value.
 */
const ForecastWorkflowAnnotation = Annotation.Root({
  laneType: Annotation<LaneType>(),
  teamId: Annotation<ObjectId>(),
  start: Annotation<Date>(),
  end: Annotation<Date>(),
  userId: Annotation<ObjectId | undefined>(),
  currentPhase: Annotation<'collect_data' | 'calculate_prediction' | 'score_confidence' | 'persist_results' | 'complete'>(),
  nextActions: Annotation<string[]>(),
  lanes: Annotation<Lane[]>(),
  historicalData: Annotation<any[]>(),
  aggregationResult: Annotation<any[]>(),
  prediction: Annotation<{
    amount: number;
    count: number;
  }>(),
  confidence: Annotation<number | undefined>(),
  error: Annotation<string | undefined>(),
  validationErrors: Annotation<string[]>(),
});

/**
 * Collect Data node: Fetch lanes and historical card data
 */
async function collectDataNode(state: ForecastWorkflowState): Promise<Partial<ForecastWorkflowState>> {
  try {
    // Build query for lanes based on lane type
    const query: any = {
      teamId: state.teamId,
      'tags.type': { $eq: state.laneType },
    };

    // For normal lanes, only include those in forecast
    if (state.laneType === LaneType.Normal) {
      query.inForecast = true;
    }

    // Fetch lanes matching the criteria
    const lanes = await EntityHelper.findBy(Lane, query);

    if (!lanes || lanes.length === 0) {
      return {
        lanes: [],
        historicalData: [],
        currentPhase: 'calculate_prediction',
        nextActions: ['calculate_with_empty_data'],
      };
    }

    // Fetch historical card data for these lanes
    const direct = DatabaseHelper.get();
    const collection = direct.collection('Cards');

    const match: any = {
      $match: {
        teamId: { $eq: state.teamId },
        status: { $ne: CardStatus.Deleted },
        laneId: { $in: lanes.map((lane: Lane) => lane._id) },
        closedAt: {
          $gte: state.start,
          $lte: state.end,
        },
      },
    };

    if (state.userId) {
      match.$match.userId = state.userId;
    }

    const cursor = await collection.aggregate([match]);
    const historicalData = await cursor.toArray();

    return {
      lanes,
      historicalData,
      currentPhase: 'calculate_prediction',
      nextActions: ['aggregate_and_calculate'],
    };
  } catch (error: unknown) {
    return {
      validationErrors: [error instanceof Error ? error.message : 'Unknown error in collect_data phase'],
      currentPhase: 'complete',
      error: 'Failed to collect historical data',
    };
  }
}

/**
 * Calculate Prediction node: Aggregate data and calculate forecast prediction
 */
async function calculatePredictionNode(state: ForecastWorkflowState): Promise<Partial<ForecastWorkflowState>> {
  try {
    // If no lanes or historical data, return zero prediction
    if (!state.lanes || state.lanes.length === 0) {
      return {
        prediction: { amount: 0, count: 0 },
        aggregationResult: [],
        currentPhase: 'score_confidence',
        nextActions: ['calculate_confidence'],
      };
    }

    // Perform aggregation to calculate total amount and count
    const direct = DatabaseHelper.get();
    const collection = direct.collection('Cards');

    const match: any = {
      $match: {
        teamId: { $eq: state.teamId },
        status: { $ne: CardStatus.Deleted },
        laneId: { $in: state.lanes.map((lane: Lane) => lane._id) },
        closedAt: {
          $gte: state.start,
          $lte: state.end,
        },
      },
    };

    if (state.userId) {
      match.$match.userId = state.userId;
    }

    const group = {
      $group: {
        _id: null,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    };

    const cursor = await collection.aggregate([match, group]);
    const aggregationResult = await cursor.toArray();

    const prediction = aggregationResult[0]
      ? { amount: aggregationResult[0].amount, count: aggregationResult[0].count }
      : { amount: 0, count: 0 };

    return {
      aggregationResult,
      prediction,
      currentPhase: 'score_confidence',
      nextActions: ['calculate_confidence'],
    };
  } catch (error: unknown) {
    return {
      validationErrors: [error instanceof Error ? error.message : 'Unknown error in calculate_prediction phase'],
      currentPhase: 'complete',
      error: 'Failed to calculate prediction',
    };
  }
}

/**
 * Score Confidence node: Calculate confidence score based on data quality
 */
async function scoreConfidenceNode(state: ForecastWorkflowState): Promise<Partial<ForecastWorkflowState>> {
  try {
    // Calculate confidence based on:
    // 1. Number of data points (more data = higher confidence)
    // 2. Number of lanes involved (more lanes = higher confidence)
    // 3. Time span coverage

    let confidence = 0;

    // Base confidence from data points
    const dataPointCount = state.historicalData?.length || 0;
    if (dataPointCount > 0) {
      // Logarithmic scale: 1-10 points = 0.3, 11-50 = 0.5, 51-100 = 0.7, 100+ = 0.9
      if (dataPointCount >= 100) {
        confidence += 0.4;
      } else if (dataPointCount >= 50) {
        confidence += 0.35;
      } else if (dataPointCount >= 10) {
        confidence += 0.25;
      } else {
        confidence += 0.15;
      }
    }

    // Confidence from lane diversity
    const laneCount = state.lanes?.length || 0;
    if (laneCount > 0) {
      if (laneCount >= 5) {
        confidence += 0.3;
      } else if (laneCount >= 3) {
        confidence += 0.2;
      } else {
        confidence += 0.1;
      }
    }

    // Confidence from prediction amount (higher amounts = more significant)
    if (state.prediction && state.prediction.amount > 0) {
      confidence += 0.3;
    }

    // Normalize confidence to 0-1 range
    confidence = Math.min(confidence, 1.0);

    return {
      confidence,
      currentPhase: 'persist_results',
      nextActions: ['save_forecast_events'],
    };
  } catch (error: unknown) {
    // Don't fail the workflow if confidence scoring fails
    console.error('Failed to score confidence:', error);
    return {
      confidence: 0.5, // Default confidence
      currentPhase: 'persist_results',
      nextActions: ['save_forecast_events'],
    };
  }
}

/**
 * Persist Results node: Save forecast events to the database
 */
async function persistResultsNode(state: ForecastWorkflowState): Promise<Partial<ForecastWorkflowState>> {
  try {
    // Create forecast events for each lane
    const direct = DatabaseHelper.get();
    const eventsCollection = direct.collection('Events');

    const now = new Date();
    const events = [];

    // Create a ForecastTotal event for each lane
    for (const lane of state.lanes || []) {
      const event: any = {
        teamId: state.teamId,
        laneId: lane._id,
        type: EventType.ForecastTotal,
        amount: state.prediction.amount,
        createdAt: now,
      };

      if (state.userId) {
        event.userId = state.userId;
      }

      events.push(event);
    }

    // Insert events if there are any
    if (events.length > 0) {
      await eventsCollection.insertMany(events);
    }

    return {
      currentPhase: 'complete',
      nextActions: [],
    };
  } catch (error: unknown) {
    // Don't fail the workflow if event persistence fails
    console.error('Failed to persist forecast events:', error);
    return {
      currentPhase: 'complete',
      nextActions: [],
      error: 'Failed to persist results, but prediction was calculated',
    };
  }
}

/**
 * Conditional edge function: Determines the next node based on current state
 */
function routeAfterCollectData(state: ForecastWorkflowState): string {
  if (state.error) {
    return END;
  }
  return 'calculate_prediction';
}

function routeAfterCalculatePrediction(state: ForecastWorkflowState): string {
  if (state.error) {
    return END;
  }
  return 'score_confidence';
}

function routeAfterScoreConfidence(state: ForecastWorkflowState): string {
  if (state.error) {
    return END;
  }
  return 'persist_results';
}

function routeAfterPersistResults(state: ForecastWorkflowState): string {
  return END;
}

/**
 * Build and return the forecast generation workflow graph
 */
export function createForecastWorkflow() {
  // Create the state graph
  const workflow = new StateGraph(ForecastWorkflowAnnotation)
    // Add nodes for each phase
    .addNode('collect_data', collectDataNode)
    .addNode('calculate_prediction', calculatePredictionNode)
    .addNode('score_confidence', scoreConfidenceNode)
    .addNode('persist_results', persistResultsNode);

  // Set the entry point
  workflow.addEdge('__start__', 'collect_data');

  // Add conditional edges
  workflow.addConditionalEdges('collect_data', routeAfterCollectData);
  workflow.addConditionalEdges('calculate_prediction', routeAfterCalculatePrediction);
  workflow.addConditionalEdges('score_confidence', routeAfterScoreConfidence);
  workflow.addConditionalEdges('persist_results', routeAfterPersistResults);

  return workflow;
}
