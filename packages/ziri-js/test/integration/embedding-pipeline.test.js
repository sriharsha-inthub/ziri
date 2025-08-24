/**
 * Embedding Pipeline Performance Tests
 * Tests for concurrent embedding pipeline throughput optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingPipeline, EmbeddingBatcher, ConcurrencyManager } from '../../lib/embedding/embedding-pipeline.js';

// Mock embedding client
class MockEmbeddingClient {
  constructor(options = {}) {
    this.defaultProvider = 'mock';
    this.responseTime = options.responseTime || 100;
    this.failureRate = options.failureRate || 0;
    this.callCount = 0;
    this.embedCalls = [];
  }

  async embed(texts, providerType = null) {
    this.callCount++;
    this.embedCalls.push({ texts: texts.slice(), providerType, timestamp: Date.now() });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, this.responseTime));
    
    // Simulate failures
    if (Math.random() < this.failureRate) {
      const error = new Error('Mock API failure');
      error.status = 500;
      throw error;
    }
    
    // Return mock embeddings
    return texts.map(() => Array(384).fill(0).map(() => Math.random()));
  }

  getProviderLimits(providerType) {
    return {
      maxTokensPerRequest: 8000,
      maxRequestsPerMinute: 1000,
      maxTokensPerMinute: 1000000,
      recommendedBatchSize: 50,
      embeddingDimensions: 384,
      supportedModels: ['mock-model']
    };
  }
}

// Helper to create mock text chunks
function createMockChunks(count, contentLength = 100) {
  const chunks = [];
  for (let i = 0; i < count; i++) {
    chunks.push({
      id: `chunk_${i}`,
      content: 'x'.repeat(contentLength),
      filePath: `file_${Math.floor(i / 10)}.js`,
      startLine: i * 10,
      endLine: (i + 1) * 10
    });
  }
  return chunks;
}

// Helper to create async iterable from array
async function* createAsyncIterable(items) {
  for (const item of items) {
    yield item;
  }
}

describe('EmbeddingPipeline', () => {
  let mockClient;
  let pipeline;

  beforeEach(() => {
    mockClient = new MockEmbeddingClient();
    pipeline = new EmbeddingPipeline(mockClient, {
      concurrency: 2,
      initialBatchSize: 10,
      adaptiveBatching: true,
      targetResponseTime: 200
    });
  });

  afterEach(() => {
    pipeline.removeAllListeners();
  });

  describe('Basic Processing', () => {
    it('should process chunks and return embedded results', async () => {
      const chunks = createMockChunks(5);
      const results = [];
      
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('embedding');
      expect(results[0]).toHaveProperty('provider', 'mock');
      expect(results[0]).toHaveProperty('embeddedAt');
      expect(mockClient.callCount).toBeGreaterThan(0);
    });

    it('should handle empty chunk stream', async () => {
      const results = [];
      
      for await (const result of pipeline.processChunks(createAsyncIterable([]))) {
        results.push(result);
      }
      
      expect(results).toHaveLength(0);
      expect(mockClient.callCount).toBe(0);
    });

    it('should preserve chunk metadata', async () => {
      const chunks = createMockChunks(3);
      chunks[0].customField = 'test-value';
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      const firstResult = results.find(r => r.id === 'chunk_0');
      expect(firstResult).toHaveProperty('customField', 'test-value');
      expect(firstResult).toHaveProperty('filePath', 'file_0.js');
    });
  });

  describe('Concurrency Management', () => {
    it('should respect concurrency limits', async () => {
      const chunks = createMockChunks(50);
      mockClient.responseTime = 200; // Slower responses to test concurrency
      
      const startTime = Date.now();
      const results = [];
      
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(50);
      // With concurrency=2 and batches, should be faster than sequential
      expect(duration).toBeLessThan(50 * mockClient.responseTime * 0.8);
    });

    it('should handle concurrent batch processing', async () => {
      // Create a pipeline with smaller batch size to force multiple batches
      const concurrentPipeline = new EmbeddingPipeline(mockClient, {
        concurrency: 2,
        initialBatchSize: 5, // Small batch size
        adaptiveBatching: false // Disable to keep consistent batch size
      });
      
      const chunks = createMockChunks(20); // 20 chunks with batch size 5 = 4 batches
      let maxConcurrentCalls = 0;
      let currentConcurrentCalls = 0;
      
      const originalEmbed = mockClient.embed.bind(mockClient);
      mockClient.embed = async function(texts, providerType) {
        currentConcurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, currentConcurrentCalls);
        
        try {
          // Add delay to ensure concurrency is visible
          await new Promise(resolve => setTimeout(resolve, 100));
          return await originalEmbed(texts, providerType);
        } finally {
          currentConcurrentCalls--;
        }
      };
      
      const results = [];
      for await (const result of concurrentPipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(results).toHaveLength(20);
      expect(maxConcurrentCalls).toBeGreaterThan(1);
      expect(maxConcurrentCalls).toBeLessThanOrEqual(2); // Respects concurrency limit
    });
  });

  describe('Adaptive Batching', () => {
    it('should decrease batch size for slow responses', async () => {
      mockClient.responseTime = 500; // Slow responses
      pipeline.options.targetResponseTime = 200;
      
      const chunks = createMockChunks(50); // Fewer chunks for faster test
      const batchSizeChanges = [];
      
      pipeline.on('batch:size:decreased', (event) => {
        batchSizeChanges.push(event);
      });
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(results).toHaveLength(50);
      expect(batchSizeChanges.length).toBeGreaterThan(0);
      expect(batchSizeChanges[0].reason).toBe('slow_response');
    }, 10000); // Increase timeout

    it('should increase batch size for fast responses', async () => {
      mockClient.responseTime = 50; // Fast responses
      pipeline.options.targetResponseTime = 200;
      
      const chunks = createMockChunks(100);
      const batchSizeChanges = [];
      
      pipeline.on('batch:size:increased', (event) => {
        batchSizeChanges.push(event);
      });
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(results).toHaveLength(100);
      expect(batchSizeChanges.length).toBeGreaterThan(0);
      expect(batchSizeChanges[0].reason).toBe('fast_response');
    });

    it('should respect min and max batch size limits', async () => {
      pipeline.options.minBatchSize = 5;
      pipeline.options.maxBatchSize = 20;
      mockClient.responseTime = 1000; // Very slow to trigger decreases
      
      const chunks = createMockChunks(30); // Fewer chunks for faster test
      const results = [];
      
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(pipeline.currentBatchSize).toBeGreaterThanOrEqual(5);
      expect(pipeline.currentBatchSize).toBeLessThanOrEqual(20);
    }, 10000); // Increase timeout
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed requests', async () => {
      mockClient.failureRate = 0.8; // Higher failure rate to ensure retries
      pipeline.options.maxRetries = 2;
      
      const chunks = createMockChunks(5); // Fewer chunks
      const retryEvents = [];
      
      pipeline.on('retry', (event) => {
        retryEvents.push(event);
      });
      
      const results = [];
      try {
        for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
          results.push(result);
        }
      } catch (error) {
        // Some failures are expected with high failure rate
      }
      
      // Should have attempted retries
      expect(retryEvents.length).toBeGreaterThan(0);
    });

    it('should handle rate limit errors with increased delay', async () => {
      let callCount = 0;
      mockClient.embed = async function(texts) {
        callCount++;
        if (callCount <= 1) { // Fail only once to speed up test
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        return texts.map(() => Array(384).fill(0).map(() => Math.random()));
      };
      
      const chunks = createMockChunks(3); // Fewer chunks
      const retryEvents = [];
      
      pipeline.on('retry', (event) => {
        retryEvents.push(event);
      });
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(results).toHaveLength(3);
      expect(retryEvents.length).toBeGreaterThan(0);
      // Rate limit retries should have longer delays
      expect(retryEvents.some(e => e.delay > 1000)).toBe(true);
    }, 10000); // Increase timeout

    it('should continue processing other batches when one fails', async () => {
      let callCount = 0;
      mockClient.embed = async function(texts) {
        callCount++;
        // Fail the second batch only
        if (callCount === 2) {
          throw new Error('Permanent failure');
        }
        return texts.map(() => Array(384).fill(0).map(() => Math.random()));
      };
      
      pipeline.options.maxRetries = 0; // No retries for this test
      
      const chunks = createMockChunks(30); // Should create multiple batches
      const errorEvents = [];
      
      pipeline.on('batch:error', (event) => {
        errorEvents.push(event);
      });
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      // Should have some results despite one batch failing
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(30);
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should emit progress events', async () => {
      const chunks = createMockChunks(50);
      const progressEvents = [];
      
      pipeline.on('progress', (event) => {
        progressEvents.push(event);
      });
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('processed');
      expect(progressEvents[0]).toHaveProperty('throughput');
      expect(progressEvents[0]).toHaveProperty('currentBatchSize');
    });

    it('should emit pipeline start and complete events', async () => {
      const chunks = createMockChunks(10);
      let startEvent = null;
      let completeEvent = null;
      
      pipeline.on('pipeline:start', (event) => {
        startEvent = event;
      });
      
      pipeline.on('pipeline:complete', (event) => {
        completeEvent = event;
      });
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      expect(startEvent).toBeTruthy();
      expect(startEvent).toHaveProperty('provider', 'mock');
      expect(startEvent).toHaveProperty('concurrency', 2);
      
      expect(completeEvent).toBeTruthy();
      expect(completeEvent).toHaveProperty('totalProcessed', 10);
      expect(completeEvent).toHaveProperty('avgThroughput');
    });

    it('should provide accurate statistics', async () => {
      const chunks = createMockChunks(20);
      
      const results = [];
      for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
        results.push(result);
      }
      
      const stats = pipeline.getStats();
      expect(stats.totalProcessed).toBe(20);
      expect(stats.totalErrors).toBe(0);
      expect(stats.elapsed).toBeGreaterThan(0);
      expect(stats.avgThroughput).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should allow setting concurrency level', () => {
      const events = [];
      pipeline.on('concurrency:changed', (event) => {
        events.push(event);
      });
      
      pipeline.setConcurrency(5);
      
      expect(pipeline.options.concurrency).toBe(5);
      expect(events).toHaveLength(1);
      expect(events[0].newLevel).toBe(5);
    });

    it('should allow manual batch size setting', () => {
      const events = [];
      pipeline.on('batch:size:manual', (event) => {
        events.push(event);
      });
      
      pipeline.setBatchSize(25);
      
      expect(pipeline.currentBatchSize).toBe(25);
      expect(events).toHaveLength(1);
      expect(events[0].newSize).toBe(25);
    });

    it('should enforce batch size limits', () => {
      pipeline.options.minBatchSize = 10;
      pipeline.options.maxBatchSize = 50;
      
      pipeline.setBatchSize(5); // Below minimum
      expect(pipeline.currentBatchSize).toBe(10);
      
      pipeline.setBatchSize(100); // Above maximum
      expect(pipeline.currentBatchSize).toBe(50);
    });
  });
});

describe('EmbeddingBatcher', () => {
  let batcher;
  let mockClient;

  beforeEach(() => {
    batcher = new EmbeddingBatcher();
    mockClient = new MockEmbeddingClient();
  });

  describe('Batch Creation', () => {
    it('should create batches based on token limits', () => {
      const chunks = createMockChunks(100, 200); // 200 chars each ≈ 50 tokens
      const batches = batcher.createBatches(chunks, 'mock', mockClient);
      
      expect(batches.length).toBeGreaterThan(1);
      
      // Each batch should respect token limits
      batches.forEach(batch => {
        const totalTokens = batch.reduce((sum, chunk) => 
          sum + Math.ceil(chunk.content.length / 4), 0);
        expect(totalTokens).toBeLessThanOrEqual(8000);
      });
    });

    it('should respect recommended batch size', () => {
      const chunks = createMockChunks(200, 50); // Small chunks
      const batches = batcher.createBatches(chunks, 'mock', mockClient);
      
      // Most batches should be around the recommended size
      const avgBatchSize = batches.reduce((sum, batch) => sum + batch.length, 0) / batches.length;
      expect(avgBatchSize).toBeLessThanOrEqual(50);
    });

    it('should skip chunks that are too large', () => {
      const chunks = [
        ...createMockChunks(5, 100),
        { id: 'huge', content: 'x'.repeat(50000) }, // Very large chunk
        ...createMockChunks(5, 100)
      ];
      
      const batches = batcher.createBatches(chunks, 'mock', mockClient);
      const allBatchedChunks = batches.flat();
      
      expect(allBatchedChunks.length).toBe(10); // Should skip the huge chunk
      expect(allBatchedChunks.find(c => c.id === 'huge')).toBeUndefined();
    });

    it('should handle empty chunk array', () => {
      const batches = batcher.createBatches([], 'mock', mockClient);
      expect(batches).toHaveLength(0);
    });
  });
});

describe('ConcurrencyManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ConcurrencyManager(2);
  });

  describe('Concurrency Control', () => {
    it('should limit concurrent executions', async () => {
      let activeTasks = 0;
      let maxActiveTasks = 0;
      
      const task = async () => {
        activeTasks++;
        maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
        await new Promise(resolve => setTimeout(resolve, 100));
        activeTasks--;
        return 'done';
      };
      
      // Start 5 tasks
      const promises = Array(5).fill().map(() => manager.execute(task));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r === 'done')).toBe(true);
      expect(maxActiveTasks).toBeLessThanOrEqual(2);
    });

    it('should handle task failures without blocking others', async () => {
      let successCount = 0;
      let errorCount = 0;
      
      const successTask = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        successCount++;
        return 'success';
      };
      
      const errorTask = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        errorCount++;
        throw new Error('Task failed');
      };
      
      const promises = [
        manager.execute(successTask),
        manager.execute(errorTask),
        manager.execute(successTask),
        manager.execute(errorTask),
        manager.execute(successTask)
      ];
      
      const results = await Promise.allSettled(promises);
      
      expect(successCount).toBe(3);
      expect(errorCount).toBe(2);
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(3);
      expect(results.filter(r => r.status === 'rejected')).toHaveLength(2);
    });

    it('should wait for completion of all tasks', async () => {
      let completedTasks = 0;
      
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        completedTasks++;
      };
      
      // Start tasks without waiting
      manager.execute(task);
      manager.execute(task);
      manager.execute(task);
      
      // Wait for completion
      await manager.waitForCompletion();
      
      expect(completedTasks).toBe(3);
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should achieve target throughput with optimal settings', async () => {
    const mockClient = new MockEmbeddingClient({ responseTime: 100 });
    const pipeline = new EmbeddingPipeline(mockClient, {
      concurrency: 3,
      initialBatchSize: 50,
      adaptiveBatching: true
    });
    
    const chunks = createMockChunks(500);
    const startTime = Date.now();
    
    const results = [];
    for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
      results.push(result);
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const throughput = results.length / duration;
    
    expect(results).toHaveLength(500);
    expect(throughput).toBeGreaterThan(10); // Should process at least 10 chunks/second
    
    const stats = pipeline.getStats();
    expect(stats.avgThroughput).toBeGreaterThan(0);
    expect(stats.totalErrors).toBe(0);
  });

  it('should handle high-volume processing efficiently', async () => {
    const mockClient = new MockEmbeddingClient({ responseTime: 50 });
    const pipeline = new EmbeddingPipeline(mockClient, {
      concurrency: 5,
      initialBatchSize: 100,
      maxBatchSize: 200
    });
    
    const chunks = createMockChunks(1000);
    const startTime = Date.now();
    
    let processedCount = 0;
    for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
      processedCount++;
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    expect(processedCount).toBe(1000);
    expect(duration).toBeLessThan(30); // Should complete within 30 seconds
    
    const stats = pipeline.getStats();
    expect(stats.avgThroughput).toBeGreaterThan(30); // High throughput
  });
});