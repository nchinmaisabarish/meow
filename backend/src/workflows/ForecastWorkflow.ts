import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ForecastState, ForecastStateHelper } from '../helpers/ForecastStateHelper.js';
import { Lane, LaneType } from '../entities/Lane.js';
import { CardStatus } from '../entities/Card.js';
import { EntityHelper } from '../helpers/EntityHelper.js';
import { DatabaseHelper } from '../helpers/DatabaseHelper.js';
import { ObjectId } from 'mongodb';

/**
 * Define the state annotation for the forecast workflow
 * This uses LangGraph's Annotation API to define state structure
 */
const ForecastStateAnnotation = Annotation.Root({
  laneType: Annotation<LaneType>(),
  teamId: Annotation<ObjectId>(),
  startDate: Annotation<Date>(),
  endDate: Annotation<Date>(),
  userId: Annotation<ObjectId | undefined>(),
  laneIds: Annotation<ObjectId[] | undefined>(),
  dataQuality: Annotation<ForecastState['dataQuality']>(),
  calculations: Annotation<ForecastState['calculations']>(),
  forecast: Annotation<ForecastState['forecast']>(),
  error: Annotation<string | undefined>(),
});

/**
 * Node: Collect data - fetch lanes matching the criteria
 */
async function collectData(state: typeof ForecastStateAnnotation.State): Promise<Partial<typeof ForecastStateAnnotation.State>> {
  try {
    // Build query for lanes
    const query: any = {
      teamId: state.teamId,
      'tags.type': { $eq: state.laneType },
    };

    // For predicted forecasts, only include lanes marked for forecast
    if (state.laneType === LaneType.Normal) {
      query.inForecast = true;
    }

    // Fetch matching lanes
    const lanes = await EntityHelper.findBy(Lane, query);
    
    // Extract lane IDs
    const laneIds = lanes.map((lane: Lane) => lane._id);

    return ForecastStateHelper.updateWithLaneData(state, laneIds);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error collecting data';
    return ForecastStateHelper.updateWithError(state, errorMessage);
  }
}

/**
 * Node: Perform statistical analysis on collected data
 */
async function performStatisticalAnalysis(state: typeof ForecastStateAnnotation.State): Promise<Partial<typeof ForecastStateAnnotation.State>> {
  try {
    // If there's an error or no lanes, skip analysis
    if (state.error || !state.laneIds || state.laneIds.length === 0) {
      return ForecastStateHelper.updateWithCalculations(state, 0, 0);
    }

    // Get database connection
    const direct = DatabaseHelper.get();
    const collection = direct.collection('Cards');

    // Build aggregation match criteria
    const match: any = {
      $match: {
        teamId: { $eq: state.teamId },
        status: { $ne: CardStatus.Deleted },
        laneId: { $in: state.laneIds },
        closedAt: {
          $gte: state.startDate,
          $lte: state.endDate,
        },
      },
    };

    // Add user filter if specified
    if (state.userId) {
      match.$match.userId = state.userId;
    }

    // Group and sum
    const group = {
      $group: {
        _id: null,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    };

    // Execute aggregation
    const cursor = await collection.aggregate([match, group]);
    const results = await cursor.toArray();

    // Extract results
    const totalAmount = results[0] ? results[0].amount : 0;
    const totalCount = results[0] ? results[0].count : 0;

    // Update data quality with card count
    const dataQualityUpdate = ForecastStateHelper.updateWithDataQuality(state, totalCount);
    const calculationsUpdate = ForecastStateHelper.updateWithCalculations(state, totalAmount, totalCount);

    return {
      ...dataQualityUpdate,
      ...calculationsUpdate,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error performing statistical analysis';
    return ForecastStateHelper.updateWithError(state, errorMessage);
  }
}

/**
 * Node: Generate prediction based on analysis
 */
async function generatePrediction(state: typeof ForecastStateAnnotation.State): Promise<Partial<typeof ForecastStateAnnotation.State>> {
  try {
    // If there's an error, return empty forecast
    if (state.error) {
      return ForecastStateHelper.updateWithForecast(state, 0, 0);
    }

    // Check if we have sufficient data quality
    if (!ForecastStateHelper.hassufficientDataQuality(state)) {
      // Return empty forecast if data quality is insufficient
      return ForecastStateHelper.updateWithForecast(state, 0, 0);
    }

    // Use calculations to generate forecast
    const amount = state.calculations?.totalAmount || 0;
    const count = state.calculations?.totalCount || 0;

    return ForecastStateHelper.updateWithForecast(state, amount, count);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error generating prediction';
    return ForecastStateHelper.updateWithError(state, errorMessage);
  }
}

/**
 * Conditional edge: Determine if we should proceed with analysis or skip to prediction
 */
function shouldPerformAnalysis(state: typeof ForecastStateAnnotation.State): string {
  // If there's an error, skip to prediction (which will return empty forecast)
  if (state.error) {
    return 'generatePrediction';
  }

  // If we have lanes, perform analysis
  if (state.laneIds && state.laneIds.length > 0) {
    return 'performStatisticalAnalysis';
  }

  // Otherwise, skip to prediction with empty data
  return 'generatePrediction';
}

/**
 * Conditional edge: Determine if data quality is sufficient for prediction
 */
function shouldGeneratePrediction(state: typeof ForecastStateAnnotation.State): string {
  // Always proceed to prediction - it will handle insufficient data quality
  return 'generatePrediction';
}

/**
 * Create and compile the forecast workflow graph
 */
export function createForecastWorkflow() {
  // Create a new state graph
  const workflow = new StateGraph(ForecastStateAnnotation)
    // Add nodes for each step in the workflow
    .addNode('collectData', collectData)
    .addNode('performStatisticalAnalysis', performStatisticalAnalysis)
    .addNode('generatePrediction', generatePrediction)
    // Define the flow
    .addEdge('__start__', 'collectData')
    .addConditionalEdges('collectData', shouldPerformAnalysis, {
      performStatisticalAnalysis: 'performStatisticalAnalysis',
      generatePrediction: 'generatePrediction',
    })
    .addConditionalEdges('performStatisticalAnalysis', shouldGeneratePrediction, {
      generatePrediction: 'generatePrediction',
    })
    .addEdge('generatePrediction', '__end__');

  // Compile the graph
  return workflow.compile();
}

/**
 * Execute the forecast workflow with the given parameters
 */
export async function executeForecastWorkflow(
  laneType: LaneType,
  teamId: ObjectId,
  startDate: Date,
  endDate: Date,
  userId?: ObjectId
): Promise<{ amount: number; count: number }> {
  // Create the workflow
  const workflow = createForecastWorkflow();

  // Create initial state
  const initialState = ForecastStateHelper.createInitialState(
    laneType,
    teamId,
    startDate,
    endDate,
    userId
  );

  // Execute the workflow
  const result = await workflow.invoke(initialState);

  // Return the forecast or empty forecast if not available
  return result.forecast || ForecastStateHelper.getEmptyForecast();
}
