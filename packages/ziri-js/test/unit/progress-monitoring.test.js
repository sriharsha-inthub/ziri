/**
 * Progress Monitoring Tests
 * Tests for progress monitoring, reporting, and statistics collection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressMonitor } from '../../lib/progress/progress-monitor.js';
import { ProgressReporter } from '../../lib/progress/progress-reporter.js';
import { StatisticsCollector } from '../../lib/progress/statistics-collector.js';
import { ProgressManager } from '../../lib/progress/progress-manager.js';

describe('ProgressMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new ProgressMonitor({
      updateInterval: 100, // Fast updates for testing
      etaWindowSize: 5,
      throughputWindowSize: 5
    });
  });

  afterEach(() => {
    monitor.cleanup?.();
  });

  describe('Basic Progress Tracking', () => {
    it('should initialize with correct default state', () => {
      expect(monitor.startTime).toBeNull();
      expect(monitor.totalItems).toBe(0);
      expect(monitor.processedItems).toBe(0);
      expect(monitor.errorCount).toBe(0);
    });

    it('should start monitoring correctly', () => {
      const config = { totalItems: 100 };
      monitor.start(config);

      expect(monitor.startTime).toBeTruthy();
      expect(monitor.totalItems).toBe(100);
      expect(monitor.processedItems).toBe(0);
    });

    it('should update progress correctly', () => {
      monitor.start({ totalItems: 100 });
      
      monitor.updateProgress(10, {
        files: { processed: 10 },
        bytes: { processed: 1024 }
      });

      const progress = monitor.getProgressSnapshot();
      expect(progress.processed).toBe(10);
      expect(progress.progress).toBe(0.1);
      expect(progress.percentage).toBe(10);
    });

    it('should track errors and skipped items', () => {
      monitor.start({ totalItems: 100 });
      
      monitor.updateProgress(5, {
        files: { processed: 3, errors: 1, skipped: 1 }
      });

      const progress = monitor.getProgressSnapshot();
      expect(progress.processed).toBe(5);
      expect(progress.errors).toBe(1);
      expect(progress.skipped).toBe(1);
    });
  });

  describe('Phase Management', () => {
    it('should track phase changes', () => {
      monitor.start();
      
      const phaseEvents = [];
      monitor.on('phase:changed', (info) => phaseEvents.push(info));
      
      monitor.setPhase('discovery', { totalFiles: 100 });
      monitor.setPhase('processing', { concurrency: 3 });
      
      expect(phaseEvents).toHaveLength(2);
      expect(phaseEvents[0].phase).toBe('discovery');
      expect(phaseEvents[1].phase).toBe('processing');
    });

    it('should track phase timing', () => {
      monitor.start();
      
      monitor.setPhase('discovery');
      // Simulate some work
      monitor.updateProgress(10);
      monitor.setPhase('processing');
      
      const progress = monitor.getProgressSnapshot();
      expect(progress.phase).toBe('processing');
    });
  });

  describe('ETA Calculation', () => {
    it('should calculate ETA based on throughput', async () => {
      monitor.start({ totalItems: 100 });
      
      // Simulate consistent progress
      for (let i = 0; i < 5; i++) {
        monitor.updateProgress(10);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const progress = monitor.getProgressSnapshot();
      expect(progress.eta).toBeTruthy();
      expect(progress.eta).toBeGreaterThan(0);
    });

    it('should return null ETA when insufficient data', () => {
      monitor.start({ totalItems: 100 });
      
      const progress = monitor.getProgressSnapshot();
      expect(progress.eta).toBeNull();
    });
  });

  describe('Completion Report', () => {
    it('should generate comprehensive completion report', async () => {
      monitor.start({ totalItems: 100 });
      
      // Add small delay to ensure timing is captured
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate processing
      monitor.recordDiscovery({
        totalFiles: 100,
        totalChunks: 500,
        totalBytes: 1024000,
        duration: 1000
      });
      
      monitor.updateProgress(100, {
        files: { processed: 95, errors: 3, skipped: 2 },
        chunks: { processed: 475 },
        bytes: { processed: 1000000 }
      });
      
      const report = monitor.complete();
      
      expect(report.summary.totalFiles).toBe(100);
      expect(report.summary.processedFiles).toBe(95);
      expect(report.summary.errorFiles).toBe(3);
      expect(report.performance.totalDuration).toBeGreaterThan(0);
      expect(report.quality.successRate).toBeCloseTo(95);
    });
  });
});

describe('ProgressReporter', () => {
  let reporter;
  let consoleSpy;

  beforeEach(() => {
    reporter = new ProgressReporter({
      showProgressBar: true,
      showThroughput: true,
      showETA: true,
      progressBarWidth: 20
    });
    
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Start Reporting', () => {
    it('should report indexing start with repository info', () => {
      reporter.reportStart({
        repositoryName: 'test-repo',
        repositoryId: 'abc123def456',
        provider: 'openai',
        config: { concurrency: 3, batchSize: 50 }
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🚀 Starting Ziri indexer'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-repo'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('abc123de'));
    });
  });

  describe('Progress Reporting', () => {
    it('should format progress line correctly', () => {
      const progress = {
        progress: 0.5,
        percentage: 50,
        processed: 50,
        total: 100,
        phase: 'processing',
        throughput: 10.5,
        eta: 30,
        errors: 2
      };

      // Mock stdout.write to capture output
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => {});
      
      reporter.reportProgress(progress);
      
      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0];
      expect(output).toContain('50%');
      expect(output).toContain('50/100');
      expect(output).toContain('10.5/s');
      expect(output).toContain('ETA: 30.0s');
      
      stdoutSpy.mockRestore();
    });

    it('should create progress bar with correct fill', () => {
      const progressBar = reporter._createProgressBar(0.75);
      expect(progressBar).toHaveLength(20);
      expect(progressBar.split('█')).toHaveLength(16); // 75% of 20 = 15 filled + 1 for split
    });
  });

  describe('Completion Reporting', () => {
    it('should report comprehensive completion statistics', () => {
      const report = {
        summary: {
          totalFiles: 1000,
          processedFiles: 950,
          skippedFiles: 45,
          errorFiles: 5,
          totalChunks: 5000,
          processedChunks: 4750,
          totalEmbeddings: 4750,
          totalBatches: 95,
          processedBytes: 10485760
        },
        performance: {
          totalDuration: 120,
          filesPerSecond: 7.9,
          chunksPerSecond: 39.6,
          embeddingsPerSecond: 39.6,
          bytesPerSecond: 87381,
          avgBatchSize: 50
        },
        timing: {
          discovery: 5,
          processing: 100,
          embedding: 10,
          storage: 5,
          total: 120
        },
        quality: {
          successRate: 95,
          errorRate: 0.5,
          skipRate: 4.5
        }
      };

      reporter.reportCompletion(report);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Indexing complete'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('950'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('7.9 files/sec'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('95.0%'));
    });
  });

  describe('Utility Functions', () => {
    it('should format duration correctly', () => {
      expect(reporter._formatDuration(30)).toBe('30.0s');
      expect(reporter._formatDuration(90)).toBe('1m 30s');
      expect(reporter._formatDuration(3665)).toBe('1h 1m');
    });

    it('should format bytes correctly', () => {
      expect(reporter._formatBytes(1024)).toBe('1.0KB');
      expect(reporter._formatBytes(1048576)).toBe('1.0MB');
      expect(reporter._formatBytes(1073741824)).toBe('1.0GB');
    });
  });
});

describe('StatisticsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new StatisticsCollector({
      collectDetailedMetrics: true,
      trackMemoryUsage: false, // Disable for testing
      historySize: 10
    });
  });

  afterEach(() => {
    collector.cleanup();
  });

  describe('File Statistics', () => {
    it('should track file discovery correctly', () => {
      collector.start();
      
      collector.recordFileDiscovery({ path: 'file1.js', size: 1024 });
      collector.recordFileDiscovery({ path: 'file2.js', size: 2048 });
      collector.recordFileDiscovery({ path: 'file3.js', size: 512 });

      const snapshot = collector.getSnapshot();
      expect(snapshot.metrics.files.discovered).toBe(3);
      expect(snapshot.metrics.files.totalSize).toBe(3584);
      expect(snapshot.metrics.files.avgSize).toBeCloseTo(1194.67, 1);
      expect(snapshot.metrics.files.largestFile.size).toBe(2048);
      expect(snapshot.metrics.files.smallestFile.size).toBe(512);
    });

    it('should track file processing results', () => {
      collector.start();
      
      collector.recordFileProcessing({ success: true, size: 1024, chunks: 5, tokens: 200 });
      collector.recordFileProcessing({ skipped: true });
      collector.recordFileProcessing({ error: true });

      const snapshot = collector.getSnapshot();
      expect(snapshot.metrics.files.processed).toBe(1);
      expect(snapshot.metrics.files.skipped).toBe(1);
      expect(snapshot.metrics.files.errors).toBe(1);
      expect(snapshot.metrics.chunks.generated).toBe(5);
      expect(snapshot.metrics.chunks.totalTokens).toBe(200);
    });
  });

  describe('Embedding Statistics', () => {
    it('should track embedding batches correctly', () => {
      collector.start();
      
      collector.recordEmbeddingBatch({
        success: true,
        embeddings: 50,
        responseTime: 2000
      });
      
      collector.recordEmbeddingBatch({
        success: true,
        embeddings: 30,
        responseTime: 1500
      });

      const snapshot = collector.getSnapshot();
      expect(snapshot.metrics.embeddings.batches).toBe(2);
      expect(snapshot.metrics.embeddings.generated).toBe(80);
      expect(snapshot.metrics.embeddings.avgResponseTime).toBe(1750);
      expect(snapshot.metrics.embeddings.avgBatchSize).toBe(40);
      expect(snapshot.metrics.embeddings.minBatchSize).toBe(30);
      expect(snapshot.metrics.embeddings.maxBatchSize).toBe(50);
    });

    it('should track embedding errors', () => {
      collector.start();
      
      collector.recordEmbeddingBatch({ success: false });
      collector.recordEmbeddingBatch({ success: true, embeddings: 25 });

      const snapshot = collector.getSnapshot();
      expect(snapshot.metrics.embeddings.errors).toBe(1);
      expect(snapshot.metrics.embeddings.generated).toBe(25);
    });
  });

  describe('API Statistics', () => {
    it('should track API calls and failures', () => {
      collector.start();
      
      collector.recordApiCall({ success: true, latency: 1000 });
      collector.recordApiCall({ success: false, rateLimited: true });
      collector.recordApiCall({ success: false, timeout: true, retry: true });

      const snapshot = collector.getSnapshot();
      expect(snapshot.metrics.api.requests).toBe(3);
      expect(snapshot.metrics.api.failures).toBe(2);
      expect(snapshot.metrics.api.rateLimitHits).toBe(1);
      expect(snapshot.metrics.api.timeouts).toBe(1);
      expect(snapshot.metrics.api.retries).toBe(1);
      expect(snapshot.metrics.api.avgLatency).toBe(1000);
    });
  });

  describe('Timing Operations', () => {
    it('should track phase timing', async () => {
      collector.start();
      
      collector.startPhase('discovery');
      await new Promise(resolve => setTimeout(resolve, 50));
      collector.endPhase('discovery');
      
      collector.startPhase('processing');
      await new Promise(resolve => setTimeout(resolve, 30));
      collector.endPhase('processing');

      const snapshot = collector.getSnapshot();
      expect(snapshot.metrics.timing.phases.discovery).toBeGreaterThan(40);
      expect(snapshot.metrics.timing.phases.processing).toBeGreaterThan(20);
    });

    it('should track operation timing', () => {
      collector.start();
      
      const opId1 = collector.startOperation('embed');
      const opId2 = collector.startOperation('embed');
      
      // Simulate different completion times
      setTimeout(() => collector.endOperation(opId1), 10);
      setTimeout(() => collector.endOperation(opId2), 20);
      
      return new Promise(resolve => {
        setTimeout(() => {
          const snapshot = collector.getSnapshot();
          const embedOp = snapshot.metrics.timing.operations.embed;
          
          expect(embedOp.count).toBe(2);
          expect(embedOp.avgTime).toBeGreaterThan(0);
          expect(embedOp.minTime).toBeLessThanOrEqual(embedOp.maxTime);
          
          resolve();
        }, 50);
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance metrics correctly', () => {
      collector.start();
      
      // Simulate 2 seconds of processing
      collector.metrics.files.processed = 100;
      collector.metrics.chunks.processed = 500;
      collector.metrics.embeddings.generated = 500;
      collector.metrics.files.processedSize = 1048576; // 1MB
      
      const snapshot = collector.getSnapshot();
      snapshot.totalDuration = 2; // 2 seconds
      
      const performance = collector._calculatePerformanceMetrics(2);
      expect(performance.filesPerSecond).toBe(50);
      expect(performance.chunksPerSecond).toBe(250);
      expect(performance.embeddingsPerSecond).toBe(250);
      expect(performance.bytesPerSecond).toBe(524288);
    });

    it('should calculate quality metrics correctly', () => {
      collector.start();
      
      collector.metrics.files.discovered = 100;
      collector.metrics.files.processed = 90;
      collector.metrics.files.errors = 5;
      collector.metrics.files.skipped = 5;
      
      const quality = collector._calculateQualityMetrics();
      expect(quality.successRate).toBe(90);
      expect(quality.errorRate).toBe(5);
      expect(quality.skipRate).toBe(5);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', () => {
      collector.start();
      
      // Add some test data
      collector.recordFileDiscovery({ path: 'test.js', size: 1024 });
      collector.recordFileProcessing({ success: true, size: 1024, chunks: 5 });
      collector.recordEmbeddingBatch({ success: true, embeddings: 5, responseTime: 1000 });
      
      const report = collector.generateReport();
      
      expect(report.summary).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.quality).toBeDefined();
      expect(report.efficiency).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.rawMetrics).toBeDefined();
    });

    it('should generate relevant recommendations', () => {
      collector.start();
      
      // Simulate high error rate
      collector.metrics.files.discovered = 100;
      collector.metrics.files.errors = 10;
      
      // Simulate slow API responses
      collector.metrics.embeddings.avgResponseTime = 6000;
      
      const snapshot = collector.getSnapshot();
      const recommendations = collector._generateRecommendations(snapshot);
      
      expect(recommendations.some(r => r.includes('error rate'))).toBe(true);
      expect(recommendations.some(r => r.includes('response times'))).toBe(true);
    });
  });
});

describe('ProgressManager Integration', () => {
  let manager;
  let consoleSpy;

  beforeEach(() => {
    manager = new ProgressManager({
      enableReporting: true,
      enableStatistics: true,
      reportingOptions: { showDetailedStats: false },
      statisticsOptions: { trackMemoryUsage: false }
    });
    
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    manager.cleanup();
    consoleSpy.mockRestore();
  });

  describe('Integration Flow', () => {
    it('should coordinate all components through complete indexing flow', async () => {
      // Start indexing
      manager.start({
        repositoryName: 'test-repo',
        repositoryId: 'abc123',
        provider: 'openai',
        options: { concurrency: 3 }
      });

      // Discovery phase
      manager.setPhase('discovery');
      manager.recordDiscovery({
        totalFiles: 100,
        totalChunks: 500,
        totalBytes: 1048576,
        duration: 1000
      });

      // Processing phase
      manager.setPhase('processing');
      
      // Simulate file processing
      for (let i = 0; i < 10; i++) {
        manager.recordFileProcessing({
          success: true,
          size: 1024,
          chunks: 5,
          tokens: 200
        });
      }

      // Embedding phase
      manager.setPhase('embedding');
      
      // Simulate batch processing
      for (let i = 0; i < 5; i++) {
        manager.recordBatch({
          batchSize: 10,
          embeddings: 10,
          responseTime: 1500,
          throughput: 6.67
        });
      }

      // Complete
      const report = manager.complete();

      expect(report).toBeDefined();
      expect(report.summary.processedFiles).toBe(10);
      expect(report.summary.totalEmbeddings).toBe(50);
      expect(report.performance).toBeDefined();
      expect(report.detailedStats).toBeDefined();
    });

    it('should handle errors gracefully', () => {
      manager.start({ repositoryName: 'test-repo' });
      
      const error = new Error('Test error');
      manager.recordError(error, { file: 'test.js', phase: 'processing' });
      
      const progress = manager.getProgress();
      expect(progress.errors).toBe(1);
    });

    it('should provide scoped tracking', () => {
      manager.start();
      
      const tracker = manager.createScopedTracker('file-processing');
      
      tracker.start();
      tracker.recordProgress(1, { files: { processed: 1 } });
      tracker.end();
      
      const progress = manager.getProgress();
      expect(progress.processed).toBe(1);
    });
  });

  describe('Real-time Updates', () => {
    it('should emit progress events', async () => {
      manager.start({ totalItems: 100 });
      
      return new Promise((resolve) => {
        manager.monitor.on('progress', (progress) => {
          expect(progress.processed).toBeGreaterThan(0);
          resolve();
        });
        
        manager.recordFileProcessing({ success: true });
      });
    });

    it('should provide current progress snapshot', () => {
      manager.start({ totalItems: 100 });
      manager.recordFileProcessing({ success: true });
      
      const progress = manager.getProgress();
      expect(progress.processed).toBe(1);
      expect(progress.total).toBe(100);
      expect(progress.percentage).toBe(1);
    });
  });

  describe('Data Export', () => {
    it('should export progress data for analysis', () => {
      manager.start({ repositoryName: 'test-repo' });
      manager.recordFileProcessing({ success: true });
      
      const exportData = manager.exportData();
      
      expect(exportData.timestamp).toBeDefined();
      expect(exportData.progress).toBeDefined();
      expect(exportData.statistics).toBeDefined();
      expect(exportData.isActive).toBe(true);
    });
  });
});