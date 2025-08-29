/**
 * Memory Optimization Tests
 * Tests for memory monitoring, checkpointing, and streaming processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryMonitor, CheckpointManager, StreamingProcessor } from '../../lib/memory/index.js';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('Memory Optimization', () => {
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ziri-memory-test-'));
  });
  
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('MemoryMonitor', () => {
    let memoryMonitor;
    
    beforeEach(() => {
      memoryMonitor = new MemoryMonitor({
        maxMemoryMB: 100,
        warningThresholdPercent: 70,
        criticalThresholdPercent: 90,
        checkIntervalMs: 100
      });
    });
    
    afterEach(() => {
      memoryMonitor.stopMonitoring();
    });

    it('should initialize with correct settings', () => {
      expect(memoryMonitor.options.maxMemoryMB).toBe(100);
      expect(memoryMonitor.maxMemoryBytes).toBe(100 * 1024 * 1024);
      expect(memoryMonitor.isMonitoring).toBe(false);
    });

    it('should start and stop monitoring', async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      
      memoryMonitor.on('monitoring:started', startSpy);
      memoryMonitor.on('monitoring:stopped', stopSpy);
      
      memoryMonitor.startMonitoring();
      expect(memoryMonitor.isMonitoring).toBe(true);
      expect(startSpy).toHaveBeenCalled();
      
      memoryMonitor.stopMonitoring();
      expect(memoryMonitor.isMonitoring).toBe(false);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should get current memory usage', () => {
      const usage = memoryMonitor.getCurrentUsage();
      
      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('external');
      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('timestamp');
      expect(typeof usage.heapUsed).toBe('number');
      expect(usage.heapUsed).toBeGreaterThan(0);
    });

    it('should calculate memory usage percentage', () => {
      const percent = memoryMonitor.getMemoryUsagePercent();
      
      expect(typeof percent).toBe('number');
      expect(percent).toBeGreaterThan(0);
      expect(percent).toBeLessThan(100); // Assuming we're not at 100% memory
    });

    it('should check if memory is within limits', () => {
      const withinLimits = memoryMonitor.isMemoryWithinLimits();
      expect(typeof withinLimits).toBe('boolean');
    });

    it('should force garbage collection if available', () => {
      // Mock global.gc
      const originalGC = global.gc;
      global.gc = vi.fn();
      
      const result = memoryMonitor.forceGC();
      
      if (global.gc) {
        expect(result).toBe(true);
        expect(global.gc).toHaveBeenCalled();
      }
      
      // Restore original
      global.gc = originalGC;
    });

    it('should emit memory events during monitoring', async () => {
      const updateSpy = vi.fn();
      memoryMonitor.on('memory:update', updateSpy);
      
      memoryMonitor.startMonitoring();
      
      // Wait for a few monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should track memory statistics', async () => {
      memoryMonitor.startMonitoring();
      
      // Wait for some monitoring
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const stats = memoryMonitor.getStats();
      
      expect(stats).toHaveProperty('currentUsage');
      expect(stats).toHaveProperty('maxMemoryBytes');
      expect(stats).toHaveProperty('usagePercent');
      expect(stats).toHaveProperty('isMonitoring');
      expect(stats.isMonitoring).toBe(true);
    });

    it('should create memory-aware buffer', () => {
      const memoryAwareStream = memoryMonitor.createMemoryAwareProcessor(() => []);
      expect(typeof memoryAwareStream).toBe('function');
    });
  });

  describe('CheckpointManager', () => {
    let checkpointManager;
    
    beforeEach(() => {
      checkpointManager = new CheckpointManager(tempDir, {
        checkpointInterval: 5,
        maxCheckpoints: 3
      });
    });

    it('should initialize checkpoint system', async () => {
      const repositoryId = 'test-repo';
      const operationType = 'indexing';
      
      await checkpointManager.initialize(repositoryId, operationType);
      
      expect(checkpointManager.currentCheckpoint).toBeTruthy();
      expect(checkpointManager.currentCheckpoint.repositoryId).toBe(repositoryId);
      expect(checkpointManager.currentCheckpoint.operationType).toBe(operationType);
    });

    it('should save and load checkpoints', async () => {
      const repositoryId = 'test-repo';
      const operationType = 'indexing';
      
      await checkpointManager.initialize(repositoryId, operationType);
      
      // Save checkpoint
      const checkpointPath = await checkpointManager.saveCheckpoint({
        customData: 'test-data'
      });
      
      expect(checkpointPath).toBeTruthy();
      
      // Load checkpoint
      const loadedCheckpoint = await checkpointManager.loadLatestCheckpoint(repositoryId, operationType);
      
      expect(loadedCheckpoint).toBeTruthy();
      expect(loadedCheckpoint.repositoryId).toBe(repositoryId);
      expect(loadedCheckpoint.customData).toBe('test-data');
    });

    it('should update progress correctly', async () => {
      const repositoryId = 'test-repo';
      await checkpointManager.initialize(repositoryId);
      
      const fileInfo = {
        path: '/test/file.js',
        hash: 'abc123'
      };
      
      checkpointManager.updateProgress(fileInfo, 5);
      
      expect(checkpointManager.processedCount).toBe(1);
      expect(checkpointManager.currentCheckpoint.processedChunks).toBe(5);
      expect(checkpointManager.currentCheckpoint.processedFiles).toHaveLength(1);
    });

    it('should detect if file was processed', async () => {
      const repositoryId = 'test-repo';
      await checkpointManager.initialize(repositoryId);
      
      const filePath = '/test/file.js';
      
      expect(checkpointManager.isFileProcessed(filePath)).toBe(false);
      
      checkpointManager.updateProgress({ path: filePath }, 1);
      
      expect(checkpointManager.isFileProcessed(filePath)).toBe(true);
    });

    it('should determine if should resume from checkpoint', async () => {
      const repositoryId = 'test-repo';
      
      // No checkpoint exists
      let resumeInfo = await checkpointManager.shouldResume(repositoryId);
      expect(resumeInfo.shouldResume).toBe(false);
      
      // Create and save checkpoint
      await checkpointManager.initialize(repositoryId);
      await checkpointManager.saveCheckpoint();
      
      // Should resume from checkpoint
      resumeInfo = await checkpointManager.shouldResume(repositoryId);
      expect(resumeInfo.shouldResume).toBe(true);
      expect(resumeInfo.checkpoint).toBeTruthy();
    });

    it('should complete operation and cleanup', async () => {
      const repositoryId = 'test-repo';
      await checkpointManager.initialize(repositoryId);
      
      checkpointManager.updateProgress({ path: '/test/file.js' }, 3);
      
      await checkpointManager.completeOperation({
        finalData: 'completed'
      });
      
      expect(checkpointManager.currentCheckpoint).toBeNull();
      expect(checkpointManager.processedCount).toBe(0);
    });

    it('should provide processing statistics', async () => {
      const repositoryId = 'test-repo';
      await checkpointManager.initialize(repositoryId);
      
      checkpointManager.updateProgress({ path: '/test/file1.js' }, 2);
      checkpointManager.updateProgress({ path: '/test/file2.js' }, 3);
      
      const stats = checkpointManager.getStats();
      
      expect(stats.repositoryId).toBe(repositoryId);
      expect(stats.processedCount).toBe(2);
      expect(stats.processedChunks).toBe(5);
      expect(stats.throughput).toBeGreaterThan(0);
    });
  });

  describe('StreamingProcessor', () => {
    let streamingProcessor;
    let checkpointManager;
    
    beforeEach(() => {
      checkpointManager = new CheckpointManager(tempDir, {
        checkpointInterval: 3
      });
      
      streamingProcessor = new StreamingProcessor({
        memoryLimitMB: 50,
        batchSize: 5,
        checkpointInterval: 3,
        checkpointManager
      });
    });
    
    afterEach(() => {
      if (streamingProcessor.memoryMonitor.isMonitoring) {
        streamingProcessor.memoryMonitor.stopMonitoring();
      }
    });

    it('should initialize with correct options', () => {
      expect(streamingProcessor.options.memoryLimitMB).toBe(50);
      expect(streamingProcessor.options.batchSize).toBe(5);
      expect(streamingProcessor.isProcessing).toBe(false);
    });

    it('should process stream with memory management', async () => {
      const testData = Array.from({ length: 15 }, (_, i) => ({
        path: `/test/file${i}.js`,
        content: `Content of file ${i}`
      }));
      
      const processorFn = vi.fn().mockImplementation(async (batch) => {
        return batch.map(item => ({
          filePath: item.path,
          chunks: 2,
          success: true
        }));
      });
      
      const results = [];
      
      for await (const result of streamingProcessor.processStream(
        testData,
        processorFn,
        { repositoryId: 'test-repo' }
      )) {
        results.push(result);
      }
      
      expect(results).toHaveLength(15);
      expect(processorFn).toHaveBeenCalled();
      expect(streamingProcessor.processedCount).toBe(15);
    });

    it('should handle batch processing correctly', async () => {
      const testData = Array.from({ length: 12 }, (_, i) => ({
        path: `/test/file${i}.js`,
        content: `Content ${i}`
      }));
      
      const batchSizes = [];
      const processorFn = vi.fn().mockImplementation(async (batch) => {
        batchSizes.push(batch.length);
        return batch.map(item => ({ filePath: item.path, success: true }));
      });
      
      const results = [];
      
      for await (const result of streamingProcessor.processStream(
        testData,
        processorFn,
        { repositoryId: 'test-repo', batchSize: 5 }
      )) {
        results.push(result);
      }
      
      // Should process in batches of 5, 5, 2
      expect(batchSizes).toEqual([5, 5, 2]);
      expect(results).toHaveLength(12);
    });

    it('should emit processing events', async () => {
      const events = [];
      
      streamingProcessor.on('processing:started', (data) => events.push({ type: 'started', data }));
      streamingProcessor.on('batch:started', (data) => events.push({ type: 'batch_started', data }));
      streamingProcessor.on('batch:completed', (data) => events.push({ type: 'batch_completed', data }));
      streamingProcessor.on('processing:completed', (data) => events.push({ type: 'completed', data }));
      
      const testData = [
        { path: '/test/file1.js' },
        { path: '/test/file2.js' }
      ];
      
      const processorFn = async (batch) => batch.map(item => ({ filePath: item.path }));
      
      const results = [];
      for await (const result of streamingProcessor.processStream(testData, processorFn)) {
        results.push(result);
      }
      
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'batch_started')).toBe(true);
      expect(events.some(e => e.type === 'batch_completed')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    it('should handle processing errors gracefully', async () => {
      const testData = [
        { path: '/test/file1.js' },
        { path: '/test/file2.js' },
        { path: '/test/file3.js' }
      ];
      
      const processorFn = vi.fn().mockImplementation(async (batch) => {
        if (batch[0].path.includes('file2')) {
          throw new Error('Processing error');
        }
        return batch.map(item => ({ filePath: item.path, success: true }));
      });
      
      const results = [];
      const errors = [];
      
      streamingProcessor.on('batch:error', (data) => errors.push(data));
      
      for await (const result of streamingProcessor.processStream(
        testData,
        processorFn,
        { batchSize: 1 }
      )) {
        results.push(result);
      }
      
      expect(errors).toHaveLength(1);
      expect(streamingProcessor.errorCount).toBe(1);
      // Should still process other items
      expect(results).toHaveLength(2);
    });

    it('should provide processing statistics', async () => {
      const testData = Array.from({ length: 8 }, (_, i) => ({
        path: `/test/file${i}.js`
      }));
      
      const processorFn = async (batch) => batch.map(item => ({ filePath: item.path }));
      
      // Start processing
      const processingPromise = (async () => {
        const results = [];
        for await (const result of streamingProcessor.processStream(testData, processorFn)) {
          results.push(result);
        }
        return results;
      })();
      
      // Check stats during processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const stats = streamingProcessor.getStats();
      
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('processedCount');
      expect(stats).toHaveProperty('errorCount');
      expect(stats).toHaveProperty('elapsed');
      expect(stats).toHaveProperty('throughput');
      expect(stats).toHaveProperty('memory');
      
      await processingPromise;
    });

    it('should pause and resume processing', () => {
      expect(streamingProcessor.isPaused).toBe(false);
      
      streamingProcessor.pause();
      expect(streamingProcessor.isPaused).toBe(true);
      
      streamingProcessor.resume();
      expect(streamingProcessor.isPaused).toBe(false);
    });
  });

  describe('Memory Stress Tests', () => {
    it('should handle large dataset without memory overflow', async () => {
      const memoryMonitor = new MemoryMonitor({
        maxMemoryMB: 100,
        warningThresholdPercent: 70,
        criticalThresholdPercent: 85
      });
      
      const checkpointManager = new CheckpointManager(tempDir);
      
      const streamingProcessor = new StreamingProcessor({
        memoryLimitMB: 100,
        batchSize: 50,
        checkpointManager,
        pauseOnMemoryPressure: true
      });
      
      // Create large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        path: `/large/file${i}.js`,
        content: 'x'.repeat(1000) // 1KB per file
      }));
      
      const processorFn = async (batch) => {
        // Simulate memory-intensive processing
        const results = [];
        for (const item of batch) {
          results.push({
            filePath: item.path,
            chunks: 3,
            embedding: new Array(100).fill(0).map(() => Math.random()),
            success: true
          });
        }
        return results;
      };
      
      const results = [];
      const memoryWarnings = [];
      
      streamingProcessor.on('memory:warning', (data) => memoryWarnings.push(data));
      
      try {
        for await (const result of streamingProcessor.processStream(
          largeDataset,
          processorFn,
          { repositoryId: 'large-repo' }
        )) {
          results.push(result);
        }
        
        expect(results).toHaveLength(1000);
        expect(streamingProcessor.processedCount).toBe(1000);
        
        // Should complete without critical memory errors
        const stats = streamingProcessor.getStats();
        expect(stats.errorCount).toBe(0);
        
      } finally {
        streamingProcessor.memoryMonitor.stopMonitoring();
      }
    }, 30000); // 30 second timeout for stress test

    it('should checkpoint progress during large operations', async () => {
      const checkpointManager = new CheckpointManager(tempDir, {
        checkpointInterval: 50
      });
      
      const streamingProcessor = new StreamingProcessor({
        batchSize: 25,
        checkpointManager
      });
      
      const largeDataset = Array.from({ length: 200 }, (_, i) => ({
        path: `/checkpoint/file${i}.js`,
        content: `Content ${i}`
      }));
      
      const processorFn = async (batch) => {
        return batch.map(item => ({
          filePath: item.path,
          chunks: 2,
          success: true
        }));
      };
      
      const checkpointsSaved = [];
      checkpointManager.on('checkpoint:saved', (data) => checkpointsSaved.push(data));
      
      const results = [];
      
      for await (const result of streamingProcessor.processStream(
        largeDataset,
        processorFn,
        { repositoryId: 'checkpoint-repo' }
      )) {
        results.push(result);
      }
      
      expect(results).toHaveLength(200);
      expect(checkpointsSaved.length).toBeGreaterThan(0);
      
      // Verify checkpoint data
      const finalStats = checkpointManager.getStats();
      expect(finalStats).toBeNull(); // Should be null after completion
    });

    it('should resume from checkpoint after interruption', async () => {
      const checkpointManager = new CheckpointManager(tempDir, {
        checkpointInterval: 30
      });
      
      const repositoryId = 'resume-test-repo';
      
      // First run - process partially
      await checkpointManager.initialize(repositoryId);
      
      const partialData = Array.from({ length: 50 }, (_, i) => ({
        path: `/resume/file${i}.js`
      }));
      
      // Simulate processing first 30 files
      for (let i = 0; i < 30; i++) {
        checkpointManager.updateProgress(partialData[i], 2);
      }
      
      await checkpointManager.saveCheckpoint();
      
      // Second run - should resume
      const resumeInfo = await checkpointManager.shouldResume(repositoryId);
      expect(resumeInfo.shouldResume).toBe(true);
      expect(resumeInfo.checkpoint.processedCount).toBe(30);
      
      // Verify processed files are tracked
      expect(checkpointManager.isFileProcessed('/resume/file0.js')).toBe(true);
      expect(checkpointManager.isFileProcessed('/resume/file29.js')).toBe(true);
      expect(checkpointManager.isFileProcessed('/resume/file30.js')).toBe(false);
    });
  });
});