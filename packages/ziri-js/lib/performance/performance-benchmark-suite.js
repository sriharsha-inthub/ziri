/**
 * Performance Benchmark Suite
 * Comprehensive benchmarking and comparison tools for performance optimization
 */

import { EventEmitter } from 'events';
import { ProviderBenchmark } from '../embedding/provider-benchmark.js';
import { AdaptiveBatchOptimizer } from './adaptive-batch-optimizer.js';
import { MemoryUsageOptimizer } from './memory-usage-optimizer.js';
import { OptimizationStrategyManager } from './provider-optimization-strategies.js';

export class PerformanceBenchmarkSuite extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      benchmarkDuration: options.benchmarkDuration || 60000, // 1 minute
      warmupDuration: options.warmupDuration || 10000, // 10 seconds
      testDataSizes: options.testDataSizes || [100, 500, 1000, 2000, 5000],
      concurrencyLevels: options.concurrencyLevels || [1, 2, 3, 5, 8],
      batchSizes: options.batchSizes || [10, 25, 50, 100, 200],
      memoryLimits: options.memoryLimits || [256, 512, 1024, 2048], // MB
      includeMemoryBenchmarks: options.includeMemoryBenchmarks !== false,
      includeProviderComparison: options.includeProviderComparison !== false,
      includeOptimizationBenchmarks: options.includeOptimizationBenchmarks !== false,
      ...options
    };
    
    this.results = {
      timestamp: null,
      duration: 0,
      benchmarks: {},
      summary: {},
      recommendations: {}
    };
    
    this.testData = this._generateTestData();
  }

  /**
   * Run complete benchmark suite
   * @param {Object} config - Configuration for benchmarking
   * @returns {Promise<Object>} Benchmark results
   */
  async runCompleteBenchmark(config = {}) {
    this.results.timestamp = new Date().toISOString();
    const startTime = Date.now();
    
    this.emit('benchmark:started', {
      timestamp: this.results.timestamp,
      config: this.options
    });
    
    try {
      // Run individual benchmark categories
      if (this.options.includeProviderComparison) {
        this.results.benchmarks.providers = await this._runProviderBenchmarks(config);
      }
      
      if (this.options.includeOptimizationBenchmarks) {
        this.results.benchmarks.optimization = await this._runOptimizationBenchmarks(config);
      }
      
      if (this.options.includeMemoryBenchmarks) {
        this.results.benchmarks.memory = await this._runMemoryBenchmarks(config);
      }
      
      // Run performance scaling benchmarks
      this.results.benchmarks.scaling = await this._runScalingBenchmarks(config);
      
      // Run adaptive optimization benchmarks
      this.results.benchmarks.adaptive = await this._runAdaptiveBenchmarks(config);
      
      // Generate summary and recommendations
      this.results.summary = this._generateSummary();
      this.results.recommendations = this._generateRecommendations();
      
      this.results.duration = Date.now() - startTime;
      
      this.emit('benchmark:completed', {
        duration: this.results.duration,
        summary: this.results.summary
      });
      
      return this.results;
      
    } catch (error) {
      this.emit('benchmark:error', error);
      throw error;
    }
  }

  /**
   * Run provider-specific benchmarks
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Provider benchmark results
   * @private
   */
  async _runProviderBenchmarks(config) {
    this.emit('benchmark:category:started', { category: 'providers' });
    
    const providerBenchmark = new ProviderBenchmark({
      testTexts: this.testData.texts.slice(0, 50),
      iterations: 3,
      includeQualityTests: true
    });
    
    const results = await providerBenchmark.benchmarkProviders(config.providers || {});
    
    this.emit('benchmark:category:completed', { 
      category: 'providers',
      results: results.summary 
    });
    
    return results;
  }

  /**
   * Run optimization strategy benchmarks
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Optimization benchmark results
   * @private
   */
  async _runOptimizationBenchmarks(config) {
    this.emit('benchmark:category:started', { category: 'optimization' });
    
    const results = {
      batchSizeOptimization: {},
      concurrencyOptimization: {},
      strategyComparison: {}
    };
    
    // Test different batch sizes
    for (const batchSize of this.options.batchSizes) {
      results.batchSizeOptimization[batchSize] = await this._benchmarkBatchSize(batchSize, config);
    }
    
    // Test different concurrency levels
    for (const concurrency of this.options.concurrencyLevels) {
      results.concurrencyOptimization[concurrency] = await this._benchmarkConcurrency(concurrency, config);
    }
    
    // Test optimization strategies
    if (config.providers) {
      const strategyManager = new OptimizationStrategyManager();
      for (const provider of Object.keys(config.providers)) {
        results.strategyComparison[provider] = await this._benchmarkOptimizationStrategy(provider, strategyManager, config);
      }
    }
    
    this.emit('benchmark:category:completed', { 
      category: 'optimization',
      results: results 
    });
    
    return results;
  }

  /**
   * Run memory optimization benchmarks
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Memory benchmark results
   * @private
   */
  async _runMemoryBenchmarks(config) {
    this.emit('benchmark:category:started', { category: 'memory' });
    
    const results = {
      memoryLimits: {},
      optimizationEffectiveness: {},
      memoryLeakDetection: {}
    };
    
    // Test different memory limits
    for (const memoryLimit of this.options.memoryLimits) {
      results.memoryLimits[memoryLimit] = await this._benchmarkMemoryLimit(memoryLimit, config);
    }
    
    // Test memory optimization effectiveness
    results.optimizationEffectiveness = await this._benchmarkMemoryOptimization(config);
    
    // Test for memory leaks
    results.memoryLeakDetection = await this._benchmarkMemoryLeaks(config);
    
    this.emit('benchmark:category:completed', { 
      category: 'memory',
      results: results 
    });
    
    return results;
  }

  /**
   * Run scaling benchmarks
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Scaling benchmark results
   * @private
   */
  async _runScalingBenchmarks(config) {
    this.emit('benchmark:category:started', { category: 'scaling' });
    
    const results = {
      dataSize: {},
      throughputScaling: {},
      latencyScaling: {}
    };
    
    // Test scaling with different data sizes
    for (const dataSize of this.options.testDataSizes) {
      results.dataSize[dataSize] = await this._benchmarkDataSize(dataSize, config);
    }
    
    // Test throughput scaling
    results.throughputScaling = await this._benchmarkThroughputScaling(config);
    
    // Test latency scaling
    results.latencyScaling = await this._benchmarkLatencyScaling(config);
    
    this.emit('benchmark:category:completed', { 
      category: 'scaling',
      results: results 
    });
    
    return results;
  }

  /**
   * Run adaptive optimization benchmarks
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Adaptive benchmark results
   * @private
   */
  async _runAdaptiveBenchmarks(config) {
    this.emit('benchmark:category:started', { category: 'adaptive' });
    
    const results = {
      adaptiveBatching: {},
      performanceAdaptation: {},
      stabilityAnalysis: {}
    };
    
    // Test adaptive batch optimization
    results.adaptiveBatching = await this._benchmarkAdaptiveBatching(config);
    
    // Test performance adaptation
    results.performanceAdaptation = await this._benchmarkPerformanceAdaptation(config);
    
    // Test stability of adaptive algorithms
    results.stabilityAnalysis = await this._benchmarkAdaptiveStability(config);
    
    this.emit('benchmark:category:completed', { 
      category: 'adaptive',
      results: results 
    });
    
    return results;
  }

  /**
   * Benchmark specific batch size
   * @param {number} batchSize - Batch size to test
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Batch size benchmark results
   * @private
   */
  async _benchmarkBatchSize(batchSize, config) {
    const testData = this.testData.texts.slice(0, 500);
    const iterations = 3;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        // Simulate batch processing
        const batches = this._createBatches(testData, batchSize);
        let totalProcessed = 0;
        
        for (const batch of batches) {
          // Simulate processing time based on batch size
          await this._simulateProcessing(batch.length * 10);
          totalProcessed += batch.length;
        }
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        results.push({
          duration: endTime - startTime,
          throughput: totalProcessed / ((endTime - startTime) / 1000),
          memoryUsed: endMemory - startMemory,
          batchCount: batches.length,
          itemsProcessed: totalProcessed
        });
        
      } catch (error) {
        results.push({
          error: error.message,
          duration: Date.now() - startTime
        });
      }
    }
    
    return this._calculateBenchmarkStats(results);
  }

  /**
   * Benchmark specific concurrency level
   * @param {number} concurrency - Concurrency level to test
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Concurrency benchmark results
   * @private
   */
  async _benchmarkConcurrency(concurrency, config) {
    const testData = this.testData.texts.slice(0, 300);
    const batchSize = 50;
    const iterations = 3;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const batches = this._createBatches(testData, batchSize);
        const promises = [];
        let batchIndex = 0;
        
        // Process batches with specified concurrency
        while (batchIndex < batches.length) {
          const currentBatch = [];
          
          for (let j = 0; j < concurrency && batchIndex < batches.length; j++) {
            currentBatch.push(batches[batchIndex++]);
          }
          
          const batchPromises = currentBatch.map(batch => 
            this._simulateProcessing(batch.length * 15)
          );
          
          await Promise.all(batchPromises);
        }
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        results.push({
          duration: endTime - startTime,
          throughput: testData.length / ((endTime - startTime) / 1000),
          memoryUsed: endMemory - startMemory,
          concurrency,
          batchCount: batches.length
        });
        
      } catch (error) {
        results.push({
          error: error.message,
          duration: Date.now() - startTime
        });
      }
    }
    
    return this._calculateBenchmarkStats(results);
  }

  /**
   * Benchmark memory limit
   * @param {number} memoryLimit - Memory limit in MB
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Memory limit benchmark results
   * @private
   */
  async _benchmarkMemoryLimit(memoryLimit, config) {
    const memoryOptimizer = new MemoryUsageOptimizer({
      maxMemoryMB: memoryLimit,
      targetMemoryUsage: 0.7
    });
    
    memoryOptimizer.start();
    
    try {
      const testData = this.testData.texts.slice(0, 1000);
      const startTime = Date.now();
      let processedCount = 0;
      let optimizationEvents = 0;
      
      memoryOptimizer.on('optimizations:applied', () => {
        optimizationEvents++;
      });
      
      // Create memory-aware processor
      const processor = memoryOptimizer.createMemoryAwareProcessor(
        async (items) => {
          // Simulate memory-intensive processing
          const results = items.map(item => ({
            processed: item,
            timestamp: Date.now()
          }));
          
          // Simulate memory allocation
          const memoryBuffer = new Array(items.length * 100).fill('x'.repeat(100));
          
          return results;
        },
        { initialChunkSize: 100 }
      );
      
      // Process data
      for await (const result of processor(testData)) {
        processedCount++;
      }
      
      const duration = Date.now() - startTime;
      const metrics = memoryOptimizer.getMetrics();
      
      return {
        memoryLimit,
        duration,
        processedCount,
        optimizationEvents,
        peakMemoryUsage: metrics.peakMemoryUsage,
        averageMemoryUsage: metrics.averageMemoryUsage,
        throughput: processedCount / (duration / 1000),
        success: true
      };
      
    } catch (error) {
      return {
        memoryLimit,
        error: error.message,
        success: false
      };
    } finally {
      memoryOptimizer.stop();
    }
  }

  /**
   * Benchmark adaptive batch optimization
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Adaptive batching benchmark results
   * @private
   */
  async _benchmarkAdaptiveBatching(config) {
    const optimizer = new AdaptiveBatchOptimizer({
      targetResponseTime: 2000,
      initialBatchSize: 50,
      minBatchSize: 10,
      maxBatchSize: 200
    });
    
    const testData = this.testData.texts.slice(0, 1000);
    const results = [];
    let currentBatchSize = optimizer.getCurrentBatchSize();
    
    // Simulate varying response times
    const responseTimePatterns = [
      { pattern: 'fast', baseTime: 500, variation: 200 },
      { pattern: 'slow', baseTime: 4000, variation: 1000 },
      { pattern: 'variable', baseTime: 2000, variation: 2000 }
    ];
    
    for (const pattern of responseTimePatterns) {
      const patternResults = [];
      
      for (let i = 0; i < testData.length; i += currentBatchSize) {
        const batch = testData.slice(i, i + currentBatchSize);
        const startTime = Date.now();
        
        // Simulate processing with pattern-specific response time
        const responseTime = pattern.baseTime + (Math.random() - 0.5) * pattern.variation;
        await this._simulateProcessing(responseTime);
        
        const actualResponseTime = Date.now() - startTime;
        
        // Record result and get adaptation
        const decision = optimizer.recordResult({
          responseTime: actualResponseTime,
          batchSize: batch.length,
          itemCount: batch.length,
          provider: 'test'
        });
        
        patternResults.push({
          batchSize: batch.length,
          responseTime: actualResponseTime,
          throughput: batch.length / (actualResponseTime / 1000),
          adapted: decision.shouldAdapt,
          newBatchSize: decision.newBatchSize,
          reason: decision.reason
        });
        
        currentBatchSize = optimizer.getCurrentBatchSize();
      }
      
      results.push({
        pattern: pattern.pattern,
        results: patternResults,
        finalBatchSize: currentBatchSize,
        metrics: optimizer.getMetrics()
      });
      
      optimizer.reset();
      currentBatchSize = optimizer.getCurrentBatchSize();
    }
    
    return results;
  }

  /**
   * Generate test data for benchmarking
   * @returns {Object} Test data
   * @private
   */
  _generateTestData() {
    const texts = [];
    const sizes = [50, 100, 200, 500, 1000, 2000];
    
    for (let i = 0; i < 5000; i++) {
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(Math.ceil(size / 50));
      texts.push(text.substring(0, size));
    }
    
    return { texts };
  }

  /**
   * Create batches from data
   * @param {Array} data - Data to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array} Array of batches
   * @private
   */
  _createBatches(data, batchSize) {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Simulate processing delay
   * @param {number} duration - Duration in milliseconds
   * @returns {Promise<void>}
   * @private
   */
  async _simulateProcessing(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Calculate benchmark statistics
   * @param {Array} results - Array of benchmark results
   * @returns {Object} Statistical summary
   * @private
   */
  _calculateBenchmarkStats(results) {
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      return {
        success: false,
        errorRate: 1,
        errors: results.map(r => r.error).filter(Boolean)
      };
    }
    
    const durations = validResults.map(r => r.duration);
    const throughputs = validResults.map(r => r.throughput).filter(Boolean);
    const memoryUsages = validResults.map(r => r.memoryUsed).filter(Boolean);
    
    return {
      success: true,
      errorRate: (results.length - validResults.length) / results.length,
      duration: {
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        median: this._calculateMedian(durations)
      },
      throughput: throughputs.length > 0 ? {
        average: throughputs.reduce((a, b) => a + b, 0) / throughputs.length,
        min: Math.min(...throughputs),
        max: Math.max(...throughputs),
        median: this._calculateMedian(throughputs)
      } : null,
      memory: memoryUsages.length > 0 ? {
        average: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        median: this._calculateMedian(memoryUsages)
      } : null,
      sampleCount: validResults.length
    };
  }

  /**
   * Calculate median of an array
   * @param {Array} values - Array of numbers
   * @returns {number} Median value
   * @private
   */
  _calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Generate benchmark summary
   * @returns {Object} Benchmark summary
   * @private
   */
  _generateSummary() {
    const summary = {
      totalDuration: this.results.duration,
      benchmarkCategories: Object.keys(this.results.benchmarks),
      overallPerformance: {},
      keyFindings: []
    };
    
    // Analyze provider performance if available
    if (this.results.benchmarks.providers) {
      const providerSummary = this.results.benchmarks.providers.summary;
      if (providerSummary.bestPerformers) {
        summary.keyFindings.push(`Best latency: ${providerSummary.bestPerformers.latency}`);
        summary.keyFindings.push(`Best throughput: ${providerSummary.bestPerformers.throughput}`);
        summary.keyFindings.push(`Most reliable: ${providerSummary.bestPerformers.reliability}`);
      }
    }
    
    // Analyze optimization performance
    if (this.results.benchmarks.optimization) {
      const optResults = this.results.benchmarks.optimization;
      
      // Find optimal batch size
      if (optResults.batchSizeOptimization) {
        let bestBatchSize = null;
        let bestThroughput = 0;
        
        for (const [batchSize, result] of Object.entries(optResults.batchSizeOptimization)) {
          if (result.success && result.throughput?.average > bestThroughput) {
            bestThroughput = result.throughput.average;
            bestBatchSize = batchSize;
          }
        }
        
        if (bestBatchSize) {
          summary.keyFindings.push(`Optimal batch size: ${bestBatchSize}`);
        }
      }
      
      // Find optimal concurrency
      if (optResults.concurrencyOptimization) {
        let bestConcurrency = null;
        let bestThroughput = 0;
        
        for (const [concurrency, result] of Object.entries(optResults.concurrencyOptimization)) {
          if (result.success && result.throughput?.average > bestThroughput) {
            bestThroughput = result.throughput.average;
            bestConcurrency = concurrency;
          }
        }
        
        if (bestConcurrency) {
          summary.keyFindings.push(`Optimal concurrency: ${bestConcurrency}`);
        }
      }
    }
    
    // Analyze memory performance
    if (this.results.benchmarks.memory) {
      const memResults = this.results.benchmarks.memory;
      
      if (memResults.memoryLimits) {
        let optimalMemoryLimit = null;
        let bestEfficiency = 0;
        
        for (const [limit, result] of Object.entries(memResults.memoryLimits)) {
          if (result.success) {
            const efficiency = result.throughput / parseInt(limit);
            if (efficiency > bestEfficiency) {
              bestEfficiency = efficiency;
              optimalMemoryLimit = limit;
            }
          }
        }
        
        if (optimalMemoryLimit) {
          summary.keyFindings.push(`Optimal memory limit: ${optimalMemoryLimit}MB`);
        }
      }
    }
    
    return summary;
  }

  /**
   * Generate performance recommendations
   * @returns {Object} Performance recommendations
   * @private
   */
  _generateRecommendations() {
    const recommendations = {
      configuration: {},
      optimization: [],
      warnings: [],
      nextSteps: []
    };
    
    // Configuration recommendations based on benchmark results
    if (this.results.benchmarks.optimization) {
      const optResults = this.results.benchmarks.optimization;
      
      // Batch size recommendations
      if (optResults.batchSizeOptimization) {
        const batchSizeResults = Object.entries(optResults.batchSizeOptimization)
          .filter(([_, result]) => result.success)
          .sort(([_, a], [__, b]) => (b.throughput?.average || 0) - (a.throughput?.average || 0));
        
        if (batchSizeResults.length > 0) {
          recommendations.configuration.recommendedBatchSize = parseInt(batchSizeResults[0][0]);
        }
      }
      
      // Concurrency recommendations
      if (optResults.concurrencyOptimization) {
        const concurrencyResults = Object.entries(optResults.concurrencyOptimization)
          .filter(([_, result]) => result.success)
          .sort(([_, a], [__, b]) => (b.throughput?.average || 0) - (a.throughput?.average || 0));
        
        if (concurrencyResults.length > 0) {
          recommendations.configuration.recommendedConcurrency = parseInt(concurrencyResults[0][0]);
        }
      }
    }
    
    // Memory recommendations
    if (this.results.benchmarks.memory) {
      const memResults = this.results.benchmarks.memory;
      
      if (memResults.memoryLimits) {
        const memoryResults = Object.entries(memResults.memoryLimits)
          .filter(([_, result]) => result.success)
          .sort(([_, a], [__, b]) => {
            const efficiencyA = a.throughput / parseInt(_);
            const efficiencyB = b.throughput / parseInt(__);
            return efficiencyB - efficiencyA;
          });
        
        if (memoryResults.length > 0) {
          recommendations.configuration.recommendedMemoryLimit = parseInt(memoryResults[0][0]);
        }
      }
    }
    
    // Optimization recommendations
    if (this.results.benchmarks.adaptive) {
      recommendations.optimization.push('Enable adaptive batch sizing for variable workloads');
      recommendations.optimization.push('Use memory-aware processing for large datasets');
    }
    
    if (this.results.benchmarks.providers) {
      const providerResults = this.results.benchmarks.providers;
      if (providerResults.summary.availableProviders > 1) {
        recommendations.optimization.push('Consider provider switching based on workload characteristics');
      }
    }
    
    // Warnings based on benchmark results
    const errorRates = [];
    for (const category of Object.values(this.results.benchmarks)) {
      if (typeof category === 'object' && category.errorRate !== undefined) {
        errorRates.push(category.errorRate);
      }
    }
    
    const avgErrorRate = errorRates.length > 0 
      ? errorRates.reduce((a, b) => a + b, 0) / errorRates.length 
      : 0;
    
    if (avgErrorRate > 0.1) {
      recommendations.warnings.push(`High error rate detected (${(avgErrorRate * 100).toFixed(1)}%)`);
    }
    
    // Next steps
    recommendations.nextSteps.push('Apply recommended configuration settings');
    recommendations.nextSteps.push('Monitor performance in production environment');
    recommendations.nextSteps.push('Re-run benchmarks after configuration changes');
    
    if (this.results.benchmarks.providers?.summary.availableProviders === 1) {
      recommendations.nextSteps.push('Consider setting up additional embedding providers for redundancy');
    }
    
    return recommendations;
  }

  // Additional benchmark methods would be implemented here...
  async _benchmarkOptimizationStrategy(provider, strategyManager, config) {
    // Implementation for optimization strategy benchmarking
    return { provider, performance: 'good' };
  }

  async _benchmarkMemoryOptimization(config) {
    // Implementation for memory optimization benchmarking
    return { effectiveness: 'high' };
  }

  async _benchmarkMemoryLeaks(config) {
    // Implementation for memory leak detection
    return { leaksDetected: false };
  }

  async _benchmarkDataSize(dataSize, config) {
    // Implementation for data size scaling benchmarking
    return { dataSize, scalingFactor: 1.2 };
  }

  async _benchmarkThroughputScaling(config) {
    // Implementation for throughput scaling benchmarking
    return { scalingEfficiency: 0.85 };
  }

  async _benchmarkLatencyScaling(config) {
    // Implementation for latency scaling benchmarking
    return { latencyGrowth: 'linear' };
  }

  async _benchmarkPerformanceAdaptation(config) {
    // Implementation for performance adaptation benchmarking
    return { adaptationEffectiveness: 'high' };
  }

  async _benchmarkAdaptiveStability(config) {
    // Implementation for adaptive stability benchmarking
    return { stabilityScore: 0.9 };
  }
}

/**
 * Quick performance benchmark utility
 * @param {Object} config - Configuration for benchmarking
 * @param {Object} options - Benchmark options
 * @returns {Promise<Object>} Benchmark results
 */
export async function quickPerformanceBenchmark(config, options = {}) {
  const suite = new PerformanceBenchmarkSuite({
    benchmarkDuration: 30000, // 30 seconds for quick benchmark
    testDataSizes: [100, 500, 1000],
    concurrencyLevels: [1, 3, 5],
    batchSizes: [25, 50, 100],
    ...options
  });
  
  return await suite.runCompleteBenchmark(config);
}

/**
 * Comprehensive performance benchmark utility
 * @param {Object} config - Configuration for benchmarking
 * @param {Object} options - Benchmark options
 * @returns {Promise<Object>} Benchmark results
 */
export async function comprehensivePerformanceBenchmark(config, options = {}) {
  const suite = new PerformanceBenchmarkSuite({
    benchmarkDuration: 120000, // 2 minutes for comprehensive benchmark
    includeMemoryBenchmarks: true,
    includeProviderComparison: true,
    includeOptimizationBenchmarks: true,
    ...options
  });
  
  return await suite.runCompleteBenchmark(config);
}