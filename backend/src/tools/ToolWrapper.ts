import { z } from 'zod';

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  schema?: z.ZodTypeAny;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export abstract class ToolWrapper<TInput = any, TOutput = any> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameter[];

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  abstract execute(input: TInput): Promise<TOutput>;

  async invoke(input: any): Promise<TOutput> {
    this.validateInput(input);
    return this.execute(input);
  }

  protected validateInput(input: any): void {
    for (const param of this.parameters) {
      if (param.required && (input[param.name] === undefined || input[param.name] === null)) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }
      if (param.schema && input[param.name] !== undefined) {
        const result = param.schema.safeParse(input[param.name]);
        if (!result.success) {
          throw new Error(`Invalid parameter '${param.name}': ${result.error.message}`);
        }
      }
    }
  }
}
