/**
 * Repository Parser Interface
 * Handles file system operations with streaming and change detection
 */

export interface RepositoryParser {
  /**
   * Discover files in a repository with exclusion pattern support
   */
  discoverFiles(repoPath: string, excludePatterns: string[]): AsyncIterable<FileInfo>;
  
  /**
   * Detect changes since last index
   */
  detectChanges(repoPath: string, lastIndex: IndexMetadata): AsyncIterable<FileChange>;
  
  /**
   * Chunk a file into processable text segments
   */
  chunkFile(filePath: string, options?: ChunkOptions): AsyncIterable<TextChunk>;
}

export interface FileInfo {
  /** Absolute file path */
  path: string;
  
  /** Relative path from repository root */
  relativePath: string;
  
  /** File content hash */
  hash: string;
  
  /** File size in bytes */
  size: number;
  
  /** Last modification timestamp */
  lastModified: Date;
  
  /** File extension */
  extension: string;
  
  /** MIME type if detectable */
  mimeType?: string;
}

export interface FileChange {
  /** File path */
  path: string;
  
  /** Type of change */
  changeType: 'added' | 'modified' | 'deleted';
  
  /** New file hash (for added/modified files) */
  hash?: string;
  
  /** Previous file hash (for modified/deleted files) */
  previousHash?: string;
}

export interface TextChunk {
  /** Text content of the chunk */
  content: string;
  
  /** Source file path */
  filePath: string;
  
  /** Relative path from repository root */
  relativePath: string;
  
  /** Starting line number in source file */
  startLine: number;
  
  /** Ending line number in source file */
  endLine: number;
  
  /** Unique chunk identifier */
  chunkId: string;
  
  /** Chunk size in characters */
  size: number;
  
  /** Token count estimate */
  tokenCount: number;
}

export interface ChunkOptions {
  /** Target chunk size in characters */
  targetChars?: number;
  
  /** Overlap between chunks as percentage (0-1) */
  overlapRatio?: number;
  
  /** Maximum chunk size in characters */
  maxChars?: number;
  
  /** Minimum chunk size in characters */
  minChars?: number;
  
  /** Whether to respect line boundaries */
  respectLineBreaks?: boolean;
  
  /** Whether to respect word boundaries */
  respectWordBoundaries?: boolean;
}

export interface IndexMetadata {
  /** Repository path */
  repositoryPath: string;
  
  /** Last indexing timestamp */
  lastIndexed: Date;
  
  /** File hashes from last index */
  fileHashes: Map<string, string>;
  
  /** Total chunks in index */
  totalChunks: number;
  
  /** Embedding provider used */
  embeddingProvider: string;
  
  /** Index format version */
  version: string;
  
  /** Exclusion patterns used */
  excludePatterns: string[];
}