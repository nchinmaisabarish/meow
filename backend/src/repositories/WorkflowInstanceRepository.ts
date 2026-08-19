import { Collection, Db, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { WorkflowInstance, WorkflowInstanceData, WorkflowStatus } from '../entities/WorkflowInstance';

export class WorkflowInstanceRepository {
  private collection: Collection<WorkflowInstanceData>;

  constructor(db: Db) {
    this.collection = db.collection<WorkflowInstanceData>('workflow_instances');
    this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ workflowId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ startedAt: -1 });
    await this.collection.createIndex({ workflowId: 1, status: 1 });
  }

  async create(workflowInstance: WorkflowInstance): Promise<WorkflowInstance> {
    const data = workflowInstance.toJSON();
    const result = await this.collection.insertOne(data);
    workflowInstance._id = result.insertedId;
    return workflowInstance;
  }

  async findById(id: string | ObjectId): Promise<WorkflowInstance | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const data = await this.collection.findOne({ _id: objectId });
    return data ? new WorkflowInstance(data) : null;
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowInstance[]> {
    const cursor = this.collection.find({ workflowId });
    const results = await cursor.toArray();
    return results.map(data => new WorkflowInstance(data));
  }

  async findByStatus(status: WorkflowStatus): Promise<WorkflowInstance[]> {
    const cursor = this.collection.find({ status });
    const results = await cursor.toArray();
    return results.map(data => new WorkflowInstance(data));
  }

  async findAll(filter: Filter<WorkflowInstanceData> = {}, limit: number = 100, skip: number = 0): Promise<WorkflowInstance[]> {
    const cursor = this.collection.find(filter).sort({ startedAt: -1 }).limit(limit).skip(skip);
    const results = await cursor.toArray();
    return results.map(data => new WorkflowInstance(data));
  }

  async update(id: string | ObjectId, workflowInstance: WorkflowInstance): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const data = workflowInstance.toJSON();
    delete data._id;
    const result = await this.collection.updateOne(
      { _id: objectId },
      { $set: data }
    );
    return result.modifiedCount > 0;
  }

  async updatePartial(id: string | ObjectId, updates: Partial<WorkflowInstanceData>): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    updates.updatedAt = new Date();
    const result = await this.collection.updateOne(
      { _id: objectId },
      { $set: updates }
    );
    return result.modifiedCount > 0;
  }

  async updateStatus(id: string | ObjectId, status: WorkflowStatus): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updates: Partial<WorkflowInstanceData> = {
      status,
      updatedAt: new Date()
    };
    if (status === WorkflowStatus.COMPLETED || status === WorkflowStatus.FAILED) {
      updates.completedAt = new Date();
    }
    const result = await this.collection.updateOne(
      { _id: objectId },
      { $set: updates }
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  async deleteByWorkflowId(workflowId: string): Promise<number> {
    const result = await this.collection.deleteMany({ workflowId });
    return result.deletedCount;
  }

  async count(filter: Filter<WorkflowInstanceData> = {}): Promise<number> {
    return await this.collection.countDocuments(filter);
  }

  async findRunningInstances(): Promise<WorkflowInstance[]> {
    return await this.findByStatus(WorkflowStatus.RUNNING);
  }

  async findPausedInstances(): Promise<WorkflowInstance[]> {
    return await this.findByStatus(WorkflowStatus.PAUSED);
  }

  async findFailedInstances(): Promise<WorkflowInstance[]> {
    return await this.findByStatus(WorkflowStatus.FAILED);
  }

  async findResumableInstances(): Promise<WorkflowInstance[]> {
    const cursor = this.collection.find({
      status: { $in: [WorkflowStatus.PAUSED, WorkflowStatus.FAILED] }
    });
    const results = await cursor.toArray();
    return results.map(data => new WorkflowInstance(data));
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<WorkflowInstance[]> {
    const cursor = this.collection.find({
      startedAt: { $gte: startDate, $lte: endDate }
    }).sort({ startedAt: -1 });
    const results = await cursor.toArray();
    return results.map(data => new WorkflowInstance(data));
  }

  async getStatistics(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
  }> {
    const [total, pending, running, completed, failed, paused] = await Promise.all([
      this.count(),
      this.count({ status: WorkflowStatus.PENDING }),
      this.count({ status: WorkflowStatus.RUNNING }),
      this.count({ status: WorkflowStatus.COMPLETED }),
      this.count({ status: WorkflowStatus.FAILED }),
      this.count({ status: WorkflowStatus.PAUSED })
    ]);

    return { total, pending, running, completed, failed, paused };
  }
}
