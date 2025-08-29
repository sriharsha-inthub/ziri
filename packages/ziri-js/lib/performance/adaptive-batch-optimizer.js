/**
 * Adaptive Batch Optimizer
 * Implements intelligent batch sizing based on API response times and provider characteristics
 */

import { EventEmitter } from 'events';

export class AdaptiveBatchOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      targetResponseTime: options.targetResponseTime || 2000, // 2 seconds
      minBatchSize: options.minBatchSize || 5,
      maxBatchSize: options.maxBatchSize || 200,
      initialBatchSize: options.initialBatchSize || 50,
      adaptationRate: options.adaptationRate || 0.2, // How aggressively to adapt
      stabilityThreshold: options.stabilityThreshold || 3, // Consecutive measurements before adapting
      responseTimeWindow: options.responseTimeWindow || 10, // Number of recent measurements to consider
      ...options
    };
    
    // Optimization state
    this.currentBatchSize = this.options.initialBatchSize;
    this.responseTimeHistory = [];
    this.throughputHistory = [];
    this.adaptationHistory = [];
    
    // Stability tracking
    this.consecutiveSlowResponses = 0;
    this.consecutiveFastResponses = 0;
    this.consecutiveStableResponses = 0;
    
    // Performance metrics
    this.metrics = {
      totalAdaptations: 0,
      improvementCount: 0,
      degradationCount: 0,
      averageResponseTime: 0,
      averageThroughput: 0,
      optimalBatchSize: this.options.initialBatchSize
    };
  }

  /**
   * Record a batch processing result and adapt batch size
   * @param {Object} result - Batch processing result
   * @param {number} result.responseTime - Response time in milliseconds
   * @param {number} result.batchSize - Size of the processed batch
   * @param {number} result.itemCount - Number of items processed
   * @param {string} result.provider - Provider used
   * @returns {Object} Optimization decision
   */
  recordResult(result) {
    const { responseTime, batchSize, itemCount, provider } = result;
    
    // Calculate throughput (items per second)
    const throughput = itemCount / (responseTime / 1000);
    
    // Update history
    this.responseTimeHistory.push({
      responseTime,
      batchSize,
      throughput,
      provider,
      timestamp: Date.now()
    });
    
    // Keep only recent history
    if (this.responseTimeHistory.length > this.options.responseTimeWindow) {
      this.responseTimeHistory.shift();
    }
    
    this.throughputHistory.push(throughput);
    if (this.throughputHistory.length > this.options.responseTimeWindow) {
      this.throughputHistory.shift();
    }
    
    // Update metrics
    this._updateMetrics();
    
    // Make adaptation decision
    const decision = this._makeAdaptationDecision(result);
    
    // Apply adaptation if needed
    if (decision.shouldAdapt) {
      const oldSize = this.currentBatchSize;
      this.currentBatchSize = decision.newBatchSize;
      
      this.adaptationHistory.push({
        timestamp: Date.now(),
        oldSize,
        newSize: this.currentBatchSize,
        reason: decision.reason,
        responseTime,
        throughput,
        provider
      });
      
      this.metrics.totalAdaptations++;
      
      this.emit('batch:adapted', {
        oldSize,
        newSize: this.currentBatchSize,
        reason: decision.reason,
        responseTime,
        throughput,
        provider
      });
    }
    
    this.emit('result:recorded', {
      responseTime,
      throughput,
      currentBatchSize: this.currentBatchSize,
      decision
    });
    
    return decision;
  }

  /**
   * Get current optimal batch size
   * @returns {number} Current batch size
   */
  getCurrentBatchSize() {
    return this.currentBatchSize;
  }

  /**
   * Get optimization metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      currentBatchSize: this.currentBatchSize,
      responseTimeHistory: this.responseTimeHistory.slice(-5), // Last 5 results
      adaptationHistory: this.adaptationHistory.slice(-10), // Last 10 adaptations
      stability: this._calculateStability()
    };
  }

  /**
   * Reset optimizer state
   */
  reset() {
    this.currentBatchSize = this.options.initialBatchSize;
    this.responseTimeHistory = [];
    this.throughputHistory = [];
    this.adaptationHistory = [];
    this.consecutiveSlowResponses = 0;
    this.consecutiveFastResponses = 0;
    this.consecutiveStableResponses = 0;
    
    this.metrics = {
      totalAdaptations: 0,
      improvementCount: 0,
      degradationCount: 0,
      averageResponseTime: 0,
      averageThroughput: 0,
      optimalBatchSize: this.options.initialBatchSize
    };
    
    this.emit('optimizer:reset');
  }

  /**
   * Set target response time
   * @param {number} targetTime - Target response time in milliseconds
   */
  setTargetResponseTime(targetTime) {
    this.options.targetResponseTime = targetTime;
    this.emit('target:updated', { targetResponseTime: targetTime });
  }

  /**
   * Make adaptation decision based on recent performance
   * @param {Object} result - Latest batch result
   * @returns {Object} Adaptation decision
   * @private
   */
  _makeAdaptationDecision(result) {
    const { responseTime, provider } = result;
    const targetTime = this.options.targetResponseTime;
    const tolerance = targetTime * 0.15; // 15% tolerance
    
    let decision = {
      shouldAdapt: false,
      newBatchSize: this.currentBatchSize,
      reason: 'stable',
      confidence: 0
    };
    
    // Check if we have enough history for stable decisions
    if (this.responseTimeHistory.length < 3) {
      return decision;
    }
    
    // Calculate recent average response time
    const recentResponses = this.responseTimeHistory.slice(-3);
    const avgResponseTime = recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / recentResponses.length;
    
    // Determine if response is consistently slow or fast
    if (avgResponseTime > targetTime + tolerance) {
      this.consecutiveSlowResponses++;
      this.consecutiveFastResponses = 0;
      this.consecutiveStableResponses = 0;
      
      // Decrease batch size if consistently slow
      if (this.consecutiveSlowResponses >= this.options.stabilityThreshold) {
        const reductionFactor = Math.min(0.8, 1 - (avgResponseTime - targetTime) / targetTime * this.options.adaptationRate);
        const newSize = Math.max(
          this.options.minBatchSize,
          Math.floor(this.currentBatchSize * reductionFactor)
        );
        
        if (newSize < this.currentBatchSize) {
          decision = {
            shouldAdapt: true,
            newBatchSize: newSize,
            reason: 'response_too_slow',
            confidence: Math.min(0.9, this.consecutiveSlowResponses / this.options.stabilityThreshold)
          };
        }
        
        this.consecutiveSlowResponses = 0;
      }
      
    } else if (avgResponseTime < targetTime - tolerance) {
      this.consecutiveFastResponses++;
      this.consecutiveSlowResponses = 0;
      this.consecutiveStableResponses = 0;
      
      // Increase batch size if consistently fast and throughput is good
      if (this.consecutiveFastResponses >= this.options.stabilityThreshold) {
        const avgThroughput = this.throughputHistory.slice(-3).reduce((sum, t) => sum + t, 0) / 3;
        const recentThroughput = this.throughputHistory.slice(-1)[0];
        
        // Only increase if throughput is stable or improving
        if (recentThroughput >= avgThroughput * 0.9) {
          const increaseFactor = Math.min(1.3, 1 + (targetTime - avgResponseTime) / targetTime * this.options.adaptationRate);
          const newSize = Math.min(
            this.options.maxBatchSize,
            Math.floor(this.currentBatchSize * increaseFactor)
          );
          
          if (newSize > this.currentBatchSize) {
            decision = {
              shouldAdapt: true,
              newBatchSize: newSize,
              reason: 'response_fast_increase_throughput',
              confidence: Math.min(0.8, this.consecutiveFastResponses / this.options.stabilityThreshold)
            };
          }
        }
        
        this.consecutiveFastResponses = 0;
      }
      
    } else {
      // Response time is within target range
      this.consecutiveStableResponses++;
      this.consecutiveSlowResponses = 0;
      this.consecutiveFastResponses = 0;
      
      // Fine-tune for optimal throughput when stable
      if (this.consecutiveStableResponses >= this.options.stabilityThreshold * 2) {
        decision = this._optimizeForThroughput();
        this.consecutiveStableResponses = 0;
      }
    }
    
    return decision;
  }

  /**
   * Optimize batch size for maximum throughput when response time is stable
   * @returns {Object} Optimization decision
   * @private
   */
  _optimizeForThroughput() {
    if (this.throughputHistory.length < 5) {
      return { shouldAdapt: false, reason: 'insufficient_throughput_data' };
    }
    
    // Analyze throughput trend
    const recentThroughput = this.throughputHistory.slice(-3);
    const olderThroughput = this.throughputHistory.slice(-6, -3);
    
    if (olderThroughput.length === 0) {
      return { shouldAdapt: false, reason: 'insufficient_comparison_data' };
    }
    
    const recentAvg = recentThroughput.reduce((sum, t) => sum + t, 0) / recentThroughput.length;
    const olderAvg = olderThroughput.reduce((sum, t) => sum + t, 0) / olderThroughput.length;
    
    // If throughput is declining, try smaller batch size
    if (recentAvg < olderAvg * 0.95) {
      const newSize = Math.max(
        this.options.minBatchSize,
        Math.floor(this.currentBatchSize * 0.9)
      );
      
      if (newSize < this.currentBatchSize) {
        return {
          shouldAdapt: true,
          newBatchSize: newSize,
          reason: 'throughput_declining',
          confidence: 0.6
        };
      }
    }
    
    // If throughput is stable and we're not at max, try slightly larger batch
    else if (recentAvg >= olderAvg * 0.98 && this.currentBatchSize < this.options.maxBatchSize) {
      const newSize = Math.min(
        this.options.maxBatchSize,
        Math.floor(this.currentBatchSize * 1.1)
      );
      
      if (newSize > this.currentBatchSize) {
        return {
          shouldAdapt: true,
          newBatchSize: newSize,
          reason: 'throughput_stable_explore_larger',
          confidence: 0.5
        };
      }
    }
    
    return { shouldAdapt: false, reason: 'throughput_optimal' };
  }

  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics() {
    if (this.responseTimeHistory.length === 0) return;
    
    // Calculate averages
    const responseTimes = this.responseTimeHistory.map(r => r.responseTime);
    this.metrics.averageResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    
    if (this.throughputHistory.length > 0) {
      this.metrics.averageThroughput = this.throughputHistory.reduce((sum, t) => sum + t, 0) / this.throughputHistory.length;
    }
    
    // Find optimal batch size based on throughput
    if (this.responseTimeHistory.length >= 5) {
      const batchPerformance = new Map();
      
      for (const record of this.responseTimeHistory) {
        if (!batchPerformance.has(record.batchSize)) {
          batchPerformance.set(record.batchSize, []);
        }
        batchPerformance.get(record.batchSize).push(record.throughput);
      }
      
      let bestBatchSize = this.currentBatchSize;
      let bestThroughput = 0;
      
      for (const [batchSize, throughputs] of batchPerformance) {
        const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
        if (avgThroughput > bestThroughput) {
          bestThroughput = avgThroughput;
          bestBatchSize = batchSize;
        }
      }
      
      this.metrics.optimalBatchSize = bestBatchSize;
    }
    
    // Count improvements vs degradations
    if (this.adaptationHistory.length >= 2) {
      const recent = this.adaptationHistory.slice(-5);
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1];
        const curr = recent[i];
        
        // Compare throughput before and after adaptation
        const prevThroughput = this.responseTimeHistory.find(r => 
          Math.abs(r.timestamp - prev.timestamp) < 5000
        )?.throughput || 0;
        
        const currThroughput = this.responseTimeHistory.find(r => 
          Math.abs(r.timestamp - curr.timestamp) < 5000
        )?.throughput || 0;
        
        if (currThroughput > prevThroughput * 1.05) {
          this.metrics.improvementCount++;
        } else if (currThroughput < prevThroughput * 0.95) {
          this.metrics.degradationCount++;
        }
      }
    }
  }

  /**
   * Calculate stability score
   * @returns {Object} Stability metrics
   * @private
   */
  _calculateStability() {
    if (this.responseTimeHistory.length < 5) {
      return { score: 0, reason: 'insufficient_data' };
    }
    
    const responseTimes = this.responseTimeHistory.slice(-5).map(r => r.responseTime);
    const throughputs = this.throughputHistory.slice(-5);
    
    // Calculate coefficient of variation for response times
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const responseTimeVariance = responseTimes.reduce((sum, t) => sum + Math.pow(t - avgResponseTime, 2), 0) / responseTimes.length;
    const responseTimeCV = Math.sqrt(responseTimeVariance) / avgResponseTime;
    
    // Calculate coefficient of variation for throughput
    const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
    const throughputVariance = throughputs.reduce((sum, t) => sum + Math.pow(t - avgThroughput, 2), 0) / throughputs.length;
    const throughputCV = Math.sqrt(throughputVariance) / avgThroughput;
    
    // Stability score (lower CV = higher stability)
    const responseTimeStability = Math.max(0, 1 - responseTimeCV);
    const throughputStability = Math.max(0, 1 - throughputCV);
    const overallStability = (responseTimeStability + throughputStability) / 2;
    
    return {
      score: overallStability,
      responseTimeStability,
      throughputStability,
      responseTimeCV,
      throughputCV,
      reason: overallStability > 0.8 ? 'stable' : 
              overallStability > 0.6 ? 'moderately_stable' : 'unstable'
    };
  }
}

/**
 * Provider-specific batch optimizer that adapts to different provider characteristics
 */
export class ProviderSpecificBatchOptimizer extends AdaptiveBatchOptimizer {
  constructor(options = {}) {
    super(options);
    
    this.providerProfiles = new Map();
    this.currentProvider = null;
  }

  /**
   * Set provider-specific optimization profile
   * @param {string} provider - Provider name
   * @param {Object} profile - Provider optimization profile
   */
  setProviderProfile(provider, profile) {
    this.providerProfiles.set(provider, {
      targetResponseTime: profile.targetResponseTime || this.options.targetResponseTime,
      minBatchSize: profile.minBatchSize || this.options.minBatchSize,
      maxBatchSize: profile.maxBatchSize || this.options.maxBatchSize,
      adaptationRate: profile.adaptationRate || this.options.adaptationRate,
      stabilityThreshold: profile.stabilityThreshold || this.options.stabilityThreshold,
      rateLimitSensitive: profile.rateLimitSensitive || false,
      latencySensitive: profile.latencySensitive || false,
      throughputOptimized: profile.throughputOptimized || false,
      ...profile
    });
  }

  /**
   * Switch to a different provider and adapt settings
   * @param {string} provider - Provider name
   */
  switchProvider(provider) {
    if (this.currentProvider !== provider) {
      this.currentProvider = provider;
      
      // Apply provider-specific settings
      if (this.providerProfiles.has(provider)) {
        const profile = this.providerProfiles.get(provider);
        
        // Update options with provider-specific values
        Object.assign(this.options, profile);
        
        // Reset batch size to provider-specific initial value
        this.currentBatchSize = profile.initialBatchSize || this.options.initialBatchSize;
        
        this.emit('provider:switched', {
          provider,
          profile,
          newBatchSize: this.currentBatchSize
        });
      }
    }
  }

  /**
   * Record result with provider-specific adaptations
   * @param {Object} result - Batch processing result
   * @returns {Object} Optimization decision
   */
  recordResult(result) {
    // Switch provider context if needed
    if (result.provider && result.provider !== this.currentProvider) {
      this.switchProvider(result.provider);
    }
    
    // Apply provider-specific decision logic
    const baseDecision = super.recordResult(result);
    
    if (this.currentProvider && this.providerProfiles.has(this.currentProvider)) {
      const profile = this.providerProfiles.get(this.currentProvider);
      
      // Apply provider-specific modifications
      if (profile.rateLimitSensitive && result.responseTime > this.options.targetResponseTime * 1.5) {
        // Be more aggressive in reducing batch size for rate-limit sensitive providers
        baseDecision.newBatchSize = Math.max(
          this.options.minBatchSize,
          Math.floor(baseDecision.newBatchSize * 0.7)
        );
        baseDecision.reason += '_rate_limit_sensitive';
      }
      
      if (profile.latencySensitive) {
        // Prioritize low latency over throughput
        const latencyTarget = this.options.targetResponseTime * 0.8;
        if (result.responseTime > latencyTarget && baseDecision.shouldAdapt) {
          baseDecision.newBatchSize = Math.max(
            this.options.minBatchSize,
            Math.floor(baseDecision.newBatchSize * 0.8)
          );
          baseDecision.reason += '_latency_optimized';
        }
      }
      
      if (profile.throughputOptimized && !baseDecision.shouldAdapt) {
        // More aggressive throughput optimization
        const throughputDecision = this._aggressiveThroughputOptimization();
        if (throughputDecision.shouldAdapt) {
          return throughputDecision;
        }
      }
    }
    
    return baseDecision;
  }

  /**
   * More aggressive throughput optimization for throughput-optimized providers
   * @returns {Object} Optimization decision
   * @private
   */
  _aggressiveThroughputOptimization() {
    if (this.throughputHistory.length < 3) {
      return { shouldAdapt: false, reason: 'insufficient_data' };
    }
    
    const recentThroughput = this.throughputHistory.slice(-2);
    const trend = recentThroughput[1] - recentThroughput[0];
    
    // If throughput is increasing, try larger batches more aggressively
    if (trend > 0 && this.currentBatchSize < this.options.maxBatchSize) {
      const newSize = Math.min(
        this.options.maxBatchSize,
        Math.floor(this.currentBatchSize * 1.2)
      );
      
      return {
        shouldAdapt: true,
        newBatchSize: newSize,
        reason: 'aggressive_throughput_optimization',
        confidence: 0.7
      };
    }
    
    return { shouldAdapt: false, reason: 'throughput_trend_stable' };
  }

  /**
   * Get provider-specific metrics
   * @returns {Object} Enhanced metrics with provider information
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    
    return {
      ...baseMetrics,
      currentProvider: this.currentProvider,
      providerProfile: this.currentProvider ? this.providerProfiles.get(this.currentProvider) : null,
      providerCount: this.providerProfiles.size
    };
  }
}