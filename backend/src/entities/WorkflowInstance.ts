import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflowInstance extends Document {
  _id: string;
  workflowName: string;
  currentState: string;
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowInstanceSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    workflowName: {
      type: String,
      required: true,
      index: true,
    },
    currentState: {
      type: String,
      required: true,
      index: true,
    },
    context: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'workflow_instances',
    timestamps: false,
  }
);

WorkflowInstanceSchema.index({ workflowName: 1, createdAt: -1 });
WorkflowInstanceSchema.index({ currentState: 1, updatedAt: -1 });

WorkflowInstanceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const WorkflowInstance = mongoose.model<IWorkflowInstance>(
  'WorkflowInstance',
  WorkflowInstanceSchema
);
