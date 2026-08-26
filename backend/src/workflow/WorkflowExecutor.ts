import { WorkflowStateMachine } from './WorkflowStateMachine.js';
import { WorkflowRegistry } from './WorkflowRegistry.js';
import { WorkflowInstance } from '../entities/WorkflowInstance.js';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const log = pino({
  name: 'WorkflowExecutor',
  level: process.env.LOG_LEVEL || 'info',
});

export interface WorkflowContext {
  [key: string]: any;
}

export interface WorkflowExecutionResult {
  success: boolean;
  workflowInstanceId?: string;
  currentState?: string;
  context?: WorkflowContext;
  error?: string;
}

export class WorkflowExecutor {
  private workflowRegistry: WorkflowRegistry;
  private activeWorkflows: Map<string, WorkflowStateMachine>;

  constructor(workflowRegistry: WorkflowRegistry) {
    this.workflowRegistry = workflowRegistry;
    this.activeWorkflows = new Map();
  }

  public async startWorkflow(
    workflowName: string,
    initialContext: WorkflowContext = {}
  ): Promise<WorkflowExecutionResult> {
    try {
      const workflowDefinition = this.workflowRegistry.getWorkflow(workflowName);

      if (!workflowDefinition) {
        log.error(`Workflow '${workflowName}' not found in registry`);
        return {
          success: false,
          error: `Workflow '${workflowName}' not found`,
        };
      }

      const workflowInstanceId = uuidv4();
      const stateMachine = new WorkflowStateMachine(workflowDefinition);

      const initialState = stateMachine.getCurrentState();

      const workflowInstance = new WorkflowInstance({
        _id: workflowInstanceId,
        workflowName,
        currentState: initialState,
        context: initialContext,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await workflowInstance.save();

      this.activeWorkflows.set(workflowInstanceId, stateMachine);

      await this.executeStateHooks(stateMachine, initialState, 'onEnter', initialContext);

      log.info(
        `Workflow '${workflowName}' started with instance ID: ${workflowInstanceId}, initial state: ${initialState}`
      );

      return {
        success: true,
        workflowInstanceId,
        currentState: initialState,
        context: initialContext,
      };
    } catch (error) {
      log.error(`Error starting workflow '${workflowName}':`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async executeTransition(
    workflowInstanceId: string,
    event: string,
    eventData: any = {}
  ): Promise<WorkflowExecutionResult> {
    try {
      const workflowInstance = await WorkflowInstance.findById(workflowInstanceId);

      if (!workflowInstance) {
        log.error(`Workflow instance '${workflowInstanceId}' not found`);
        return {
          success: false,
          error: `Workflow instance '${workflowInstanceId}' not found`,
        };
      }

      let stateMachine = this.activeWorkflows.get(workflowInstanceId);

      if (!stateMachine) {
        const workflowDefinition = this.workflowRegistry.getWorkflow(
          workflowInstance.workflowName
        );

        if (!workflowDefinition) {
          log.error(`Workflow '${workflowInstance.workflowName}' not found in registry`);
          return {
            success: false,
            error: `Workflow '${workflowInstance.workflowName}' not found`,
          };
        }

        stateMachine = new WorkflowStateMachine(workflowDefinition);
        stateMachine.setState(workflowInstance.currentState);
        this.activeWorkflows.set(workflowInstanceId, stateMachine);
      }

      const previousState = stateMachine.getCurrentState();

      await this.executeStateHooks(
        stateMachine,
        previousState,
        'onExit',
        workflowInstance.context
      );

      const transitionResult = stateMachine.transition(event);

      if (!transitionResult) {
        log.warn(
          `Transition failed for workflow instance '${workflowInstanceId}' with event '${event}' from state '${previousState}'`
        );
        return {
          success: false,
          error: `Invalid transition: event '${event}' not allowed from state '${previousState}'`,
          currentState: previousState,
          context: workflowInstance.context,
        };
      }

      const newState = stateMachine.getCurrentState();

      const updatedContext = {
        ...workflowInstance.context,
        ...eventData,
        lastEvent: event,
        lastTransitionAt: new Date(),
      };

      await this.executeStateHooks(stateMachine, newState, 'onEnter', updatedContext);

      workflowInstance.currentState = newState;
      workflowInstance.context = updatedContext;
      workflowInstance.updatedAt = new Date();

      await workflowInstance.save();

      log.info(
        `Workflow instance '${workflowInstanceId}' transitioned from '${previousState}' to '${newState}' via event '${event}'`
      );

      return {
        success: true,
        workflowInstanceId,
        currentState: newState,
        context: updatedContext,
      };
    } catch (error) {
      log.error(`Error executing transition for workflow instance '${workflowInstanceId}':`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getWorkflowStatus(
    workflowInstanceId: string
  ): Promise<WorkflowExecutionResult | null> {
    try {
      const workflowInstance = await WorkflowInstance.findById(workflowInstanceId);

      if (!workflowInstance) {
        log.warn(`Workflow instance '${workflowInstanceId}' not found`);
        return null;
      }

      return {
        success: true,
        workflowInstanceId: workflowInstance._id,
        currentState: workflowInstance.currentState,
        context: workflowInstance.context,
      };
    } catch (error) {
      log.error(`Error getting workflow status for instance '${workflowInstanceId}':`, error);
      return null;
    }
  }

  public async listWorkflowInstances(workflowName?: string): Promise<any[]> {
    try {
      const query = workflowName ? { workflowName } : {};
      const instances = await WorkflowInstance.find(query).sort({ createdAt: -1 }).exec();

      return instances.map((instance) => ({
        workflowInstanceId: instance._id,
        workflowName: instance.workflowName,
        currentState: instance.currentState,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      }));
    } catch (error) {
      log.error('Error listing workflow instances:', error);
      return [];
    }
  }

  public async deleteWorkflowInstance(workflowInstanceId: string): Promise<boolean> {
    try {
      const result = await WorkflowInstance.findByIdAndDelete(workflowInstanceId);

      if (result) {
        this.activeWorkflows.delete(workflowInstanceId);
        log.info(`Workflow instance '${workflowInstanceId}' deleted`);
        return true;
      }

      return false;
    } catch (error) {
      log.error(`Error deleting workflow instance '${workflowInstanceId}':`, error);
      return false;
    }
  }

  private async executeStateHooks(
    stateMachine: WorkflowStateMachine,
    stateName: string,
    hookType: 'onEnter' | 'onExit',
    context: WorkflowContext
  ): Promise<void> {
    try {
      const state = stateMachine.getStateDefinition(stateName);

      if (!state || !state[hookType]) {
        return;
      }

      const hook = state[hookType];

      if (typeof hook === 'function') {
        await Promise.resolve(hook(context));
        log.debug(`Executed ${hookType} hook for state '${stateName}'`);
      }
    } catch (error) {
      log.error(`Error executing ${hookType} hook for state '${stateName}':`, error);
    }
  }

  public clearActiveWorkflow(workflowInstanceId: string): void {
    this.activeWorkflows.delete(workflowInstanceId);
  }

  public getActiveWorkflowCount(): number {
    return this.activeWorkflows.size;
  }
}
