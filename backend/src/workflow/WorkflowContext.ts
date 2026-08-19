import { ObjectId } from 'mongodb';

export interface WorkflowVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export interface WorkflowState {
  currentStep: string;
  completedSteps: string[];
  variables: Map<string, WorkflowVariable>;
  startedAt: Date;
  lastUpdatedAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  error?: string;
}

export interface WorkflowSnapshot {
  workflowId: string;
  executionId: string;
  state: WorkflowState;
  timestamp: Date;
}

export class WorkflowContext {
  private workflowId: string;
  private executionId: string;
  private state: WorkflowState;
  private snapshots: WorkflowSnapshot[];
  private maxSnapshots: number;

  constructor(workflowId: string, executionId?: string) {
    this.workflowId = workflowId;
    this.executionId = executionId || new ObjectId().toString();
    this.snapshots = [];
    this.maxSnapshots = 50;
    this.state = {
      currentStep: '',
      completedSteps: [],
      variables: new Map<string, WorkflowVariable>(),
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      status: 'pending'
    };
  }

  getWorkflowId(): string {
    return this.workflowId;
  }

  getExecutionId(): string {
    return this.executionId;
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  getCurrentStep(): string {
    return this.state.currentStep;
  }

  setCurrentStep(stepId: string): void {
    this.state.currentStep = stepId;
    this.state.lastUpdatedAt = new Date();
    this.createSnapshot();
  }

  markStepCompleted(stepId: string): void {
    if (!this.state.completedSteps.includes(stepId)) {
      this.state.completedSteps.push(stepId);
      this.state.lastUpdatedAt = new Date();
      this.createSnapshot();
    }
  }

  isStepCompleted(stepId: string): boolean {
    return this.state.completedSteps.includes(stepId);
  }

  getCompletedSteps(): string[] {
    return [...this.state.completedSteps];
  }

  setVariable(name: string, value: any, type?: 'string' | 'number' | 'boolean' | 'object' | 'array'): void {
    const inferredType = type || this.inferType(value);
    this.state.variables.set(name, {
      name,
      value,
      type: inferredType
    });
    this.state.lastUpdatedAt = new Date();
  }

  getVariable(name: string): any {
    const variable = this.state.variables.get(name);
    return variable ? variable.value : undefined;
  }

  hasVariable(name: string): boolean {
    return this.state.variables.has(name);
  }

  getAllVariables(): Map<string, WorkflowVariable> {
    return new Map(this.state.variables);
  }

  deleteVariable(name: string): boolean {
    const deleted = this.state.variables.delete(name);
    if (deleted) {
      this.state.lastUpdatedAt = new Date();
    }
    return deleted;
  }

  setStatus(status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'): void {
    this.state.status = status;
    this.state.lastUpdatedAt = new Date();
    this.createSnapshot();
  }

  getStatus(): 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back' {
    return this.state.status;
  }

  setError(error: string): void {
    this.state.error = error;
    this.state.status = 'failed';
    this.state.lastUpdatedAt = new Date();
    this.createSnapshot();
  }

  getError(): string | undefined {
    return this.state.error;
  }

  clearError(): void {
    delete this.state.error;
    this.state.lastUpdatedAt = new Date();
  }

  private inferType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null || value === undefined) {
      return 'object';
    }
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return type;
    }
    return 'object';
  }

  private createSnapshot(): void {
    const snapshot: WorkflowSnapshot = {
      workflowId: this.workflowId,
      executionId: this.executionId,
      state: JSON.parse(JSON.stringify({
        ...this.state,
        variables: Array.from(this.state.variables.entries())
      })),
      timestamp: new Date()
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  getSnapshots(): WorkflowSnapshot[] {
    return [...this.snapshots];
  }

  getLatestSnapshot(): WorkflowSnapshot | undefined {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : undefined;
  }

  restoreFromSnapshot(snapshot: WorkflowSnapshot): void {
    this.state = {
      ...snapshot.state,
      variables: new Map(snapshot.state.variables as any)
    };
  }

  rollbackToStep(stepId: string): boolean {
    const stepIndex = this.state.completedSteps.indexOf(stepId);
    if (stepIndex === -1) {
      return false;
    }

    this.state.completedSteps = this.state.completedSteps.slice(0, stepIndex);
    this.state.currentStep = stepId;
    this.state.status = 'rolled_back';
    this.state.lastUpdatedAt = new Date();
    this.createSnapshot();
    return true;
  }

  serialize(): string {
    return JSON.stringify({
      workflowId: this.workflowId,
      executionId: this.executionId,
      state: {
        ...this.state,
        variables: Array.from(this.state.variables.entries())
      },
      snapshots: this.snapshots
    });
  }

  static deserialize(data: string): WorkflowContext {
    const parsed = JSON.parse(data);
    const context = new WorkflowContext(parsed.workflowId, parsed.executionId);
    context.state = {
      ...parsed.state,
      variables: new Map(parsed.state.variables),
      startedAt: new Date(parsed.state.startedAt),
      lastUpdatedAt: new Date(parsed.state.lastUpdatedAt)
    };
    context.snapshots = parsed.snapshots.map((s: any) => ({
      ...s,
      timestamp: new Date(s.timestamp),
      state: {
        ...s.state,
        startedAt: new Date(s.state.startedAt),
        lastUpdatedAt: new Date(s.state.lastUpdatedAt)
      }
    }));
    return context;
  }

  reset(): void {
    this.state = {
      currentStep: '',
      completedSteps: [],
      variables: new Map<string, WorkflowVariable>(),
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      status: 'pending'
    };
    this.snapshots = [];
  }

  clone(): WorkflowContext {
    const cloned = new WorkflowContext(this.workflowId);
    cloned.executionId = new ObjectId().toString();
    cloned.state = {
      ...this.state,
      variables: new Map(this.state.variables),
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      completedSteps: [...this.state.completedSteps]
    };
    return cloned;
  }
}
