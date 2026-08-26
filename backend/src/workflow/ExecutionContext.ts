export class ExecutionContext {
  private variables: Map<string, any>;
  private logs: string[];
  private nextStepId?: string;
  private metadata: Map<string, any>;
  private startTime: Date;
  private status: 'pending' | 'running' | 'completed' | 'failed';

  constructor(initialVariables?: Record<string, any>) {
    this.variables = new Map();
    this.logs = [];
    this.metadata = new Map();
    this.startTime = new Date();
    this.status = 'pending';

    if (initialVariables) {
      Object.entries(initialVariables).forEach(([key, value]) => {
        this.variables.set(key, value);
      });
    }
  }

  setVariable(key: string, value: any): void {
    this.variables.set(key, value);
    this.log(`Variable set: ${key} = ${JSON.stringify(value)}`);
  }

  getVariable(key: string): any {
    return this.variables.get(key);
  }

  hasVariable(key: string): boolean {
    return this.variables.has(key);
  }

  deleteVariable(key: string): boolean {
    return this.variables.delete(key);
  }

  getAllVariables(): Record<string, any> {
    const result: Record<string, any> = {};
    this.variables.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  evaluateCondition(key: string, operator: string, value?: any): boolean {
    const contextValue = this.getVariable(key);

    switch (operator) {
      case 'equals':
      case '==':
      case '===':
        return contextValue === value;
      case 'notEquals':
      case '!=':
      case '!==':
        return contextValue !== value;
      case 'greaterThan':
      case '>':
        return contextValue > value;
      case 'lessThan':
      case '<':
        return contextValue < value;
      case 'greaterThanOrEqual':
      case '>=':
        return contextValue >= value;
      case 'lessThanOrEqual':
      case '<=':
        return contextValue <= value;
      case 'contains':
        if (Array.isArray(contextValue)) {
          return contextValue.includes(value);
        }
        if (typeof contextValue === 'string') {
          return contextValue.includes(value);
        }
        return false;
      case 'notContains':
        if (Array.isArray(contextValue)) {
          return !contextValue.includes(value);
        }
        if (typeof contextValue === 'string') {
          return !contextValue.includes(value);
        }
        return true;
      case 'exists':
        return contextValue !== undefined && contextValue !== null;
      case 'notExists':
        return contextValue === undefined || contextValue === null;
      case 'isEmpty':
        if (Array.isArray(contextValue)) {
          return contextValue.length === 0;
        }
        if (typeof contextValue === 'string') {
          return contextValue.length === 0;
        }
        if (typeof contextValue === 'object' && contextValue !== null) {
          return Object.keys(contextValue).length === 0;
        }
        return contextValue === undefined || contextValue === null;
      case 'isNotEmpty':
        if (Array.isArray(contextValue)) {
          return contextValue.length > 0;
        }
        if (typeof contextValue === 'string') {
          return contextValue.length > 0;
        }
        if (typeof contextValue === 'object' && contextValue !== null) {
          return Object.keys(contextValue).length > 0;
        }
        return contextValue !== undefined && contextValue !== null;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  evaluateExpression(expression: string): boolean {
    const parts = expression.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return this.evaluateCondition(parts[0], 'exists');
    }
    
    if (parts.length === 2) {
      const [key, operator] = parts;
      return this.evaluateCondition(key, operator);
    }
    
    if (parts.length >= 3) {
      const key = parts[0];
      const operator = parts[1];
      const value = parts.slice(2).join(' ');
      
      let parsedValue: any = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }
      
      return this.evaluateCondition(key, operator, parsedValue);
    }
    
    return false;
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setNextStepId(stepId: string): void {
    this.nextStepId = stepId;
    this.log(`Next step set to: ${stepId}`);
  }

  getNextStepId(): string | undefined {
    return this.nextStepId;
  }

  clearNextStepId(): void {
    this.nextStepId = undefined;
  }

  setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }

  getMetadata(key: string): any {
    return this.metadata.get(key);
  }

  getAllMetadata(): Record<string, any> {
    const result: Record<string, any> = {};
    this.metadata.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  getStartTime(): Date {
    return this.startTime;
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime.getTime();
  }

  setStatus(status: 'pending' | 'running' | 'completed' | 'failed'): void {
    this.status = status;
    this.log(`Status changed to: ${status}`);
  }

  getStatus(): 'pending' | 'running' | 'completed' | 'failed' {
    return this.status;
  }

  clone(): ExecutionContext {
    const cloned = new ExecutionContext();
    cloned.variables = new Map(this.variables);
    cloned.logs = [...this.logs];
    cloned.nextStepId = this.nextStepId;
    cloned.metadata = new Map(this.metadata);
    cloned.startTime = this.startTime;
    cloned.status = this.status;
    return cloned;
  }

  toJSON(): any {
    return {
      variables: this.getAllVariables(),
      logs: this.logs,
      nextStepId: this.nextStepId,
      metadata: this.getAllMetadata(),
      startTime: this.startTime.toISOString(),
      status: this.status,
      elapsedTime: this.getElapsedTime()
    };
  }
}
