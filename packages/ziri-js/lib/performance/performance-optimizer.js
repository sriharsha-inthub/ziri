/**
 * Performance Optimizer
 * Main integration point for all performance optimization features
 */

import { EventEmitter } from 'events';
import { AdaptiveBatchOptimizer, ProviderSpecificBatchOptimizer } from './adaptive-batch-optimizer.js';
import { OptimizationStrategyManager } from './provider-optimization-strategies.js';
import { MemoryUsageOptimizer } from './memory-usage-optimizer.js';
import { PerformanceBenchmarkSuite } from './performance-benchmark-suite.js';

export class PerformanceOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableAdaptiveBatching: options.enableAdaptiveBatching !== false,
      enableMemoryOptimization: options.enableMemoryOptimization !== false,
      enableProviderOptimization: options.enableProviderOptimization !== false,
      autoTuning: options.autoTuning !== false,
      benchmarkInterval: options.benchmarkInterval || 300000, // 5 minutes
      optimizationInterval: options.optimizationInterval || 60000, // 1 minute
      ...options
    };
    
    // Initialize optimization components
    this.batchOptimizer = this.options.enableAdaptiveBatching 
      ? new ProviderSpecificBatchOptimizer(this.options.batchOptimizer || {})
      : null;
    
    this.strategyManager = this.options.enableProviderOptimization 
      ? new OptimizationStrategyManager()
      : null;
    
    this.memoryOptimizer = this.options.enableMemoryOptimization 
      ? new MemoryUsageOptimizer(this.options.memoryOptimizer || {})
      : null;
    
    this.benchmarkSuite = new PerformanceBenchmarkSuite(this.options.benchmarkSuite || {});
    
    // Optimization state
    this.currentOptimizations = {
      batchSize: null,
      concurrency: null,
      memoryLimit: null,
      provider: null,
      lastOptimized: null
    };
    
    this.performanceHistory = [];
    this.optimizationMetrics = {
      totalOptimizations: 0,
      improvementCount: 0,
      degradationCount: 0,
      averageImprovement: 0
    };
    
    // Auto-tuning intervals
    this.benchmarkInterval = null;
    this.optimizationInterval = null;
    
    this._setupEventHandlers();
  }

  /**
   * Start performance optimization
   * @param {Object} config - Initial configuration
   */
  async start(config = {}) {
    this.emit('optimizer:starting', { config });
    
    // Start memory optimization if enabled
    if (this.memoryOptimizer) {
      this.memoryOptimizer.start();
    }
    
    // Initialize provider strategies if enabled
    if (this.strategyManager && config.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        this.strategyManager.registerStrategy(providerName, providerConfig);
      }
    }
    
    // Set up provider-specific batch optimization profiles
    if (this.batchOptimizer && config.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        const profile = this._createProviderProfile(providerName, providerConfig);
        this.batchOptimizer.setProviderProfile(providerName, profile);
      }
    }
    
    // Start auto-tuning if enabled
    if (this.options.autoTuning) {
      await this._startAutoTuning(config);
    }
    
    this.emit('optimizer:started', {
      enabledFeatures: this._getEnabledFeatures(),
      config: this.currentOptimizations
    });
  }

  /**
   * Stop performance optimization
   */
  stop() {
    this.emit('optimizer:stopping');
    
    // Stop memory optimization
    if (this.memoryOptimizer) {
      this.memoryOptimizer.stop();
    }
    
    // Stop auto-tuning intervals
    if (this.benchmarkInterval) {
      clearInterval(this.benchmarkInterval);
      this.benchmarkInterval = null;
    }
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    
    this.emit('optimizer:stopped', {
      metrics: this.getMetrics()
    });
  }

  /**
   * Optimize processing settings based on current context
   * @param {Object} currentSettings - Current processing settings
   * @param {Object} context - Current context (provider, workload, etc.)
   * @returns {Object} Optimized settings
   */
  async optimize(currentSettings, context = {}) {
    const startTime = Date.now();
    let optimizedSettings = { ...currentSettings };
    const optimizations = [];
    
    this.emit('optimization:started', { currentSettings, context });
    
    try {
      // Apply memory optimizations
      if (this.memoryOptimizer) {
        const memoryOptimizedSettings = this.memoryOptimizer.applyOptimizations(optimizedSettings);
        if (JSON.stringify(memoryOptimizedSettings) !== JSON.stringify(optimizedSettings)) {
          optimizations.push('memory');
          optimizedSettings = memoryOptimizedSettings;
        }
      }
      
      // Apply provider-specific optimizations
      if (this.strategyManager && context.provider) {
        // Ensure strategy is switched to the current provider
        this.strategyManager.switchStrategy(context.provider);
        
        const strategyRecommendations = this.strategyManager.getOptimizationRecommendations(context);
        
        if (strategyRecommendations.batchSize !== optimizedSettings.batchSize) {
          optimizations.push('provider_batch_size');
          optimizedSettings.batchSize = strategyRecommendations.batchSize;
        }
        
        if (strategyRecommendations.concurrency !== optimizedSettings.concurrency) {
          optimizations.push('provider_concurrency');
          optimizedSettings.concurrency = strategyRecommendations.concurrency;
        }
      }
      
      // Apply adaptive batch optimizations
      if (this.batchOptimizer && context.provider) {
        this.batchOptimizer.switchProvider(context.provider);
        const adaptiveBatchSize = this.batchOptimizer.getCurrentBatchSize();
        
        if (adaptiveBatchSize !== optimizedSettings.batchSize) {
          optimizations.push('adaptive_batching');
          optimizedSettings.batchSize = adaptiveBatchSize;
        }
      }
      
      // Update current optimizations
      this.currentOptimizations = {
        ...optimizedSettings,
        lastOptimized: Date.now()
      };
      
      this.optimizationMetrics.totalOptimizations++;
      
      const optimizationResult = {
        originalSettings: currentSettings,
        optimizedSettings,
        optimizations,
        duration: Date.now() - startTime,
        improvement: this._calculateImprovement(currentSettings, optimizedSettings, context)
      };
      
      this.emit('optimization:completed', optimizationResult);
      
      return optimizedSettings;
      
    } catch (error) {
      this.emit('optimization:error', { error, currentSettings, context });
      throw error;
    }
  }

  /**
   * Record performance metrics and adapt optimizations
   * @param {Object} metrics - Performance metrics
   * @param {Object} context - Processing context
   */
  recordPerformance(metrics, context = {}) {
    const timestamp = Date.now();
    
    // Store performance history
    this.performanceHistory.push({
      timestamp,
      ...metrics,
      ...context
    });
    
    // Keep only recent history
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
    
    // Record with batch optimizer
    if (this.batchOptimizer && context.provider) {
      this.batchOptimizer.recordResult({
        responseTime: metrics.responseTime || metrics.duration,
        batchSize: metrics.batchSize || context.batchSize,
        itemCount: metrics.itemCount || metrics.processedCount,
        provider: context.provider
      });
    }
    
    // Record with strategy manager
    if (this.strategyManager && context.provider) {
      this.strategyManager.recordPerformanceAndAdapt(context.provider, metrics);
    }
    
    this.emit('performance:recorded', {
      metrics,
      context,
      timestamp
    });
  }

  /**
   * Run performance benchmark
   * @param {Object} config - Benchmark configuration
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async runBenchmark(config, options = {}) {
    this.emit('benchmark:started', { config, options });
    
    try {
      const results = await this.benchmarkSuite.runCompleteBenchmark(config);
      
      // Apply benchmark recommendations if auto-tuning is enabled
      if (this.options.autoTuning && results.recommendations) {
        await this._applyBenchmarkRecommendations(results.recommendations);
      }
      
      this.emit('benchmark:completed', { results });
      
      return results;
      
    } catch (error) {
      this.emit('benchmark:error', { error });
      throw error;
    }
  }

  /**
   * Get current optimization metrics
   * @returns {Object} Optimization metrics
   */
  getMetrics() {
    const metrics = {
      currentOptimizations: { ...this.currentOptimizations },
      optimizationMetrics: { ...this.optimizationMetrics },
      enabledFeatures: this._getEnabledFeatures(),
      performanceHistory: this.performanceHistory.slice(-10) // Last 10 records
    };
    
    // Add component-specific metrics
    if (this.batchOptimizer) {
      metrics.batchOptimizer = this.batchOptimizer.getMetrics();
    }
    
    if (this.memoryOptimizer) {
      metrics.memoryOptimizer = this.memoryOptimizer.getMetrics();
    }
    
    if (this.strategyManager) {
      metrics.strategyManager = this.strategyManager.getPerformanceSummary();
    }
    
    return metrics;
  }

  /**
   * Get optimization recommendations
   * @param {Object} context - Current context
   * @returns {Object} Optimization recommendations
   */
  getRecommendations(context = {}) {
    const recommendations = {
      immediate: [],
      configuration: {},
      monitoring: [],
      nextSteps: []
    };
    
    // Memory recommendations
    if (this.memoryOptimizer) {
      const memoryRecommendations = this.memoryOptimizer.getOptimizationRecommendations(context);
      if (memoryRecommendations.shouldOptimize) {
        recommendations.immediate.push({
          type: 'memory',
          urgency: memoryRecommendations.urgency,
          optimizations: memoryRecommendations.optimizations
        });
      }
    }
    
    // Provider strategy recommendations
    if (this.strategyManager && context.provider) {
      // Ensure strategy is switched to the current provider
      this.strategyManager.switchStrategy(context.provider);
      
      const strategyRecommendations = this.strategyManager.getOptimizationRecommendations(context);
      recommendations.configuration = {
        ...recommendations.configuration,
        ...strategyRecommendations
      };
    }
    
    // Batch optimization recommendations
    if (this.batchOptimizer) {
      const batchMetrics = this.batchOptimizer.getMetrics();
      if (batchMetrics.stability.score < 0.7) {
        recommendations.monitoring.push('Monitor batch size stability - frequent adaptations detected');
      }
    }
    
    // Performance history analysis
    if (this.performanceHistory.length >= 10) {
      const recentPerformance = this.performanceHistory.slice(-10);
      const avgThroughput = recentPerformance.reduce((sum, p) => sum + (p.throughput || 0), 0) / recentPerformance.length;
      const avgResponseTime = recentPerformance.reduce((sum, p) => sum + (p.responseTime || 0), 0) / recentPerformance.length;
      
      if (avgThroughput < 10) {
        recommendations.immediate.push({
          type: 'throughput',
          urgency: 'high',
          message: 'Low throughput detected - consider increasing concurrency or batch size'
        });
      }
      
      if (avgResponseTime > 5000) {
        recommendations.immediate.push({
          type: 'latency',
          urgency: 'medium',
          message: 'High response times detected - consider reducing batch size or switching providers'
        });
      }
    }
    
    // Next steps
    if (!this.options.autoTuning) {
      recommendations.nextSteps.push('Enable auto-tuning for automatic optimization');
    }
    
    if (this.performanceHistory.length < 50) {
      recommendations.nextSteps.push('Collect more performance data for better optimization recommendations');
    }
    
    return recommendations;
  }

  /**
   * Reset optimization state
   */
  reset() {
    this.currentOptimizations = {
      batchSize: null,
      concurrency: null,
      memoryLimit: null,
      provider: null,
      lastOptimized: null
    };
    
    this.performanceHistory = [];
    this.optimizationMetrics = {
      totalOptimizations: 0,
      improvementCount: 0,
      degradationCount: 0,
      averageImprovement: 0
    };
    
    // Reset component states
    if (this.batchOptimizer) {
      this.batchOptimizer.reset();
    }
    
    if (this.memoryOptimizer) {
      this.memoryOptimizer.reset();
    }
    
    this.emit('optimizer:reset');
  }

  /**
   * Create provider-specific optimization profile
   * @param {string} providerName - Provider name
   * @param {Object} providerConfig - Provider configuration
   * @returns {Object} Optimization profile
   * @private
   */
  _createProviderProfile(providerName, providerConfig) {
    const baseProfile = {
      targetResponseTime: 2000,
      minBatchSize: 10,
      maxBatchSize: 200,
      adaptationRate: 0.2,
      stabilityThreshold: 3
    };
    
    // Provider-specific adjustments
    switch (providerName.toLowerCase()) {
      case 'openai':
        return {
          ...baseProfile,
          targetResponseTime: 1500,
          maxBatchSize: 2048,
          rateLimitSensitive: true
        };
        
      case 'ollama':
        return {
          ...baseProfile,
          targetResponseTime: 3000,
          maxBatchSize: 100,
          minBatchSize: 5,
          latencySensitive: false,
          throughputOptimized: true
        };
        
      case 'huggingface':
        return {
          ...baseProfile,
          targetResponseTime: 4000,
          maxBatchSize: 128,
          rateLimitSensitive: true,
          adaptationRate: 0.1 // More conservative
        };
        
      case 'cohere':
        return {
          ...baseProfile,
          targetResponseTime: 2500,
          maxBatchSize: 96,
          rateLimitSensitive: true
        };
        
      default:
        return baseProfile;
    }
  }

  /**
   * Setup event handlers for optimization components
   * @private
   */
  _setupEventHandlers() {
    // Batch optimizer events
    if (this.batchOptimizer) {
      this.batchOptimizer.on('batch:adapted', (data) => {
        this.emit('optimization:batch_adapted', data);
      });
      
      this.batchOptimizer.on('provider:switched', (data) => {
        this.emit('optimization:provider_switched', data);
      });
    }
    
    // Memory optimizer events
    if (this.memoryOptimizer) {
      this.memoryOptimizer.on('memory:pressure', (data) => {
        this.emit('optimization:memory_pressure', data);
      });
      
      this.memoryOptimizer.on('optimizations:applied', (data) => {
        this.emit('optimization:memory_applied', data);
      });
    }
    
    // Strategy manager events
    if (this.strategyManager) {
      this.strategyManager.on('performance:recorded', (data) => {
        this.emit('optimization:strategy_performance', data);
      });
    }
  }

  /**
   * Start auto-tuning
   * @param {Object} config - Configuration
   * @private
   */
  async _startAutoTuning(config) {
    // Run initial benchmark
    if (config.providers && Object.keys(config.providers).length > 0) {
      try {
        const initialBenchmark = await this.runBenchmark(config, { 
          benchmarkDuration: 30000 // Quick initial benchmark
        });
        
        this.emit('auto_tuning:initial_benchmark', { results: initialBenchmark });
      } catch (error) {
        this.emit('auto_tuning:benchmark_error', { error });
      }
    }
    
    // Set up periodic benchmarking
    if (this.options.benchmarkInterval > 0) {
      this.benchmarkInterval = setInterval(async () => {
        try {
          await this.runBenchmark(config, { 
            benchmarkDuration: 60000 // Regular benchmark
          });
        } catch (error) {
          this.emit('auto_tuning:benchmark_error', { error });
        }
      }, this.options.benchmarkInterval);
    }
    
    // Set up periodic optimization
    if (this.options.optimizationInterval > 0) {
      this.optimizationInterval = setInterval(() => {
        this._performPeriodicOptimization();
      }, this.options.optimizationInterval);
    }
  }

  /**
   * Perform periodic optimization based on recent performance
   * @private
   */
  _performPeriodicOptimization() {
    if (this.performanceHistory.length < 5) {
      return; // Not enough data
    }
    
    const recentPerformance = this.performanceHistory.slice(-10);
    const avgMetrics = this._calculateAverageMetrics(recentPerformance);
    
    // Check if optimization is needed
    const needsOptimization = 
      avgMetrics.errorRate > 0.05 || // High error rate
      avgMetrics.responseTime > 5000 || // Slow responses
      avgMetrics.throughput < 5; // Low throughput
    
    if (needsOptimization) {
      this.emit('auto_tuning:optimization_triggered', {
        reason: 'performance_degradation',
        metrics: avgMetrics
      });
      
      // Apply optimizations based on the issues detected
      const context = {
        provider: recentPerformance[recentPerformance.length - 1].provider,
        memoryUsage: avgMetrics.memoryUsage,
        avgResponseTime: avgMetrics.responseTime
      };
      
      this.optimize(this.currentOptimizations, context).catch(error => {
        this.emit('auto_tuning:optimization_error', { error });
      });
    }
  }

  /**
   * Apply benchmark recommendations
   * @param {Object} recommendations - Benchmark recommendations
   * @private
   */
  async _applyBenchmarkRecommendations(recommendations) {
    if (recommendations.configuration) {
      const config = recommendations.configuration;
      
      if (config.recommendedBatchSize) {
        this.currentOptimizations.batchSize = config.recommendedBatchSize;
      }
      
      if (config.recommendedConcurrency) {
        this.currentOptimizations.concurrency = config.recommendedConcurrency;
      }
      
      if (config.recommendedMemoryLimit) {
        this.currentOptimizations.memoryLimit = config.recommendedMemoryLimit;
      }
      
      this.emit('auto_tuning:recommendations_applied', {
        recommendations: config
      });
    }
  }

  /**
   * Calculate improvement from optimization
   * @param {Object} originalSettings - Original settings
   * @param {Object} optimizedSettings - Optimized settings
   * @param {Object} context - Context
   * @returns {number} Improvement score
   * @private
   */
  _calculateImprovement(originalSettings, optimizedSettings, context) {
    // Simple improvement calculation based on expected performance gains
    let improvement = 0;
    
    if (optimizedSettings.batchSize > originalSettings.batchSize) {
      improvement += 0.1; // Expect 10% improvement from larger batches
    } else if (optimizedSettings.batchSize < originalSettings.batchSize) {
      improvement += 0.05; // Expect 5% improvement from memory optimization
    }
    
    if (optimizedSettings.concurrency !== originalSettings.concurrency) {
      improvement += 0.15; // Expect 15% improvement from concurrency optimization
    }
    
    return improvement;
  }

  /**
   * Calculate average metrics from performance history
   * @param {Array} performanceData - Performance data
   * @returns {Object} Average metrics
   * @private
   */
  _calculateAverageMetrics(performanceData) {
    const metrics = {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      memoryUsage: 0
    };
    
    let validCount = 0;
    
    for (const data of performanceData) {
      if (data.responseTime !== undefined) {
        metrics.responseTime += data.responseTime;
        validCount++;
      }
      if (data.throughput !== undefined) {
        metrics.throughput += data.throughput;
      }
      if (data.errorRate !== undefined) {
        metrics.errorRate += data.errorRate;
      }
      if (data.memoryUsage !== undefined) {
        metrics.memoryUsage += data.memoryUsage;
      }
    }
    
    if (validCount > 0) {
      metrics.responseTime /= validCount;
      metrics.throughput /= validCount;
      metrics.errorRate /= validCount;
      metrics.memoryUsage /= validCount;
    }
    
    return metrics;
  }

  /**
   * Get enabled optimization features
   * @returns {Array} List of enabled features
   * @private
   */
  _getEnabledFeatures() {
    const features = [];
    
    if (this.options.enableAdaptiveBatching) {
      features.push('adaptive_batching');
    }
    
    if (this.options.enableMemoryOptimization) {
      features.push('memory_optimization');
    }
    
    if (this.options.enableProviderOptimization) {
      features.push('provider_optimization');
    }
    
    if (this.options.autoTuning) {
      features.push('auto_tuning');
    }
    
    return features;
  }
}