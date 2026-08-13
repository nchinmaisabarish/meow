import {
  Tool,
  ToolMetadata,
  ToolSchema,
  ToolExecutionContext,
  ToolExecutionResult,
} from './ToolInterface';

export abstract class BaseTool<TInput = any, TOutput = any>
  implements Tool<TInput, TOutput>
{
  abstract readonly metadata: ToolMetadata;
  abstract readonly inputSchema: ToolSchema;
  abstract readonly outputSchema: ToolSchema;

  protected abstract executeImpl(
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<TOutput>;

  async execute(
    input: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>> {
    const executionContext: ToolExecutionContext = context || {
      timestamp: new Date(),
    };

    try {
      const validationResult = this.validate(input);
      if (!validationResult.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: validationResult.errors,
          },
        };
      }

      const result = await this.executeImpl(input, executionContext);

      return {
        success: true,
        data: result,
        metadata: {
          executedAt: executionContext.timestamp,
          toolName: this.metadata.name,
          toolVersion: this.metadata.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  validate(input: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    if (this.inputSchema.required) {
      for (const requiredField of this.inputSchema.required) {
        if (!(requiredField in input)) {
          errors.push(`Missing required field: ${requiredField}`);
        }
      }
    }

    for (const [fieldName, fieldSchema] of Object.entries(
      this.inputSchema.properties
    )) {
      if (fieldName in input) {
        const value = input[fieldName];
        const expectedType = fieldSchema.type;

        if (!this.validateType(value, expectedType)) {
          errors.push(
            `Field '${fieldName}' must be of type ${expectedType}, got ${typeof value}`
          );
        }

        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push(
            `Field '${fieldName}' must be one of: ${fieldSchema.enum.join(', ')}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  getSchema(): {
    metadata: ToolMetadata;
    input: ToolSchema;
    output: ToolSchema;
  } {
    return {
      metadata: this.metadata,
      input: this.inputSchema,
      output: this.outputSchema,
    };
  }

  protected createSuccessResult(data: TOutput): ToolExecutionResult<TOutput> {
    return {
      success: true,
      data,
    };
  }

  protected createErrorResult(
    code: string,
    message: string,
    details?: any
  ): ToolExecutionResult<TOutput> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
  }
}
