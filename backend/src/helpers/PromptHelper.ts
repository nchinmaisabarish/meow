import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PromptHelper {
  private static promptCache: Map<string, string> = new Map();

  /**
   * Load a prompt template from the prompts directory
   * @param filename - The name of the prompt file (e.g., 'query-interpreter.txt')
   * @returns The prompt template content
   */
  static async loadPrompt(filename: string): Promise<string> {
    // Check cache first
    if (this.promptCache.has(filename)) {
      return this.promptCache.get(filename)!;
    }

    // Load from file
    const promptPath = join(__dirname, '..', 'prompts', filename);
    const content = await readFile(promptPath, 'utf-8');
    
    // Cache for future use
    this.promptCache.set(filename, content);
    
    return content;
  }

  /**
   * Format a prompt template with user query
   * @param template - The prompt template
   * @param query - The user's query
   * @returns The formatted prompt
   */
  static formatPrompt(template: string, query: string): string {
    return `${template}\n\n${query}`;
  }

  /**
   * Clear the prompt cache (useful for testing)
   */
  static clearCache(): void {
    this.promptCache.clear();
  }
}
