/**
 * Index Manager Interface
 * Orchestrates the entire indexing process for repositories
 */

export interface IndexManager {
  /**
   * Index a repository completely
   */
  indexRepository(repoPath: string, options: IndexOptions): Promise<IndexResult>;
  
  /**
   * Update an existing repository index with incremental changes
   */
  updateRepository(repoPath: string): Promise<UpdateResult>;
  
  /**
   * Get the current status of a repository index
   */
  getRepositoryStatus(repoPath: string): Promise<RepositoryStatus>;
}

export interface IndexOptions {
  /** Embedding provider to use */
  provider: EmbeddingProvider;
  
  /** Number of concurrent operations */
  concurrency: number;
  
  /** Batch size for embedding requests */
  batchSize: number;
  
  /** Force a complete re-index even if incremental is possible */
  forceFullIndex: boolean;
  
  /** File patterns to exclude from indexing */
  excludePatterns: string[];
}

export interface IndexResult {
  /** Number of files processed */
  filesProcessed: number;
  
  /** Number of text chunks generated */
  chunksGenerated: number;
  
  /** Number of embeddings created */
  embeddingsCreated: number;
  
  /** Total duration in milliseconds */
  duration: number;
  
  /** Unique repository identifier */
  repositoryId: string;
  
  /** Performance statistics */
  stats: IndexingStats;
}

export interface UpdateResult {
  /** Number of files added */
  filesAdded: number;
  
  /** Number of files modified */
  filesModified: number;
  
  /** Number of files deleted */
  filesDeleted: number;
  
  /** Total duration in milliseconds */
  duration: number;
  
  /** Updated embeddings count */
  embeddingsUpdated: number;
}

export interface RepositoryStatus {
  /** Repository identifier */
  repositoryId: string;
  
  /** Repository path */
  path: string;
  
  /** Last indexing timestamp */
  lastIndexed: Date | null;
  
  /** Total number of indexed files */
  totalFiles: number;
  
  /** Total number of chunks */
  totalChunks: number;
  
  /** Embedding provider used */
  embeddingProvider: string;
  
  /** Index version */
  version: string;
  
  /** Whether incremental updates are available */
  supportsIncremental: boolean;
}

export interface IndexingStats {
  /** Average files processed per second */
  filesPerSecond: number;
  
  /** Average embeddings generated per second */
  embeddingsPerSecond: number;
  
  /** Peak memory usage in MB */
  peakMemoryMB: number;
  
  /** API request count */
  apiRequests: number;
  
  /** Average API response time in ms */
  avgApiResponseTime: number;
}

export type EmbeddingProvider = 'openai' | 'ollama' | 'huggingface' | 'cohere';