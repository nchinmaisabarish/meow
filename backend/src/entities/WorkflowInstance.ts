import { ObjectId } from 'mongodb';

export enum WorkflowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED'
}

export interface WorkflowStepState {
  stepId: string;
  stepName: string;
  status: WorkflowStatus;
  input?: any;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowInstanceData {
  _id?: ObjectId;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  currentStepIndex: number;
  steps: WorkflowStepState[];
  context: Record<string, any>;
  input?: any;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export class WorkflowInstance {
  _id?: ObjectId;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  currentStepIndex: number;
  steps: WorkflowStepState[];
  context: Record<string, any>;
  input?: any;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;

  constructor(data: WorkflowInstanceData) {
    this._id = data._id;
    this.workflowId = data.workflowId;
    this.workflowName = data.workflowName;
    this.status = data.status;
    this.currentStepIndex = data.currentStepIndex;
    this.steps = data.steps;
    this.context = data.context;
    this.input = data.input;
    this.output = data.output;
    this.error = data.error;
    this.startedAt = data.startedAt;
    this.completedAt = data.completedAt;
    this.updatedAt = data.updatedAt;
    this.metadata = data.metadata;
  }

  toJSON(): WorkflowInstanceData {
    return {
      _id: this._id,
      workflowId: this.workflowId,
      workflowName: this.workflowName,
      status: this.status,
      currentStepIndex: this.currentStepIndex,
      steps: this.steps,
      context: this.context,
      input: this.input,
      output: this.output,
      error: this.error,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }

  updateStep(stepIndex: number, stepState: Partial<WorkflowStepState>): void {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.steps[stepIndex] = { ...this.steps[stepIndex], ...stepState };
      this.updatedAt = new Date();
    }
  }

  addStep(stepState: WorkflowStepState): void {
    this.steps.push(stepState);
    this.updatedAt = new Date();
  }

  updateStatus(status: WorkflowStatus): void {
    this.status = status;
    this.updatedAt = new Date();
    if (status === WorkflowStatus.COMPLETED || status === WorkflowStatus.FAILED) {
      this.completedAt = new Date();
    }
  }

  updateContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
    this.updatedAt = new Date();
  }

  setError(error: string): void {
    this.error = error;
    this.status = WorkflowStatus.FAILED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  getCurrentStep(): WorkflowStepState | undefined {
    return this.steps[this.currentStepIndex];
  }

  moveToNextStep(): void {
    this.currentStepIndex++;
    this.updatedAt = new Date();
  }

  isComplete(): boolean {
    return this.status === WorkflowStatus.COMPLETED || this.status === WorkflowStatus.FAILED;
  }

  canResume(): boolean {
    return this.status === WorkflowStatus.PAUSED || this.status === WorkflowStatus.FAILED;
  }
}
