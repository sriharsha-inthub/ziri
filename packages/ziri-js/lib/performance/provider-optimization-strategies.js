/**
 * Provider-Specific Optimization Strategies
 * Implements tailored optimization strategies for different embedding providers
 */

import { EventEmitter } from 'events';

/**
 * Base optimization strategy
 */
export class BaseOptimizationStrategy extends EventEmitter {
  constructor(providerName, options = {}) {
    super();
    this.providerName = providerName;
    this.options = options;
  }

  /**
   * Get optimal batch size for this provider
   * @param {Object} context - Current context (memory, load, etc.)
   * @returns {number} Optimal batch size
   */
  getOptimalBatchSize(context = {}) {
    return this.options.defaultBatchSize || 50;
  }

  /**
   * Get optimal concurrency level
   * @param {Object} context - Current context
   * @returns {number} Optimal concurrency level
   */
  getOptimalConcurrency(context = {}) {
    return this.options.defaultConcurrency || 3;
  }

  /**
   * Get retry strategy for this provider
   * @returns {Object} Retry configuration
   */
  getRetryStrategy() {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    };
  }

  /**
   * Adapt to current performance metrics
   * @param {Object} metrics - Performance metrics
   * @returns {Object} Adaptation recommendations
   */
  adaptToMetrics(metrics) {
    return {
      batchSize: this.getOptimalBatchSize(),
      concurrency: this.getOptimalConcurrency(),
      shouldAdapt: false,
      reason: 'no_adaptation_needed'
    };
  }
}

/**
 * OpenAI optimization strategy
 */
export class OpenAIOptimizationStrategy extends BaseOptimizationStrategy {
  constructor(options = {}) {
    super('openai', {
      defaultBatchSize: 100,
      defaultConcurrency: 5,
      maxBatchSize: 2048,
      maxConcurrency: 10,
      rateLimitWindow: 60000, // 1 minute
      maxTokensPerMinute: 1000000,
      maxRequestsPerMinute: 3000,
      ...options
    });
    
    this.rateLimitTracker = {
      requests: [],
      tokens: []
    };
  }

  getOptimalBatchSize(context = {}) {
    const { memoryUsage = 0, currentLoad = 0, avgResponseTime = 2000 } = context;
    
    let batchSize = this.options.defaultBatchSize;
    
    // Adjust for memory pressure
    if (memoryUsage > 0.8) {
      batchSize = Math.floor(batchSize * 0.6);
    } else if (memoryUsage > 0.6) {
      batchSize = Math.floor(batchSize * 0.8);
    }
    
    // Adjust for response time
    if (avgResponseTime > 5000) {
      batchSize = Math.floor(batchSize * 0.7);
    } else if (avgResponseTime < 1000) {
      batchSize = Math.min(this.options.maxBatchSize, Math.floor(batchSize * 1.3));
    }
    
    // Adjust for rate limits
    const rateLimitUtilization = this._calculateRateLimitUtilization();
    if (rateLimitUtilization > 0.8) {
      batchSize = Math.floor(batchSize * 0.5);
    }
    
    return Math.max(10, Math.min(this.options.maxBatchSize, batchSize));
  }

  getOptimalConcurrency(context = {}) {
    const { memoryUsage = 0, networkLatency = 100 } = context;
    
    let concurrency = this.options.defaultConcurrency;
    
    // Reduce concurrency under memory pressure
    if (memoryUsage > 0.8) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.5));
    } else if (memoryUsage > 0.6) {
      concurrency = Math.max(2, Math.floor(concurrency * 0.7));
    }
    
    // Adjust for network conditions
    if (networkLatency > 500) {
      concurrency = Math.min(this.options.maxConcurrency, concurrency + 2);
    }
    
    // Adjust for rate limits
    const rateLimitUtilization = this._calculateRateLimitUtilization();
    if (rateLimitUtilization > 0.7) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.6));
    }
    
    return Math.max(1, Math.min(this.options.maxConcurrency, concurrency));
  }

  getRetryStrategy() {
    return {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitter: true,
      rateLimitDelay: 60000, // Wait 1 minute on rate limit
      retryableErrors: ['rate_limit', 'timeout', 'network', 'server_error']
    };
  }

  adaptToMetrics(metrics) {
    const { avgResponseTime, errorRate, rateLimitHits, throughput } = metrics;
    
    let adaptations = {
      batchSize: this.getOptimalBatchSize(metrics),
      concurrency: this.getOptimalConcurrency(metrics),
      shouldAdapt: false,
      reason: 'stable'
    };
    
    // Adapt to high error rates
    if (errorRate > 0.1) {
      adaptations.batchSize = Math.floor(adaptations.batchSize * 0.5);
      adaptations.concurrency = Math.max(1, Math.floor(adaptations.concurrency * 0.5));
      adaptations.shouldAdapt = true;
      adaptations.reason = 'high_error_rate';
    }
    
    // Adapt to rate limit hits
    if (rateLimitHits > 0) {
      adaptations.batchSize = Math.floor(adaptations.batchSize * 0.3);
      adaptations.concurrency = 1;
      adaptations.shouldAdapt = true;
      adaptations.reason = 'rate_limit_hit';
    }
    
    // Optimize for throughput
    if (errorRate < 0.05 && avgResponseTime < 3000 && throughput > 0) {
      const currentThroughput = throughput;
      const potentialBatchSize = Math.min(this.options.maxBatchSize, adaptations.batchSize * 1.2);
      
      if (potentialBatchSize > adaptations.batchSize) {
        adaptations.batchSize = potentialBatchSize;
        adaptations.shouldAdapt = true;
        adaptations.reason = 'throughput_optimization';
      }
    }
    
    return adaptations;
  }

  recordRequest(tokens) {
    const now = Date.now();
    this.rateLimitTracker.requests.push(now);
    this.rateLimitTracker.tokens.push({ timestamp: now, count: tokens });
    
    // Clean old entries
    this._cleanRateLimitTracker();
  }

  _calculateRateLimitUtilization() {
    this._cleanRateLimitTracker();
    
    const requestUtilization = this.rateLimitTracker.requests.length / this.options.maxRequestsPerMinute;
    const tokenCount = this.rateLimitTracker.tokens.reduce((sum, entry) => sum + entry.count, 0);
    const tokenUtilization = tokenCount / this.options.maxTokensPerMinute;
    
    return Math.max(requestUtilization, tokenUtilization);
  }

  _cleanRateLimitTracker() {
    const cutoff = Date.now() - this.options.rateLimitWindow;
    this.rateLimitTracker.requests = this.rateLimitTracker.requests.filter(t => t > cutoff);
    this.rateLimitTracker.tokens = this.rateLimitTracker.tokens.filter(entry => entry.timestamp > cutoff);
  }
}

/**
 * Ollama optimization strategy (local deployment)
 */
export class OllamaOptimizationStrategy extends BaseOptimizationStrategy {
  constructor(options = {}) {
    super('ollama', {
      defaultBatchSize: 20,
      defaultConcurrency: 2,
      maxBatchSize: 100,
      maxConcurrency: 4,
      memoryPerBatch: 50, // MB per batch
      ...options
    });
  }

  getOptimalBatchSize(context = {}) {
    const { memoryUsage = 0, cpuUsage = 0, availableMemory = 1024 } = context;
    
    let batchSize = this.options.defaultBatchSize;
    
    // Adjust for available memory (local deployment is memory-sensitive)
    const maxBatchesForMemory = Math.floor(availableMemory / this.options.memoryPerBatch);
    batchSize = Math.min(batchSize, maxBatchesForMemory);
    
    // Reduce batch size under high memory usage
    if (memoryUsage > 0.8) {
      batchSize = Math.floor(batchSize * 0.4);
    } else if (memoryUsage > 0.6) {
      batchSize = Math.floor(batchSize * 0.7);
    }
    
    // Adjust for CPU usage
    if (cpuUsage > 0.8) {
      batchSize = Math.floor(batchSize * 0.6);
    }
    
    return Math.max(5, Math.min(this.options.maxBatchSize, batchSize));
  }

  getOptimalConcurrency(context = {}) {
    const { memoryUsage = 0, cpuUsage = 0, cpuCores = 4 } = context;
    
    let concurrency = Math.min(this.options.defaultConcurrency, Math.floor(cpuCores / 2));
    
    // Reduce concurrency under resource pressure
    if (memoryUsage > 0.7 || cpuUsage > 0.7) {
      concurrency = 1;
    } else if (memoryUsage > 0.5 || cpuUsage > 0.5) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.7));
    }
    
    return Math.max(1, Math.min(this.options.maxConcurrency, concurrency));
  }

  getRetryStrategy() {
    return {
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitter: false, // Local deployment, less jitter needed
      retryableErrors: ['timeout', 'server_error', 'connection_error']
    };
  }

  adaptToMetrics(metrics) {
    const { avgResponseTime, errorRate, memoryUsage, cpuUsage } = metrics;
    
    let adaptations = {
      batchSize: this.getOptimalBatchSize(metrics),
      concurrency: this.getOptimalConcurrency(metrics),
      shouldAdapt: false,
      reason: 'stable'
    };
    
    // Adapt to resource pressure
    if (memoryUsage > 0.8 || cpuUsage > 0.8) {
      adaptations.batchSize = Math.max(5, Math.floor(adaptations.batchSize * 0.5));
      adaptations.concurrency = 1;
      adaptations.shouldAdapt = true;
      adaptations.reason = 'resource_pressure';
    }
    
    // Adapt to slow responses (local model might be overloaded)
    if (avgResponseTime > 10000) {
      adaptations.batchSize = Math.max(5, Math.floor(adaptations.batchSize * 0.6));
      adaptations.concurrency = Math.max(1, adaptations.concurrency - 1);
      adaptations.shouldAdapt = true;
      adaptations.reason = 'slow_response';
    }
    
    return adaptations;
  }
}

/**
 * Hugging Face optimization strategy
 */
export class HuggingFaceOptimizationStrategy extends BaseOptimizationStrategy {
  constructor(options = {}) {
    super('huggingface', {
      defaultBatchSize: 32,
      defaultConcurrency: 3,
      maxBatchSize: 128,
      maxConcurrency: 6,
      rateLimitWindow: 3600000, // 1 hour
      freeRequestsPerHour: 1000,
      ...options
    });
    
    this.requestTracker = [];
  }

  getOptimalBatchSize(context = {}) {
    const { memoryUsage = 0, avgResponseTime = 3000, isFreeTier = true } = context;
    
    let batchSize = this.options.defaultBatchSize;
    
    // Free tier gets smaller batches
    if (isFreeTier) {
      batchSize = Math.floor(batchSize * 0.6);
    }
    
    // Adjust for memory and response time
    if (memoryUsage > 0.7) {
      batchSize = Math.floor(batchSize * 0.7);
    }
    
    if (avgResponseTime > 8000) {
      batchSize = Math.floor(batchSize * 0.6);
    } else if (avgResponseTime < 2000) {
      batchSize = Math.min(this.options.maxBatchSize, Math.floor(batchSize * 1.2));
    }
    
    return Math.max(8, Math.min(this.options.maxBatchSize, batchSize));
  }

  getOptimalConcurrency(context = {}) {
    const { isFreeTier = true, networkLatency = 200 } = context;
    
    let concurrency = this.options.defaultConcurrency;
    
    // Free tier gets lower concurrency
    if (isFreeTier) {
      concurrency = Math.min(2, concurrency);
    }
    
    // Adjust for network latency (HF can be slower)
    if (networkLatency > 1000) {
      concurrency = Math.min(this.options.maxConcurrency, concurrency + 1);
    }
    
    return Math.max(1, Math.min(this.options.maxConcurrency, concurrency));
  }

  getRetryStrategy() {
    return {
      maxRetries: 4,
      baseDelay: 2000,
      maxDelay: 120000,
      backoffMultiplier: 2.5,
      jitter: true,
      rateLimitDelay: 3600000, // Wait 1 hour on rate limit for free tier
      retryableErrors: ['rate_limit', 'timeout', 'server_error', 'model_loading']
    };
  }

  recordRequest() {
    this.requestTracker.push(Date.now());
    this._cleanRequestTracker();
  }

  _cleanRequestTracker() {
    const cutoff = Date.now() - this.options.rateLimitWindow;
    this.requestTracker = this.requestTracker.filter(t => t > cutoff);
  }

  _calculateRequestUtilization() {
    this._cleanRequestTracker();
    return this.requestTracker.length / this.options.freeRequestsPerHour;
  }
}

/**
 * Cohere optimization strategy
 */
export class CohereOptimizationStrategy extends BaseOptimizationStrategy {
  constructor(options = {}) {
    super('cohere', {
      defaultBatchSize: 96,
      defaultConcurrency: 4,
      maxBatchSize: 96, // Cohere has a strict limit
      maxConcurrency: 8,
      rateLimitWindow: 60000,
      maxRequestsPerMinute: 100,
      ...options
    });
    
    this.requestTracker = [];
  }

  getOptimalBatchSize(context = {}) {
    // Cohere has a fixed max batch size of 96
    const { memoryUsage = 0, avgResponseTime = 2000 } = context;
    
    let batchSize = this.options.maxBatchSize;
    
    // Adjust for memory pressure
    if (memoryUsage > 0.8) {
      batchSize = Math.floor(batchSize * 0.5);
    } else if (memoryUsage > 0.6) {
      batchSize = Math.floor(batchSize * 0.7);
    }
    
    // Adjust for response time
    if (avgResponseTime > 6000) {
      batchSize = Math.floor(batchSize * 0.6);
    }
    
    return Math.max(16, batchSize);
  }

  getOptimalConcurrency(context = {}) {
    const { memoryUsage = 0 } = context;
    
    let concurrency = this.options.defaultConcurrency;
    
    // Adjust for memory pressure
    if (memoryUsage > 0.7) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.5));
    }
    
    // Adjust for rate limits
    const rateLimitUtilization = this._calculateRateLimitUtilization();
    if (rateLimitUtilization > 0.7) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.5));
    }
    
    return Math.max(1, Math.min(this.options.maxConcurrency, concurrency));
  }

  getRetryStrategy() {
    return {
      maxRetries: 4,
      baseDelay: 1500,
      maxDelay: 45000,
      backoffMultiplier: 2,
      jitter: true,
      rateLimitDelay: 60000,
      retryableErrors: ['rate_limit', 'timeout', 'server_error']
    };
  }

  recordRequest() {
    this.requestTracker.push(Date.now());
    this._cleanRequestTracker();
  }

  _cleanRequestTracker() {
    const cutoff = Date.now() - this.options.rateLimitWindow;
    this.requestTracker = this.requestTracker.filter(t => t > cutoff);
  }

  _calculateRateLimitUtilization() {
    this._cleanRequestTracker();
    return this.requestTracker.length / this.options.maxRequestsPerMinute;
  }
}

/**
 * Strategy factory for creating provider-specific optimization strategies
 */
export class OptimizationStrategyFactory {
  static createStrategy(providerName, options = {}) {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return new OpenAIOptimizationStrategy(options);
      case 'ollama':
        return new OllamaOptimizationStrategy(options);
      case 'huggingface':
      case 'hugging_face':
        return new HuggingFaceOptimizationStrategy(options);
      case 'cohere':
        return new CohereOptimizationStrategy(options);
      default:
        return new BaseOptimizationStrategy(providerName, options);
    }
  }

  static getSupportedProviders() {
    return ['openai', 'ollama', 'huggingface', 'cohere'];
  }
}

/**
 * Optimization strategy manager that coordinates multiple provider strategies
 */
export class OptimizationStrategyManager extends EventEmitter {
  constructor() {
    super();
    this.strategies = new Map();
    this.currentStrategy = null;
    this.performanceHistory = new Map();
  }

  /**
   * Register a strategy for a provider
   * @param {string} providerName - Provider name
   * @param {Object} options - Strategy options
   */
  registerStrategy(providerName, options = {}) {
    const strategy = OptimizationStrategyFactory.createStrategy(providerName, options);
    this.strategies.set(providerName, strategy);
    
    // Forward strategy events
    strategy.on('*', (eventName, data) => {
      this.emit(`strategy:${providerName}:${eventName}`, data);
    });
    
    return strategy;
  }

  /**
   * Get strategy for a provider
   * @param {string} providerName - Provider name
   * @returns {BaseOptimizationStrategy} Strategy instance
   */
  getStrategy(providerName) {
    if (!this.strategies.has(providerName)) {
      this.registerStrategy(providerName);
    }
    return this.strategies.get(providerName);
  }

  /**
   * Switch to a provider strategy
   * @param {string} providerName - Provider name
   */
  switchStrategy(providerName) {
    this.currentStrategy = this.getStrategy(providerName);
    this.emit('strategy:switched', { provider: providerName });
  }

  /**
   * Get optimization recommendations for current provider
   * @param {Object} context - Current context
   * @returns {Object} Optimization recommendations
   */
  getOptimizationRecommendations(context = {}) {
    if (!this.currentStrategy) {
      throw new Error('No strategy selected. Call switchStrategy() first.');
    }
    
    return {
      batchSize: this.currentStrategy.getOptimalBatchSize(context),
      concurrency: this.currentStrategy.getOptimalConcurrency(context),
      retryStrategy: this.currentStrategy.getRetryStrategy(),
      provider: this.currentStrategy.providerName
    };
  }

  /**
   * Record performance metrics and get adaptations
   * @param {string} providerName - Provider name
   * @param {Object} metrics - Performance metrics
   * @returns {Object} Adaptation recommendations
   */
  recordPerformanceAndAdapt(providerName, metrics) {
    const strategy = this.getStrategy(providerName);
    
    // Store performance history
    if (!this.performanceHistory.has(providerName)) {
      this.performanceHistory.set(providerName, []);
    }
    
    const history = this.performanceHistory.get(providerName);
    history.push({
      timestamp: Date.now(),
      ...metrics
    });
    
    // Keep only recent history
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    // Get adaptations from strategy
    const adaptations = strategy.adaptToMetrics(metrics);
    
    this.emit('performance:recorded', {
      provider: providerName,
      metrics,
      adaptations
    });
    
    return adaptations;
  }

  /**
   * Get performance summary for all providers
   * @returns {Object} Performance summary
   */
  getPerformanceSummary() {
    const summary = {};
    
    for (const [provider, history] of this.performanceHistory) {
      if (history.length === 0) continue;
      
      const recent = history.slice(-10);
      const avgResponseTime = recent.reduce((sum, m) => sum + (m.avgResponseTime || 0), 0) / recent.length;
      const avgThroughput = recent.reduce((sum, m) => sum + (m.throughput || 0), 0) / recent.length;
      const avgErrorRate = recent.reduce((sum, m) => sum + (m.errorRate || 0), 0) / recent.length;
      
      summary[provider] = {
        avgResponseTime,
        avgThroughput,
        avgErrorRate,
        sampleCount: recent.length,
        lastUpdated: recent[recent.length - 1].timestamp
      };
    }
    
    return summary;
  }

  /**
   * Get the best performing provider based on recent metrics
   * @param {Object} criteria - Selection criteria
   * @returns {string} Best provider name
   */
  getBestProvider(criteria = {}) {
    const { 
      prioritizeLatency = false, 
      prioritizeThroughput = true, 
      prioritizeReliability = true 
    } = criteria;
    
    const summary = this.getPerformanceSummary();
    const providers = Object.keys(summary);
    
    if (providers.length === 0) {
      return null;
    }
    
    let bestProvider = providers[0];
    let bestScore = this._calculateProviderScore(summary[bestProvider], criteria);
    
    for (let i = 1; i < providers.length; i++) {
      const provider = providers[i];
      const score = this._calculateProviderScore(summary[provider], criteria);
      
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }
    
    return bestProvider;
  }

  /**
   * Calculate provider performance score
   * @param {Object} metrics - Provider metrics
   * @param {Object} criteria - Scoring criteria
   * @returns {number} Performance score
   * @private
   */
  _calculateProviderScore(metrics, criteria) {
    const { avgResponseTime, avgThroughput, avgErrorRate } = metrics;
    
    // Normalize metrics (lower is better for response time and error rate)
    const latencyScore = avgResponseTime > 0 ? 1 / (avgResponseTime / 1000) : 0;
    const throughputScore = avgThroughput || 0;
    const reliabilityScore = 1 - (avgErrorRate || 0);
    
    // Weight the scores based on criteria
    let totalScore = 0;
    let totalWeight = 0;
    
    if (criteria.prioritizeLatency) {
      totalScore += latencyScore * 0.4;
      totalWeight += 0.4;
    }
    
    if (criteria.prioritizeThroughput) {
      totalScore += throughputScore * 0.4;
      totalWeight += 0.4;
    }
    
    if (criteria.prioritizeReliability) {
      totalScore += reliabilityScore * 0.2;
      totalWeight += 0.2;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}