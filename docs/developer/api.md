# Ziri API Documentation

This document provides comprehensive API documentation for Ziri's internal modules and interfaces. This is intended for developers who want to understand, extend, or contribute to Ziri.

## Core Interfaces

### Index Manager

The Index Manager is the main orchestrator for indexing operations.

```typescript
interface IndexManager {
  /**
   * Index a repository with the specified options
   * @param repoPath - Path to the repository
   * @param options - Indexing configuration options
   * @returns Promise resolving to indexing results
   */
  indexRepository(repoPath: string, options: IndexOptions): Promise<IndexResult>
  
  /**
   * Update an existing repository index (incremental)
   * @param repoPath - Path to the repository
   * @returns Promise resolving to update results
   */
  updateRepository(repoPath: string): Promise<UpdateResult>
  
  /**
   * Get the current status of a repository
   * @param repoPath - Path to the repository
   * @returns Current repository status
   */
  getRepositoryStatus(repoPath: string): RepositoryStatus
  
  /**
   * Cancel an ongoing indexing operation
   * @param repoPath - Path to the repository
   */
  cancelIndexing(repoPath: string): Promise<void>
}

interface IndexOptions {
  provider: EmbeddingProvider
  concurrency: number
  batchSize: number
  memoryLimit: number
  forceFullIndex: boolean
  excludePatterns: string[]
  verbose: boolean
  dryRun: boolean
}

interface IndexResult {
  repositoryId: string
  filesProcessed: number
  filesSkipped: number
  chunksGenerated: number
  embeddingsCreated: number
  duration: number
  throughput: number
  memoryUsage: MemoryUsage
  errors: IndexingError[]
}

interface UpdateResult extends IndexResult {
  filesAdded: number
  filesModified: number
  filesDeleted: number
  incrementalUpdate: boolean
}

interface RepositoryStatus {
  repositoryId: string
  indexed: boolean
  lastIndexed: Date
  totalFiles: number
  totalChunks: number
  provider: string
  version: string
  isIndexing: boolean
  progress?: IndexingProgress
}
```

### Repository Parser

Handles file system operations and content processing.

```typescript
interface RepositoryParser {
  /**
   * Discover all files in a repository
   * @param repoPath - Repository path
   * @param excludePatterns - Patterns to exclude
   * @returns Async iterable of file information
   */
  discoverFiles(repoPath: string, excludePatterns: string[]): AsyncIterable<FileInfo>
  
  /**
   * Detect changes since last indexing
   * @param repoPath - Repository path
   * @param lastIndex - Previous index metadata
   * @returns Async iterable of file changes
   */
  detectChanges(repoPath: string, lastIndex: IndexMetadata): AsyncIterable<FileChange>
  
  /**
   * Chunk a file into processable segments
   * @param filePath - Path to the file
   * @param options - Chunking options
   * @returns Async iterable of text chunks
   */
  chunkFile(filePath: string, options?: ChunkingOptions): AsyncIterable<TextChunk>
  
  /**
   * Get file metadata
   * @param filePath - Path to the file
   * @returns File metadata
   */
  getFileMetadata(filePath: string): Promise<FileMetadata>
}

interface FileInfo {
  path: string
  relativePath: string
  hash: string
  size: number
  lastModified: Date
  language: string
  mimeType: string
  encoding: string
}

interface FileChange {
  path: string
  changeType: 'added' | 'modified' | 'deleted'
  hash?: string
  previousHash?: string
  timestamp: Date
}

interface TextChunk {
  id: string
  content: string
  filePath: string
  startLine: number
  endLine: number
  startChar: number
  endChar: number
  language: string
  metadata: ChunkMetadata
}

interface ChunkingOptions {
  maxChunkSize: number
  overlapSize: number
  strategy: 'fixed' | 'semantic' | 'adaptive'
  preserveStructure: boolean
}
```

### Embedding Pipeline

Manages embedding generation with optimization and error handling.

```typescript
interface EmbeddingPipeline {
  /**
   * Process chunks and generate embeddings
   * @param chunks - Input chunks to process
   * @param provider - Embedding provider to use
   * @param options - Processing options
   * @returns Async iterable of embedded chunks
   */
  processChunks(
    chunks: AsyncIterable<TextChunk>,
    provider: EmbeddingProvider,
    options?: ProcessingOptions
  ): AsyncIterable<EmbeddedChunk>
  
  /**
   * Set batch size for processing
   * @param size - New batch size
   */
  setBatchSize(size: number): void
  
  /**
   * Set concurrency level
   * @param level - Number of concurrent requests
   */
  setConcurrency(level: number): void
  
  /**
   * Get current processing statistics
   * @returns Current processing metrics
   */
  getStatistics(): ProcessingStatistics
}

interface ProcessingOptions {
  batchSize?: number
  concurrency?: number
  retryAttempts?: number
  timeout?: number
  adaptiveBatching?: boolean
}

interface EmbeddedChunk extends TextChunk {
  vector: number[]
  embeddingProvider: string
  embeddingModel: string
  processingTime: number
  tokenCount: number
}

interface ProcessingStatistics {
  chunksProcessed: number
  embeddingsGenerated: number
  averageProcessingTime: number
  currentBatchSize: number
  errorRate: number
  throughput: number
}
```

### Embedding Providers

Common interface for all embedding providers.

```typescript
interface EmbeddingProvider {
  readonly name: string
  readonly type: ProviderType
  readonly config: ProviderConfig
  
  /**
   * Generate embeddings for text inputs
   * @param texts - Array of text strings
   * @returns Promise resolving to embedding vectors
   */
  embed(texts: string[]): Promise<number[][]>
  
  /**
   * Validate provider configuration
   * @returns Promise resolving to validation result
   */
  validateConfig(): Promise<ValidationResult>
  
  /**
   * Get model information
   * @returns Model metadata
   */
  getModelInfo(): ModelInfo
  
  /**
   * Get optimal batch size for this provider
   * @returns Recommended batch size
   */
  getOptimalBatchSize(): number
  
  /**
   * Get rate limit information
   * @returns Rate limit details
   */
  getRateLimit(): RateLimit
  
  /**
   * Check if provider supports streaming
   * @returns True if streaming is supported
   */
  supportsStreaming(): boolean
  
  /**
   * Estimate token count for text
   * @param text - Input text
   * @returns Estimated token count
   */
  estimateTokens(text: string): number
}

type ProviderType = 'openai' | 'ollama' | 'huggingface' | 'cohere' | 'custom'

interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  model: string
  dimensions: number
  maxTokens: number
  timeout: number
  retryAttempts: number
  headers?: Record<string, string>
}

interface ModelInfo {
  name: string
  dimensions: number
  maxTokens: number
  contextWindow: number
  pricing?: PricingInfo
}

interface RateLimit {
  requestsPerMinute: number
  tokensPerMinute: number
  requestsPerDay?: number
  tokensPerDay?: number
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

### Index Store

Provides storage and retrieval of vector embeddings and metadata.

```typescript
interface IndexStore {
  /**
   * Create a new repository index
   * @param repoPath - Repository path
   * @param config - Storage configuration
   * @returns Promise resolving to repository ID
   */
  createRepository(repoPath: string, config?: StorageConfig): Promise<string>
  
  /**
   * Store embeddings for a repository
   * @param repositoryId - Repository identifier
   * @param embeddings - Embedded chunks to store
   * @returns Promise resolving when storage is complete
   */
  storeEmbeddings(repositoryId: string, embeddings: EmbeddedChunk[]): Promise<void>
  
  /**
   * Remove embeddings by chunk IDs
   * @param repositoryId - Repository identifier
   * @param chunkIds - IDs of chunks to remove
   * @returns Promise resolving when removal is complete
   */
  removeEmbeddings(repositoryId: string, chunkIds: string[]): Promise<void>
  
  /**
   * Query embeddings by similarity
   * @param repositoryId - Repository identifier
   * @param queryVector - Query embedding vector
   * @param options - Query options
   * @returns Promise resolving to search results
   */
  queryEmbeddings(
    repositoryId: string,
    queryVector: number[],
    options?: QueryOptions
  ): Promise<SearchResult[]>
  
  /**
   * Get repository metadata
   * @param repositoryId - Repository identifier
   * @returns Promise resolving to metadata
   */
  getMetadata(repositoryId: string): Promise<IndexMetadata>
  
  /**
   * Update repository metadata
   * @param repositoryId - Repository identifier
   * @param metadata - Updated metadata
   * @returns Promise resolving when update is complete
   */
  updateMetadata(repositoryId: string, metadata: Partial<IndexMetadata>): Promise<void>
  
  /**
   * Delete entire repository index
   * @param repositoryId - Repository identifier
   * @returns Promise resolving when deletion is complete
   */
  deleteRepository(repositoryId: string): Promise<void>
  
  /**
   * Get storage statistics
   * @param repositoryId - Repository identifier
   * @returns Storage statistics
   */
  getStorageStats(repositoryId: string): Promise<StorageStats>
}

interface StorageConfig {
  compression: boolean
  backupEnabled: boolean
  encryptionKey?: string
}

interface QueryOptions {
  limit: number
  threshold: number
  includeMetadata: boolean
  filter?: QueryFilter
}

interface QueryFilter {
  filePaths?: string[]
  languages?: string[]
  dateRange?: DateRange
  fileTypes?: string[]
}

interface SearchResult {
  chunkId: string
  score: number
  content: string
  filePath: string
  startLine: number
  endLine: number
  metadata: ChunkMetadata
}

interface StorageStats {
  totalChunks: number
  totalSize: number
  compressionRatio: number
  lastUpdated: Date
  indexHealth: 'healthy' | 'degraded' | 'corrupted'
}
```

### Query Manager

Handles search queries and result processing.

```typescript
interface QueryManager {
  /**
   * Execute a search query
   * @param query - Search query string
   * @param options - Query options
   * @returns Promise resolving to query results
   */
  query(query: string, options: QueryOptions): Promise<QueryResult>
  
  /**
   * Execute a vector query directly
   * @param queryVector - Pre-computed query vector
   * @param options - Query options
   * @returns Promise resolving to query results
   */
  vectorQuery(queryVector: number[], options: QueryOptions): Promise<QueryResult>
  
  /**
   * Get query suggestions based on repository content
   * @param repositoryId - Repository identifier
   * @param partial - Partial query string
   * @returns Promise resolving to suggestions
   */
  getSuggestions(repositoryId: string, partial: string): Promise<string[]>
  
  /**
   * Explain query results (debugging)
   * @param query - Search query
   * @param results - Query results
   * @returns Explanation of scoring and ranking
   */
  explainResults(query: string, results: QueryResult): QueryExplanation
}

interface QueryResult {
  query: string
  results: SearchResult[]
  totalResults: number
  processingTime: number
  repositoriesSearched: string[]
  metadata: QueryMetadata
}

interface QueryMetadata {
  queryVector: number[]
  normalizedQuery: string
  expandedTerms: string[]
  filters: QueryFilter[]
}

interface QueryExplanation {
  queryAnalysis: {
    originalQuery: string
    normalizedQuery: string
    keyTerms: string[]
    queryVector: number[]
  }
  resultScoring: {
    scoringMethod: string
    factors: ScoringFactor[]
  }
  results: ResultExplanation[]
}

interface ScoringFactor {
  name: string
  weight: number
  description: string
}

interface ResultExplanation {
  chunkId: string
  finalScore: number
  scoreBreakdown: {
    [factorName: string]: number
  }
  reasoning: string
}
```

### Configuration Manager

Manages application configuration with validation and persistence.

```typescript
interface ConfigManager {
  /**
   * Load configuration from all sources
   * @returns Promise resolving to merged configuration
   */
  loadConfig(): Promise<ZiriConfig>
  
  /**
   * Save configuration to file
   * @param config - Configuration to save
   * @returns Promise resolving when save is complete
   */
  saveConfig(config: ZiriConfig): Promise<void>
  
  /**
   * Get configuration value by path
   * @param path - Dot-separated configuration path
   * @returns Configuration value
   */
  get<T>(path: string): T | undefined
  
  /**
   * Set configuration value by path
   * @param path - Dot-separated configuration path
   * @param value - Value to set
   * @returns Promise resolving when set is complete
   */
  set(path: string, value: any): Promise<void>
  
  /**
   * Validate configuration
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: ZiriConfig): ValidationResult
  
  /**
   * Reset configuration to defaults
   * @returns Promise resolving when reset is complete
   */
  resetConfig(): Promise<void>
  
  /**
   * Watch for configuration changes
   * @param callback - Function to call on changes
   * @returns Unsubscribe function
   */
  watchConfig(callback: (config: ZiriConfig) => void): () => void
}

interface ZiriConfig {
  defaultProvider: string
  providers: Record<string, ProviderConfig>
  performance: PerformanceConfig
  exclusions: ExclusionConfig
  storage: StorageConfig
  logging: LoggingConfig
  experimental?: ExperimentalConfig
}

interface PerformanceConfig {
  concurrency: number
  batchSize: number
  memoryLimit: number
  adaptiveBatching: boolean
  retryAttempts: number
  retryDelay: number
  timeout: number
}

interface ExclusionConfig {
  patterns: string[]
  extensions: string[]
  maxFileSize: number
  minFileSize: number
  excludeHidden: boolean
  excludeBinary: boolean
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  file: string
  console: boolean
  maxSize: number
  maxFiles: number
  format: LogFormat
}

interface LogFormat {
  timestamp: boolean
  level: boolean
  component: boolean
  colors: boolean
}
```

## Utility Classes

### Progress Reporter

Provides progress tracking and user feedback.

```typescript
interface ProgressReporter {
  /**
   * Start a new progress session
   * @param total - Total number of items to process
   * @param label - Progress label
   */
  start(total: number, label: string): void
  
  /**
   * Update progress
   * @param current - Current progress count
   * @param message - Optional status message
   */
  update(current: number, message?: string): void
  
  /**
   * Increment progress by one
   * @param message - Optional status message
   */
  increment(message?: string): void
  
  /**
   * Complete progress session
   * @param message - Completion message
   */
  complete(message?: string): void
  
  /**
   * Fail progress session
   * @param error - Error that caused failure
   */
  fail(error: Error): void
  
  /**
   * Set progress format
   * @param format - Progress display format
   */
  setFormat(format: ProgressFormat): void
}

interface ProgressFormat {
  showPercentage: boolean
  showETA: boolean
  showThroughput: boolean
  showElapsed: boolean
  barLength: number
  template: string
}
```

### Logger

Provides structured logging with multiple outputs.

```typescript
interface Logger {
  /**
   * Log debug message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  debug(message: string, meta?: LogMetadata): void
  
  /**
   * Log info message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  info(message: string, meta?: LogMetadata): void
  
  /**
   * Log warning message
   * @param message - Log message
   * @param meta - Additional metadata
   */
  warn(message: string, meta?: LogMetadata): void
  
  /**
   * Log error message
   * @param message - Log message
   * @param error - Error object
   * @param meta - Additional metadata
   */
  error(message: string, error?: Error, meta?: LogMetadata): void
  
  /**
   * Create child logger with context
   * @param context - Logger context
   * @returns Child logger instance
   */
  child(context: LogContext): Logger
  
  /**
   * Set log level
   * @param level - New log level
   */
  setLevel(level: LogLevel): void
}

interface LogMetadata {
  [key: string]: any
}

interface LogContext {
  component: string
  operation?: string
  repositoryId?: string
  [key: string]: any
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
```

### Performance Monitor

Tracks and reports performance metrics.

```typescript
interface PerformanceMonitor {
  /**
   * Start timing an operation
   * @param name - Operation name
   * @returns Timer instance
   */
  startTimer(name: string): Timer
  
  /**
   * Record a metric value
   * @param name - Metric name
   * @param value - Metric value
   * @param tags - Optional tags
   */
  recordMetric(name: string, value: number, tags?: MetricTags): void
  
  /**
   * Increment a counter
   * @param name - Counter name
   * @param tags - Optional tags
   */
  incrementCounter(name: string, tags?: MetricTags): void
  
  /**
   * Record memory usage
   * @param component - Component name
   */
  recordMemoryUsage(component: string): void
  
  /**
   * Get performance summary
   * @param timeRange - Time range for summary
   * @returns Performance summary
   */
  getSummary(timeRange?: TimeRange): PerformanceSummary
  
  /**
   * Export metrics
   * @param format - Export format
   * @returns Exported metrics
   */
  exportMetrics(format: 'json' | 'csv' | 'prometheus'): string
}

interface Timer {
  /**
   * Stop timer and record duration
   * @param tags - Optional tags
   */
  stop(tags?: MetricTags): number
  
  /**
   * Get elapsed time without stopping
   * @returns Elapsed time in milliseconds
   */
  elapsed(): number
}

interface MetricTags {
  [key: string]: string | number
}

interface PerformanceSummary {
  timeRange: TimeRange
  operations: OperationSummary[]
  systemMetrics: SystemMetrics
  errors: ErrorSummary[]
}

interface OperationSummary {
  name: string
  count: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  p95Duration: number
  throughput: number
}
```

## Error Types

### Custom Error Classes

```typescript
class ZiriError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: ErrorContext
  ) {
    super(message)
    this.name = 'ZiriError'
  }
}

class IndexingError extends ZiriError {
  constructor(
    message: string,
    public filePath?: string,
    public chunkId?: string,
    context?: ErrorContext
  ) {
    super(message, 'INDEXING_ERROR', context)
    this.name = 'IndexingError'
  }
}

class ProviderError extends ZiriError {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    context?: ErrorContext
  ) {
    super(message, 'PROVIDER_ERROR', context)
    this.name = 'ProviderError'
  }
}

class ConfigurationError extends ZiriError {
  constructor(
    message: string,
    public configPath?: string,
    context?: ErrorContext
  ) {
    super(message, 'CONFIGURATION_ERROR', context)
    this.name = 'ConfigurationError'
  }
}

class StorageError extends ZiriError {
  constructor(
    message: string,
    public operation?: string,
    public repositoryId?: string,
    context?: ErrorContext
  ) {
    super(message, 'STORAGE_ERROR', context)
    this.name = 'StorageError'
  }
}

interface ErrorContext {
  repositoryId?: string
  filePath?: string
  provider?: string
  operation?: string
  timestamp: Date
  stackTrace?: string
  [key: string]: any
}
```

## Event System

### Event Emitter Interface

```typescript
interface EventEmitter {
  /**
   * Add event listener
   * @param event - Event name
   * @param listener - Event listener function
   */
  on(event: string, listener: EventListener): void
  
  /**
   * Add one-time event listener
   * @param event - Event name
   * @param listener - Event listener function
   */
  once(event: string, listener: EventListener): void
  
  /**
   * Remove event listener
   * @param event - Event name
   * @param listener - Event listener function
   */
  off(event: string, listener: EventListener): void
  
  /**
   * Emit event
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data?: any): void
  
  /**
   * Remove all listeners for event
   * @param event - Event name
   */
  removeAllListeners(event?: string): void
}

type EventListener = (data?: any) => void

// Event types
interface IndexingEvents {
  'indexing:started': { repositoryId: string; totalFiles: number }
  'indexing:progress': { repositoryId: string; current: number; total: number }
  'indexing:file-processed': { repositoryId: string; filePath: string }
  'indexing:completed': { repositoryId: string; result: IndexResult }
  'indexing:error': { repositoryId: string; error: Error }
  'indexing:cancelled': { repositoryId: string }
}

interface QueryEvents {
  'query:started': { query: string; repositoryIds: string[] }
  'query:completed': { query: string; result: QueryResult }
  'query:error': { query: string; error: Error }
}

interface ProviderEvents {
  'provider:request': { provider: string; batchSize: number }
  'provider:response': { provider: string; duration: number; success: boolean }
  'provider:error': { provider: string; error: Error }
  'provider:rate-limited': { provider: string; retryAfter: number }
}
```

This API documentation provides a comprehensive reference for all internal interfaces and classes in Ziri. Use this as a guide when extending functionality or contributing to the codebase.