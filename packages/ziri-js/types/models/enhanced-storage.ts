/**
 * Enhanced Storage Data Models
 * Implements rich metadata and content storage for enhanced context retrieval
 */

export interface EnhancedChunkData {
  /** Actual code content */
  content: string;
  
  /** Full file path */
  filePath: string;
  
  /** Repository-relative path */
  relativePath: string;
  
  /** Starting line number */
  startLine: number;
  
  /** Ending line number */
  endLine: number;
  
  /** Detected programming language */
  language: string;
  
  /** Chunk type classification */
  type: 'function' | 'class' | 'import' | 'comment' | 'code';
  
  /** Extracted function name (if applicable) */
  functionName?: string;
  
  /** Extracted class name (if applicable) */
  className?: string;
  
  /** Import statements found in chunk */
  imports?: string[];
  
  /** Surrounding context lines */
  surroundingContext?: {
    before: string[];
    after: string[];
  };
  
  /** Basic metadata */
  metadata: {
    fileType: string;
    size: number;
    tokenCount: number;
  };
}

export interface EnhancedQueryResult {
  /** Similarity score (0-1) */
  score: number;
  
  /** Source file path */
  file: string;
  
  /** Repository identifier */
  repo: string;
  
  /** Line range as string "startLine-endLine" */
  lines: string;
  
  /** Actual code content */
  context: string;
  
  /** Programming language */
  language: string;
  
  /** Chunk type */
  type: 'function' | 'class' | 'import' | 'comment' | 'code';
  
  /** Function name (if applicable) */
  functionName?: string;
  
  /** Class name (if applicable) */
  className?: string;
  
  /** Basic relevance explanation */
  relevanceExplanation: string;
  
  /** Surrounding lines for context */
  surroundingLines?: {
    before: string[];
    after: string[];
  };
}

export interface EnhancedIndexEntry {
  /** Chunk hash ID */
  id: string;
  
  /** File relative path */
  relPath: string;
  
  /** Path to vector file */
  vectorPath: string;
  
  /** Path to enhanced chunk data file */
  chunkPath: string;
  
  /** Enhanced metadata */
  metadata: {
    alias: string;
    language: string;
    type: string;
    functionName?: string;
    className?: string;
    lastModified: number;
  };
}