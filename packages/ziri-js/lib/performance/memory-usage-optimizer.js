/**
 * Memory Usage Optimizer
 * Advanced memory optimization for large repository processing
 */

import { EventEmitter } from 'events';
import { MemoryMonitor } from '../memory/memory-monitor.js';

export class MemoryUsageOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxMemoryMB: options.maxMemoryMB || 512,
      targetMemoryUsage: options.targetMemoryUsage || 0.7, // 70% of max
      criticalMemoryUsage: options.criticalMemoryUsage || 0.9, // 90% of max
      gcThreshold: options.gcThreshold || 0.8, // 80% of max
      chunkSizeReduction: options.chunkSizeReduction || 0.5,
      batchSizeReduction: options.batchSizeReduction || 0.6,
      concurrencyReduction: options.concurrencyReduction || 0.5,
      memoryCheckInterval: options.memoryCheckInterval || 1000,
      adaptiveChunking: options.adaptiveChunking !== false,
      streamingThreshold: options.streamingThreshold || 100, // MB
      ...options
    };
    
    this.memoryMonitor = new MemoryMonitor({
      maxMemoryMB: this.options.maxMemoryMB,
      warningThresholdPercent: this.options.targetMemoryUsage * 100,
      criticalThresholdPercent: this.options.criticalMemoryUsage * 100,
      checkIntervalMs: this.options.memoryCheckInterval
    });
    
    // Optimization state
    this.currentOptimizations = {
      chunkSize: null,
      batchSize: null,
      concurrency: null,
      streamingEnabled: false,
      compressionEnabled: false
    };
    
    this.optimizationHistory = [];
    this.performanceMetrics = {
      memoryPressureEvents: 0,
      gcEvents: 0,
      optimizationEvents: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0
    };
    
    this._setupMemoryMonitoring();
  }

  /**
   * Start memory optimization
   */
  start() {
    this.memoryMonitor.startMonitoring();
    this.emit('optimizer:started', {
      maxMemoryMB: this.options.maxMemoryMB,
      targetUsage: this.options.targetMemoryUsage
    });
  }

  /**
   * Stop memory optimization
   */
  stop() {
    this.memoryMonitor.stopMonitoring();
    this.emit('optimizer:stopped', this.getMetrics());
  }

  /**
   * Get current memory optimization recommendations
   * @param {Object} currentSettings - Current processing settings
   * @returns {Object} Optimization recommendations
   */
  getOptimizationRecommendations(currentSettings = {}) {
    const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
    const currentUsage = this.memoryMonitor.getCurrentUsage();
    
    const recommendations = {
      shouldOptimize: false,
      urgency: 'low',
      optimizations: {},
      memoryUsage,
      reason: 'memory_usage_normal'
    };
    
    // Determine optimization urgency
    if (memoryUsage >= this.options.criticalMemoryUsage) {
      recommendations.urgency = 'critical';
      recommendations.shouldOptimize = true;
      recommendations.reason = 'critical_memory_usage';
    } else if (memoryUsage >= this.options.targetMemoryUsage) {
      recommendations.urgency = 'high';
      recommendations.shouldOptimize = true;
      recommendations.reason = 'high_memory_usage';
    } else if (memoryUsage >= this.options.targetMemoryUsage * 0.8) {
      recommendations.urgency = 'medium';
      recommendations.shouldOptimize = true;
      recommendations.reason = 'approaching_memory_limit';
    }
    
    if (recommendations.shouldOptimize) {
      recommendations.optimizations = this._generateOptimizations(currentSettings, memoryUsage);
    }
    
    return recommendations;
  }

  /**
   * Apply memory optimizations
   * @param {Object} currentSettings - Current processing settings
   * @returns {Object} Optimized settings
   */
  applyOptimizations(currentSettings) {
    const recommendations = this.getOptimizationRecommendations(currentSettings);
    
    if (!recommendations.shouldOptimize) {
      return currentSettings;
    }
    
    const optimizedSettings = { ...currentSettings };
    
    // Apply optimizations
    for (const [key, value] of Object.entries(recommendations.optimizations)) {
      optimizedSettings[key] = value;
      this.currentOptimizations[key] = value;
    }
    
    // Record optimization
    this.optimizationHistory.push({
      timestamp: Date.now(),
      memoryUsage: recommendations.memoryUsage,
      urgency: recommendations.urgency,
      reason: recommendations.reason,
      optimizations: recommendations.optimizations,
      originalSettings: currentSettings,
      optimizedSettings
    });
    
    this.performanceMetrics.optimizationEvents++;
    
    this.emit('optimizations:applied', {
      urgency: recommendations.urgency,
      optimizations: recommendations.optimizations,
      memoryUsage: recommendations.memoryUsage
    });
    
    return optimizedSettings;
  }

  /**
   * Create memory-aware chunk processor
   * @param {Function} processorFn - Processing function
   * @param {Object} options - Processing options
   * @returns {Function} Memory-aware processor
   */
  createMemoryAwareProcessor(processorFn, options = {}) {
    const {
      initialChunkSize = 1000,
      minChunkSize = 100,
      maxChunkSize = 5000,
      adaptiveChunking = this.options.adaptiveChunking
    } = options;
    
    let currentChunkSize = initialChunkSize;
    
    return async function* memoryAwareProcessor(iterable) {
      let buffer = [];
      let processedCount = 0;
      
      for await (const item of iterable) {
        buffer.push(item);
        
        // Check if we should process the current buffer
        const shouldProcess = buffer.length >= currentChunkSize || 
                             this._shouldProcessDueToMemory();
        
        if (shouldProcess) {
          // Apply memory optimizations before processing
          const optimizedSettings = this.applyOptimizations({
            chunkSize: currentChunkSize,
            bufferSize: buffer.length
          });
          
          // Adjust chunk size if needed
          if (adaptiveChunking && optimizedSettings.chunkSize !== currentChunkSize) {
            currentChunkSize = Math.max(minChunkSize, 
              Math.min(maxChunkSize, optimizedSettings.chunkSize));
          }
          
          // Process buffer in smaller chunks if memory pressure is high
          const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
          if (memoryUsage > this.options.targetMemoryUsage) {
            yield* this._processBufferInChunks(buffer, processorFn, currentChunkSize);
          } else {
            const results = await processorFn(buffer);
            for (const result of results) {
              yield result;
            }
          }
          
          buffer = [];
          processedCount += buffer.length;
          
          // Periodic memory check and GC
          if (processedCount % 100 === 0) {
            await this._performMemoryMaintenance();
          }
        }
      }
      
      // Process remaining items
      if (buffer.length > 0) {
        const results = await processorFn(buffer);
        for (const result of results) {
          yield result;
        }
      }
    }.bind(this);
  }

  /**
   * Create memory-aware batch processor
   * @param {Function} batchProcessor - Batch processing function
   * @param {Object} options - Processing options
   * @returns {Function} Memory-aware batch processor
   */
  createMemoryAwareBatchProcessor(batchProcessor, options = {}) {
    const {
      initialBatchSize = 50,
      minBatchSize = 5,
      maxBatchSize = 200
    } = options;
    
    return async (items) => {
      const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
      
      // Determine optimal batch size based on memory usage
      let batchSize = initialBatchSize;
      if (memoryUsage > this.options.criticalMemoryUsage) {
        batchSize = Math.max(minBatchSize, Math.floor(batchSize * 0.3));
      } else if (memoryUsage > this.options.targetMemoryUsage) {
        batchSize = Math.max(minBatchSize, Math.floor(batchSize * 0.6));
      }
      
      const results = [];
      
      // Process items in memory-optimized batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Check memory before processing each batch
        await this._ensureMemoryAvailable();
        
        try {
          const batchResults = await batchProcessor(batch);
          results.push(...batchResults);
          
          // Force GC after each batch if memory usage is high
          if (memoryUsage > this.options.gcThreshold) {
            this.memoryMonitor.forceGC();
          }
          
        } catch (error) {
          // If memory error, try with smaller batch
          if (error.message.includes('memory') && batch.length > minBatchSize) {
            const smallerBatchSize = Math.max(minBatchSize, Math.floor(batch.length / 2));
            for (let j = 0; j < batch.length; j += smallerBatchSize) {
              const smallBatch = batch.slice(j, j + smallerBatchSize);
              const smallBatchResults = await batchProcessor(smallBatch);
              results.push(...smallBatchResults);
            }
          } else {
            throw error;
          }
        }
      }
      
      return results;
    };
  }

  /**
   * Get memory optimization metrics
   * @returns {Object} Optimization metrics
   */
  getMetrics() {
    const memoryStats = this.memoryMonitor.getStats();
    
    return {
      ...this.performanceMetrics,
      currentMemoryUsage: memoryStats.usagePercent,
      peakMemoryUsage: (memoryStats.peakUsage / (this.options.maxMemoryMB * 1024 * 1024)) * 100,
      averageMemoryUsage: (memoryStats.averageUsage / (this.options.maxMemoryMB * 1024 * 1024)) * 100,
      currentOptimizations: { ...this.currentOptimizations },
      optimizationHistory: this.optimizationHistory.slice(-10),
      memoryStats
    };
  }

  /**
   * Reset optimization state
   */
  reset() {
    this.currentOptimizations = {
      chunkSize: null,
      batchSize: null,
      concurrency: null,
      streamingEnabled: false,
      compressionEnabled: false
    };
    
    this.optimizationHistory = [];
    this.performanceMetrics = {
      memoryPressureEvents: 0,
      gcEvents: 0,
      optimizationEvents: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0
    };
    
    this.memoryMonitor.resetStats();
    this.emit('optimizer:reset');
  }

  /**
   * Generate specific optimizations based on memory usage
   * @param {Object} currentSettings - Current settings
   * @param {number} memoryUsage - Current memory usage (0-1)
   * @returns {Object} Optimization recommendations
   * @private
   */
  _generateOptimizations(currentSettings, memoryUsage) {
    const optimizations = {};
    
    // Chunk size optimization
    if (currentSettings.chunkSize) {
      if (memoryUsage >= this.options.criticalMemoryUsage) {
        optimizations.chunkSize = Math.floor(currentSettings.chunkSize * 0.3);
      } else if (memoryUsage >= this.options.targetMemoryUsage) {
        optimizations.chunkSize = Math.floor(currentSettings.chunkSize * this.options.chunkSizeReduction);
      }
    }
    
    // Batch size optimization
    if (currentSettings.batchSize) {
      if (memoryUsage >= this.options.criticalMemoryUsage) {
        optimizations.batchSize = Math.max(5, Math.floor(currentSettings.batchSize * 0.2));
      } else if (memoryUsage >= this.options.targetMemoryUsage) {
        optimizations.batchSize = Math.max(10, Math.floor(currentSettings.batchSize * this.options.batchSizeReduction));
      }
    }
    
    // Concurrency optimization
    if (currentSettings.concurrency) {
      if (memoryUsage >= this.options.criticalMemoryUsage) {
        optimizations.concurrency = 1;
      } else if (memoryUsage >= this.options.targetMemoryUsage) {
        optimizations.concurrency = Math.max(1, Math.floor(currentSettings.concurrency * this.options.concurrencyReduction));
      }
    }
    
    // Enable streaming for large datasets
    if (memoryUsage >= this.options.targetMemoryUsage) {
      optimizations.streamingEnabled = true;
    }
    
    // Enable compression for memory savings
    if (memoryUsage >= this.options.criticalMemoryUsage) {
      optimizations.compressionEnabled = true;
    }
    
    return optimizations;
  }

  /**
   * Setup memory monitoring event handlers
   * @private
   */
  _setupMemoryMonitoring() {
    this.memoryMonitor.on('memory:warning', (data) => {
      this.performanceMetrics.memoryPressureEvents++;
      this.emit('memory:pressure', {
        level: 'warning',
        usage: data.usage,
        percent: data.percent
      });
    });
    
    this.memoryMonitor.on('memory:critical', (data) => {
      this.performanceMetrics.memoryPressureEvents++;
      this.emit('memory:pressure', {
        level: 'critical',
        usage: data.usage,
        percent: data.percent
      });
    });
    
    this.memoryMonitor.on('gc:forced', () => {
      this.performanceMetrics.gcEvents++;
      this.emit('gc:triggered', {
        reason: 'memory_optimization'
      });
    });
  }

  /**
   * Check if processing should occur due to memory pressure
   * @returns {boolean} Should process now
   * @private
   */
  _shouldProcessDueToMemory() {
    const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
    return memoryUsage > this.options.targetMemoryUsage;
  }

  /**
   * Process buffer in smaller chunks to manage memory
   * @param {Array} buffer - Items to process
   * @param {Function} processorFn - Processing function
   * @param {number} chunkSize - Chunk size
   * @returns {AsyncGenerator} Processed results
   * @private
   */
  async* _processBufferInChunks(buffer, processorFn, chunkSize) {
    const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
    const adaptedChunkSize = memoryUsage > this.options.criticalMemoryUsage 
      ? Math.max(10, Math.floor(chunkSize * 0.3))
      : Math.max(20, Math.floor(chunkSize * 0.6));
    
    for (let i = 0; i < buffer.length; i += adaptedChunkSize) {
      const chunk = buffer.slice(i, i + adaptedChunkSize);
      
      // Ensure memory is available before processing
      await this._ensureMemoryAvailable();
      
      const results = await processorFn(chunk);
      for (const result of results) {
        yield result;
      }
      
      // Force GC between chunks if memory usage is high
      if (memoryUsage > this.options.gcThreshold) {
        this.memoryMonitor.forceGC();
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow GC to complete
      }
    }
  }

  /**
   * Ensure memory is available for processing
   * @private
   */
  async _ensureMemoryAvailable() {
    const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
    
    if (memoryUsage > this.options.criticalMemoryUsage) {
      // Force GC and wait
      this.memoryMonitor.forceGC();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Wait for memory to become available
      await this.memoryMonitor.waitForMemoryAvailable(10000);
    }
  }

  /**
   * Perform periodic memory maintenance
   * @private
   */
  async _performMemoryMaintenance() {
    const memoryUsage = this.memoryMonitor.getMemoryUsagePercent() / 100;
    
    if (memoryUsage > this.options.gcThreshold) {
      this.memoryMonitor.forceGC();
      
      // Update average memory usage
      const currentUsage = this.memoryMonitor.getCurrentUsage();
      this.performanceMetrics.averageMemoryUsage = 
        (this.performanceMetrics.averageMemoryUsage + (currentUsage.heapUsed / (this.options.maxMemoryMB * 1024 * 1024)) * 100) / 2;
      
      // Update peak memory usage
      const peakPercent = (currentUsage.heapUsed / (this.options.maxMemoryMB * 1024 * 1024)) * 100;
      if (peakPercent > this.performanceMetrics.peakMemoryUsage) {
        this.performanceMetrics.peakMemoryUsage = peakPercent;
      }
    }
  }
}

/**
 * Memory-aware streaming buffer for large datasets
 */
export class MemoryAwareStreamingBuffer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxBufferSizeMB: options.maxBufferSizeMB || 50,
      flushThreshold: options.flushThreshold || 0.8,
      compressionEnabled: options.compressionEnabled || false,
      ...options
    };
    
    this.buffer = [];
    this.currentSizeBytes = 0;
    this.maxSizeBytes = this.options.maxBufferSizeMB * 1024 * 1024;
    this.itemCount = 0;
  }

  /**
   * Add item to buffer
   * @param {*} item - Item to add
   * @returns {boolean} True if item was added, false if buffer is full
   */
  add(item) {
    const itemSize = this._estimateItemSize(item);
    
    if (this.currentSizeBytes + itemSize > this.maxSizeBytes) {
      this.emit('buffer:full', {
        itemCount: this.itemCount,
        sizeBytes: this.currentSizeBytes,
        sizeMB: this.currentSizeBytes / (1024 * 1024)
      });
      return false;
    }
    
    this.buffer.push(item);
    this.currentSizeBytes += itemSize;
    this.itemCount++;
    
    // Check if we should flush
    if (this.currentSizeBytes >= this.maxSizeBytes * this.options.flushThreshold) {
      this.emit('buffer:should_flush', {
        itemCount: this.itemCount,
        sizeBytes: this.currentSizeBytes,
        threshold: this.options.flushThreshold
      });
    }
    
    return true;
  }

  /**
   * Flush buffer and return items
   * @returns {Array} Buffered items
   */
  flush() {
    const items = [...this.buffer];
    this.buffer = [];
    this.currentSizeBytes = 0;
    this.itemCount = 0;
    
    this.emit('buffer:flushed', {
      itemCount: items.length
    });
    
    return items;
  }

  /**
   * Get buffer status
   * @returns {Object} Buffer status
   */
  getStatus() {
    return {
      itemCount: this.itemCount,
      sizeBytes: this.currentSizeBytes,
      sizeMB: this.currentSizeBytes / (1024 * 1024),
      maxSizeMB: this.options.maxBufferSizeMB,
      utilizationPercent: (this.currentSizeBytes / this.maxSizeBytes) * 100,
      shouldFlush: this.currentSizeBytes >= this.maxSizeBytes * this.options.flushThreshold
    };
  }

  /**
   * Estimate item size in bytes
   * @param {*} item - Item to estimate
   * @returns {number} Estimated size in bytes
   * @private
   */
  _estimateItemSize(item) {
    if (typeof item === 'string') {
      return item.length * 2; // UTF-16 encoding
    }
    
    if (Buffer.isBuffer(item)) {
      return item.length;
    }
    
    if (typeof item === 'object' && item !== null) {
      try {
        return JSON.stringify(item).length * 2;
      } catch {
        return 1024; // Default estimate for complex objects
      }
    }
    
    return 8; // Default for primitives
  }
}