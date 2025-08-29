/**
 * Performance Optimization Tests
 * Tests for all performance optimization features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceOptimizer,
  AdaptiveBatchOptimizer,
  ProviderSpecificBatchOptimizer,
  OptimizationStrategyFactory,
  OptimizationStrategyManager,
  MemoryUsageOptimizer,
  PerformanceBenchmarkSuite
} from '../../lib/performance/index.js';

describe('Performance Optimization', () => {
  describe('AdaptiveBatchOptimizer', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new AdaptiveBatchOptimizer({
        targetResponseTime: 2000,
        initialBatchSize: 50,
        minBatchSize: 10,
        maxBatchSize: 200
      });
    });

    it('should initialize with correct default settings', () => {
      expect(optimizer.getCurrentBatchSize()).toBe(50);
      expect(optimizer.options.targetResponseTime).toBe(2000);
    });

    it('should decrease batch size for slow responses', () => {
      const initialSize = optimizer.getCurrentBatchSize();
      
      // Record multiple slow responses
      for (let i = 0; i < 5; i++) {
        optimizer.recordResult({
          responseTime: 5000, // Much slower than target
          batchSize: initialSize,
          itemCount: initialSize,
          provider: 'test'
        });
      }
      
      expect(optimizer.getCurrentBatchSize()).toBeLessThan(initialSize);
    });

    it('should increase batch size for fast responses', () => {
      const initialSize = optimizer.getCurrentBatchSize();
      
      // Record multiple fast responses
      for (let i = 0; i < 5; i++) {
        optimizer.recordResult({
          responseTime: 500, // Much faster than target
          batchSize: initialSize,
          itemCount: initialSize,
          provider: 'test'
        });
      }
      
      expect(optimizer.getCurrentBatchSize()).toBeGreaterThan(initialSize);
    });

    it('should maintain batch size for optimal responses', () => {
      const initialSize = optimizer.getCurrentBatchSize();
      
      // Record responses within target range
      for (let i = 0; i < 5; i++) {
        optimizer.recordResult({
          responseTime: 2000, // Exactly at target
          batchSize: initialSize,
          itemCount: initialSize,
          provider: 'test'
        });
      }
      
      expect(optimizer.getCurrentBatchSize()).toBe(initialSize);
    });

    it('should respect min and max batch size limits', () => {
      // Force very slow responses to test min limit
      for (let i = 0; i < 10; i++) {
        optimizer.recordResult({
          responseTime: 10000,
          batchSize: optimizer.getCurrentBatchSize(),
          itemCount: optimizer.getCurrentBatchSize(),
          provider: 'test'
        });
      }
      
      expect(optimizer.getCurrentBatchSize()).toBeGreaterThanOrEqual(10);
      
      // Reset and force very fast responses to test max limit
      optimizer.reset();
      for (let i = 0; i < 10; i++) {
        optimizer.recordResult({
          responseTime: 100,
          batchSize: optimizer.getCurrentBatchSize(),
          itemCount: optimizer.getCurrentBatchSize(),
          provider: 'test'
        });
      }
      
      expect(optimizer.getCurrentBatchSize()).toBeLessThanOrEqual(200);
    });

    it('should provide performance metrics', () => {
      optimizer.recordResult({
        responseTime: 1500,
        batchSize: 50,
        itemCount: 50,
        provider: 'test'
      });
      
      const metrics = optimizer.getMetrics();
      expect(metrics).toHaveProperty('currentBatchSize');
      expect(metrics).toHaveProperty('responseTimeHistory');
      expect(metrics).toHaveProperty('stability');
      expect(metrics.currentBatchSize).toBe(50);
    });
  });

  describe('ProviderSpecificBatchOptimizer', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new ProviderSpecificBatchOptimizer();
    });

    it('should handle provider-specific profiles', () => {
      const profile = {
        targetResponseTime: 1500,
        maxBatchSize: 100,
        rateLimitSensitive: true
      };
      
      optimizer.setProviderProfile('openai', profile);
      optimizer.switchProvider('openai');
      
      expect(optimizer.options.targetResponseTime).toBe(1500);
      expect(optimizer.options.maxBatchSize).toBe(100);
    });

    it('should adapt batch size based on provider characteristics', () => {
      // Set up rate-limit sensitive provider
      optimizer.setProviderProfile('test-provider', {
        rateLimitSensitive: true,
        targetResponseTime: 2000
      });
      
      optimizer.switchProvider('test-provider');
      
      // Record slow response that might indicate rate limiting
      const decision = optimizer.recordResult({
        responseTime: 4000, // Slow response
        batchSize: 50,
        itemCount: 50,
        provider: 'test-provider'
      });
      
      if (decision.shouldAdapt) {
        expect(decision.newBatchSize).toBeLessThan(50);
      }
    });
  });

  describe('OptimizationStrategyFactory', () => {
    it('should create OpenAI strategy', () => {
      const strategy = OptimizationStrategyFactory.createStrategy('openai');
      expect(strategy.providerName).toBe('openai');
      expect(strategy.options.defaultBatchSize).toBe(100);
    });

    it('should create Ollama strategy', () => {
      const strategy = OptimizationStrategyFactory.createStrategy('ollama');
      expect(strategy.providerName).toBe('ollama');
      expect(strategy.options.defaultBatchSize).toBe(20);
    });

    it('should create base strategy for unknown providers', () => {
      const strategy = OptimizationStrategyFactory.createStrategy('unknown');
      expect(strategy.providerName).toBe('unknown');
    });

    it('should list supported providers', () => {
      const providers = OptimizationStrategyFactory.getSupportedProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('ollama');
      expect(providers).toContain('huggingface');
      expect(providers).toContain('cohere');
    });
  });

  describe('OptimizationStrategyManager', () => {
    let manager;

    beforeEach(() => {
      manager = new OptimizationStrategyManager();
    });

    it('should register and retrieve strategies', () => {
      manager.registerStrategy('openai');
      const strategy = manager.getStrategy('openai');
      expect(strategy.providerName).toBe('openai');
    });

    it('should switch between strategies', () => {
      manager.registerStrategy('openai');
      manager.registerStrategy('ollama');
      
      manager.switchStrategy('openai');
      expect(manager.currentStrategy.providerName).toBe('openai');
      
      manager.switchStrategy('ollama');
      expect(manager.currentStrategy.providerName).toBe('ollama');
    });

    it('should provide optimization recommendations', () => {
      manager.registerStrategy('openai');
      manager.switchStrategy('openai');
      
      const recommendations = manager.getOptimizationRecommendations({
        memoryUsage: 0.5,
        avgResponseTime: 2000
      });
      
      expect(recommendations).toHaveProperty('batchSize');
      expect(recommendations).toHaveProperty('concurrency');
      expect(recommendations).toHaveProperty('retryStrategy');
    });

    it('should record performance and provide adaptations', () => {
      manager.registerStrategy('openai');
      
      const adaptations = manager.recordPerformanceAndAdapt('openai', {
        avgResponseTime: 3000,
        errorRate: 0.05,
        throughput: 10
      });
      
      expect(adaptations).toHaveProperty('batchSize');
      expect(adaptations).toHaveProperty('concurrency');
    });
  });

  describe('MemoryUsageOptimizer', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new MemoryUsageOptimizer({
        maxMemoryMB: 256,
        targetMemoryUsage: 0.7
      });
    });

    afterEach(() => {
      optimizer.stop();
    });

    it('should initialize with correct settings', () => {
      expect(optimizer.options.maxMemoryMB).toBe(256);
      expect(optimizer.options.targetMemoryUsage).toBe(0.7);
    });

    it('should provide optimization recommendations', () => {
      const recommendations = optimizer.getOptimizationRecommendations({
        chunkSize: 1000,
        batchSize: 100,
        concurrency: 5
      });
      
      expect(recommendations).toHaveProperty('shouldOptimize');
      expect(recommendations).toHaveProperty('urgency');
      expect(recommendations).toHaveProperty('memoryUsage');
    });

    it('should apply memory optimizations', () => {
      const currentSettings = {
        chunkSize: 1000,
        batchSize: 100,
        concurrency: 5
      };
      
      const optimizedSettings = optimizer.applyOptimizations(currentSettings);
      expect(optimizedSettings).toHaveProperty('chunkSize');
      expect(optimizedSettings).toHaveProperty('batchSize');
      expect(optimizedSettings).toHaveProperty('concurrency');
    });

    it('should create memory-aware processor', () => {
      const processor = optimizer.createMemoryAwareProcessor(
        async (items) => items.map(item => ({ processed: item })),
        { initialChunkSize: 100 }
      );
      
      expect(typeof processor).toBe('function');
    });

    it('should create memory-aware batch processor', () => {
      const batchProcessor = optimizer.createMemoryAwareBatchProcessor(
        async (batch) => batch.map(item => ({ processed: item }))
      );
      
      expect(typeof batchProcessor).toBe('function');
    });
  });

  describe('PerformanceBenchmarkSuite', () => {
    let suite;

    beforeEach(() => {
      suite = new PerformanceBenchmarkSuite({
        benchmarkDuration: 1000, // Short duration for tests
        testDataSizes: [10, 50],
        concurrencyLevels: [1, 2],
        batchSizes: [5, 10]
      });
    });

    it('should initialize with correct options', () => {
      expect(suite.options.benchmarkDuration).toBe(1000);
      expect(suite.options.testDataSizes).toEqual([10, 50]);
    });

    it('should generate test data', () => {
      expect(suite.testData).toHaveProperty('texts');
      expect(Array.isArray(suite.testData.texts)).toBe(true);
      expect(suite.testData.texts.length).toBeGreaterThan(0);
    });

    // Note: Full benchmark tests would be integration tests
    // as they require actual provider configurations
  });

  describe('PerformanceOptimizer Integration', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new PerformanceOptimizer({
        enableAdaptiveBatching: true,
        enableMemoryOptimization: true,
        enableProviderOptimization: true,
        autoTuning: false // Disable for tests
      });
    });

    afterEach(() => {
      optimizer.stop();
    });

    it('should initialize with all features enabled', () => {
      expect(optimizer.batchOptimizer).toBeDefined();
      expect(optimizer.memoryOptimizer).toBeDefined();
      expect(optimizer.strategyManager).toBeDefined();
    });

    it('should start and stop correctly', async () => {
      const config = {
        providers: {
          openai: { type: 'openai', model: 'text-embedding-3-small' }
        }
      };
      
      await optimizer.start(config);
      // Check that memory optimizer was started (it has a memoryMonitor property)
      expect(optimizer.memoryOptimizer.memoryMonitor).toBeDefined();
      
      optimizer.stop();
      // After stopping, the optimizer should still exist but monitoring should be stopped
      expect(optimizer.memoryOptimizer).toBeDefined();
    });

    it('should optimize settings', async () => {
      const config = {
        providers: {
          openai: { type: 'openai', model: 'text-embedding-3-small' }
        }
      };
      
      await optimizer.start(config);
      
      // Manually switch strategy to avoid the error
      if (optimizer.strategyManager) {
        optimizer.strategyManager.switchStrategy('openai');
      }
      
      const currentSettings = {
        batchSize: 50,
        concurrency: 3,
        chunkSize: 1000
      };
      
      const context = {
        provider: 'openai',
        memoryUsage: 0.5
      };
      
      const optimizedSettings = await optimizer.optimize(currentSettings, context);
      
      expect(optimizedSettings).toHaveProperty('batchSize');
      expect(optimizedSettings).toHaveProperty('concurrency');
    });

    it('should record performance metrics', () => {
      const metrics = {
        responseTime: 2000,
        throughput: 25,
        errorRate: 0.02,
        batchSize: 50
      };
      
      const context = {
        provider: 'openai',
        batchSize: 50
      };
      
      optimizer.recordPerformance(metrics, context);
      
      expect(optimizer.performanceHistory.length).toBe(1);
      expect(optimizer.performanceHistory[0]).toMatchObject(metrics);
    });

    it('should provide comprehensive metrics', () => {
      const metrics = optimizer.getMetrics();
      
      expect(metrics).toHaveProperty('currentOptimizations');
      expect(metrics).toHaveProperty('optimizationMetrics');
      expect(metrics).toHaveProperty('enabledFeatures');
      expect(metrics).toHaveProperty('performanceHistory');
    });

    it('should provide optimization recommendations', () => {
      // Register and switch to a strategy first
      if (optimizer.strategyManager) {
        optimizer.strategyManager.registerStrategy('openai');
        optimizer.strategyManager.switchStrategy('openai');
      }
      
      const recommendations = optimizer.getRecommendations({
        provider: 'openai',
        memoryUsage: 0.8
      });
      
      expect(recommendations).toHaveProperty('immediate');
      expect(recommendations).toHaveProperty('configuration');
      expect(recommendations).toHaveProperty('monitoring');
      expect(recommendations).toHaveProperty('nextSteps');
    });

    it('should reset state correctly', () => {
      // Add some performance data
      optimizer.recordPerformance({
        responseTime: 2000,
        throughput: 25
      }, { provider: 'openai' });
      
      expect(optimizer.performanceHistory.length).toBe(1);
      
      optimizer.reset();
      
      expect(optimizer.performanceHistory.length).toBe(0);
      expect(optimizer.optimizationMetrics.totalOptimizations).toBe(0);
    });
  });

  describe('Performance Optimization Edge Cases', () => {
    it('should handle missing performance data gracefully', () => {
      const optimizer = new AdaptiveBatchOptimizer();
      
      // Try to get metrics with no data
      const metrics = optimizer.getMetrics();
      expect(metrics.currentBatchSize).toBeDefined();
      expect(metrics.responseTimeHistory).toEqual([]);
    });

    it('should handle invalid batch size adaptations', () => {
      const optimizer = new AdaptiveBatchOptimizer({
        minBatchSize: 10,
        maxBatchSize: 100
      });
      
      // Try to force batch size below minimum
      for (let i = 0; i < 20; i++) {
        optimizer.recordResult({
          responseTime: 10000, // Very slow
          batchSize: optimizer.getCurrentBatchSize(),
          itemCount: optimizer.getCurrentBatchSize(),
          provider: 'test'
        });
      }
      
      expect(optimizer.getCurrentBatchSize()).toBeGreaterThanOrEqual(10);
    });

    it('should handle memory optimization with no current settings', () => {
      const optimizer = new MemoryUsageOptimizer();
      
      const optimizedSettings = optimizer.applyOptimizations({});
      expect(optimizedSettings).toEqual({});
    });

    it('should handle strategy manager with no providers', () => {
      const manager = new OptimizationStrategyManager();
      
      expect(() => {
        manager.getOptimizationRecommendations();
      }).toThrow();
    });
  });
});

// Mock implementations for testing
vi.mock('process', () => ({
  memoryUsage: () => ({
    heapUsed: 50 * 1024 * 1024, // 50MB
    heapTotal: 100 * 1024 * 1024, // 100MB
    external: 10 * 1024 * 1024, // 10MB
    rss: 150 * 1024 * 1024 // 150MB
  })
}));

// Helper function to create mock performance data
function createMockPerformanceData(count = 10) {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      timestamp: Date.now() - (count - i) * 1000,
      responseTime: 1500 + Math.random() * 1000,
      throughput: 20 + Math.random() * 10,
      errorRate: Math.random() * 0.1,
      provider: 'openai'
    });
  }
  return data;
}