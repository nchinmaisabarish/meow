/**
 * WorkflowState manages execution context across workflow steps.
 * It provides a type-safe container for storing and retrieving
 * workflow data as steps execute.
 */
export class WorkflowState {
  private context: Map<string, any>;

  constructor() {
    this.context = new Map<string, any>();
  }

  /**
   * Set a value in the workflow context.
   * @param key - The key to store the value under
   * @param value - The value to store
   */
  set(key: string, value: any): void {
    this.context.set(key, value);
  }

  /**
   * Get a value from the workflow context.
   * @param key - The key to retrieve the value for
   * @returns The value associated with the key, or undefined if not found
   */
  get(key: string): any {
    return this.context.get(key);
  }

  /**
   * Check if a key exists in the workflow context.
   * @param key - The key to check for existence
   * @returns True if the key exists, false otherwise
   */
  has(key: string): boolean {
    return this.context.has(key);
  }

  /**
   * Get a snapshot of the current workflow state for inspection.
   * @returns An object containing all key-value pairs in the workflow context
   */
  getSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    this.context.forEach((value, key) => {
      snapshot[key] = value;
    });
    return snapshot;
  }
}
