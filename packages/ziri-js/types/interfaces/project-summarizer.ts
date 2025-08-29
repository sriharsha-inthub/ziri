/**
 * Project Summarizer Interface
 * Maintains dynamic project summaries for prompt enhancement
 */

import { FileChange } from './repository-parser.js';

export interface ProjectSummarizer {
  /**
   * Generate a complete project summary
   */
  generateSummary(repositoryId: string): Promise<ProjectSummary>;
  
  /**
   * Update summary based on file changes
   */
  updateSummary(repositoryId: string, changes: FileChange[]): Promise<void>;
  
  /**
   * Get existing project summary
   */
  getSummary(repositoryId: string): Promise<ProjectSummary>;
  
  /**
   * Check if summary needs regeneration
   */
  needsRegeneration(repositoryId: string, changes: FileChange[]): Promise<boolean>;
}

export interface ProjectSummary {
  /** High-level project overview */
  overview: string;
  
  /** Technologies and frameworks detected */
  technologies: string[];
  
  /** Project directory structure */
  structure: DirectoryStructure;
  
  /** Key components and their purposes */
  keyComponents: ComponentInfo[];
  
  /** Last update timestamp */
  lastUpdated: Date;
  
  /** Summary generation metadata */
  metadata: SummaryMetadata;
}

export interface DirectoryStructure {
  /** Root directory name */
  name: string;
  
  /** Directory type classification */
  type: DirectoryType;
  
  /** Subdirectories */
  children: DirectoryStructure[];
  
  /** Important files in this directory */
  importantFiles: string[];
  
  /** Directory purpose description */
  purpose?: string;
}

export interface ComponentInfo {
  /** Component name */
  name: string;
  
  /** Component type (class, function, module, etc.) */
  type: ComponentType;
  
  /** File path where component is defined */
  filePath: string;
  
  /** Component description */
  description: string;
  
  /** Dependencies on other components */
  dependencies: string[];
  
  /** Lines of code estimate */
  linesOfCode?: number;
}

export interface SummaryMetadata {
  /** Total files analyzed */
  filesAnalyzed: number;
  
  /** Total lines of code */
  totalLinesOfCode: number;
  
  /** Primary programming language */
  primaryLanguage: string;
  
  /** Language distribution */
  languageDistribution: Map<string, number>;
  
  /** Project complexity score (1-10) */
  complexityScore: number;
  
  /** Summary generation timestamp */
  generatedAt: Date;
  
  /** Version of summarizer used */
  summarizerVersion: string;
}

export type DirectoryType = 
  | 'source'
  | 'test' 
  | 'documentation'
  | 'configuration'
  | 'build'
  | 'assets'
  | 'dependencies'
  | 'other';

export type ComponentType =
  | 'class'
  | 'function'
  | 'interface'
  | 'module'
  | 'service'
  | 'component'
  | 'controller'
  | 'model'
  | 'utility'
  | 'configuration'
  | 'other';