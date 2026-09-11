import { ObjectId } from 'mongodb';
import { LaneType } from '../entities/Lane.js';

/**
 * Represents the state of the forecast generation workflow
 */
export interface ForecastState {
  /**
   * The lane type to forecast (Normal for predicted, ClosedWon for achieved)
   */
  laneType: LaneType;
  
  /**
   * The team ID for the forecast
   */
  teamId: ObjectId;
  
  /**
   * Start date for the forecast period
   */
  startDate: Date;
  
  /**
   * End date for the forecast period
   */
  endDate: Date;
  
  /**
   * Optional user ID to filter forecasts
   */
  userId?: ObjectId;
  
  /**
   * Collected lane IDs matching the criteria
   */
  laneIds?: ObjectId[];
  
  /**
   * Data quality metrics
   */
  dataQuality?: {
    laneCount: number;
    hasData: boolean;
    cardCount: number;
  };
  
  /**
   * Intermediate calculation results
   */
  calculations?: {
    totalAmount: number;
    totalCount: number;
  };
  
  /**
   * Final forecast result
   */
  forecast?: {
    amount: number;
    count: number;
  };
  
  /**
   * Any errors encountered during workflow execution
   */
  error?: string;
}

/**
 * Helper class for managing forecast workflow state transitions
 */
export class ForecastStateHelper {
  /**
   * Create initial forecast state from request parameters
   */
  static createInitialState(
    laneType: LaneType,
    teamId: ObjectId,
    startDate: Date,
    endDate: Date,
    userId?: ObjectId
  ): ForecastState {
    return {
      laneType,
      teamId,
      startDate,
      endDate,
      userId,
    };
  }

  /**
   * Update state with collected lane data
   */
  static updateWithLaneData(
    state: ForecastState,
    laneIds: ObjectId[]
  ): Partial<ForecastState> {
    return {
      laneIds,
      dataQuality: {
        laneCount: laneIds.length,
        hasData: laneIds.length > 0,
        cardCount: 0, // Will be updated in next step
      },
    };
  }

  /**
   * Update state with data quality metrics
   */
  static updateWithDataQuality(
    state: ForecastState,
    cardCount: number
  ): Partial<ForecastState> {
    return {
      dataQuality: {
        ...state.dataQuality!,
        cardCount,
        hasData: cardCount > 0,
      },
    };
  }

  /**
   * Update state with calculation results
   */
  static updateWithCalculations(
    state: ForecastState,
    totalAmount: number,
    totalCount: number
  ): Partial<ForecastState> {
    return {
      calculations: {
        totalAmount,
        totalCount,
      },
    };
  }

  /**
   * Update state with final forecast
   */
  static updateWithForecast(
    state: ForecastState,
    amount: number,
    count: number
  ): Partial<ForecastState> {
    return {
      forecast: {
        amount,
        count,
      },
    };
  }

  /**
   * Update state with error
   */
  static updateWithError(state: ForecastState, error: string): Partial<ForecastState> {
    return {
      error,
      forecast: {
        amount: 0,
        count: 0,
      },
    };
  }

  /**
   * Check if data quality is sufficient for forecast generation
   */
  static hassufficientDataQuality(state: ForecastState): boolean {
    if (!state.dataQuality) {
      return false;
    }
    
    return state.dataQuality.hasData && state.dataQuality.laneCount > 0;
  }

  /**
   * Get default empty forecast
   */
  static getEmptyForecast(): { amount: number; count: number } {
    return {
      amount: 0,
      count: 0,
    };
  }
}
