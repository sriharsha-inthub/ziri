# Ziri Code Examples

This document provides comprehensive code examples for integrating with and extending Ziri. These examples are useful for developers who want to build on top of Ziri or integrate it into their own applications.

## Table of Contents

- [Basic Integration](#basic-integration)
- [Custom Providers](#custom-providers)
- [Storage Extensions](#storage-extensions)
- [CLI Extensions](#cli-extensions)
- [Programmatic Usage](#programmatic-usage)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Testing Examples](#testing-examples)

## Basic Integration

### Simple Indexing and Querying

```typescript
import { ZiriClient } from 'ziri'

async function basicExample() {
  // Initialize client
  const client = new ZiriClient({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  })
  
  // Index a repository
  const indexResult = await client.indexRepository('/path/to/repo', {
    concurrency: 4,
    batchSize: 50,
    verbose: true
  })
  
  console.log(`Indexed ${indexResult.filesProcessed} files in ${indexResult.duration}ms`)
  
  // Query the repository
  const queryResult = await client.query('authentication logic', {
    limit: 10,
    threshold: 0.7
  })
  
  console.log(`Found ${queryResult.results.length} results:`)
  queryResult.results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.filePath}:${result.startLine}`)
    console.log(`   Score: ${result.score.toFixed(3)}`)
    console.log(`   Content: ${result.content.substring(0, 100)}...`)
  })
}
```

### Configuration Management

```typescript
import { ConfigManager, ZiriConfig } from 'ziri'

async function configurationExample() {
  const configManager = new ConfigManager()
  
  // Load current configuration
  const config = await configManager.loadConfig()
  console.log('Current provider:', config.defaultProvider)
  
  // Update configuration
  await configManager.set('performance.concurrency', 6)
  await configManager.set('performance.batchSize', 100)
  
  // Add new provider
  const newProviderConfig = {
    type: 'huggingface',
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: 'sentence-transformers/all-mpnet-base-v2',
    dimensions: 768
  }
  
  await configManager.set('providers.huggingface', newProviderConfig)
  
  // Validate configuration
  const validation = configManager.validateConfig(config)
  if (!validation.valid) {
    console.error('Configuration errors:', validation.errors)
  }
  
  // Save configuration
  await configManager.saveConfig(config)
}
```

## Custom Providers

### Creating a Custom Embedding Provider

```typescript
import { BaseEmbeddingProvider, ProviderConfig, ModelInfo, RateLimit } from 'ziri'

interface CustomProviderConfig extends ProviderConfig {
  endpoint: string
  authToken: string
  customModel: string
}

class CustomEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(private config: CustomProviderConfig) {
    super()
  }
  
  get name(): string {
    return 'custom-provider'
  }
  
  get type(): string {
    return 'custom'
  }
  
  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.config.endpoint}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: JSON.stringify({
          texts,
          model: this.config.customModel
        })
      })
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.embeddings
    } catch (error) {
      throw new ProviderError(
        `Custom provider embedding failed: ${error.message}`,
        this.name,
        error.status
      )
    }
  }
  
  async validateConfig(): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`
        }
      })
      
      return {
        valid: response.ok,
        errors: response.ok ? [] : [`API endpoint not accessible: ${response.status}`],
        warnings: []
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`Cannot connect to endpoint: ${error.message}`],
        warnings: []
      }
    }
  }
  
  getModelInfo(): ModelInfo {
    return {
      name: this.config.customModel,
      dimensions: this.config.dimensions,
      maxTokens: this.config.maxTokens,
      contextWindow: this.config.maxTokens
    }
  }
  
  getOptimalBatchSize(): number {
    return 25 // Conservative batch size for custom provider
  }
  
  getRateLimit(): RateLimit {
    return {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  }
  
  supportsStreaming(): boolean {
    return false
  }
  
  estimateTokens(text: string): number {
    // Simple estimation - roughly 4 characters per token
    return Math.ceil(text.length / 4)
  }
}

// Register the custom provider
import { ProviderRegistry } from 'ziri'

ProviderRegistry.register('custom', CustomEmbeddingProvider)

// Usage
const customProvider = new CustomEmbeddingProvider({
  endpoint: 'https://api.example.com',
  authToken: 'your-auth-token',
  customModel: 'custom-embedding-model',
  dimensions: 512,
  maxTokens: 1000,
  timeout: 30000,
  retryAttempts: 3
})
```

### Provider with Caching

```typescript
import { BaseEmbeddingProvider } from 'ziri'
import { createHash } from 'crypto'

class CachedEmbeddingProvider extends BaseEmbeddingProvider {
  private cache = new Map<string, number[]>()
  private maxCacheSize = 10000
  
  constructor(
    private baseProvider: EmbeddingProvider,
    private cacheOptions?: { maxSize?: number; ttl?: number }
  ) {
    super()
    if (cacheOptions?.maxSize) {
      this.maxCacheSize = cacheOptions.maxSize
    }
  }
  
  get name(): string {
    return `cached-${this.baseProvider.name}`
  }
  
  get type(): string {
    return this.baseProvider.type
  }
  
  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = []
    const uncachedTexts: string[] = []
    const uncachedIndices: number[] = []
    
    // Check cache for each text
    texts.forEach((text, index) => {
      const cacheKey = this.getCacheKey(text)
      const cached = this.cache.get(cacheKey)
      
      if (cached) {
        results[index] = cached
      } else {
        uncachedTexts.push(text)
        uncachedIndices.push(index)
      }
    })
    
    // Process uncached texts
    if (uncachedTexts.length > 0) {
      const embeddings = await this.baseProvider.embed(uncachedTexts)
      
      embeddings.forEach((embedding, i) => {
        const originalIndex = uncachedIndices[i]
        const text = uncachedTexts[i]
        const cacheKey = this.getCacheKey(text)
        
        results[originalIndex] = embedding
        this.addToCache(cacheKey, embedding)
      })
    }
    
    return results
  }
  
  private getCacheKey(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }
  
  private addToCache(key: string, embedding: number[]): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, embedding)
  }
  
  // Delegate other methods to base provider
  async validateConfig(): Promise<ValidationResult> {
    return this.baseProvider.validateConfig()
  }
  
  getModelInfo(): ModelInfo {
    return this.baseProvider.getModelInfo()
  }
  
  getOptimalBatchSize(): number {
    return this.baseProvider.getOptimalBatchSize()
  }
  
  getRateLimit(): RateLimit {
    return this.baseProvider.getRateLimit()
  }
  
  supportsStreaming(): boolean {
    return this.baseProvider.supportsStreaming()
  }
  
  estimateTokens(text: string): number {
    return this.baseProvider.estimateTokens(text)
  }
}

// Usage
const openaiProvider = new OpenAIProvider(config)
const cachedProvider = new CachedEmbeddingProvider(openaiProvider, {
  maxSize: 5000,
  ttl: 3600000 // 1 hour
})
```

## Storage Extensions

### Custom Storage Backend

```typescript
import { StorageBackend, VectorRecord, SearchResult, QueryOptions } from 'ziri'

class RedisStorageBackend implements StorageBackend {
  private redis: Redis
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl)
  }
  
  async store(repositoryId: string, vectors: VectorRecord[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const vector of vectors) {
      const key = `repo:${repositoryId}:chunk:${vector.id}`
      const data = {
        vector: JSON.stringify(vector.vector),
        content: vector.content,
        filePath: vector.filePath,
        startLine: vector.startLine,
        endLine: vector.endLine,
        metadata: JSON.stringify(vector.metadata)
      }
      
      pipeline.hset(key, data)
      pipeline.sadd(`repo:${repositoryId}:chunks`, vector.id)
    }
    
    await pipeline.exec()
  }
  
  async query(
    repositoryId: string,
    queryVector: number[],
    options: QueryOptions
  ): Promise<SearchResult[]> {
    // Get all chunk IDs for the repository
    const chunkIds = await this.redis.smembers(`repo:${repositoryId}:chunks`)
    
    const results: SearchResult[] = []
    
    // Process chunks in batches to avoid memory issues
    const batchSize = 100
    for (let i = 0; i < chunkIds.length; i += batchSize) {
      const batch = chunkIds.slice(i, i + batchSize)
      const pipeline = this.redis.pipeline()
      
      batch.forEach(chunkId => {
        pipeline.hgetall(`repo:${repositoryId}:chunk:${chunkId}`)
      })
      
      const batchResults = await pipeline.exec()
      
      batchResults.forEach(([error, data], index) => {
        if (error || !data) return
        
        const chunkData = data as Record<string, string>
        const vector = JSON.parse(chunkData.vector)
        const score = this.calculateSimilarity(queryVector, vector)
        
        if (score >= options.threshold) {
          results.push({
            chunkId: batch[index],
            score,
            content: chunkData.content,
            filePath: chunkData.filePath,
            startLine: parseInt(chunkData.startLine),
            endLine: parseInt(chunkData.endLine),
            metadata: JSON.parse(chunkData.metadata)
          })
        }
      })
    }
    
    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit)
  }
  
  async delete(repositoryId: string, chunkIds: string[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    chunkIds.forEach(chunkId => {
      pipeline.del(`repo:${repositoryId}:chunk:${chunkId}`)
      pipeline.srem(`repo:${repositoryId}:chunks`, chunkId)
    })
    
    await pipeline.exec()
  }
  
  private calculateSimilarity(a: number[], b: number[]): number {
    // Cosine similarity calculation
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
```

### Storage with Compression

```typescript
import { StorageBackend } from 'ziri'
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

class CompressedStorageBackend implements StorageBackend {
  constructor(private baseStorage: StorageBackend) {}
  
  async store(repositoryId: string, vectors: VectorRecord[]): Promise<void> {
    // Compress vectors before storing
    const compressedVectors = await Promise.all(
      vectors.map(async (vector) => ({
        ...vector,
        vector: await this.compressVector(vector.vector),
        content: await this.compressString(vector.content)
      }))
    )
    
    return this.baseStorage.store(repositoryId, compressedVectors as any)
  }
  
  async query(
    repositoryId: string,
    queryVector: number[],
    options: QueryOptions
  ): Promise<SearchResult[]> {
    const results = await this.baseStorage.query(repositoryId, queryVector, options)
    
    // Decompress results
    return Promise.all(
      results.map(async (result) => ({
        ...result,
        content: await this.decompressString(result.content as any)
      }))
    )
  }
  
  async delete(repositoryId: string, chunkIds: string[]): Promise<void> {
    return this.baseStorage.delete(repositoryId, chunkIds)
  }
  
  private async compressVector(vector: number[]): Promise<Buffer> {
    const buffer = Buffer.from(new Float32Array(vector).buffer)
    return gzipAsync(buffer)
  }
  
  private async decompressVector(compressed: Buffer): Promise<number[]> {
    const decompressed = await gunzipAsync(compressed)
    const float32Array = new Float32Array(decompressed.buffer)
    return Array.from(float32Array)
  }
  
  private async compressString(text: string): Promise<Buffer> {
    return gzipAsync(Buffer.from(text, 'utf8'))
  }
  
  private async decompressString(compressed: Buffer): Promise<string> {
    const decompressed = await gunzipAsync(compressed)
    return decompressed.toString('utf8')
  }
}
```

## CLI Extensions

### Custom CLI Command

```typescript
import { Command } from 'commander'
import { ZiriClient } from 'ziri'

// Custom command for repository comparison
export function createCompareCommand(): Command {
  return new Command('compare')
    .description('Compare similarity between two repositories')
    .argument('<repo1>', 'First repository path')
    .argument('<repo2>', 'Second repository path')
    .option('-k, --results <number>', 'Number of results to show', '10')
    .option('--threshold <number>', 'Similarity threshold', '0.7')
    .action(async (repo1: string, repo2: string, options) => {
      const client = new ZiriClient()
      
      console.log(`Comparing ${repo1} with ${repo2}...`)
      
      // Index both repositories if needed
      await client.indexRepository(repo1)
      await client.indexRepository(repo2)
      
      // Get representative chunks from repo1
      const repo1Chunks = await client.getRepositoryChunks(repo1, {
        limit: 100,
        strategy: 'representative'
      })
      
      const similarities: Array<{
        chunk1: string
        chunk2: string
        similarity: number
        file1: string
        file2: string
      }> = []
      
      // Compare each chunk with repo2
      for (const chunk of repo1Chunks) {
        const results = await client.queryRepository(repo2, chunk.content, {
          limit: 1,
          threshold: parseFloat(options.threshold)
        })
        
        if (results.length > 0) {
          similarities.push({
            chunk1: chunk.content.substring(0, 100),
            chunk2: results[0].content.substring(0, 100),
            similarity: results[0].score,
            file1: chunk.filePath,
            file2: results[0].filePath
          })
        }
      }
      
      // Sort by similarity and show top results
      similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, parseInt(options.results))
        .forEach((sim, index) => {
          console.log(`\n${index + 1}. Similarity: ${sim.similarity.toFixed(3)}`)
          console.log(`   ${sim.file1} ↔ ${sim.file2}`)
          console.log(`   "${sim.chunk1}..."`)
          console.log(`   "${sim.chunk2}..."`)
        })
    })
}

// Usage in main CLI
import { program } from 'commander'

program.addCommand(createCompareCommand())
```

### Plugin System

```typescript
interface ZiriPlugin {
  name: string
  version: string
  commands?: Command[]
  providers?: EmbeddingProvider[]
  storageBackends?: StorageBackend[]
  hooks?: PluginHooks
}

interface PluginHooks {
  beforeIndexing?: (context: IndexingContext) => Promise<void>
  afterIndexing?: (context: IndexingContext, result: IndexResult) => Promise<void>
  beforeQuery?: (context: QueryContext) => Promise<void>
  afterQuery?: (context: QueryContext, result: QueryResult) => Promise<void>
}

class PluginManager {
  private plugins = new Map<string, ZiriPlugin>()
  
  register(plugin: ZiriPlugin): void {
    this.plugins.set(plugin.name, plugin)
    
    // Register commands
    if (plugin.commands) {
      plugin.commands.forEach(command => {
        program.addCommand(command)
      })
    }
    
    // Register providers
    if (plugin.providers) {
      plugin.providers.forEach(provider => {
        ProviderRegistry.register(provider.name, provider.constructor as any)
      })
    }
  }
  
  async executeHook(
    hookName: keyof PluginHooks,
    context: any,
    result?: any
  ): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.[hookName]
      if (hook) {
        await hook(context, result)
      }
    }
  }
}

// Example plugin
const analyticsPlugin: ZiriPlugin = {
  name: 'analytics',
  version: '1.0.0',
  hooks: {
    afterIndexing: async (context, result) => {
      // Send analytics data
      await fetch('https://analytics.example.com/indexing', {
        method: 'POST',
        body: JSON.stringify({
          repositoryId: context.repositoryId,
          filesProcessed: result.filesProcessed,
          duration: result.duration
        })
      })
    },
    afterQuery: async (context, result) => {
      // Track query analytics
      await fetch('https://analytics.example.com/query', {
        method: 'POST',
        body: JSON.stringify({
          query: context.query,
          resultCount: result.results.length,
          processingTime: result.processingTime
        })
      })
    }
  }
}

// Register plugin
const pluginManager = new PluginManager()
pluginManager.register(analyticsPlugin)
```

## Programmatic Usage

### Batch Processing Multiple Repositories

```typescript
import { ZiriClient, IndexResult } from 'ziri'
import { promises as fs } from 'fs'
import path from 'path'

class BatchProcessor {
  private client: ZiriClient
  
  constructor(config: ZiriConfig) {
    this.client = new ZiriClient(config)
  }
  
  async processDirectory(
    rootDir: string,
    options: {
      maxDepth?: number
      excludePatterns?: string[]
      concurrency?: number
    } = {}
  ): Promise<BatchResult> {
    const repositories = await this.discoverRepositories(rootDir, options.maxDepth || 2)
    const results: Array<{ path: string; result: IndexResult | Error }> = []
    
    console.log(`Found ${repositories.length} repositories to process`)
    
    // Process repositories with controlled concurrency
    const semaphore = new Semaphore(options.concurrency || 3)
    
    const promises = repositories.map(async (repoPath) => {
      await semaphore.acquire()
      
      try {
        console.log(`Processing ${repoPath}...`)
        const result = await this.client.indexRepository(repoPath, {
          excludePatterns: options.excludePatterns || ['node_modules', '.git'],
          verbose: false
        })
        
        results.push({ path: repoPath, result })
        console.log(`✅ Completed ${repoPath} (${result.filesProcessed} files)`)
      } catch (error) {
        results.push({ path: repoPath, result: error as Error })
        console.error(`❌ Failed ${repoPath}: ${error.message}`)
      } finally {
        semaphore.release()
      }
    })
    
    await Promise.all(promises)
    
    return this.generateBatchReport(results)
  }
  
  private async discoverRepositories(rootDir: string, maxDepth: number): Promise<string[]> {
    const repositories: string[] = []
    
    async function traverse(dir: string, depth: number) {
      if (depth > maxDepth) return
      
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      // Check if this directory is a repository
      const hasGit = entries.some(entry => entry.name === '.git' && entry.isDirectory())
      const hasPackageJson = entries.some(entry => entry.name === 'package.json' && entry.isFile())
      const hasPyprojectToml = entries.some(entry => entry.name === 'pyproject.toml' && entry.isFile())
      
      if (hasGit || hasPackageJson || hasPyprojectToml) {
        repositories.push(dir)
        return // Don't traverse into subdirectories of repositories
      }
      
      // Traverse subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await traverse(path.join(dir, entry.name), depth + 1)
        }
      }
    }
    
    await traverse(rootDir, 0)
    return repositories
  }
  
  private generateBatchReport(results: Array<{ path: string; result: IndexResult | Error }>): BatchResult {
    const successful = results.filter(r => !(r.result instanceof Error))
    const failed = results.filter(r => r.result instanceof Error)
    
    const totalFiles = successful.reduce((sum, r) => {
      const result = r.result as IndexResult
      return sum + result.filesProcessed
    }, 0)
    
    const totalDuration = successful.reduce((sum, r) => {
      const result = r.result as IndexResult
      return sum + result.duration
    }, 0)
    
    return {
      totalRepositories: results.length,
      successful: successful.length,
      failed: failed.length,
      totalFiles,
      totalDuration,
      averageFilesPerRepo: totalFiles / successful.length,
      failures: failed.map(f => ({
        path: f.path,
        error: (f.result as Error).message
      }))
    }
  }
}

interface BatchResult {
  totalRepositories: number
  successful: number
  failed: number
  totalFiles: number
  totalDuration: number
  averageFilesPerRepo: number
  failures: Array<{ path: string; error: string }>
}

// Usage
const processor = new BatchProcessor({
  provider: 'ollama',
  performance: {
    concurrency: 4,
    batchSize: 50
  }
})

const result = await processor.processDirectory('/path/to/projects', {
  maxDepth: 3,
  excludePatterns: ['node_modules', '.git', 'dist', 'build'],
  concurrency: 2
})

console.log(`Processed ${result.successful}/${result.totalRepositories} repositories`)
console.log(`Total files: ${result.totalFiles}`)
console.log(`Average files per repo: ${result.averageFilesPerRepo.toFixed(1)}`)
```

### Real-time File Watching

```typescript
import { watch } from 'chokidar'
import { ZiriClient } from 'ziri'

class RealtimeIndexer {
  private client: ZiriClient
  private watchers = new Map<string, any>()
  private updateQueue = new Map<string, Set<string>>()
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  
  constructor(config: ZiriConfig) {
    this.client = new ZiriClient(config)
  }
  
  watchRepository(repoPath: string, options: WatchOptions = {}): void {
    const watcher = watch(repoPath, {
      ignored: options.excludePatterns || ['node_modules/**', '.git/**'],
      persistent: true,
      ignoreInitial: true
    })
    
    watcher
      .on('add', (filePath) => this.handleFileChange(repoPath, filePath, 'added'))
      .on('change', (filePath) => this.handleFileChange(repoPath, filePath, 'modified'))
      .on('unlink', (filePath) => this.handleFileChange(repoPath, filePath, 'deleted'))
    
    this.watchers.set(repoPath, watcher)
    console.log(`👀 Watching ${repoPath} for changes`)
  }
  
  private handleFileChange(repoPath: string, filePath: string, changeType: string): void {
    // Add to update queue
    if (!this.updateQueue.has(repoPath)) {
      this.updateQueue.set(repoPath, new Set())
    }
    this.updateQueue.get(repoPath)!.add(filePath)
    
    // Debounce updates to avoid excessive processing
    const debounceKey = repoPath
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!)
    }
    
    this.debounceTimers.set(debounceKey, setTimeout(() => {
      this.processQueuedUpdates(repoPath)
    }, 1000)) // 1 second debounce
  }
  
  private async processQueuedUpdates(repoPath: string): Promise<void> {
    const changedFiles = this.updateQueue.get(repoPath)
    if (!changedFiles || changedFiles.size === 0) return
    
    console.log(`🔄 Processing ${changedFiles.size} changed files in ${repoPath}`)
    
    try {
      const result = await this.client.updateRepository(repoPath, {
        changedFiles: Array.from(changedFiles)
      })
      
      console.log(`✅ Updated ${result.filesProcessed} files in ${result.duration}ms`)
    } catch (error) {
      console.error(`❌ Failed to update ${repoPath}:`, error.message)
    }
    
    // Clear the queue
    this.updateQueue.set(repoPath, new Set())
    this.debounceTimers.delete(repoPath)
  }
  
  stopWatching(repoPath: string): void {
    const watcher = this.watchers.get(repoPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(repoPath)
      console.log(`🛑 Stopped watching ${repoPath}`)
    }
  }
  
  stopAll(): void {
    for (const [repoPath] of this.watchers) {
      this.stopWatching(repoPath)
    }
  }
}

interface WatchOptions {
  excludePatterns?: string[]
  debounceMs?: number
}

// Usage
const indexer = new RealtimeIndexer({
  provider: 'ollama',
  performance: { concurrency: 2, batchSize: 25 }
})

// Watch multiple repositories
indexer.watchRepository('/path/to/frontend')
indexer.watchRepository('/path/to/backend')
indexer.watchRepository('/path/to/shared')

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down file watchers...')
  indexer.stopAll()
  process.exit(0)
})
```

## Performance Optimization

### Adaptive Batch Sizing

```typescript
class AdaptiveBatcher {
  private currentBatchSize: number
  private responseTimeHistory: number[] = []
  private errorRateHistory: number[] = []
  private readonly historySize = 10
  private readonly targetResponseTime = 2000 // 2 seconds
  private readonly minBatchSize = 5
  private readonly maxBatchSize = 200
  
  constructor(initialBatchSize: number = 50) {
    this.currentBatchSize = initialBatchSize
  }
  
  async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += this.currentBatchSize) {
      const batch = items.slice(i, i + this.currentBatchSize)
      const startTime = Date.now()
      
      try {
        const batchResults = await processor(batch)
        const responseTime = Date.now() - startTime
        
        results.push(...batchResults)
        this.recordSuccess(responseTime)
      } catch (error) {
        this.recordError()
        throw error
      }
    }
    
    return results
  }
  
  private recordSuccess(responseTime: number): void {
    this.responseTimeHistory.push(responseTime)
    this.errorRateHistory.push(0)
    this.trimHistory()
    this.adaptBatchSize()
  }
  
  private recordError(): void {
    this.errorRateHistory.push(1)
    this.trimHistory()
    this.adaptBatchSize()
  }
  
  private trimHistory(): void {
    if (this.responseTimeHistory.length > this.historySize) {
      this.responseTimeHistory.shift()
    }
    if (this.errorRateHistory.length > this.historySize) {
      this.errorRateHistory.shift()
    }
  }
  
  private adaptBatchSize(): void {
    if (this.responseTimeHistory.length < 3) return
    
    const avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
    const errorRate = this.errorRateHistory.reduce((a, b) => a + b, 0) / this.errorRateHistory.length
    
    let adjustment = 1.0
    
    // Adjust based on response time
    if (avgResponseTime < this.targetResponseTime * 0.5) {
      adjustment *= 1.2 // Increase batch size if very fast
    } else if (avgResponseTime > this.targetResponseTime) {
      adjustment *= 0.8 // Decrease batch size if too slow
    }
    
    // Adjust based on error rate
    if (errorRate > 0.1) {
      adjustment *= 0.7 // Significantly reduce if errors
    }
    
    this.currentBatchSize = Math.round(
      Math.max(
        this.minBatchSize,
        Math.min(this.maxBatchSize, this.currentBatchSize * adjustment)
      )
    )
  }
  
  getCurrentBatchSize(): number {
    return this.currentBatchSize
  }
  
  getStatistics(): BatchingStatistics {
    return {
      currentBatchSize: this.currentBatchSize,
      averageResponseTime: this.responseTimeHistory.length > 0 
        ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length 
        : 0,
      errorRate: this.errorRateHistory.length > 0
        ? this.errorRateHistory.reduce((a, b) => a + b, 0) / this.errorRateHistory.length
        : 0
    }
  }
}

interface BatchingStatistics {
  currentBatchSize: number
  averageResponseTime: number
  errorRate: number
}
```

### Memory-Efficient Streaming

```typescript
import { Transform, Readable } from 'stream'
import { pipeline } from 'stream/promises'

class MemoryEfficientProcessor {
  private memoryLimit: number
  private currentMemoryUsage = 0
  
  constructor(memoryLimitMB: number = 512) {
    this.memoryLimit = memoryLimitMB * 1024 * 1024 // Convert to bytes
  }
  
  async processLargeRepository(
    repoPath: string,
    processor: (chunk: TextChunk) => Promise<EmbeddedChunk>
  ): Promise<void> {
    const fileStream = this.createFileStream(repoPath)
    const chunkStream = this.createChunkingStream()
    const embeddingStream = this.createEmbeddingStream(processor)
    const storageStream = this.createStorageStream()
    
    await pipeline(
      fileStream,
      chunkStream,
      embeddingStream,
      storageStream
    )
  }
  
  private createFileStream(repoPath: string): Readable {
    return new Readable({
      objectMode: true,
      async read() {
        // Implement file discovery and reading
        // Yield one file at a time to control memory usage
      }
    })
  }
  
  private createChunkingStream(): Transform {
    return new Transform({
      objectMode: true,
      transform(fileContent: FileContent, encoding, callback) {
        try {
          const chunks = this.chunkFile(fileContent)
          chunks.forEach(chunk => this.push(chunk))
          callback()
        } catch (error) {
          callback(error)
        }
      }
    })
  }
  
  private createEmbeddingStream(
    processor: (chunk: TextChunk) => Promise<EmbeddedChunk>
  ): Transform {
    const batchSize = 10
    let batch: TextChunk[] = []
    
    return new Transform({
      objectMode: true,
      async transform(chunk: TextChunk, encoding, callback) {
        batch.push(chunk)
        
        if (batch.length >= batchSize || this.isMemoryPressure()) {
          try {
            const processed = await Promise.all(
              batch.map(c => processor(c))
            )
            processed.forEach(p => this.push(p))
            batch = []
            callback()
          } catch (error) {
            callback(error)
          }
        } else {
          callback()
        }
      },
      
      async flush(callback) {
        if (batch.length > 0) {
          try {
            const processed = await Promise.all(
              batch.map(c => processor(c))
            )
            processed.forEach(p => this.push(p))
            callback()
          } catch (error) {
            callback(error)
          }
        } else {
          callback()
        }
      }
    })
  }
  
  private createStorageStream(): Transform {
    const batchSize = 100
    let batch: EmbeddedChunk[] = []
    
    return new Transform({
      objectMode: true,
      async transform(embeddedChunk: EmbeddedChunk, encoding, callback) {
        batch.push(embeddedChunk)
        
        if (batch.length >= batchSize) {
          try {
            await this.storeBatch(batch)
            batch = []
            callback()
          } catch (error) {
            callback(error)
          }
        } else {
          callback()
        }
      },
      
      async flush(callback) {
        if (batch.length > 0) {
          try {
            await this.storeBatch(batch)
            callback()
          } catch (error) {
            callback(error)
          }
        } else {
          callback()
        }
      }
    })
  }
  
  private isMemoryPressure(): boolean {
    const memoryUsage = process.memoryUsage()
    return memoryUsage.heapUsed > this.memoryLimit * 0.8
  }
  
  private async storeBatch(batch: EmbeddedChunk[]): Promise<void> {
    // Implement batch storage
    // This could write to database, file system, etc.
  }
}
```

These code examples provide a comprehensive foundation for working with and extending Ziri. They demonstrate best practices for integration, customization, and optimization while maintaining code quality and performance.