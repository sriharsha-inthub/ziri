/**
 * Progress Monitor
 * Provides detailed progress tracking with real-time statistics and ETA calculations
 */

import { EventEmitter } from 'events';

export class ProgressMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: options.updateInterval || 1000, // 1 second
      etaWindowSize: options.etaWindowSize || 10, // samples for ETA calculation
      throughputWindowSize: options.throughputWindowSize || 20, // samples for throughput
      ...options
    };
    
    // Progress state
    this.startTime = null;
    this.lastUpdateTime = null;
    this.totalItems = 0;
    this.processedItems = 0;
    this.errorCount = 0;
    this.skippedItems = 0;
    
    // Performance tracking
    this.throughputHistory = [];
    this.progressHistory = [];
    this.currentPhase = 'idle';
    this.phaseStartTime = null;
    
    // Statistics
    this.stats = {
      files: {
        total: 0,
        processed: 0,
        skipped: 0,
        errors: 0
      },
      chunks: {
        total: 0,
        processed: 0,
        errors: 0
      },
      embeddings: {
        total: 0,
        generated: 0,
        errors: 0,
        batches: 0
      },
      bytes: {
        total: 0,
        processed: 0
      },
      timing: {
        discovery: 0,
        processing: 0,
        embedding: 0,
        storage: 0,
        total: 0
      }
    };
    
    // Update timer
    this.updateTimer = null;
  }

  /**
   * Start progress monitoring
   * @param {Object} config - Initial configuration
   */
  start(config = {}) {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.totalItems = config.totalItems || 0;
    this.processedItems = 0;
    this.errorCount = 0;
    this.skippedItems = 0;
    
    // Reset statistics
    this.stats = {
      files: { total: 0, processed: 0, skipped: 0, errors: 0 },
      chunks: { total: 0, processed: 0, errors: 0 },
      embeddings: { total: 0, generated: 0, errors: 0, batches: 0 },
      bytes: { total: 0, processed: 0 },
      timing: { discovery: 0, processing: 0, embedding: 0, storage: 0, total: 0 }
    };
    
    // Clear history
    this.throughputHistory = [];
    this.progressHistory = [];
    
    // Start update timer
    this._startUpdateTimer();
    
    this.emit('start', {
      startTime: this.startTime,
      totalItems: this.totalItems,
      config
    });
  }

  /**
   * Update progress with new items processed
   * @param {number} count - Number of items processed
   * @param {Object} details - Additional details
   */
  updateProgress(count, details = {}) {
    this.processedItems += count;
    
    // Update specific statistics
    if (details.files) {
      this.stats.files.processed += details.files.processed || 0;
      this.stats.files.skipped += details.files.skipped || 0;
      this.stats.files.errors += details.files.errors || 0;
    }
    
    if (details.chunks) {
      this.stats.chunks.processed += details.chunks.processed || 0;
      this.stats.chunks.errors += details.chunks.errors || 0;
    }
    
    if (details.embeddings) {
      this.stats.embeddings.generated += details.embeddings.generated || 0;
      this.stats.embeddings.errors += details.embeddings.errors || 0;
      this.stats.embeddings.batches += details.embeddings.batches || 0;
    }
    
    if (details.bytes) {
      this.stats.bytes.processed += details.bytes.processed || 0;
    }
    
    // Track errors and skips
    if (details.files) {
      this.errorCount += details.files.errors || 0;
      this.skippedItems += details.files.skipped || 0;
    } else {
      this.errorCount += details.errors || 0;
      this.skippedItems += details.skipped || 0;
    }
    
    // Update throughput history
    this._updateThroughput();
    
    this.emit('progress', this.getProgressSnapshot());
  }

  /**
   * Set total items count
   * @param {number} total - Total items to process
   */
  setTotal(total) {
    this.totalItems = total;
    this.stats.files.total = total;
    this.emit('total:updated', { total });
  }

  /**
   * Set current processing phase
   * @param {string} phase - Phase name
   * @param {Object} details - Phase details
   */
  setPhase(phase, details = {}) {
    const now = Date.now();
    
    // Record timing for previous phase
    if (this.currentPhase !== 'idle' && this.phaseStartTime) {
      const phaseDuration = now - this.phaseStartTime;
      this.stats.timing[this.currentPhase] = 
        (this.stats.timing[this.currentPhase] || 0) + phaseDuration;
    }
    
    this.currentPhase = phase;
    this.phaseStartTime = now;
    
    this.emit('phase:changed', {
      phase,
      previousPhase: this.currentPhase,
      details
    });
  }

  /**
   * Record file discovery completion
   * @param {Object} discoveryStats - Discovery statistics
   */
  recordDiscovery(discoveryStats) {
    this.stats.files.total = discoveryStats.totalFiles || 0;
    this.stats.chunks.total = discoveryStats.totalChunks || 0;
    this.stats.bytes.total = discoveryStats.totalBytes || 0;
    
    this.setTotal(this.stats.files.total);
    
    this.emit('discovery:complete', {
      files: this.stats.files.total,
      chunks: this.stats.chunks.total,
      bytes: this.stats.bytes.total,
      duration: discoveryStats.duration || 0
    });
  }

  /**
   * Record batch processing
   * @param {Object} batchStats - Batch statistics
   */
  recordBatch(batchStats) {
    this.stats.embeddings.batches++;
    this.stats.embeddings.generated += batchStats.embeddings || 0;
    this.stats.embeddings.errors += batchStats.errors || 0;
    
    this.emit('batch:processed', {
      batchSize: batchStats.size || 0,
      embeddings: batchStats.embeddings || 0,
      errors: batchStats.errors || 0,
      responseTime: batchStats.responseTime || 0,
      throughput: batchStats.throughput || 0
    });
  }

  /**
   * Complete progress monitoring
   * @param {Object} finalStats - Final statistics
   */
  complete(finalStats = {}) {
    const now = Date.now();
    
    // Record final phase timing
    if (this.currentPhase !== 'idle' && this.phaseStartTime) {
      const phaseDuration = now - this.phaseStartTime;
      this.stats.timing[this.currentPhase] = 
        (this.stats.timing[this.currentPhase] || 0) + phaseDuration;
    }
    
    this.stats.timing.total = this.startTime ? now - this.startTime : 0;
    
    // Stop update timer
    this._stopUpdateTimer();
    
    // Merge final stats
    Object.assign(this.stats, finalStats);
    
    const completionReport = this.generateCompletionReport();
    
    this.emit('complete', completionReport);
    
    return completionReport;
  }

  /**
   * Get current progress snapshot
   * @returns {Object} Progress snapshot
   */
  getProgressSnapshot() {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    const progress = this.totalItems > 0 ? (this.processedItems / this.totalItems) : 0;
    
    // Calculate ETA
    const eta = this._calculateETA();
    
    // Calculate current throughput
    const currentThroughput = this._getCurrentThroughput();
    
    return {
      progress: Math.min(progress, 1),
      percentage: Math.min(Math.round(progress * 100), 100),
      processed: this.processedItems,
      total: this.totalItems,
      remaining: Math.max(0, this.totalItems - this.processedItems),
      errors: this.errorCount,
      skipped: this.skippedItems,
      elapsed,
      eta,
      throughput: currentThroughput,
      phase: this.currentPhase,
      stats: { ...this.stats }
    };
  }

  /**
   * Generate comprehensive completion report
   * @returns {Object} Completion report
   */
  generateCompletionReport() {
    const totalDuration = this.stats.timing.total / 1000;
    const avgThroughput = this.processedItems / totalDuration;
    
    return {
      summary: {
        totalFiles: this.stats.files.total,
        processedFiles: this.stats.files.processed,
        skippedFiles: this.stats.files.skipped,
        errorFiles: this.stats.files.errors,
        totalChunks: this.stats.chunks.total,
        processedChunks: this.stats.chunks.processed,
        totalEmbeddings: this.stats.embeddings.generated,
        totalBatches: this.stats.embeddings.batches,
        totalBytes: this.stats.bytes.total,
        processedBytes: this.stats.bytes.processed
      },
      performance: {
        totalDuration,
        avgThroughput,
        filesPerSecond: this.stats.files.processed / totalDuration,
        chunksPerSecond: this.stats.chunks.processed / totalDuration,
        embeddingsPerSecond: this.stats.embeddings.generated / totalDuration,
        bytesPerSecond: this.stats.bytes.processed / totalDuration,
        avgBatchSize: this.stats.embeddings.batches > 0 
          ? this.stats.embeddings.generated / this.stats.embeddings.batches 
          : 0
      },
      timing: {
        discovery: this.stats.timing.discovery / 1000,
        processing: this.stats.timing.processing / 1000,
        embedding: this.stats.timing.embedding / 1000,
        storage: this.stats.timing.storage / 1000,
        total: totalDuration
      },
      quality: {
        successRate: this.stats.files.total > 0 
          ? (this.stats.files.processed / this.stats.files.total) * 100 
          : 0,
        errorRate: this.stats.files.total > 0 
          ? (this.stats.files.errors / this.stats.files.total) * 100 
          : 0,
        skipRate: this.stats.files.total > 0 
          ? (this.stats.files.skipped / this.stats.files.total) * 100 
          : 0
      }
    };
  }

  /**
   * Update throughput history
   * @private
   */
  _updateThroughput() {
    const now = Date.now();
    const elapsed = (now - this.lastUpdateTime) / 1000;
    
    if (elapsed > 0) {
      const throughput = this.processedItems / ((now - this.startTime) / 1000);
      
      this.throughputHistory.push({
        timestamp: now,
        throughput,
        processed: this.processedItems
      });
      
      // Keep only recent history
      if (this.throughputHistory.length > this.options.throughputWindowSize) {
        this.throughputHistory.shift();
      }
      
      this.lastUpdateTime = now;
    }
  }

  /**
   * Calculate ETA based on recent throughput
   * @returns {number} ETA in seconds
   * @private
   */
  _calculateETA() {
    if (this.throughputHistory.length < 2 || this.totalItems === 0) {
      return null;
    }
    
    // Use recent samples for ETA calculation
    const recentSamples = this.throughputHistory.slice(-this.options.etaWindowSize);
    const avgThroughput = recentSamples.reduce((sum, sample) => sum + sample.throughput, 0) / recentSamples.length;
    
    const remaining = this.totalItems - this.processedItems;
    
    if (avgThroughput > 0 && remaining > 0) {
      return remaining / avgThroughput;
    }
    
    return null;
  }

  /**
   * Get current throughput
   * @returns {number} Current throughput (items/second)
   * @private
   */
  _getCurrentThroughput() {
    if (this.throughputHistory.length === 0) {
      return 0;
    }
    
    const recentSamples = this.throughputHistory.slice(-5); // Last 5 samples
    return recentSamples.reduce((sum, sample) => sum + sample.throughput, 0) / recentSamples.length;
  }

  /**
   * Start update timer
   * @private
   */
  _startUpdateTimer() {
    this.updateTimer = setInterval(() => {
      this._updateThroughput();
      this.emit('update', this.getProgressSnapshot());
    }, this.options.updateInterval);
  }

  /**
   * Stop update timer
   * @private
   */
  _stopUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}