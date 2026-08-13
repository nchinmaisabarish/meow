import { WorkflowDefinition, WorkflowSchemaValidator } from './WorkflowSchema.js';

export interface WorkflowRegistryOptions {
  allowOverwrite?: boolean;
  validateOnRegister?: boolean;
}

export class WorkflowRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowRegistryError';
  }
}

export class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition>;
  private workflowsByName: Map<string, Map<string, WorkflowDefinition>>;
  private options: WorkflowRegistryOptions;

  constructor(options: WorkflowRegistryOptions = {}) {
    this.workflows = new Map();
    this.workflowsByName = new Map();
    this.options = {
      allowOverwrite: options.allowOverwrite ?? false,
      validateOnRegister: options.validateOnRegister ?? true,
    };
  }

  register(workflow: WorkflowDefinition): void {
    if (this.options.validateOnRegister) {
      const validation = WorkflowSchemaValidator.validateWorkflowDefinition(workflow);
      if (!validation.valid) {
        throw new WorkflowRegistryError(
          `Invalid workflow definition: ${validation.errors.join(', ')}`
        );
      }
    }

    if (this.workflows.has(workflow.id) && !this.options.allowOverwrite) {
      throw new WorkflowRegistryError(
        `Workflow with id ${workflow.id} already exists. Set allowOverwrite to true to replace it.`
      );
    }

    const workflowWithTimestamps = {
      ...workflow,
      createdAt: workflow.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(workflow.id, workflowWithTimestamps);

    if (!this.workflowsByName.has(workflow.name)) {
      this.workflowsByName.set(workflow.name, new Map());
    }
    this.workflowsByName.get(workflow.name)!.set(workflow.version, workflowWithTimestamps);
  }

  registerBatch(workflows: WorkflowDefinition[]): void {
    const errors: string[] = [];

    workflows.forEach((workflow, index) => {
      try {
        this.register(workflow);
      } catch (error) {
        errors.push(`Workflow at index ${index} (${workflow.id}): ${(error as Error).message}`);
      }
    });

    if (errors.length > 0) {
      throw new WorkflowRegistryError(
        `Failed to register ${errors.length} workflow(s): ${errors.join('; ')}`
      );
    }
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  getByName(name: string, version?: string): WorkflowDefinition | undefined {
    const versions = this.workflowsByName.get(name);
    if (!versions) {
      return undefined;
    }

    if (version) {
      return versions.get(version);
    }

    const sortedVersions = Array.from(versions.entries()).sort((a, b) => {
      return this.compareVersions(b[0], a[0]);
    });

    return sortedVersions[0]?.[1];
  }

  getVersions(name: string): string[] {
    const versions = this.workflowsByName.get(name);
    if (!versions) {
      return [];
    }

    return Array.from(versions.keys()).sort((a, b) => this.compareVersions(b, a));
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  listByName(): Map<string, WorkflowDefinition[]> {
    const result = new Map<string, WorkflowDefinition[]>();

    this.workflowsByName.forEach((versions, name) => {
      const sortedWorkflows = Array.from(versions.values()).sort((a, b) => {
        return this.compareVersions(b.version, a.version);
      });
      result.set(name, sortedWorkflows);
    });

    return result;
  }

  has(id: string): boolean {
    return this.workflows.has(id);
  }

  hasByName(name: string, version?: string): boolean {
    const versions = this.workflowsByName.get(name);
    if (!versions) {
      return false;
    }

    if (version) {
      return versions.has(version);
    }

    return versions.size > 0;
  }

  unregister(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      return false;
    }

    this.workflows.delete(id);

    const versions = this.workflowsByName.get(workflow.name);
    if (versions) {
      versions.delete(workflow.version);
      if (versions.size === 0) {
        this.workflowsByName.delete(workflow.name);
      }
    }

    return true;
  }

  unregisterByName(name: string, version?: string): number {
    const versions = this.workflowsByName.get(name);
    if (!versions) {
      return 0;
    }

    if (version) {
      const workflow = versions.get(version);
      if (workflow) {
        this.workflows.delete(workflow.id);
        versions.delete(version);
        if (versions.size === 0) {
          this.workflowsByName.delete(name);
        }
        return 1;
      }
      return 0;
    }

    const count = versions.size;
    versions.forEach((workflow) => {
      this.workflows.delete(workflow.id);
    });
    this.workflowsByName.delete(name);
    return count;
  }

  clear(): void {
    this.workflows.clear();
    this.workflowsByName.clear();
  }

  count(): number {
    return this.workflows.size;
  }

  getWorkflowNames(): string[] {
    return Array.from(this.workflowsByName.keys()).sort();
  }

  validate(workflow: WorkflowDefinition): { valid: boolean; errors: string[] } {
    return WorkflowSchemaValidator.validateWorkflowDefinition(workflow);
  }

  export(): WorkflowDefinition[] {
    return this.list();
  }

  import(workflows: WorkflowDefinition[], options?: { overwrite?: boolean }): void {
    const originalAllowOverwrite = this.options.allowOverwrite;
    if (options?.overwrite !== undefined) {
      this.options.allowOverwrite = options.overwrite;
    }

    try {
      this.registerBatch(workflows);
    } finally {
      this.options.allowOverwrite = originalAllowOverwrite;
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }
}

let defaultRegistry: WorkflowRegistry | null = null;

export function getDefaultRegistry(): WorkflowRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new WorkflowRegistry({
      allowOverwrite: false,
      validateOnRegister: true,
    });
  }
  return defaultRegistry;
}

export function setDefaultRegistry(registry: WorkflowRegistry): void {
  defaultRegistry = registry;
}

export function resetDefaultRegistry(): void {
  defaultRegistry = null;
}
