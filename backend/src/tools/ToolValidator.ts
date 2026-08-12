import { JSONSchema } from './Tool';

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class ToolValidator {
  static validate(data: any, schema: JSONSchema): ValidationResult {
    const errors: ValidationError[] = [];
    this.validateValue(data, schema, '', errors);
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateValue(
    value: any,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[]
  ): void {
    if (value === null || value === undefined) {
      if (schema.required && schema.required.length > 0) {
        errors.push({
          path,
          message: 'Value is required but is null or undefined',
          value,
        });
      }
      return;
    }

    const actualType = this.getType(value);

    if (schema.enum) {
      if (!schema.enum.includes(value)) {
        errors.push({
          path,
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          value,
        });
      }
      return;
    }

    if (schema.type && actualType !== schema.type) {
      errors.push({
        path,
        message: `Expected type '${schema.type}' but got '${actualType}'`,
        value,
      });
      return;
    }

    switch (schema.type) {
      case 'object':
        this.validateObject(value, schema, path, errors);
        break;
      case 'array':
        this.validateArray(value, schema, path, errors);
        break;
      case 'string':
        this.validateString(value, schema, path, errors);
        break;
      case 'number':
      case 'integer':
        this.validateNumber(value, schema, path, errors);
        break;
    }
  }

  private static validateObject(
    value: any,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[]
  ): void {
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${key}` : key;
        const propValue = value[key];

        if (propValue === undefined && schema.required?.includes(key)) {
          errors.push({
            path: propPath,
            message: `Required property '${key}' is missing`,
          });
        } else if (propValue !== undefined) {
          this.validateValue(propValue, propSchema as JSONSchema, propPath, errors);
        }
      }
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Additional property '${key}' is not allowed`,
            value: value[key],
          });
        }
      }
    }
  }

  private static validateArray(
    value: any,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[]
  ): void {
    if (!Array.isArray(value)) {
      errors.push({
        path,
        message: 'Expected an array',
        value,
      });
      return;
    }

    if (schema.items) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        this.validateValue(item, schema.items as JSONSchema, itemPath, errors);
      });
    }
  }

  private static validateString(
    value: any,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[]
  ): void {
    if (typeof value !== 'string') {
      return;
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String length must be at least ${schema.minLength}`,
        value,
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length must not exceed ${schema.maxLength}`,
        value,
      });
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String does not match pattern: ${schema.pattern}`,
          value,
        });
      }
    }

    if (schema.format) {
      this.validateFormat(value, schema.format, path, errors);
    }
  }

  private static validateNumber(
    value: any,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[]
  ): void {
    if (typeof value !== 'number') {
      return;
    }

    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push({
        path,
        message: 'Value must be an integer',
        value,
      });
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Value must be at least ${schema.minimum}`,
        value,
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Value must not exceed ${schema.maximum}`,
        value,
      });
    }
  }

  private static validateFormat(
    value: string,
    format: string,
    path: string,
    errors: ValidationError[]
  ): void {
    switch (format) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({
            path,
            message: 'Invalid email format',
            value,
          });
        }
        break;
      case 'uri':
      case 'url':
        try {
          new URL(value);
        } catch {
          errors.push({
            path,
            message: 'Invalid URL format',
            value,
          });
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          errors.push({
            path,
            message: 'Invalid date format',
            value,
          });
        }
        break;
      case 'date-time':
        if (isNaN(Date.parse(value))) {
          errors.push({
            path,
            message: 'Invalid date-time format',
            value,
          });
        }
        break;
      case 'uuid':
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value
          )
        ) {
          errors.push({
            path,
            message: 'Invalid UUID format',
            value,
          });
        }
        break;
    }
  }

  private static getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    return typeof value;
  }
}
