import { WorkflowStep } from './WorkflowStep';
import { ExecutionContext } from './ExecutionContext';

export interface Condition {
  evaluate(context: ExecutionContext): boolean;
}

export class SimpleCondition implements Condition {
  constructor(
    private key: string,
    private operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'exists',
    private value?: any
  ) {}

  evaluate(context: ExecutionContext): boolean {
    const contextValue = context.getVariable(this.key);

    switch (this.operator) {
      case 'equals':
        return contextValue === this.value;
      case 'notEquals':
        return contextValue !== this.value;
      case 'greaterThan':
        return contextValue > this.value;
      case 'lessThan':
        return contextValue < this.value;
      case 'contains':
        if (Array.isArray(contextValue)) {
          return contextValue.includes(this.value);
        }
        if (typeof contextValue === 'string') {
          return contextValue.includes(this.value);
        }
        return false;
      case 'exists':
        return contextValue !== undefined && contextValue !== null;
      default:
        return false;
    }
  }
}

export class CompositeCondition implements Condition {
  constructor(
    private conditions: Condition[],
    private operator: 'and' | 'or'
  ) {}

  evaluate(context: ExecutionContext): boolean {
    if (this.operator === 'and') {
      return this.conditions.every(condition => condition.evaluate(context));
    } else {
      return this.conditions.some(condition => condition.evaluate(context));
    }
  }
}

export interface ConditionalBranch {
  condition: Condition;
  nextStepId: string;
}

export class ConditionalStep implements WorkflowStep {
  public readonly id: string;
  public readonly name: string;
  private branches: ConditionalBranch[];
  private defaultNextStepId?: string;

  constructor(
    id: string,
    name: string,
    branches: ConditionalBranch[],
    defaultNextStepId?: string
  ) {
    this.id = id;
    this.name = name;
    this.branches = branches;
    this.defaultNextStepId = defaultNextStepId;
  }

  async execute(context: ExecutionContext): Promise<void> {
    context.log(`Evaluating conditional step: ${this.name}`);

    for (const branch of this.branches) {
      try {
        const conditionResult = branch.condition.evaluate(context);
        context.log(`Condition evaluated to: ${conditionResult}`);

        if (conditionResult) {
          context.setNextStepId(branch.nextStepId);
          context.log(`Branch selected: ${branch.nextStepId}`);
          return;
        }
      } catch (error) {
        context.log(`Error evaluating condition: ${error}`);
        throw error;
      }
    }

    if (this.defaultNextStepId) {
      context.setNextStepId(this.defaultNextStepId);
      context.log(`Default branch selected: ${this.defaultNextStepId}`);
    } else {
      context.log('No condition matched and no default branch specified');
    }
  }

  addBranch(condition: Condition, nextStepId: string): void {
    this.branches.push({ condition, nextStepId });
  }

  setDefaultBranch(nextStepId: string): void {
    this.defaultNextStepId = nextStepId;
  }

  getBranches(): ConditionalBranch[] {
    return [...this.branches];
  }

  getDefaultBranch(): string | undefined {
    return this.defaultNextStepId;
  }
}
