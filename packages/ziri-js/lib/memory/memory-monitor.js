/**
 * Memory Monitor
 * Tracks memory usage and enforces limits for streaming operations
 */

import { EventEmitter } from 'events';

export class MemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxMemoryMB: options.maxMemoryMB || 512,
      warningThresholdPercent: options.warningThresholdPercent || 80,
      criticalThresholdPercent: options.criticalThresholdPercent || 95,
      checkIntervalMs: options.checkIntervalMs || 1000,
      enableGC: options.enableGC !== false,
      ...options
    };
    
    this.maxMemoryBytes = this.options.maxMemoryMB * 1024 * 1024;
    this.warningThreshold = this.maxMemoryBytes * (this.options.warningThresholdPercent / 100);
    this.criticalThreshold = this.maxMemoryBytes * (this.options.criticalThresholdPercent / 100);
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.memoryHistory = [];
    this.maxHistorySize = 60; // Keep 60 samples
    
    // Memory statistics
    this.stats = {
      peakUsage: 0,
      averageUsage: 0,
      warningCount: 0,
      criticalCount: 0,
      gcCount: 0
    };
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this._checkMemoryUsage();
    }, this.options.checkIntervalMs);
    
    this.emit('monitoring:started', {
      maxMemoryMB: this.options.maxMemoryMB,
      warningThreshold: this.options.warningThresholdPercent,
      criticalThreshold: this.options.criticalThresholdPercent
    });
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.emit('monitoring:stopped', this.getStats());
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage() {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      timestamp: Date.now()
    };
  }

  /**
   * Check if memory usage is within limits
   */
  isMemoryWithinLimits() {
    const usage = this.getCurrentUsage();
    return usage.heapUsed < this.criticalThreshold;
  }

  /**
   * Get memory usage as percentage of limit
   */
  getMemoryUsagePercent() {
    const usage = this.getCurrentUsage();
    return (usage.heapUsed / this.maxMemoryBytes) * 100;
  }

  /**
   * Force garbage collection if available
   */
  forceGC() {
    if (this.options.enableGC && global.gc) {
      try {
        global.gc();
        this.stats.gcCount++;
        this.emit('gc:forced', {
          beforeUsage: this.getCurrentUsage(),
          timestamp: Date.now()
        });
        
        // Check usage after GC
        setTimeout(() => {
          const afterUsage = this.getCurrentUsage();
          this.emit('gc:complete', {
            afterUsage,
            timestamp: Date.now()
          });
        }, 100);
        
        return true;
      } catch (error) {
        this.emit('gc:error', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Wait for memory to be available
   */
  async waitForMemoryAvailable(timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (!this.isMemoryWithinLimits()) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Memory limit exceeded for ${timeoutMs}ms`);
      }
      
      // Try garbage collection
      this.forceGC();
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const currentUsage = this.getCurrentUsage();
    
    // Calculate average usage
    if (this.memoryHistory.length > 0) {
      const totalUsage = this.memoryHistory.reduce((sum, usage) => sum + usage.heapUsed, 0);
      this.stats.averageUsage = totalUsage / this.memoryHistory.length;
    }
    
    return {
      ...this.stats,
      currentUsage,
      maxMemoryBytes: this.maxMemoryBytes,
      usagePercent: this.getMemoryUsagePercent(),
      historySize: this.memoryHistory.length,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Get memory usage history
   */
  getHistory() {
    return [...this.memoryHistory];
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      peakUsage: 0,
      averageUsage: 0,
      warningCount: 0,
      criticalCount: 0,
      gcCount: 0
    };
    this.memoryHistory = [];
    
    this.emit('stats:reset');
  }

  /**
   * Check memory usage and emit events
   * @private
   */
  _checkMemoryUsage() {
    const usage = this.getCurrentUsage();
    
    // Update peak usage
    if (usage.heapUsed > this.stats.peakUsage) {
      this.stats.peakUsage = usage.heapUsed;
    }
    
    // Add to history
    this.memoryHistory.push(usage);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
    
    // Check thresholds
    if (usage.heapUsed >= this.criticalThreshold) {
      this.stats.criticalCount++;
      this.emit('memory:critical', {
        usage,
        threshold: this.criticalThreshold,
        percent: (usage.heapUsed / this.maxMemoryBytes) * 100
      });
      
      // Auto-trigger GC on critical usage
      if (this.options.enableGC) {
        this.forceGC();
      }
      
    } else if (usage.heapUsed >= this.warningThreshold) {
      this.stats.warningCount++;
      this.emit('memory:warning', {
        usage,
        threshold: this.warningThreshold,
        percent: (usage.heapUsed / this.maxMemoryBytes) * 100
      });
    }
    
    // Emit regular usage update
    this.emit('memory:update', usage);
  }

  /**
   * Create a memory-aware stream processor
   */
  createMemoryAwareProcessor(processorFn, options = {}) {
    const {
      batchSize = 100,
      memoryCheckInterval = 10,
      pauseOnWarning = false,
      pauseOnCritical = true
    } = options;
    
    return async function* memoryAwareProcessor(iterable) {
      let processedCount = 0;
      let batch = [];
      
      for await (const item of iterable) {
        batch.push(item);
        
        // Process batch when full
        if (batch.length >= batchSize) {
          yield* await this._processBatchWithMemoryCheck(
            batch, 
            processorFn, 
            { pauseOnWarning, pauseOnCritical }
          );
          batch = [];
        }
        
        // Check memory periodically
        processedCount++;
        if (processedCount % memoryCheckInterval === 0) {
          await this._handleMemoryPressure({ pauseOnWarning, pauseOnCritical });
        }
      }
      
      // Process remaining items
      if (batch.length > 0) {
        yield* await this._processBatchWithMemoryCheck(
          batch, 
          processorFn, 
          { pauseOnWarning, pauseOnCritical }
        );
      }
    }.bind(this);
  }

  /**
   * Process batch with memory checking
   * @private
   */
  async* _processBatchWithMemoryCheck(batch, processorFn, options) {
    await this._handleMemoryPressure(options);
    
    try {
      const results = await processorFn(batch);
      for (const result of results) {
        yield result;
      }
    } catch (error) {
      this.emit('processor:error', { error, batchSize: batch.length });
      throw error;
    }
  }

  /**
   * Handle memory pressure
   * @private
   */
  async _handleMemoryPressure(options) {
    const usage = this.getCurrentUsage();
    
    if (usage.heapUsed >= this.criticalThreshold && options.pauseOnCritical) {
      this.emit('processor:paused', { reason: 'critical_memory', usage });
      await this.waitForMemoryAvailable();
      this.emit('processor:resumed', { reason: 'memory_available', usage: this.getCurrentUsage() });
      
    } else if (usage.heapUsed >= this.warningThreshold && options.pauseOnWarning) {
      this.emit('processor:paused', { reason: 'warning_memory', usage });
      
      // Try GC and wait a bit
      this.forceGC();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.emit('processor:resumed', { reason: 'gc_complete', usage: this.getCurrentUsage() });
    }
  }
}

/**
 * Memory-aware streaming utilities
 */
export class MemoryAwareStream {
  constructor(memoryMonitor) {
    this.memoryMonitor = memoryMonitor;
  }

  /**
   * Create a memory-limited buffer
   */
  createBuffer(maxSizeMB = 50) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const buffer = [];
    let currentSize = 0;
    
    return {
      add(item) {
        const itemSize = this._estimateSize(item);
        
        if (currentSize + itemSize > maxSizeBytes) {
          throw new Error(`Buffer would exceed ${maxSizeMB}MB limit`);
        }
        
        buffer.push(item);
        currentSize += itemSize;
      },
      
      flush() {
        const items = [...buffer];
        buffer.length = 0;
        currentSize = 0;
        return items;
      },
      
      size() {
        return buffer.length;
      },
      
      sizeBytes() {
        return currentSize;
      },
      
      isFull() {
        return currentSize >= maxSizeBytes * 0.9; // 90% threshold
      }
    };
  }

  /**
   * Estimate object size in bytes
   * @private
   */
  _estimateSize(obj) {
    if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16 encoding
    }
    
    if (Buffer.isBuffer(obj)) {
      return obj.length;
    }
    
    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this._estimateSize(item), 0);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return JSON.stringify(obj).length * 2;
    }
    
    return 8; // Rough estimate for primitives
  }
}