/**
 * Progress Reporter
 * Handles display and formatting of progress information with detailed statistics
 */

export class ProgressReporter {
  constructor(options = {}) {
    this.options = {
      showProgressBar: options.showProgressBar !== false,
      showThroughput: options.showThroughput !== false,
      showETA: options.showETA !== false,
      showPhase: options.showPhase !== false,
      showDetailedStats: options.showDetailedStats !== false,
      progressBarWidth: options.progressBarWidth || 40,
      updateInterval: options.updateInterval || 1000,
      ...options
    };
    
    this.lastOutput = '';
    this.startTime = null;
  }

  /**
   * Start indexing progress reporting
   * @param {Object} data - Indexing start data
   */
  startIndexing(data) {
    this.startTime = Date.now();
    console.log(`🚀 Starting indexing for repository: ${data.repositoryId?.slice(0, 8)}...`);
    console.log(`🤖 Provider: ${data.provider}`);
    console.log(`💾 Memory limit: ${data.memoryLimitMB}MB`);
  }

  /**
   * Start update progress reporting
   * @param {Object} data - Update start data
   */
  startUpdate(data) {
    this.startTime = Date.now();
    console.log(`🔄 Starting incremental update for: ${data.repositoryId?.slice(0, 8)}...`);
  }

  /**
   * Report file processing progress
   * @param {Object} data - File progress data
   */
  reportFileProgress(data) {
    if (data.totalProcessed % 10 === 0 || data.success === false) {
      const status = data.success ? '✅' : '❌';
      const chunks = data.chunks ? ` (${data.chunks} chunks)` : '';
      console.log(`${status} ${data.filePath}${chunks}`);
    }
  }

  /**
   * Complete indexing progress reporting
   * @param {Object} data - Indexing completion data
   */
  completeIndexing(data) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`✅ Indexing completed in ${duration}s`);
    console.log(`📊 Processed: ${data.totalProcessed} files, ${data.totalChunks} chunks`);
    if (data.memoryStats) {
      console.log(`💾 Peak memory: ${(data.memoryStats.peakUsage / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  /**
   * Complete update progress reporting
   * @param {Object} data - Update completion data
   */
  completeUpdate(data) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`✅ Update completed in ${duration}s`);
    console.log(`📊 Changed: ${data.changes} files, Deleted: ${data.deleted} files`);
  }

  /**
   * Report indexing start
   * @param {Object} info - Repository and configuration info
   */
  reportStart(info) {
    this.startTime = Date.now();
    
    console.log('\n🚀 Starting Ziri indexer...');
    console.log(`📁 Repository: ${info.repositoryName || 'Unknown'}`);
    console.log(`🆔 Repo ID: ${info.repositoryId?.slice(0, 8)}...`);
    console.log(`🤖 Provider: ${info.provider || 'Unknown'}`);
    
    if (info.config) {
      console.log(`⚙️  Configuration:`);
      console.log(`   • Concurrency: ${info.config.concurrency || 'default'}`);
      console.log(`   • Batch size: ${info.config.batchSize || 'adaptive'}`);
      console.log(`   • Memory limit: ${info.config.memoryLimit || 'default'}`);
    }
    
    console.log('');
  }

  /**
   * Report discovery phase completion
   * @param {Object} discoveryStats - Discovery statistics
   */
  reportDiscovery(discoveryStats) {
    console.log(`📊 Discovery complete:`);
    console.log(`   • Files found: ${discoveryStats.files.toLocaleString()}`);
    console.log(`   • Total chunks: ${discoveryStats.chunks.toLocaleString()}`);
    console.log(`   • Total size: ${this._formatBytes(discoveryStats.bytes)}`);
    console.log(`   • Discovery time: ${this._formatDuration(discoveryStats.duration)}`);
    console.log('');
  }

  /**
   * Report real-time progress
   * @param {Object} progress - Progress snapshot
   */
  reportProgress(progress) {
    if (!this.options.showProgressBar) return;
    
    const output = this._formatProgressLine(progress);
    
    // Only update if output changed to reduce flicker
    if (output !== this.lastOutput) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear line
      process.stdout.write(output);
      this.lastOutput = output;
    }
  }

  /**
   * Report batch processing
   * @param {Object} batchInfo - Batch processing information
   */
  reportBatch(batchInfo) {
    if (this.options.showDetailedStats) {
      const throughput = batchInfo.throughput ? ` (${batchInfo.throughput.toFixed(1)}/s)` : '';
      const timing = batchInfo.responseTime ? ` in ${batchInfo.responseTime}ms` : '';
      
      console.log(`\n  🔄 Batch: ${batchInfo.batchSize} chunks → ${batchInfo.embeddings} embeddings${throughput}${timing}`);
    }
  }

  /**
   * Report phase change
   * @param {Object} phaseInfo - Phase change information
   */
  reportPhaseChange(phaseInfo) {
    if (this.options.showPhase) {
      const phaseEmoji = this._getPhaseEmoji(phaseInfo.phase);
      console.log(`\n${phaseEmoji} ${this._formatPhase(phaseInfo.phase)}`);
    }
  }

  /**
   * Report completion with comprehensive statistics
   * @param {Object} report - Completion report
   */
  reportCompletion(report) {
    console.log('\n\n✅ Indexing complete!\n');
    
    // Summary section
    console.log('📊 Summary:');
    console.log(`   📁 Files processed: ${report.summary.processedFiles.toLocaleString()}`);
    console.log(`   ⏭️  Files skipped: ${report.summary.skippedFiles.toLocaleString()} (unchanged)`);
    if (report.summary.errorFiles > 0) {
      console.log(`   ❌ Files with errors: ${report.summary.errorFiles.toLocaleString()}`);
    }
    console.log(`   🧩 Total chunks: ${report.summary.processedChunks.toLocaleString()}`);
    console.log(`   🎯 Vector embeddings: ${report.summary.totalEmbeddings.toLocaleString()}`);
    console.log(`   📦 Total size: ${this._formatBytes(report.summary.processedBytes)}`);
    console.log('');
    
    // Performance section
    console.log('⚡ Performance:');
    console.log(`   ⏱️  Total duration: ${this._formatDuration(report.performance.totalDuration)}`);
    console.log(`   🚀 Processing rate: ${report.performance.filesPerSecond.toFixed(1)} files/sec`);
    console.log(`   🧩 Chunk rate: ${report.performance.chunksPerSecond.toFixed(1)} chunks/sec`);
    console.log(`   🎯 Embedding rate: ${report.performance.embeddingsPerSecond.toFixed(1)} embeddings/sec`);
    console.log(`   📊 Throughput: ${this._formatBytes(report.performance.bytesPerSecond)}/sec`);
    console.log(`   📦 Avg batch size: ${report.performance.avgBatchSize.toFixed(1)} embeddings`);
    console.log('');
    
    // Timing breakdown
    if (report.timing.discovery > 0 || report.timing.processing > 0) {
      console.log('⏰ Timing breakdown:');
      if (report.timing.discovery > 0) {
        console.log(`   🔍 Discovery: ${this._formatDuration(report.timing.discovery)} (${this._getPercentage(report.timing.discovery, report.timing.total)}%)`);
      }
      if (report.timing.processing > 0) {
        console.log(`   ⚙️  Processing: ${this._formatDuration(report.timing.processing)} (${this._getPercentage(report.timing.processing, report.timing.total)}%)`);
      }
      if (report.timing.embedding > 0) {
        console.log(`   🤖 Embedding: ${this._formatDuration(report.timing.embedding)} (${this._getPercentage(report.timing.embedding, report.timing.total)}%)`);
      }
      if (report.timing.storage > 0) {
        console.log(`   💾 Storage: ${this._formatDuration(report.timing.storage)} (${this._getPercentage(report.timing.storage, report.timing.total)}%)`);
      }
      console.log('');
    }
    
    // Quality metrics
    console.log('📈 Quality metrics:');
    console.log(`   ✅ Success rate: ${report.quality.successRate.toFixed(1)}%`);
    if (report.quality.errorRate > 0) {
      console.log(`   ❌ Error rate: ${report.quality.errorRate.toFixed(1)}%`);
    }
    if (report.quality.skipRate > 0) {
      console.log(`   ⏭️  Skip rate: ${report.quality.skipRate.toFixed(1)}%`);
    }
    console.log('');
    
    // Next steps
    if (report.summary.totalEmbeddings > 0) {
      console.log('🎯 Ready to query! Try:');
      console.log('   ziri query "your search terms"');
    }
  }

  /**
   * Report error with context
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  reportError(error, context = {}) {
    console.log(`\n❌ Error: ${error.message}`);
    
    if (context.file) {
      console.log(`   📄 File: ${context.file}`);
    }
    
    if (context.phase) {
      console.log(`   🔄 Phase: ${context.phase}`);
    }
    
    if (context.suggestion) {
      console.log(`   💡 Suggestion: ${context.suggestion}`);
    }
    
    console.log('');
  }

  /**
   * Format progress line with all information
   * @param {Object} progress - Progress data
   * @returns {string} Formatted progress line
   * @private
   */
  _formatProgressLine(progress) {
    let line = '';
    
    // Progress bar
    if (this.options.showProgressBar) {
      const progressBar = this._createProgressBar(progress.progress);
      line += `[${progressBar}] ${progress.percentage}%`;
    }
    
    // Current stats
    line += ` | ${progress.processed.toLocaleString()}`;
    if (progress.total > 0) {
      line += `/${progress.total.toLocaleString()}`;
    }
    
    // Phase
    if (this.options.showPhase && progress.phase !== 'idle') {
      line += ` | ${this._formatPhase(progress.phase)}`;
    }
    
    // Throughput
    if (this.options.showThroughput && progress.throughput > 0) {
      line += ` | ${progress.throughput.toFixed(1)}/s`;
    }
    
    // ETA
    if (this.options.showETA && progress.eta !== null && progress.eta > 0) {
      line += ` | ETA: ${this._formatDuration(progress.eta)}`;
    }
    
    // Errors
    if (progress.errors > 0) {
      line += ` | ❌ ${progress.errors}`;
    }
    
    return line;
  }

  /**
   * Create progress bar string
   * @param {number} progress - Progress ratio (0-1)
   * @returns {string} Progress bar
   * @private
   */
  _createProgressBar(progress) {
    const width = this.options.progressBarWidth;
    const filled = Math.round(progress * width);
    const empty = width - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Format phase name for display
   * @param {string} phase - Phase name
   * @returns {string} Formatted phase
   * @private
   */
  _formatPhase(phase) {
    const phaseNames = {
      discovery: 'Discovering files',
      processing: 'Processing files',
      embedding: 'Generating embeddings',
      storage: 'Storing vectors',
      summary: 'Generating summary',
      cleanup: 'Cleaning up'
    };
    
    return phaseNames[phase] || phase;
  }

  /**
   * Get emoji for phase
   * @param {string} phase - Phase name
   * @returns {string} Phase emoji
   * @private
   */
  _getPhaseEmoji(phase) {
    const phaseEmojis = {
      discovery: '🔍',
      processing: '⚙️',
      embedding: '🤖',
      storage: '💾',
      summary: '📝',
      cleanup: '🧹'
    };
    
    return phaseEmojis[phase] || '⚡';
  }

  /**
   * Format duration in human-readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   * @private
   */
  _formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Format bytes in human-readable format
   * @param {number} bytes - Bytes
   * @returns {string} Formatted bytes
   * @private
   */
  _formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }

  /**
   * Calculate percentage
   * @param {number} value - Value
   * @param {number} total - Total
   * @returns {number} Percentage
   * @private
   */
  _getPercentage(value, total) {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }
}