/**
 * Embedding Pipeline Interface
 * Manages concurrent embedding generation with intelligent batching
 */

import { TextChunk } from './repository-parser.js';
import { EmbeddingProvider } from './index-manager.js';

export interface EmbeddingPipeline {
  /**
   * Process text chunks through the embedding pipeline
   */
  processChunks(chunks: AsyncIterable<TextChunk>, provider: EmbeddingProvider): AsyncIterable<EmbeddedChunk>;
  
  /**
   * Set the batch size for embedding requests
   */
  setBatchSize(size: number): void;
  
  /**
   * Set the concurrency level for parallel processing
   */
  setConcurrency(level: number): void;
  
  /**
   * Get current pipeline statistics
   */
  getStats(): PipelineStats;
}

export interface EmbeddingBatcher {
  /**
   * Create optimal batches from text chunks
   */
  createBatches(chunks: TextChunk[], maxTokens: number): TextChunk[][];
  
  /**
   * Adapt batch size based on API response performance
   */
  adaptBatchSize(responseTime: number, currentSize: number): number;
  
  /**
   * Get optimal batch size for a provider
   */
  getOptimalBatchSize(provider: EmbeddingProvider): number;
}

export interface EmbeddingClient {
  /**
   * Generate embeddings for text array
   */
  embed(texts: string[], provider: EmbeddingProvider): Promise<number[][]>;
  
  /**
   * Get provider-specific limits and capabilities
   */
  getProviderLimits(provider: EmbeddingProvider): ProviderLimits;
  
  /**
   * Test provider connectivity and authentication
   */
  testProvider(provider: EmbeddingProvider): Promise<ProviderTestResult>;
}

export interface EmbeddedChunk {
  /** Original text chunk */
  chunk: TextChunk;
  
  /** Generated embedding vector */
  embedding: number[];
  
  /** Embedding generation timestamp */
  createdAt: Date;
  
  /** Provider used for embedding */
  provider: EmbeddingProvider;
  
  /** Embedding model version */
  modelVersion: string;
}

export interface PipelineStats {
  /** Total chunks processed */
  chunksProcessed: number;
  
  /** Total embeddings generated */
  embeddingsGenerated: number;
  
  /** Current processing rate (chunks/sec) */
  processingRate: number;
  
  /** Average batch size */
  avgBatchSize: number;
  
  /** Current concurrency level */
  concurrency: number;
  
  /** API request count */
  apiRequests: number;
  
  /** Failed requests count */
  failedRequests: number;
  
  /** Average response time (ms) */
  avgResponseTime: number;
}

export interface ProviderLimits {
  /** Maximum tokens per request */
  maxTokensPerRequest: number;
  
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;
  
  /** Maximum tokens per minute */
  maxTokensPerMinute: number;
  
  /** Recommended batch size */
  recommendedBatchSize: number;
  
  /** Embedding dimensions */
  embeddingDimensions: number;
  
  /** Supported models */
  supportedModels: string[];
}

export interface ProviderTestResult {
  /** Whether the provider is accessible */
  success: boolean;
  
  /** Error message if test failed */
  error?: string;
  
  /** Response time for test request (ms) */
  responseTime: number;
  
  /** Provider model information */
  modelInfo?: {
    name: string;
    dimensions: number;
    maxTokens: number;
  };
}