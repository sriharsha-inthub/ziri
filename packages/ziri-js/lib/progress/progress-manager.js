/**
 * Progress Manager
 * Coordinates progress monitoring, reporting, and statistics collection
 */

import { EventEmitter } from 'events';
import { ProgressMonitor } from './progress-monitor.js';
import { ProgressReporter } from './progress-reporter.js';
import { StatisticsCollector } from './statistics-collector.js';

export class ProgressManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableReporting: options.enableReporting !== false,
      enableStatistics: options.enableStatistics !== false,
      reportingOptions: options.reportingOptions || {},
      statisticsOptions: options.statisticsOptions || {},
      monitorOptions: options.monitorOptions || {},
      ...options
    };
    
    // Initialize components
    this.monitor = new ProgressMonitor(this.options.monitorOptions);
    this.reporter = this.options.enableReporting 
      ? new ProgressReporter(this.options.reportingOptions) 
      : null;
    this.statistics = this.options.enableStatistics 
      ? new StatisticsCollector(this.options.statisticsOptions) 
      : null;
    
    // Bind event handlers
    this._setupEventHandlers();
    
    // State
    this.isActive = false;
    this.currentPhase = 'idle';
  }

  /**
   * Start progress monitoring for indexing operation
   * @param {Object} config - Indexing configuration
   */
  start(config = {}) {
    this.isActive = true;
    
    // Start components
    this.monitor.start(config);
    if (this.statistics) {
      this.statistics.start();
    }
    
    // Report start
    if (this.reporter) {
      this.reporter.reportStart({
        repositoryName: config.repositoryName,
        repositoryId: config.repositoryId,
        provider: config.provider,
        config: config.options
      });
    }
  }

  /**
   * Set the current processing phase
   * @param {string} phase - Phase name
   * @param {Object} details - Phase details
   */
  setPhase(phase, details = {}) {
    this.currentPhase = phase;
    
    // Update monitor
    this.monitor.setPhase(phase, details);
    
    // Update statistics
    if (this.statistics) {
      if (this.currentPhase !== 'idle') {
        this.statistics.endPhase(this.currentPhase);
      }
      this.statistics.startPhase(phase);
    }
    
    // Report phase change
    if (this.reporter) {
      this.reporter.reportPhaseChange({ phase, details });
    }
  }

  /**
   * Record file discovery completion
   * @param {Object} discoveryStats - Discovery statistics
   */
  recordDiscovery(discoveryStats) {
    // Update monitor
    this.monitor.recordDiscovery(discoveryStats);
    
    // Update statistics
    if (this.statistics) {
      for (let i = 0; i < discoveryStats.totalFiles; i++) {
        this.statistics.recordFileDiscovery({
          path: `file_${i}`,
          size: discoveryStats.totalBytes / discoveryStats.totalFiles
        });
      }
    }
    
    // Report discovery
    if (this.reporter) {
      this.reporter.reportDiscovery({
        files: discoveryStats.totalFiles,
        chunks: discoveryStats.totalChunks,
        bytes: discoveryStats.totalBytes,
        duration: discoveryStats.duration
      });
    }
  }

  /**
   * Record file processing
   * @param {Object} fileInfo - File processing information
   */
  recordFileProcessing(fileInfo) {
    // Update monitor
    this.monitor.updateProgress(1, {
      files: { processed: fileInfo.success ? 1 : 0, skipped: fileInfo.skipped ? 1 : 0, errors: fileInfo.error ? 1 : 0 },
      chunks: { processed: fileInfo.chunks || 0 },
      bytes: { processed: fileInfo.size || 0 }
    });
    
    // Update statistics
    if (this.statistics) {
      this.statistics.recordFileProcessing({
        success: fileInfo.success,
        skipped: fileInfo.skipped,
        error: fileInfo.error,
        size: fileInfo.size,
        chunks: fileInfo.chunks,
        tokens: fileInfo.tokens
      });
    }
  }

  /**
   * Record embedding batch processing
   * @param {Object} batchInfo - Batch processing information
   */
  recordBatch(batchInfo) {
    // Update monitor
    this.monitor.recordBatch({
      size: batchInfo.batchSize,
      embeddings: batchInfo.embeddings,
      errors: batchInfo.errors,
      responseTime: batchInfo.responseTime,
      throughput: batchInfo.throughput
    });
    
    // Update statistics
    if (this.statistics) {
      this.statistics.recordEmbeddingBatch({
        success: !batchInfo.error,
        embeddings: batchInfo.embeddings,
        responseTime: batchInfo.responseTime,
        error: batchInfo.error
      });
      
      // Record API call
      this.statistics.recordApiCall({
        success: !batchInfo.error,
        latency: batchInfo.responseTime,
        rateLimited: batchInfo.rateLimited,
        timeout: batchInfo.timeout,
        retry: batchInfo.retry
      });
    }
    
    // Report batch
    if (this.reporter) {
      this.reporter.reportBatch({
        batchSize: batchInfo.batchSize,
        embeddings: batchInfo.embeddings,
        errors: batchInfo.errors,
        responseTime: batchInfo.responseTime,
        throughput: batchInfo.throughput
      });
    }
  }

  /**
   * Record API retry
   * @param {Object} retryInfo - Retry information
   */
  recordRetry(retryInfo) {
    if (this.statistics) {
      this.statistics.recordApiCall({
        success: false,
        retry: true,
        rateLimited: retryInfo.rateLimited,
        timeout: retryInfo.timeout
      });
    }
  }

  /**
   * Record error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  recordError(error, context = {}) {
    // Update monitor
    this.monitor.updateProgress(0, { errors: 1 });
    
    // Report error
    if (this.reporter) {
      this.reporter.reportError(error, context);
    }
  }

  /**
   * Complete progress monitoring
   * @param {Object} finalStats - Final statistics
   * @returns {Object} Completion report
   */
  complete(finalStats = {}) {
    this.isActive = false;
    
    // End current phase
    if (this.statistics && this.currentPhase !== 'idle') {
      this.statistics.endPhase(this.currentPhase);
    }
    
    // Complete monitor
    const monitorReport = this.monitor.complete(finalStats);
    
    // Generate statistics report
    let statisticsReport = null;
    if (this.statistics) {
      statisticsReport = this.statistics.generateReport();
      this.statistics.cleanup();
    }
    
    // Combine reports
    const completionReport = this._combineReports(monitorReport, statisticsReport);
    
    // Report completion
    if (this.reporter) {
      this.reporter.reportCompletion(completionReport);
    }
    
    return completionReport;
  }

  /**
   * Get current progress snapshot
   * @returns {Object} Progress snapshot
   */
  getProgress() {
    const progress = this.monitor.getProgressSnapshot();
    
    if (this.statistics) {
      const stats = this.statistics.getSnapshot();
      progress.detailedStats = stats;
    }
    
    return progress;
  }

  /**
   * Setup event handlers for components
   * @private
   */
  _setupEventHandlers() {
    // Monitor events
    this.monitor.on('progress', (progress) => {
      if (this.reporter) {
        this.reporter.reportProgress(progress);
      }
    });
    
    this.monitor.on('phase:changed', (phaseInfo) => {
      this.currentPhase = phaseInfo.phase;
    });
    
    // Forward monitor events
    this.monitor.on('start', (info) => this.emit('start', info));
    this.monitor.on('complete', (report) => this.emit('complete', report));
    this.monitor.on('update', (progress) => this.emit('update', progress));
  }

  /**
   * Combine monitor and statistics reports
   * @param {Object} monitorReport - Monitor report
   * @param {Object} statisticsReport - Statistics report
   * @returns {Object} Combined report
   * @private
   */
  _combineReports(monitorReport, statisticsReport) {
    const combined = { ...monitorReport };
    
    if (statisticsReport) {
      // Merge performance metrics
      combined.performance = {
        ...combined.performance,
        ...statisticsReport.performance.throughput,
        timing: statisticsReport.performance.timing,
        memory: statisticsReport.performance.memory,
        api: statisticsReport.performance.api
      };
      
      // Add detailed statistics
      combined.detailedStats = {
        quality: statisticsReport.quality,
        efficiency: statisticsReport.efficiency,
        recommendations: statisticsReport.recommendations,
        rawMetrics: statisticsReport.rawMetrics
      };
    }
    
    return combined;
  }

  /**
   * Create a scoped progress tracker for a specific operation
   * @param {string} operation - Operation name
   * @returns {Object} Scoped tracker
   */
  createScopedTracker(operation) {
    let operationId = null;
    
    return {
      start: () => {
        if (this.statistics) {
          operationId = this.statistics.startOperation(operation);
        }
      },
      
      end: () => {
        if (this.statistics && operationId) {
          this.statistics.endOperation(operationId);
          operationId = null;
        }
      },
      
      recordProgress: (count, details) => {
        this.monitor.updateProgress(count, details);
      },
      
      recordError: (error, context) => {
        this.recordError(error, { ...context, operation });
      }
    };
  }

  /**
   * Get performance recommendations
   * @returns {string[]} Recommendations
   */
  getRecommendations() {
    if (!this.statistics) {
      return [];
    }
    
    const snapshot = this.statistics.getSnapshot();
    return this.statistics._generateRecommendations(snapshot);
  }

  /**
   * Export progress data for analysis
   * @returns {Object} Exportable progress data
   */
  exportData() {
    const progress = this.getProgress();
    
    return {
      timestamp: Date.now(),
      progress: progress,
      statistics: this.statistics ? this.statistics.getSnapshot() : null,
      isActive: this.isActive,
      currentPhase: this.currentPhase
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isActive = false;
    
    if (this.statistics) {
      this.statistics.cleanup();
    }
    
    // Remove all listeners
    this.monitor.removeAllListeners();
  }
}

// Re-export components for direct use
export { ProgressMonitor } from './progress-monitor.js';
export { ProgressReporter } from './progress-reporter.js';
export { StatisticsCollector } from './statistics-collector.js';