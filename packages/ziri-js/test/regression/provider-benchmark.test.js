/**
 * Tests for Provider Benchmarking Tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ProviderBenchmark, 
  benchmarkProviders, 
  quickProviderComparison 
} from '../../lib/embedding/provider-benchmark.js';
import { ProviderFactory } from '../../lib/embedding/provider-factory.js';

// Mock the ProviderFactory
vi.mock('../../lib/embedding/provider-factory.js', () => ({
  ProviderFactory: {
    createProvider: vi.fn()
  }
}));

// Mock provider for testing
class MockProvider {
  constructor(config = {}) {
    this.type = config.type || 'mock';
    this.model = config.model || 'mock-model';
    this.dimensions = config.dimensions || 768;
    this.maxTokens = config.maxTokens || 1000;
    this.responseTime = config.responseTime || 100;
    this.failureRate = config.failureRate || 0;
    this.embeddings = config.embeddings || null;
  }

  async embed(texts) {
    // Simulate response time
    await new Promise(resolve => setTimeout(resolve, this.responseTime));
    
    // Simulate failures
    if (Math.random() < this.failureRate) {
      throw new Error('Mock provider failure');
    }

    // Return mock embeddings
    if (this.embeddings) {
      return texts.map(() => [...this.embeddings]);
    }
    
    return texts.map(() => new Array(this.dimensions).fill(0).map(() => Math.random()));
  }

  async test() {
    const startTime = Date.now();
    try {
      await this.embed(['test']);
      return {
        success: true,
        responseTime: Date.now() - startTime,
        modelInfo: {
          name: this.model,
          dimensions: this.dimensions,
          maxTokens: this.maxTokens
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  validateConfig() {
    // Mock validation
  }

  getLimits() {
    return {
      maxTokensPerRequest: this.maxTokens,
      embeddingDimensions: this.dimensions,
      recommendedBatchSize: 50
    };
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  isReady() {
    return true;
  }
}

// Mock ProviderFactory
vi.mock('../lib/embedding/provider-factory.js', () => ({
  ProviderFactory: {
    createProvider: vi.fn()
  }
}));

describe('ProviderBenchmark', () => {
  let benchmark;
  let mockProviders;

  beforeEach(() => {
    benchmark = new ProviderBenchmark({
      testTexts: ['test1', 'test2', 'test3'],
      iterations: 1, // Reduced for faster tests
      warmupIterations: 0, // Skip warmup for tests
      includeQualityTests: false
    });

    mockProviders = {
      fast: new MockProvider({ 
        type: 'fast', 
        responseTime: 10, // Faster for tests
        failureRate: 0 
      }),
      slow: new MockProvider({ 
        type: 'slow', 
        responseTime: 50, // Still slower but not too slow for tests
        failureRate: 0 
      }),
      unreliable: new MockProvider({ 
        type: 'unreliable', 
        responseTime: 20, 
        failureRate: 0.3 
      })
    };

    // Mock ProviderFactory.createProvider
    ProviderFactory.createProvider.mockImplementation((type, config) => {
      return mockProviders[type] || new MockProvider({ type, ...config });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const benchmark = new ProviderBenchmark();
      expect(benchmark.options.iterations).toBe(3);
      expect(benchmark.options.warmupIterations).toBe(1);
      expect(benchmark.options.includeQualityTests).toBe(true);
    });

    it('should accept custom options', () => {
      const options = {
        iterations: 5,
        testTexts: ['custom'],
        includeQualityTests: false
      };
      const benchmark = new ProviderBenchmark(options);
      expect(benchmark.options.iterations).toBe(5);
      expect(benchmark.options.testTexts).toEqual(['custom']);
      expect(benchmark.options.includeQualityTests).toBe(false);
    });
  });

  describe('benchmarkProviders', () => {
    it('should benchmark multiple providers successfully', async () => {
      const configs = {
        fast: { type: 'fast' },
        slow: { type: 'slow' }
      };

      const results = await benchmark.benchmarkProviders(configs);

      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('detailed');
      expect(results).toHaveProperty('comparison');
      expect(results).toHaveProperty('recommendations');
      expect(results.summary.totalProviders).toBe(2);
      expect(results.summary.availableProviders).toBe(2);
    }, 10000); // 10 second timeout

    it('should handle provider failures gracefully', async () => {
      const configs = {
        working: { type: 'fast' },
        failing: { type: 'failing' }
      };

      // Create a provider that fails during testing, not during creation
      const failingProvider = new MockProvider({ 
        type: 'failing', 
        responseTime: 10, 
        failureRate: 1.0 // Always fails
      });
      
      // Override the test method to always fail
      failingProvider.test = async () => ({
        success: false,
        error: 'Provider connectivity failed',
        responseTime: 100
      });

      ProviderFactory.createProvider.mockImplementation((type, config) => {
        if (type === 'failing') {
          return failingProvider;
        }
        return mockProviders[type] || new MockProvider({ type, ...config });
      });

      const results = await benchmark.benchmarkProviders(configs);

      expect(results.detailed.working.available).toBe(true);
      expect(results.detailed.failing.available).toBe(false);
      expect(results.detailed.failing.error).toContain('Provider connectivity failed');
    }, 10000); // 10 second timeout

    it('should emit progress events', async () => {
      const events = [];
      benchmark.on('benchmark:start', (data) => events.push({ type: 'start', data }));
      benchmark.on('provider:start', (data) => events.push({ type: 'provider:start', data }));
      benchmark.on('provider:complete', (data) => events.push({ type: 'provider:complete', data }));
      benchmark.on('benchmark:complete', (data) => events.push({ type: 'complete', data }));

      const configs = { fast: { type: 'fast' } };
      await benchmark.benchmarkProviders(configs);

      expect(events.some(e => e.type === 'start')).toBe(true);
      expect(events.some(e => e.type === 'provider:start')).toBe(true);
      expect(events.some(e => e.type === 'provider:complete')).toBe(true);
      expect(events.some(e => e.type === 'complete')).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should measure latency correctly', async () => {
      const provider = mockProviders.fast;
      const results = await benchmark._runPerformanceBenchmarks(provider);

      expect(results.latency).toBeDefined();
      expect(results.latency.singleText).toBeDefined();
      expect(results.latency.singleText.average).toBeGreaterThan(0);
      expect(results.latency.batch).toBeDefined();
    });

    it('should measure throughput at different batch sizes', async () => {
      const provider = mockProviders.fast;
      const results = await benchmark._runPerformanceBenchmarks(provider);

      expect(results.throughput).toBeDefined();
      expect(results.throughput.byBatchSize).toBeInstanceOf(Array);
      expect(results.throughput.byBatchSize.length).toBeGreaterThan(0);
      
      const firstResult = results.throughput.byBatchSize[0];
      expect(firstResult).toHaveProperty('batchSize');
      expect(firstResult).toHaveProperty('throughput');
      expect(firstResult).toHaveProperty('successRate');
    });

    it('should measure reliability correctly', async () => {
      const provider = mockProviders.unreliable;
      const results = await benchmark._runPerformanceBenchmarks(provider);

      expect(results.reliability).toBeDefined();
      expect(results.reliability.successRate).toBeLessThan(1);
      expect(results.reliability.errorTypes).toBeDefined();
    });

    it('should test scalability', async () => {
      const provider = mockProviders.fast;
      const results = await benchmark._runPerformanceBenchmarks(provider);

      expect(results.scalability).toBeDefined();
      expect(results.scalability.results).toBeInstanceOf(Array);
      expect(results.scalability.scalabilityScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Quality Benchmarks', () => {
    beforeEach(() => {
      // Create providers with consistent embeddings for quality testing
      const consistentEmbeddings = new Array(768).fill(0).map((_, i) => Math.sin(i / 100));
      mockProviders.consistent = new MockProvider({
        type: 'consistent',
        embeddings: consistentEmbeddings
      });
    });

    it('should test semantic similarity when enabled', async () => {
      benchmark.options.includeQualityTests = true;
      const provider = mockProviders.consistent;
      
      const results = await benchmark._runQualityBenchmarks(provider);

      expect(results.similarity).toBeDefined();
      expect(results.similarity.averageSimilarScore).toBeDefined();
      expect(results.similarity.averageDissimilarScore).toBeDefined();
      expect(results.similarity.separation).toBeDefined();
    });

    it('should test clustering capability', async () => {
      benchmark.options.includeQualityTests = true;
      const provider = mockProviders.consistent;
      
      const results = await benchmark._runQualityBenchmarks(provider);

      expect(results.clustering).toBeDefined();
      expect(results.clustering.technology).toBeDefined();
      expect(results.clustering.nature).toBeDefined();
      expect(results.clustering.food).toBeDefined();
    });

    it('should test dimensionality properties', async () => {
      benchmark.options.includeQualityTests = true;
      const provider = mockProviders.consistent;
      
      const results = await benchmark._runQualityBenchmarks(provider);

      expect(results.dimensionality).toBeDefined();
      expect(results.dimensionality.dimensions).toBe(768);
      expect(results.dimensionality.averageNorm).toBeGreaterThan(0);
      expect(results.dimensionality.averageSparsity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics and Analysis', () => {
    it('should calculate statistics correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = benchmark._calculateStats(values);

      expect(stats.average).toBe(3);
      expect(stats.median).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.p95).toBe(5);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it('should handle empty arrays', () => {
      const stats = benchmark._calculateStats([]);
      expect(stats).toBeNull();
    });

    it('should calculate cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const c = [1, 0, 0];

      const similarity1 = benchmark._cosineSimilarity(a, b);
      const similarity2 = benchmark._cosineSimilarity(a, c);

      expect(similarity1).toBe(0); // Orthogonal vectors
      expect(similarity2).toBe(1); // Identical vectors
    });

    it('should generate meaningful summaries', () => {
      const detailedResults = {
        fast: {
          available: true,
          config: { model: 'fast-model', dimensions: 768 },
          performance: {
            latency: { singleText: { average: 50 } },
            throughput: { optimal: { throughput: { average: 20 } } },
            reliability: { successRate: 0.99 }
          }
        },
        slow: {
          available: true,
          config: { model: 'slow-model', dimensions: 512 },
          performance: {
            latency: { singleText: { average: 200 } },
            throughput: { optimal: { throughput: { average: 5 } } },
            reliability: { successRate: 0.95 }
          }
        }
      };

      const summary = benchmark._generateSummary(detailedResults);

      expect(summary.totalProviders).toBe(2);
      expect(summary.availableProviders).toBe(2);
      expect(summary.bestPerformers.latency).toBe('fast');
      expect(summary.bestPerformers.throughput).toBe('fast');
      expect(summary.bestPerformers.reliability).toBe('fast');
    });

    it('should generate useful recommendations', () => {
      const detailedResults = {
        fast: {
          available: true,
          performance: {
            latency: { singleText: { average: 50 } },
            throughput: { optimal: { throughput: { average: 20 } } },
            reliability: { successRate: 0.99 }
          }
        }
      };

      const recommendations = benchmark._generateRecommendations(detailedResults);

      expect(recommendations.useCase).toBeDefined();
      expect(recommendations.useCase['Low latency applications']).toBe('fast');
      expect(recommendations.performance).toBeInstanceOf(Array);
      expect(recommendations.cost).toBeInstanceOf(Array);
    });
  });

  describe('Utility Functions', () => {
    it('should find optimal batch size', () => {
      const throughputResults = [
        { batchSize: 1, throughput: { average: 5 }, successRate: 1.0 },
        { batchSize: 10, throughput: { average: 15 }, successRate: 0.95 },
        { batchSize: 50, throughput: { average: 25 }, successRate: 0.9 },
        { batchSize: 100, throughput: { average: 20 }, successRate: 0.8 }
      ];

      const optimal = benchmark._findOptimalBatchSize(throughputResults);

      expect(optimal.batchSize).toBe(50); // Highest throughput with acceptable success rate
      expect(optimal.throughput.average).toBe(25);
    });

    it('should calculate correlation correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // Perfect positive correlation

      const correlation = benchmark._calculateCorrelation(x, y);
      expect(correlation).toBeCloseTo(1, 2);
    });

    it('should get nested values correctly', () => {
      const obj = {
        level1: {
          level2: {
            value: 42
          }
        }
      };

      const value = benchmark._getNestedValue(obj, 'level1.level2.value');
      expect(value).toBe(42);

      const missing = benchmark._getNestedValue(obj, 'level1.missing.value');
      expect(missing).toBeUndefined();
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    ProviderFactory.createProvider.mockImplementation((type, config) => {
      return new MockProvider({ type, ...config });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('benchmarkProviders', () => {
    it('should run benchmark with provided configs', async () => {
      const configs = {
        test: { type: 'test' }
      };

      const results = await benchmarkProviders(configs, { iterations: 1 });

      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('detailed');
      expect(results.summary.totalProviders).toBe(1);
    });
  });

  describe('quickProviderComparison', () => {
    it('should run quick comparison', async () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        ZIRI_OPENAI_API_KEY: 'test-key'
      };

      try {
        const results = await quickProviderComparison({ iterations: 1 });

        expect(results).toHaveProperty('summary');
        expect(results).toHaveProperty('recommendations');
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle missing API keys gracefully', async () => {
      // Clear environment variables
      const originalEnv = process.env;
      process.env = {};

      try {
        const results = await quickProviderComparison({ iterations: 1 });

        // Should still work with Ollama (no API key required)
        expect(results).toHaveProperty('summary');
      } finally {
        process.env = originalEnv;
      }
    });
  });
});

describe('Integration Tests', () => {
  it('should handle real-world benchmark scenarios', async () => {
    const benchmark = new ProviderBenchmark({
      iterations: 1,
      includeQualityTests: false,
      testTexts: [
        'Short text',
        'This is a medium length text that contains multiple words and should test the embedding quality reasonably well.',
        'This is a very long text that goes on and on and contains many words and sentences to test how well the embedding provider handles longer content that might approach token limits and test the robustness of the embedding generation process.'
      ]
    });

    const configs = {
      provider1: { type: 'fast', responseTime: 100 },
      provider2: { type: 'slow', responseTime: 300 }
    };

    ProviderFactory.createProvider.mockImplementation((type, config) => {
      return new MockProvider({ 
        type, 
        responseTime: config.responseTime || 100,
        ...config 
      });
    });

    const results = await benchmark.benchmarkProviders(configs);

    // Verify comprehensive results structure
    expect(results.summary.availableProviders).toBe(2);
    expect(results.detailed.provider1.available).toBe(true);
    expect(results.detailed.provider2.available).toBe(true);
    
    // Verify performance differences are captured
    const p1Latency = results.detailed.provider1.performance.latency.singleText.average;
    const p2Latency = results.detailed.provider2.performance.latency.singleText.average;
    expect(p1Latency).toBeLessThan(p2Latency);

    // Verify recommendations are generated
    expect(results.recommendations.useCase).toBeDefined();
    expect(results.recommendations.performance).toBeInstanceOf(Array);
  }, 15000); // 15 second timeout for integration test
});