/**
 * Streaming Processor
 * Memory-efficient streaming processor with checkpointing and memory monitoring
 */

import { EventEmitter } from 'events';
import { MemoryMonitor } from './memory-monitor.js';
import { CheckpointManager } from './checkpoint-manager.js';

export class StreamingProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      memoryLimitMB: options.memoryLimitMB || 512,
      batchSize: options.batchSize || 100,
      checkpointInterval: options.checkpointInterval || 500,
      enableCheckpoints: options.enableCheckpoints !== false,
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      pauseOnMemoryPressure: options.pauseOnMemoryPressure !== false,
      ...options
    };
    
    // Initialize memory monitor
    this.memoryMonitor = new MemoryMonitor({
      maxMemoryMB: this.options.memoryLimitMB,
      warningThresholdPercent: 75,
      criticalThresholdPercent: 90,
      enableGC: true
    });
    
    // Initialize checkpoint manager
    this.checkpointManager = options.checkpointManager || null;
    
    // Processing state
    this.isProcessing = false;
    this.isPaused = false;
    this.processedCount = 0;
    this.errorCount = 0;
    this.startTime = null;
    
    // Setup event handlers
    this._setupEventHandlers();
  }

  /**
   * Process an iterable stream with memory management and checkpointing
   */
  async* processStream(iterable, processorFn, options = {}) {
    const {
      repositoryId = 'default',
      operationType = 'processing',
      resumeFromCheckpoint = true,
      batchSize = this.options.batchSize
    } = options;
    
    this.isProcessing = true;
    this.startTime = Date.now();
    this.processedCount = 0;
    this.errorCount = 0;
    
    try {
      // Start memory monitoring
      if (this.options.enableMemoryMonitoring) {
        this.memoryMonitor.startMonitoring();
      }
      
      // Initialize checkpointing
      let checkpoint = null;
      if (this.options.enableCheckpoints && this.checkpointManager) {
        if (resumeFromCheckpoint) {
          const resumeInfo = await this.checkpointManager.shouldResume(repositoryId, operationType);
          if (resumeInfo.shouldResume) {
            checkpoint = resumeInfo.checkpoint;
            this.processedCount = checkpoint.processedCount || 0;
            this.emit('processing:resumed', {
              repositoryId,
              processedCount: this.processedCount,
              checkpoint
            });
          }
        }
        
        if (!checkpoint) {
          await this.checkpointManager.initialize(repositoryId, operationType);
        }
      }
      
      this.emit('processing:started', {
        repositoryId,
        operationType,
        memoryLimitMB: this.options.memoryLimitMB,
        batchSize,
        resumed: !!checkpoint
      });
      
      // Process stream in batches
      yield* this._processBatchedStream(iterable, processorFn, {
        batchSize,
        repositoryId,
        operationType
      });
      
      // Complete processing
      if (this.checkpointManager) {
        await this.checkpointManager.completeOperation({
          totalProcessed: this.processedCount,
          totalErrors: this.errorCount,
          duration: Date.now() - this.startTime
        });
      }
      
      this.emit('processing:completed', {
        repositoryId,
        processedCount: this.processedCount,
        errorCount: this.errorCount,
        duration: Date.now() - this.startTime
      });
      
    } catch (error) {
      this.emit('processing:error', { error, repositoryId });
      throw error;
    } finally {
      this.isProcessing = false;
      
      if (this.options.enableMemoryMonitoring) {
        this.memoryMonitor.stopMonitoring();
      }
    }
  }

  /**
   * Process stream in memory-aware batches
   * @private
   */
  async* _processBatchedStream(iterable, processorFn, options) {
    const { batchSize, repositoryId, operationType } = options;
    
    let batch = [];
    let itemCount = 0;
    
    for await (const item of iterable) {
      // Check if we should pause for memory pressure
      if (this.options.pauseOnMemoryPressure) {
        await this._handleMemoryPressure();
      }
      
      // Skip if already processed (checkpoint resume)
      if (this.checkpointManager?.isFileProcessed(item.path || item.filePath)) {
        this.emit('item:skipped', { item, reason: 'already_processed' });
        continue;
      }
      
      batch.push(item);
      itemCount++;
      
      // Process batch when full or memory pressure
      if (batch.length >= batchSize || this._shouldFlushBatch()) {
        yield* await this._processBatch(batch, processorFn, options);
        batch = [];
        
        // Force garbage collection periodically
        if (itemCount % (batchSize * 5) === 0) {
          this.memoryMonitor.forceGC();
        }
      }
    }
    
    // Process remaining items
    if (batch.length > 0) {
      yield* await this._processBatch(batch, processorFn, options);
    }
  }

  /**
   * Process a single batch
   * @private
   */
  async* _processBatch(batch, processorFn, options) {
    const batchStartTime = Date.now();
    
    this.emit('batch:started', {
      batchSize: batch.length,
      processedCount: this.processedCount
    });
    
    try {
      // Process batch with memory monitoring
      const results = await this._processWithMemoryCheck(batch, processorFn);
      
      // Update progress and checkpoints
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const result = results[i];
        
        this.processedCount++;
        
        // Update checkpoint
        if (this.checkpointManager) {
          this.checkpointManager.updateProgress(item, result?.chunks || 0);
        }
        
        // Yield result
        if (result) {
          yield result;
        }
      }
      
      const batchDuration = Date.now() - batchStartTime;
      
      this.emit('batch:completed', {
        batchSize: batch.length,
        duration: batchDuration,
        throughput: batch.length / (batchDuration / 1000),
        processedCount: this.processedCount
      });
      
    } catch (error) {
      this.errorCount++;
      this.emit('batch:error', {
        error,
        batchSize: batch.length,
        processedCount: this.processedCount
      });
      
      // Continue processing other batches
      console.warn(`Batch processing error: ${error.message}`);
    }
  }

  /**
   * Process with memory checking
   * @private
   */
  async _processWithMemoryCheck(batch, processorFn) {
    // Check memory before processing
    if (!this.memoryMonitor.isMemoryWithinLimits()) {
      this.emit('memory:pressure', {
        usage: this.memoryMonitor.getCurrentUsage(),
        action: 'waiting'
      });
      
      await this.memoryMonitor.waitForMemoryAvailable();
    }
    
    // Process the batch
    return await processorFn(batch);
  }

  /**
   * Handle memory pressure
   * @private
   */
  async _handleMemoryPressure() {
    if (this.isPaused) {
      return;
    }
    
    const usage = this.memoryMonitor.getCurrentUsage();
    const usagePercent = this.memoryMonitor.getMemoryUsagePercent();
    
    // Pause if memory usage is too high
    if (usagePercent > 85) {
      this.isPaused = true;
      
      this.emit('processing:paused', {
        reason: 'memory_pressure',
        usagePercent,
        usage
      });
      
      // Force garbage collection
      this.memoryMonitor.forceGC();
      
      // Wait for memory to be available
      await this.memoryMonitor.waitForMemoryAvailable(10000);
      
      this.isPaused = false;
      
      this.emit('processing:resumed', {
        reason: 'memory_available',
        usagePercent: this.memoryMonitor.getMemoryUsagePercent()
      });
    }
  }

  /**
   * Check if batch should be flushed due to memory pressure
   * @private
   */
  _shouldFlushBatch() {
    if (!this.options.enableMemoryMonitoring) {
      return false;
    }
    
    const usagePercent = this.memoryMonitor.getMemoryUsagePercent();
    return usagePercent > 70; // Flush early if memory usage is high
  }

  /**
   * Pause processing
   */
  pause() {
    this.isPaused = true;
    this.emit('processing:paused', { reason: 'manual' });
  }

  /**
   * Resume processing
   */
  resume() {
    this.isPaused = false;
    this.emit('processing:resumed', { reason: 'manual' });
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    const memoryStats = this.memoryMonitor.getStats();
    const checkpointStats = this.checkpointManager?.getStats();
    
    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      elapsed,
      throughput: elapsed > 0 ? this.processedCount / (elapsed / 1000) : 0,
      memory: memoryStats,
      checkpoint: checkpointStats
    };
  }

  /**
   * Create a memory-optimized file processor
   */
  createFileProcessor(embeddingPipeline, indexStore) {
    return async (fileBatch) => {
      const results = [];
      
      for (const fileInfo of fileBatch) {
        try {
          // Process file chunks
          const chunks = [];
          
          // This would be implemented by the file chunker
          // For now, we'll simulate chunk processing
          const chunkCount = Math.floor(Math.random() * 10) + 1;
          
          for (let i = 0; i < chunkCount; i++) {
            chunks.push({
              id: `${fileInfo.path}_chunk_${i}`,
              content: `Chunk ${i} content from ${fileInfo.path}`,
              filePath: fileInfo.path,
              startLine: i * 10,
              endLine: (i + 1) * 10
            });
          }
          
          // Generate embeddings (this would use the embedding pipeline)
          const embeddings = await this._generateEmbeddings(chunks, embeddingPipeline);
          
          // Store embeddings (this would use the index store)
          await this._storeEmbeddings(embeddings, indexStore);
          
          results.push({
            filePath: fileInfo.path,
            chunks: chunks.length,
            success: true
          });
          
        } catch (error) {
          results.push({
            filePath: fileInfo.path,
            chunks: 0,
            success: false,
            error: error.message
          });
        }
      }
      
      return results;
    };
  }

  /**
   * Generate embeddings for chunks (placeholder)
   * @private
   */
  async _generateEmbeddings(chunks, embeddingPipeline) {
    // This would use the actual embedding pipeline
    // For now, return mock embeddings
    return chunks.map(chunk => ({
      ...chunk,
      embedding: new Array(1536).fill(0).map(() => Math.random())
    }));
  }

  /**
   * Store embeddings (placeholder)
   * @private
   */
  async _storeEmbeddings(embeddings, indexStore) {
    // This would use the actual index store
    // For now, just simulate storage
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Setup event handlers
   * @private
   */
  _setupEventHandlers() {
    // Memory monitor events
    this.memoryMonitor.on('memory:critical', (data) => {
      this.emit('memory:critical', data);
    });
    
    this.memoryMonitor.on('memory:warning', (data) => {
      this.emit('memory:warning', data);
    });
    
    this.memoryMonitor.on('gc:forced', (data) => {
      this.emit('gc:forced', data);
    });
    
    // Checkpoint manager events
    if (this.checkpointManager) {
      this.checkpointManager.on('checkpoint:saved', (data) => {
        this.emit('checkpoint:saved', data);
      });
      
      this.checkpointManager.on('checkpoint:error', (data) => {
        this.emit('checkpoint:error', data);
      });
    }
  }
}