/**
 * Index Store Interface
 * Provides isolated, efficient storage for each repository
 */

import { EmbeddedChunk } from './embedding-pipeline.js';
import { IndexMetadata } from './repository-parser.js';

export interface IndexStore {
  /**
   * Create a new repository index store
   */
  createRepository(repoPath: string): Promise<string>;
  
  /**
   * Store embeddings in batch for performance
   */
  storeEmbeddings(repositoryId: string, embeddings: EmbeddedChunk[]): Promise<void>;
  
  /**
   * Remove embeddings by chunk IDs
   */
  removeEmbeddings(repositoryId: string, chunkIds: string[]): Promise<void>;
  
  /**
   * Query embeddings by similarity
   */
  queryEmbeddings(repositoryId: string, query: number[], limit: number): Promise<SearchResult[]>;
  
  /**
   * Get repository metadata
   */
  getMetadata(repositoryId: string): Promise<IndexMetadata>;
  
  /**
   * Update repository metadata
   */
  updateMetadata(repositoryId: string, metadata: IndexMetadata): Promise<void>;
  
  /**
   * Check if repository exists
   */
  repositoryExists(repositoryId: string): Promise<boolean>;
  
  /**
   * Delete entire repository index
   */
  deleteRepository(repositoryId: string): Promise<void>;
  
  /**
   * Get storage statistics
   */
  getStorageStats(repositoryId: string): Promise<StorageStats>;
}

export interface SearchResult {
  /** Chunk ID */
  chunkId: string;
  
  /** Similarity score (0-1) */
  score: number;
  
  /** Original text content */
  content: string;
  
  /** Source file path */
  filePath: string;
  
  /** Line numbers in source file */
  startLine: number;
  endLine: number;
  
  /** Embedding vector */
  embedding: number[];
  
  /** Metadata about the chunk */
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  /** File hash when chunk was created */
  fileHash: string;
  
  /** Chunk creation timestamp */
  createdAt: Date;
  
  /** Embedding provider used */
  provider: string;
  
  /** Model version */
  modelVersion: string;
  
  /** Chunk size in characters */
  size: number;
  
  /** Token count estimate */
  tokenCount?: number;
}

export interface StorageStats {
  /** Total number of chunks stored */
  totalChunks: number;
  
  /** Total number of files indexed */
  totalFiles: number;
  
  /** Storage size in bytes */
  storageSize: number;
  
  /** Index creation date */
  createdAt: Date;
  
  /** Last update timestamp */
  lastUpdated: Date;
  
  /** Embedding provider distribution */
  providerStats: Map<string, number>;
}

export interface VectorRecord {
  /** Unique chunk identifier */
  id: string;
  
  /** Embedding vector */
  vector: number[];
  
  /** Original text content */
  content: string;
  
  /** Source file path */
  filePath: string;
  
  /** Chunk start line */
  startLine: number;
  
  /** Chunk end line */
  endLine: number;
  
  /** File hash for change detection */
  fileHash: string;
  
  /** Record creation timestamp */
  createdAt: Date;
  
  /** Embedding provider */
  provider: string;
  
  /** Model version */
  modelVersion: string;
}