import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export class ZiriClient {
  private ziriPath: string;

  constructor() {
    // Use the locally installed ziri package
    this.ziriPath = 'npx ziri';
  }

  /**
   * Search the indexed codebase
   * @param query Search query
   * @returns Search results
   */
  async search(query: string): Promise<any[]> {
    try {
      const { stdout } = await execAsync(`${this.ziriPath} query "${query}" --json`, {
        cwd: vscode.workspace.rootPath
      });
      
      const results = JSON.parse(stdout);
      return Array.isArray(results) ? results : [];
    } catch (error: any) {
      if (error.stderr && error.stderr.includes('No results found')) {
        return [];
      }
      throw new Error(`Failed to search: ${error.message}`);
    }
  }

  /**
   * Index the current repository
   */
  async indexRepository(): Promise<void> {
    try {
      await execAsync(`${this.ziriPath} index --verbose`, {
        cwd: vscode.workspace.rootPath
      });
    } catch (error: any) {
      throw new Error(`Failed to index repository: ${error.message}`);
    }
  }

  /**
   * Chat with the AI assistant
   * @param question User question
   * @returns AI response
   */
  async chat(question: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`${this.ziriPath} chat "${question}"`, {
        cwd: vscode.workspace.rootPath
      });
      
      return stdout;
    } catch (error: any) {
      throw new Error(`Failed to chat: ${error.message}`);
    }
  }

  /**
   * Check if Ziri is available
   * @returns true if Ziri is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.ziriPath} --version`);
      return true;
    } catch {
      return false;
    }
  }
}