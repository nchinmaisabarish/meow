import { StatusCodes } from 'http-status-codes';
import { ApplicationError } from './ApplicationError.js';

export class LLMProcessingError extends ApplicationError {
  constructor(description?: string) {
    super(LLMProcessingError.name, StatusCodes.INTERNAL_SERVER_ERROR, description);
  }
}
