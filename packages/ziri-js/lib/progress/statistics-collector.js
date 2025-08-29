/**
 * Statistics Collector
 * Collects and analyzes comprehensive performance metrics and statistics
 */

export class StatisticsCollector {
  constructor(options = {}) {
    this.options = {
      collectDetailedMetrics: options.collectDetailedMetrics !== false,
      trackMemoryUsage: options.trackMemoryUsage !== false,
      trackApiMetrics: options.trackApiMetrics !== false,
      historySize: options.historySize || 1000,
      ...options
    };
    
    // Core metrics
    this.metrics = {
      files: {
        discovered: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        totalSize: 0,
        processedSize: 0,
        avgSize: 0,
        largestFile: { path: '', size: 0 },
        smallestFile: { path: '', size: Infinity }
      },
      chunks: {
        generated: 0,
        processed: 0,
        errors: 0,
        totalTokens: 0,
        avgTokensPerChunk: 0,
        avgChunksPerFile: 0
      },
      embeddings: {
        generated: 0,
        errors: 0,
        batches: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        avgBatchSize: 0,
        minBatchSize: Infinity,
        maxBatchSize: 0
      },
      api: {
        requests: 0,
        failures: 0,
        retries: 0,
        totalLatency: 0,
        avgLatency: 0,
        rateLimitHits: 0,
        timeouts: 0
      },
      memory: {
        peakUsage: 0,
        avgUsage: 0,
        samples: []
      },
      timing: {
        phases: {},
        operations: {}
      }
    };
    
    // Performance history
    this.history = {
      throughput: [],
      responseTime: [],
      batchSize: [],
      memoryUsage: [],
      errorRate: []
    };
    
    // Tracking state
    this.startTime = null;
    this.phaseStartTimes = {};
    this.operationStartTimes = {};
  }

  /**
   * Start statistics collection
   */
  start() {
    this.startTime = Date.now();
    this._resetMetrics();
    
    if (this.options.trackMemoryUsage) {
      this._startMemoryTracking();
    }
  }

  /**
   * Record file discovery
   * @param {Object} fileInfo - File information
   */
  recordFileDiscovery(fileInfo) {
    this.metrics.files.discovered++;
    this.metrics.files.totalSize += fileInfo.size;
    
    // Track file size extremes
    if (fileInfo.size > this.metrics.files.largestFile.size) {
      this.metrics.files.largestFile = { path: fileInfo.path, size: fileInfo.size };
    }
    
    if (fileInfo.size < this.metrics.files.smallestFile.size) {
      this.metrics.files.smallestFile = { path: fileInfo.path, size: fileInfo.size };
    }
    
    // Update average
    this.metrics.files.avgSize = this.metrics.files.totalSize / this.metrics.files.discovered;
  }

  /**
   * Record file processing
   * @param {Object} processingInfo - Processing information
   */
  recordFileProcessing(processingInfo) {
    if (processingInfo.success) {
      this.metrics.files.processed++;
      this.metrics.files.processedSize += processingInfo.size || 0;
      
      if (processingInfo.chunks) {
        this.metrics.chunks.generated += processingInfo.chunks;
        this.metrics.chunks.totalTokens += processingInfo.tokens || 0;
      }
    } else if (processingInfo.skipped) {
      this.metrics.files.skipped++;
    } else if (processingInfo.error) {
      this.metrics.files.errors++;
    }
    
    // Update averages
    if (this.metrics.files.processed > 0) {
      this.metrics.chunks.avgChunksPerFile = this.metrics.chunks.generated / this.metrics.files.processed;
    }
    
    if (this.metrics.chunks.generated > 0) {
      this.metrics.chunks.avgTokensPerChunk = this.metrics.chunks.totalTokens / this.metrics.chunks.generated;
    }
  }

  /**
   * Record chunk processing
   * @param {Object} chunkInfo - Chunk information
   */
  recordChunkProcessing(chunkInfo) {
    if (chunkInfo.success) {
      this.metrics.chunks.processed++;
    } else {
      this.metrics.chunks.errors++;
    }
  }

  /**
   * Record embedding batch
   * @param {Object} batchInfo - Batch information
   */
  recordEmbeddingBatch(batchInfo) {
    this.metrics.embeddings.batches++;
    
    if (batchInfo.success) {
      this.metrics.embeddings.generated += batchInfo.embeddings || 0;
      
      // Track batch size statistics
      const batchSize = batchInfo.embeddings || 0;
      this.metrics.embeddings.minBatchSize = Math.min(this.metrics.embeddings.minBatchSize, batchSize);
      this.metrics.embeddings.maxBatchSize = Math.max(this.metrics.embeddings.maxBatchSize, batchSize);
      
      // Track response time
      if (batchInfo.responseTime) {
        this.metrics.embeddings.totalResponseTime += batchInfo.responseTime;
        this.metrics.embeddings.avgResponseTime = 
          this.metrics.embeddings.totalResponseTime / this.metrics.embeddings.batches;
        
        // Add to history
        this._addToHistory('responseTime', batchInfo.responseTime);
        this._addToHistory('batchSize', batchSize);
      }
      
      // Calculate throughput
      if (batchInfo.responseTime && batchInfo.responseTime > 0) {
        const throughput = batchSize / (batchInfo.responseTime / 1000);
        this._addToHistory('throughput', throughput);
      }
    } else {
      this.metrics.embeddings.errors++;
    }
    
    // Update average batch size
    if (this.metrics.embeddings.batches > 0) {
      this.metrics.embeddings.avgBatchSize = 
        this.metrics.embeddings.generated / this.metrics.embeddings.batches;
    }
  }

  /**
   * Record API call
   * @param {Object} apiInfo - API call information
   */
  recordApiCall(apiInfo) {
    this.metrics.api.requests++;
    
    if (apiInfo.success) {
      if (apiInfo.latency) {
        this.metrics.api.totalLatency += apiInfo.latency;
        this.metrics.api.avgLatency = this.metrics.api.totalLatency / this.metrics.api.requests;
      }
    } else {
      this.metrics.api.failures++;
      
      if (apiInfo.rateLimited) {
        this.metrics.api.rateLimitHits++;
      }
      
      if (apiInfo.timeout) {
        this.metrics.api.timeouts++;
      }
      
      if (apiInfo.retry) {
        this.metrics.api.retries++;
      }
    }
  }

  /**
   * Start timing a phase
   * @param {string} phase - Phase name
   */
  startPhase(phase) {
    this.phaseStartTimes[phase] = Date.now();
  }

  /**
   * End timing a phase
   * @param {string} phase - Phase name
   */
  endPhase(phase) {
    if (this.phaseStartTimes[phase]) {
      const duration = Date.now() - this.phaseStartTimes[phase];
      this.metrics.timing.phases[phase] = (this.metrics.timing.phases[phase] || 0) + duration;
      delete this.phaseStartTimes[phase];
    }
  }

  /**
   * Start timing an operation
   * @param {string} operation - Operation name
   * @returns {string} Operation ID for ending
   */
  startOperation(operation) {
    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    this.operationStartTimes[operationId] = Date.now();
    return operationId;
  }

  /**
   * End timing an operation
   * @param {string} operationId - Operation ID
   */
  endOperation(operationId) {
    if (this.operationStartTimes[operationId]) {
      const duration = Date.now() - this.operationStartTimes[operationId];
      const operation = operationId.split('_')[0];
      
      if (!this.metrics.timing.operations[operation]) {
        this.metrics.timing.operations[operation] = {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0
        };
      }
      
      const opMetrics = this.metrics.timing.operations[operation];
      opMetrics.count++;
      opMetrics.totalTime += duration;
      opMetrics.avgTime = opMetrics.totalTime / opMetrics.count;
      opMetrics.minTime = Math.min(opMetrics.minTime, duration);
      opMetrics.maxTime = Math.max(opMetrics.maxTime, duration);
      
      delete this.operationStartTimes[operationId];
    }
  }

  /**
   * Get current statistics snapshot
   * @returns {Object} Statistics snapshot
   */
  getSnapshot() {
    const now = Date.now();
    const totalDuration = this.startTime ? (now - this.startTime) / 1000 : 0;
    
    return {
      timestamp: now,
      totalDuration,
      metrics: JSON.parse(JSON.stringify(this.metrics)),
      performance: this._calculatePerformanceMetrics(totalDuration),
      quality: this._calculateQualityMetrics(),
      efficiency: this._calculateEfficiencyMetrics()
    };
  }

  /**
   * Generate comprehensive statistics report
   * @returns {Object} Statistics report
   */
  generateReport() {
    const snapshot = this.getSnapshot();
    
    return {
      summary: this._generateSummary(snapshot),
      performance: this._generatePerformanceReport(snapshot),
      quality: this._generateQualityReport(snapshot),
      efficiency: this._generateEfficiencyReport(snapshot),
      recommendations: this._generateRecommendations(snapshot),
      rawMetrics: snapshot.metrics
    };
  }

  /**
   * Reset all metrics
   * @private
   */
  _resetMetrics() {
    // Reset counters but preserve structure
    this.metrics.files = {
      discovered: 0, processed: 0, skipped: 0, errors: 0,
      totalSize: 0, processedSize: 0, avgSize: 0,
      largestFile: { path: '', size: 0 },
      smallestFile: { path: '', size: Infinity }
    };
    
    this.metrics.chunks = {
      generated: 0, processed: 0, errors: 0,
      totalTokens: 0, avgTokensPerChunk: 0, avgChunksPerFile: 0
    };
    
    this.metrics.embeddings = {
      generated: 0, errors: 0, batches: 0,
      totalResponseTime: 0, avgResponseTime: 0, avgBatchSize: 0,
      minBatchSize: Infinity, maxBatchSize: 0
    };
    
    this.metrics.api = {
      requests: 0, failures: 0, retries: 0,
      totalLatency: 0, avgLatency: 0,
      rateLimitHits: 0, timeouts: 0
    };
    
    this.metrics.memory = {
      peakUsage: 0, avgUsage: 0, samples: []
    };
    
    this.metrics.timing = {
      phases: {},
      operations: {}
    };
    
    // Clear history
    Object.keys(this.history).forEach(key => {
      this.history[key] = [];
    });
  }

  /**
   * Add value to history
   * @param {string} metric - Metric name
   * @param {number} value - Value to add
   * @private
   */
  _addToHistory(metric, value) {
    if (!this.history[metric]) {
      this.history[metric] = [];
    }
    
    this.history[metric].push({
      timestamp: Date.now(),
      value
    });
    
    // Keep history size manageable
    if (this.history[metric].length > this.options.historySize) {
      this.history[metric].shift();
    }
  }

  /**
   * Start memory usage tracking
   * @private
   */
  _startMemoryTracking() {
    const trackMemory = () => {
      if (process.memoryUsage) {
        const usage = process.memoryUsage();
        const totalUsage = usage.heapUsed + usage.external;
        
        this.metrics.memory.samples.push(totalUsage);
        this.metrics.memory.peakUsage = Math.max(this.metrics.memory.peakUsage, totalUsage);
        
        if (this.metrics.memory.samples.length > 0) {
          this.metrics.memory.avgUsage = 
            this.metrics.memory.samples.reduce((a, b) => a + b) / this.metrics.memory.samples.length;
        }
        
        this._addToHistory('memoryUsage', totalUsage);
        
        // Keep samples manageable
        if (this.metrics.memory.samples.length > 100) {
          this.metrics.memory.samples.shift();
        }
      }
    };
    
    // Track memory every 5 seconds
    this.memoryTracker = setInterval(trackMemory, 5000);
    trackMemory(); // Initial sample
  }

  /**
   * Calculate performance metrics
   * @param {number} totalDuration - Total duration in seconds
   * @returns {Object} Performance metrics
   * @private
   */
  _calculatePerformanceMetrics(totalDuration) {
    return {
      filesPerSecond: totalDuration > 0 ? this.metrics.files.processed / totalDuration : 0,
      chunksPerSecond: totalDuration > 0 ? this.metrics.chunks.processed / totalDuration : 0,
      embeddingsPerSecond: totalDuration > 0 ? this.metrics.embeddings.generated / totalDuration : 0,
      bytesPerSecond: totalDuration > 0 ? this.metrics.files.processedSize / totalDuration : 0,
      avgThroughput: this._getAverageFromHistory('throughput'),
      peakThroughput: this._getPeakFromHistory('throughput')
    };
  }

  /**
   * Calculate quality metrics
   * @returns {Object} Quality metrics
   * @private
   */
  _calculateQualityMetrics() {
    const totalFiles = this.metrics.files.discovered;
    const successRate = totalFiles > 0 ? (this.metrics.files.processed / totalFiles) * 100 : 0;
    const errorRate = totalFiles > 0 ? (this.metrics.files.errors / totalFiles) * 100 : 0;
    const skipRate = totalFiles > 0 ? (this.metrics.files.skipped / totalFiles) * 100 : 0;
    
    return {
      successRate,
      errorRate,
      skipRate,
      apiSuccessRate: this.metrics.api.requests > 0 
        ? ((this.metrics.api.requests - this.metrics.api.failures) / this.metrics.api.requests) * 100 
        : 0,
      embeddingSuccessRate: this.metrics.embeddings.batches > 0
        ? ((this.metrics.embeddings.batches - this.metrics.embeddings.errors) / this.metrics.embeddings.batches) * 100
        : 0
    };
  }

  /**
   * Calculate efficiency metrics
   * @returns {Object} Efficiency metrics
   * @private
   */
  _calculateEfficiencyMetrics() {
    return {
      avgBatchSize: this.metrics.embeddings.avgBatchSize,
      batchEfficiency: this.metrics.embeddings.maxBatchSize > 0 
        ? (this.metrics.embeddings.avgBatchSize / this.metrics.embeddings.maxBatchSize) * 100 
        : 0,
      memoryEfficiency: this.metrics.memory.peakUsage > 0 && this.metrics.memory.avgUsage > 0
        ? (this.metrics.memory.avgUsage / this.metrics.memory.peakUsage) * 100
        : 0,
      retryRate: this.metrics.api.requests > 0 
        ? (this.metrics.api.retries / this.metrics.api.requests) * 100 
        : 0
    };
  }

  /**
   * Get average from history
   * @param {string} metric - Metric name
   * @returns {number} Average value
   * @private
   */
  _getAverageFromHistory(metric) {
    const history = this.history[metric] || [];
    if (history.length === 0) return 0;
    
    const sum = history.reduce((total, item) => total + item.value, 0);
    return sum / history.length;
  }

  /**
   * Get peak value from history
   * @param {string} metric - Metric name
   * @returns {number} Peak value
   * @private
   */
  _getPeakFromHistory(metric) {
    const history = this.history[metric] || [];
    if (history.length === 0) return 0;
    
    return Math.max(...history.map(item => item.value));
  }

  /**
   * Generate summary
   * @param {Object} snapshot - Statistics snapshot
   * @returns {Object} Summary
   * @private
   */
  _generateSummary(snapshot) {
    return {
      totalFiles: snapshot.metrics.files.discovered,
      processedFiles: snapshot.metrics.files.processed,
      totalChunks: snapshot.metrics.chunks.generated,
      totalEmbeddings: snapshot.metrics.embeddings.generated,
      totalBatches: snapshot.metrics.embeddings.batches,
      duration: snapshot.totalDuration
    };
  }

  /**
   * Generate performance report
   * @param {Object} snapshot - Statistics snapshot
   * @returns {Object} Performance report
   * @private
   */
  _generatePerformanceReport(snapshot) {
    return {
      throughput: snapshot.performance,
      timing: snapshot.metrics.timing,
      memory: {
        peak: snapshot.metrics.memory.peakUsage,
        average: snapshot.metrics.memory.avgUsage
      },
      api: {
        avgLatency: snapshot.metrics.api.avgLatency,
        successRate: snapshot.quality.apiSuccessRate
      }
    };
  }

  /**
   * Generate quality report
   * @param {Object} snapshot - Statistics snapshot
   * @returns {Object} Quality report
   * @private
   */
  _generateQualityReport(snapshot) {
    return snapshot.quality;
  }

  /**
   * Generate efficiency report
   * @param {Object} snapshot - Statistics snapshot
   * @returns {Object} Efficiency report
   * @private
   */
  _generateEfficiencyReport(snapshot) {
    return snapshot.efficiency;
  }

  /**
   * Generate recommendations based on metrics
   * @param {Object} snapshot - Statistics snapshot
   * @returns {string[]} Recommendations
   * @private
   */
  _generateRecommendations(snapshot) {
    const recommendations = [];
    
    // Performance recommendations
    if (snapshot.performance.avgThroughput < 10) {
      recommendations.push('Consider increasing concurrency level for better throughput');
    }
    
    if (snapshot.metrics.embeddings.avgResponseTime > 5000) {
      recommendations.push('API response times are high - consider reducing batch size');
    }
    
    // Quality recommendations
    if (snapshot.quality.errorRate > 5) {
      recommendations.push('High error rate detected - check file formats and API connectivity');
    }
    
    if (snapshot.quality.apiSuccessRate < 95) {
      recommendations.push('API reliability issues - consider implementing better retry logic');
    }
    
    // Efficiency recommendations
    if (snapshot.efficiency.batchEfficiency < 70) {
      recommendations.push('Batch sizes are suboptimal - enable adaptive batching');
    }
    
    if (snapshot.metrics.memory.peakUsage > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('High memory usage - consider enabling streaming mode');
    }
    
    return recommendations;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.memoryTracker) {
      clearInterval(this.memoryTracker);
      this.memoryTracker = null;
    }
  }
}