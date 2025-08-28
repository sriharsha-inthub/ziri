/**
 * Concurrent Embedding Pipeline
 * Manages concurrent embedding generation with intelligent batching and adaptive optimization
 */

import { EventEmitter } from 'events';

export class EmbeddingPipeline extends EventEmitter {
  constructor(embeddingClient, options = {}) {
    super();
    
    this.client = embeddingClient;
    this.options = {
      concurrency: options.concurrency || 3,
      initialBatchSize: options.initialBatchSize || 50,
      maxBatchSize: options.maxBatchSize || 200,
      minBatchSize: options.minBatchSize || 10,
      adaptiveBatching: options.adaptiveBatching !== false,
      targetResponseTime: options.targetResponseTime || 2000, // 2 seconds
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    // Pipeline state
    this.currentBatchSize = this.options.initialBatchSize;
    this.activeRequests = 0;
    this.totalProcessed = 0;
    this.totalErrors = 0;
    this.responseTimeHistory = [];
    this.throughputHistory = [];
    
    // Performance tracking
    this.startTime = null;
    this.lastProgressUpdate = 0;
    
    // Adaptive batching state
    this.consecutiveSlowResponses = 0;
    this.consecutiveFastResponses = 0;
  }

  /**
   * Process chunks through the embedding pipeline
   * @param {AsyncIterable<TextChunk>} chunks - Stream of text chunks to process
   * @param {string} providerType - Embedding provider to use
   * @returns {AsyncIterable<EmbeddedChunk>} Stream of embedded chunks
   */
  async* processChunks(chunks, providerType = null) {
    this.startTime = Date.now();
    this.totalProcessed = 0;
    this.totalErrors = 0;
    
    this.emit('pipeline:start', {
      provider: providerType || this.client.defaultProvider,
      concurrency: this.options.concurrency,
      initialBatchSize: this.currentBatchSize
    });

    const batcher = new EmbeddingBatcher(this.options);
    const concurrencyManager = new ConcurrencyManager(this.options.concurrency);
    
    let chunkBuffer = [];
    let chunkId = 0;
    
    try {
      // Collect chunks into batches
      for await (const chunk of chunks) {
        chunk.id = chunk.id || `chunk_${chunkId++}`;
        chunkBuffer.push(chunk);
        
        // Process batch when we have enough chunks
        if (chunkBuffer.length >= this.currentBatchSize) {
          const batch = chunkBuffer.splice(0, this.currentBatchSize);
          const batchPromise = this._processBatch(batch, providerType, batcher, concurrencyManager);
          
          // Yield results as they complete
          for await (const result of batchPromise) {
            yield result;
          }
        }
      }
      
      // Process remaining chunks
      if (chunkBuffer.length > 0) {
        const batchPromise = this._processBatch(chunkBuffer, providerType, batcher, concurrencyManager);
        for await (const result of batchPromise) {
          yield result;
        }
      }
      
      // Wait for all concurrent requests to complete
      await concurrencyManager.waitForCompletion();
      
    } catch (error) {
      this.emit('pipeline:error', error);
      throw error;
    } finally {
      this._emitFinalStats();
    }
  }

  /**
   * Process a batch of chunks with concurrency management
   * @param {TextChunk[]} chunks - Chunks to process
   * @param {string} providerType - Provider type
   * @param {EmbeddingBatcher} batcher - Batching manager
   * @param {ConcurrencyManager} concurrencyManager - Concurrency manager
   * @returns {AsyncIterable<EmbeddedChunk>} Embedded chunks
   * @private
   */
  async* _processBatch(chunks, providerType, batcher, concurrencyManager) {
    // Create sub-batches based on token limits
    const subBatches = batcher.createBatches(chunks, providerType, this.client);
    
    // If we have multiple sub-batches, process them concurrently
    if (subBatches.length > 1) {
      // Process sub-batches concurrently
      const batchPromises = subBatches.map(subBatch => 
        concurrencyManager.execute(() => this._processSubBatch(subBatch, providerType))
      );
      
      // Yield results as they complete
      for (const batchPromise of batchPromises) {
        try {
          const results = await batchPromise;
          for (const result of results) {
            yield result;
          }
        } catch (error) {
          this.totalErrors++;
          this.emit('batch:error', { error, batchSize: chunks.length });
          // Continue processing other batches
        }
      }
    } else {
      // Single batch, process directly
      try {
        const results = await concurrencyManager.execute(() => 
          this._processSubBatch(subBatches[0], providerType)
        );
        for (const result of results) {
          yield result;
        }
      } catch (error) {
        this.totalErrors++;
        this.emit('batch:error', { error, batchSize: chunks.length });
      }
    }
  }

  /**
   * Process a sub-batch of chunks
   * @param {TextChunk[]} chunks - Chunks to process
   * @param {string} providerType - Provider type
   * @returns {Promise<EmbeddedChunk[]>} Embedded chunks
   * @private
   */
  async _processSubBatch(chunks, providerType) {
    const startTime = Date.now();
    const texts = chunks.map(chunk => chunk.content);
    
    this.emit('batch:start', {
      batchSize: chunks.length,
      provider: providerType || this.client.defaultProvider
    });

    try {
      // Generate embeddings with retry logic
      const embeddings = await this._embedWithRetry(texts, providerType);
      
      // Create embedded chunks
      const embeddedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
        embeddedAt: new Date(),
        provider: providerType || this.client.defaultProvider
      }));
      
      // Update performance metrics
      const responseTime = Date.now() - startTime;
      this._updatePerformanceMetrics(responseTime, chunks.length);
      
      this.totalProcessed += chunks.length;
      this.emit('batch:complete', {
        batchSize: chunks.length,
        responseTime,
        throughput: chunks.length / (responseTime / 1000)
      });
      
      return embeddedChunks;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.emit('batch:error', {
        error,
        batchSize: chunks.length,
        responseTime
      });
      throw error;
    }
  }

  /**
   * Generate embeddings with retry logic
   * @param {string[]} texts - Texts to embed
   * @param {string} providerType - Provider type
   * @returns {Promise<number[][]>} Embeddings
   * @private
   */
  async _embedWithRetry(texts, providerType) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await this.client.embed(texts, providerType);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.options.maxRetries) {
          const delay = this._calculateRetryDelay(attempt, error);
          this.emit('retry', {
            attempt: attempt + 1,
            maxRetries: this.options.maxRetries,
            delay,
            error: error.message
          });
          
          await this._sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * @param {number} attempt - Attempt number
   * @param {Error} error - Last error
   * @returns {number} Delay in milliseconds
   * @private
   */
  _calculateRetryDelay(attempt, error) {
    // Base delay with exponential backoff
    let delay = this.options.retryDelay * Math.pow(2, attempt);
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    delay += jitter;
    
    // Increase delay for rate limit errors
    if (error.message?.includes('rate limit') || error.status === 429) {
      delay *= 2;
    }
    
    // Cap maximum delay at 30 seconds
    return Math.min(delay, 30000);
  }

  /**
   * Update performance metrics and adapt batch size
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} batchSize - Size of the processed batch
   * @private
   */
  _updatePerformanceMetrics(responseTime, batchSize) {
    // Track response times
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 10) {
      this.responseTimeHistory.shift();
    }
    
    // Track throughput
    const throughput = batchSize / (responseTime / 1000);
    this.throughputHistory.push(throughput);
    if (this.throughputHistory.length > 10) {
      this.throughputHistory.shift();
    }
    
    // Adapt batch size if enabled
    if (this.options.adaptiveBatching) {
      this._adaptBatchSize(responseTime);
    }
    
    // Emit progress updates
    this._emitProgressUpdate();
  }

  /**
   * Adapt batch size based on response times
   * @param {number} responseTime - Latest response time
   * @private
   */
  _adaptBatchSize(responseTime) {
    const targetTime = this.options.targetResponseTime;
    const tolerance = targetTime * 0.1; // 10% tolerance for more aggressive adaptation
    
    if (responseTime > targetTime + tolerance) {
      // Response too slow, decrease batch size
      this.consecutiveSlowResponses++;
      this.consecutiveFastResponses = 0;
      
      if (this.consecutiveSlowResponses >= 1) { // More aggressive - trigger after 1 slow response
        const oldSize = this.currentBatchSize;
        const newSize = Math.max(
          this.options.minBatchSize,
          Math.floor(this.currentBatchSize * 0.8)
        );
        
        if (newSize !== this.currentBatchSize) {
          this.currentBatchSize = newSize;
          this.emit('batch:size:decreased', {
            oldSize,
            newSize: this.currentBatchSize,
            reason: 'slow_response',
            responseTime
          });
        }
        
        this.consecutiveSlowResponses = 0;
      }
    } else if (responseTime < targetTime - tolerance) {
      // Response fast enough, consider increasing batch size
      this.consecutiveFastResponses++;
      this.consecutiveSlowResponses = 0;
      
      if (this.consecutiveFastResponses >= 2) { // More aggressive - trigger after 2 fast responses
        const oldSize = this.currentBatchSize;
        const newSize = Math.min(
          this.options.maxBatchSize,
          Math.floor(this.currentBatchSize * 1.2)
        );
        
        if (newSize !== this.currentBatchSize) {
          this.currentBatchSize = newSize;
          this.emit('batch:size:increased', {
            oldSize,
            newSize: this.currentBatchSize,
            reason: 'fast_response',
            responseTime
          });
        }
        
        this.consecutiveFastResponses = 0;
      }
    }
  }

  /**
   * Emit progress updates
   * @private
   */
  _emitProgressUpdate() {
    const now = Date.now();
    if (now - this.lastProgressUpdate > 1000) { // Update every second
      const elapsed = (now - this.startTime) / 1000;
      const avgThroughput = this.throughputHistory.length > 0 
        ? this.throughputHistory.reduce((a, b) => a + b) / this.throughputHistory.length
        : 0;
      
      this.emit('progress', {
        processed: this.totalProcessed,
        errors: this.totalErrors,
        elapsed,
        throughput: avgThroughput,
        currentBatchSize: this.currentBatchSize,
        activeRequests: this.activeRequests,
        // Enhanced progress information
        avgResponseTime: this.responseTimeHistory.length > 0
          ? this.responseTimeHistory.reduce((a, b) => a + b) / this.responseTimeHistory.length
          : 0,
        peakThroughput: this.throughputHistory.length > 0
          ? Math.max(...this.throughputHistory)
          : 0,
        batchSizeHistory: {
          min: this.options.minBatchSize,
          max: this.options.maxBatchSize,
          current: this.currentBatchSize
        }
      });
      
      this.lastProgressUpdate = now;
    }
  }

  /**
   * Emit final statistics
   * @private
   */
  _emitFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const avgResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b) / this.responseTimeHistory.length
      : 0;
    const avgThroughput = this.throughputHistory.length > 0
      ? this.throughputHistory.reduce((a, b) => a + b) / this.throughputHistory.length
      : 0;
    
    this.emit('pipeline:complete', {
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
      elapsed,
      avgResponseTime,
      avgThroughput,
      finalBatchSize: this.currentBatchSize
    });
  }

  /**
   * Set concurrency level
   * @param {number} level - Concurrency level
   */
  setConcurrency(level) {
    this.options.concurrency = Math.max(1, Math.min(10, level));
    this.emit('concurrency:changed', { newLevel: this.options.concurrency });
  }

  /**
   * Set batch size
   * @param {number} size - Batch size
   */
  setBatchSize(size) {
    this.currentBatchSize = Math.max(
      this.options.minBatchSize,
      Math.min(this.options.maxBatchSize, size)
    );
    this.emit('batch:size:manual', { newSize: this.currentBatchSize });
  }

  /**
   * Get current pipeline statistics
   * @returns {Object} Pipeline statistics
   */
  getStats() {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    
    return {
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
      elapsed,
      currentBatchSize: this.currentBatchSize,
      activeRequests: this.activeRequests,
      avgResponseTime: this.responseTimeHistory.length > 0
        ? this.responseTimeHistory.reduce((a, b) => a + b) / this.responseTimeHistory.length
        : 0,
      avgThroughput: this.throughputHistory.length > 0
        ? this.throughputHistory.reduce((a, b) => a + b) / this.throughputHistory.length
        : 0
    };
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Embedding Batcher
 * Creates optimal batches based on token limits and provider capabilities
 */
export class EmbeddingBatcher {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Create batches from chunks based on provider limits
   * @param {TextChunk[]} chunks - Chunks to batch
   * @param {string} providerType - Provider type
   * @param {EmbeddingClient} client - Embedding client
   * @returns {TextChunk[][]} Array of batches
   */
  createBatches(chunks, providerType, client) {
    const limits = client.getProviderLimits(providerType);
    const maxTokensPerBatch = limits.maxTokensPerRequest || 8000;
    const recommendedBatchSize = limits.recommendedBatchSize || 50;
    
    const batches = [];
    let currentBatch = [];
    let currentTokens = 0;
    
    for (const chunk of chunks) {
      const estimatedTokens = this._estimateTokens(chunk.content);
      
      // Skip chunks that are too large
      if (estimatedTokens > maxTokensPerBatch) {
        continue;
      }
      
      // Start new batch if adding this chunk would exceed limits
      if (currentBatch.length > 0 && 
          (currentTokens + estimatedTokens > maxTokensPerBatch ||
           currentBatch.length >= recommendedBatchSize)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTokens = 0;
      }
      
      currentBatch.push(chunk);
      currentTokens += estimatedTokens;
    }
    
    // Add final batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }

  /**
   * Estimate token count for text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   * @private
   */
  _estimateTokens(text) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Concurrency Manager
 * Manages concurrent request execution with limits
 */
export class ConcurrencyManager {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
    this.activeRequests = 0;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Execute a function with concurrency control
   * @param {Function} fn - Function to execute
   * @returns {Promise} Function result
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Wait for all active requests to complete
   * @returns {Promise<void>}
   */
  async waitForCompletion() {
    while (this.activeRequests > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Process the request queue
   * @private
   */
  async _processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
      const { fn, resolve, reject } = this.queue.shift();
      this.activeRequests++;

      // Execute function asynchronously
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.activeRequests--;
          // Continue processing queue
          setImmediate(() => this._processQueue());
        });
    }

    this.processing = false;
  }
}