/**
 * Provider Fallback Manager
 * Handles automatic fallback between embedding providers when failures occur
 */

import { EventEmitter } from 'events';
import { ProviderError, AuthenticationError, RateLimitError } from './error-handler.js';

export class ProviderFallbackManager extends EventEmitter {
  constructor(embeddingClient, options = {}) {
    super();
    
    this.client = embeddingClient;
    this.options = {
      enableFallback: options.enableFallback !== false,
      fallbackOrder: options.fallbackOrder || [],
      maxFallbackAttempts: options.maxFallbackAttempts || 3,
      testProvidersOnInit: options.testProvidersOnInit !== false,
      fallbackCooldown: options.fallbackCooldown || 60000, // 1 minute
      ...options
    };
    
    // Fallback state
    this.providerHealth = new Map();
    this.fallbackHistory = [];
    this.lastFallbackTime = new Map();
    this.currentProvider = null;
    
    // Initialize provider health tracking
    this._initializeProviderHealth();
  }

  /**
   * Execute embedding operation with automatic fallback
   * @param {string[]} texts - Texts to embed
   * @param {string} preferredProvider - Preferred provider (optional)
   * @returns {Promise<Object>} Embedding result with provider info
   */
  async embedWithFallback(texts, preferredProvider = null) {
    const startProvider = preferredProvider || this.client.defaultProvider;
    const fallbackChain = this._buildFallbackChain(startProvider);
    
    let lastError;
    let attemptCount = 0;
    
    for (const provider of fallbackChain) {
      if (attemptCount >= this.options.maxFallbackAttempts) {
        break;
      }
      
      try {
        // Check if provider is in cooldown
        if (this._isProviderInCooldown(provider)) {
          this.emit('provider:skipped', {
            provider,
            reason: 'cooldown',
            cooldownRemaining: this._getCooldownRemaining(provider)
          });
          continue;
        }
        
        // Check provider health
        const health = this.providerHealth.get(provider);
        if (health && !health.healthy && health.consecutiveFailures > 2) {
          this.emit('provider:skipped', {
            provider,
            reason: 'unhealthy',
            consecutiveFailures: health.consecutiveFailures
          });
          continue;
        }
        
        this.emit('provider:attempting', {
          provider,
          attempt: attemptCount + 1,
          totalProviders: fallbackChain.length
        });
        
        const startTime = Date.now();
        const embeddings = await this.client.embed(texts, provider);
        const responseTime = Date.now() - startTime;
        
        // Update provider health on success
        this._updateProviderHealth(provider, true, responseTime);
        
        // Record successful fallback if not the original provider
        if (provider !== startProvider) {
          this._recordFallback(startProvider, provider, true);
          this.emit('fallback:success', {
            fromProvider: startProvider,
            toProvider: provider,
            attempt: attemptCount + 1,
            responseTime
          });
        }
        
        this.currentProvider = provider;
        
        return {
          embeddings,
          provider,
          responseTime,
          fallbackUsed: provider !== startProvider,
          attempt: attemptCount + 1
        };
        
      } catch (error) {
        lastError = error;
        attemptCount++;
        
        // Update provider health on failure
        this._updateProviderHealth(provider, false);
        
        // Set cooldown for certain error types
        if (error instanceof RateLimitError) {
          this._setCooldown(provider, error.retryAfter || 60000);
        } else if (error instanceof AuthenticationError) {
          this._setCooldown(provider, 300000); // 5 minutes for auth errors
        }
        
        this.emit('provider:failed', {
          provider,
          error: error.message,
          errorType: error.constructor.name,
          attempt: attemptCount
        });
        
        // Record failed fallback attempt
        if (provider !== startProvider) {
          this._recordFallback(startProvider, provider, false, error);
        }
      }
    }
    
    // All providers failed
    this.emit('fallback:exhausted', {
      originalProvider: startProvider,
      attemptedProviders: fallbackChain.slice(0, attemptCount),
      lastError: lastError?.message
    });
    
    throw new ProviderError(
      `All embedding providers failed. Last error: ${lastError?.message}`,
      startProvider,
      lastError,
      {
        attemptedProviders: fallbackChain.slice(0, attemptCount),
        totalAttempts: attemptCount
      }
    );
  }

  /**
   * Test all providers and update health status
   * @returns {Promise<Object>} Test results for all providers
   */
  async testAllProviders() {
    const results = {};
    const availableProviders = this.client.getAvailableProviders();
    
    this.emit('health:testing_started', { providers: availableProviders });
    
    for (const provider of availableProviders) {
      try {
        const startTime = Date.now();
        const testResult = await this.client.testProvider(provider);
        const responseTime = Date.now() - startTime;
        
        results[provider] = {
          ...testResult,
          responseTime
        };
        
        // Update health based on test result
        this._updateProviderHealth(provider, testResult.success, responseTime);
        
      } catch (error) {
        results[provider] = {
          success: false,
          error: error.message,
          responseTime: 0
        };
        
        this._updateProviderHealth(provider, false);
      }
    }
    
    this.emit('health:testing_completed', { results });
    
    return results;
  }

  /**
   * Get the best available provider based on health and performance
   * @param {string[]} preferredOrder - Preferred provider order
   * @returns {Promise<string>} Best available provider
   */
  async getBestProvider(preferredOrder = null) {
    const testResults = await this.testAllProviders();
    const order = preferredOrder || this.options.fallbackOrder || this.client.getAvailableProviders();
    
    // Score providers based on health, performance, and preference
    const providerScores = new Map();
    
    for (const provider of order) {
      const result = testResults[provider];
      const health = this.providerHealth.get(provider);
      
      if (!result?.success) {
        providerScores.set(provider, 0);
        continue;
      }
      
      let score = 100; // Base score
      
      // Preference bonus (earlier in order gets higher score)
      const preferenceBonus = (order.length - order.indexOf(provider)) * 10;
      score += preferenceBonus;
      
      // Health penalty
      if (health) {
        score -= health.consecutiveFailures * 20;
        if (!health.healthy) score -= 50;
      }
      
      // Performance bonus (faster response = higher score)
      if (result.responseTime > 0) {
        const performanceBonus = Math.max(0, 50 - (result.responseTime / 100));
        score += performanceBonus;
      }
      
      // Cooldown penalty
      if (this._isProviderInCooldown(provider)) {
        score -= 100;
      }
      
      providerScores.set(provider, Math.max(0, score));
    }
    
    // Find provider with highest score
    let bestProvider = null;
    let bestScore = -1;
    
    for (const [provider, score] of providerScores) {
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }
    
    if (!bestProvider) {
      throw new Error('No healthy embedding providers available');
    }
    
    this.emit('provider:selected', {
      provider: bestProvider,
      score: bestScore,
      allScores: Object.fromEntries(providerScores)
    });
    
    return bestProvider;
  }

  /**
   * Get provider health status
   * @param {string} provider - Provider name (optional)
   * @returns {Object} Health status
   */
  getProviderHealth(provider = null) {
    if (provider) {
      return this.providerHealth.get(provider) || {
        healthy: false,
        consecutiveFailures: 0,
        lastSuccess: null,
        lastFailure: null,
        avgResponseTime: 0
      };
    }
    
    const healthStatus = {};
    for (const [providerName, health] of this.providerHealth) {
      healthStatus[providerName] = { ...health };
    }
    
    return healthStatus;
  }

  /**
   * Get fallback statistics
   * @returns {Object} Fallback statistics
   */
  getFallbackStats() {
    const stats = {
      totalFallbacks: this.fallbackHistory.length,
      successfulFallbacks: this.fallbackHistory.filter(f => f.success).length,
      failedFallbacks: this.fallbackHistory.filter(f => !f.success).length,
      byProvider: {},
      recentFallbacks: this.fallbackHistory.slice(-10)
    };
    
    // Count fallbacks by provider
    for (const fallback of this.fallbackHistory) {
      const key = `${fallback.from} -> ${fallback.to}`;
      if (!stats.byProvider[key]) {
        stats.byProvider[key] = { total: 0, successful: 0 };
      }
      stats.byProvider[key].total++;
      if (fallback.success) {
        stats.byProvider[key].successful++;
      }
    }
    
    return stats;
  }

  /**
   * Reset provider health and fallback history
   */
  reset() {
    this.providerHealth.clear();
    this.fallbackHistory = [];
    this.lastFallbackTime.clear();
    this.currentProvider = null;
    this._initializeProviderHealth();
  }

  /**
   * Initialize provider health tracking
   * @private
   */
  _initializeProviderHealth() {
    const availableProviders = this.client.getAvailableProviders();
    
    for (const provider of availableProviders) {
      this.providerHealth.set(provider, {
        healthy: true,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastSuccess: null,
        lastFailure: null,
        totalRequests: 0,
        totalFailures: 0,
        avgResponseTime: 0,
        responseTimes: []
      });
    }
    
    // Test providers on initialization if enabled
    if (this.options.testProvidersOnInit) {
      setImmediate(() => this.testAllProviders());
    }
  }

  /**
   * Build fallback chain for a provider
   * @param {string} startProvider - Starting provider
   * @returns {string[]} Fallback chain
   * @private
   */
  _buildFallbackChain(startProvider) {
    const chain = [startProvider];
    const availableProviders = this.client.getAvailableProviders();
    const fallbackOrder = this.options.fallbackOrder.length > 0 
      ? this.options.fallbackOrder 
      : availableProviders;
    
    // Add providers from fallback order (excluding start provider)
    for (const provider of fallbackOrder) {
      if (provider !== startProvider && availableProviders.includes(provider)) {
        chain.push(provider);
      }
    }
    
    // Add any remaining available providers
    for (const provider of availableProviders) {
      if (!chain.includes(provider)) {
        chain.push(provider);
      }
    }
    
    return chain;
  }

  /**
   * Update provider health status
   * @param {string} provider - Provider name
   * @param {boolean} success - Whether operation was successful
   * @param {number} responseTime - Response time in milliseconds
   * @private
   */
  _updateProviderHealth(provider, success, responseTime = 0) {
    const health = this.providerHealth.get(provider);
    if (!health) return;
    
    health.totalRequests++;
    
    if (success) {
      health.consecutiveFailures = 0;
      health.consecutiveSuccesses++;
      health.lastSuccess = new Date();
      health.healthy = true;
      
      // Update response time tracking
      if (responseTime > 0) {
        health.responseTimes.push(responseTime);
        if (health.responseTimes.length > 10) {
          health.responseTimes.shift();
        }
        health.avgResponseTime = health.responseTimes.reduce((a, b) => a + b) / health.responseTimes.length;
      }
    } else {
      health.consecutiveSuccesses = 0;
      health.consecutiveFailures++;
      health.totalFailures++;
      health.lastFailure = new Date();
      
      // Mark as unhealthy after 3 consecutive failures
      if (health.consecutiveFailures >= 3) {
        health.healthy = false;
      }
    }
    
    this.emit('provider:health_updated', {
      provider,
      health: { ...health },
      success
    });
  }

  /**
   * Check if provider is in cooldown
   * @param {string} provider - Provider name
   * @returns {boolean} Whether provider is in cooldown
   * @private
   */
  _isProviderInCooldown(provider) {
    const lastFallback = this.lastFallbackTime.get(provider);
    if (!lastFallback) return false;
    
    return Date.now() - lastFallback < this.options.fallbackCooldown;
  }

  /**
   * Get remaining cooldown time for provider
   * @param {string} provider - Provider name
   * @returns {number} Remaining cooldown time in milliseconds
   * @private
   */
  _getCooldownRemaining(provider) {
    const lastFallback = this.lastFallbackTime.get(provider);
    if (!lastFallback) return 0;
    
    const elapsed = Date.now() - lastFallback;
    return Math.max(0, this.options.fallbackCooldown - elapsed);
  }

  /**
   * Set cooldown for provider
   * @param {string} provider - Provider name
   * @param {number} duration - Cooldown duration in milliseconds
   * @private
   */
  _setCooldown(provider, duration) {
    this.lastFallbackTime.set(provider, Date.now());
    
    this.emit('provider:cooldown_set', {
      provider,
      duration,
      expiresAt: new Date(Date.now() + duration)
    });
  }

  /**
   * Record fallback attempt
   * @param {string} fromProvider - Original provider
   * @param {string} toProvider - Fallback provider
   * @param {boolean} success - Whether fallback was successful
   * @param {Error} error - Error if fallback failed
   * @private
   */
  _recordFallback(fromProvider, toProvider, success, error = null) {
    const fallback = {
      from: fromProvider,
      to: toProvider,
      success,
      error: error?.message,
      timestamp: new Date()
    };
    
    this.fallbackHistory.push(fallback);
    
    // Keep only last 100 fallback records
    if (this.fallbackHistory.length > 100) {
      this.fallbackHistory.shift();
    }
    
    this.emit('fallback:recorded', fallback);
  }
}