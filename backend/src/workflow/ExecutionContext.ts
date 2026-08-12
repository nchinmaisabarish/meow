export interface ExecutionContextOptions {
  workflowId?: string;
  userId?: string;
  initialState?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface StepExecutionRecord {
  stepName: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  result?: any;
  error?: Error;
}

export class ExecutionContext {
  private readonly workflowId: string;
  private readonly userId?: string;
  private state: Map<string, any>;
  private metadata: Map<string, any>;
  private stepHistory: StepExecutionRecord[];
  private errors: Array<{ stepName: string; error: Error }>;
  private startTime: Date;
  private endTime?: Date;

  constructor(options: ExecutionContextOptions = {}) {
    this.workflowId = options.workflowId || this.generateWorkflowId();
    this.userId = options.userId;
    this.state = new Map(Object.entries(options.initialState || {}));
    this.metadata = new Map(Object.entries(options.metadata || {}));
    this.stepHistory = [];
    this.errors = [];
    this.startTime = new Date();
  }

  private generateWorkflowId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  getWorkflowId(): string {
    return this.workflowId;
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  setState(key: string, value: any): void {
    this.state.set(key, value);
  }

  getState<T = any>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  getAllState(): Record<string, any> {
    return Object.fromEntries(this.state.entries());
  }

  hasState(key: string): boolean {
    return this.state.has(key);
  }

  deleteState(key: string): boolean {
    return this.state.delete(key);
  }

  setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }

  getMetadata<T = any>(key: string): T | undefined {
    return this.metadata.get(key) as T | undefined;
  }

  getAllMetadata(): Record<string, any> {
    return Object.fromEntries(this.metadata.entries());
  }

  addStepResult(stepName: string, result: any): void {
    const record: StepExecutionRecord = {
      stepName,
      startTime: new Date(),
      endTime: new Date(),
      success: true,
      result,
    };
    this.stepHistory.push(record);
  }

  addError(stepName: string, error: Error): void {
    this.errors.push({ stepName, error });
    const record: StepExecutionRecord = {
      stepName,
      startTime: new Date(),
      endTime: new Date(),
      success: false,
      error,
    };
    this.stepHistory.push(record);
  }

  getStepHistory(): StepExecutionRecord[] {
    return [...this.stepHistory];
  }

  getErrors(): Array<{ stepName: string; error: Error }> {
    return [...this.errors];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getLastStepResult(): StepExecutionRecord | undefined {
    return this.stepHistory[this.stepHistory.length - 1];
  }

  getStepResult(stepName: string): StepExecutionRecord | undefined {
    return this.stepHistory.find((record) => record.stepName === stepName);
  }

  markComplete(): void {
    this.endTime = new Date();
  }

  isComplete(): boolean {
    return this.endTime !== undefined;
  }

  getDuration(): number | undefined {
    if (!this.endTime) {
      return undefined;
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }

  getStartTime(): Date {
    return this.startTime;
  }

  getEndTime(): Date | undefined {
    return this.endTime;
  }

  clone(): ExecutionContext {
    const cloned = new ExecutionContext({
      workflowId: this.workflowId,
      userId: this.userId,
      initialState: this.getAllState(),
      metadata: this.getAllMetadata(),
    });
    cloned.stepHistory = [...this.stepHistory];
    cloned.errors = [...this.errors];
    cloned.startTime = this.startTime;
    cloned.endTime = this.endTime;
    return cloned;
  }

  toJSON(): Record<string, any> {
    return {
      workflowId: this.workflowId,
      userId: this.userId,
      state: this.getAllState(),
      metadata: this.getAllMetadata(),
      stepHistory: this.stepHistory,
      errors: this.errors.map((e) => ({
        stepName: e.stepName,
        error: e.error.message,
      })),
      startTime: this.startTime.toISOString(),
      endTime: this.endTime?.toISOString(),
      duration: this.getDuration(),
      isComplete: this.isComplete(),
      hasErrors: this.hasErrors(),
    };
  }
}
