/**
 * Resilient Embedding Client
 * Enhanced embedding client with comprehensive error handling and fallback strategies
 */

import { EventEmitter } from 'events';
import { EmbeddingClient } from '../embedding/embedding-client.js';
import { ErrorHandler, ProviderError, RateLimitError, AuthenticationError, NetworkError } from './error-handler.js';
import { ProviderFallbackManager } from './provider-fallback.js';

export class ResilientEmbeddingClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.baseClient = new EmbeddingClient(config);
    
    // Initialize error handler
    this.errorHandler = new ErrorHandler({
      maxRetries: config.maxRetries || 3,
      baseRetryDelay: config.baseRetryDelay || 1000,
      maxRetryDelay: config.maxRetryDelay || 30000,
      enableFallback: config.enableFallback !== false,
      fallbackProviders: config.fallbackProviders || [],
      ...config.errorHandling
    });
    
    // Initialize fallback manager
    this.fallbackManager = new ProviderFallbackManager(this.baseClient, {
      enableFallback: config.enableFallback !== false,
      fallbackOrder: config.fallbackOrder || [],
      maxFallbackAttempts: config.maxFallbackAttempts || 3,
      testProvidersOnInit: config.testProvidersOnInit !== false,
      ...config.fallback
    });
    
    // Forward events from components
    this._setupEventForwarding();
    
    // Performance and reliability tracking
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbacksUsed: 0,
      totalRetries: 0,
      avgResponseTime: 0,
      responseTimes: []
    };
  }

  /**
   * Generate embeddings with comprehensive error handling and fallback
   * @param {string[]} texts - Array of texts to embed
   * @param {string} providerType - Provider type to use (optional)
   * @returns {Promise<Object>} Embedding result with metadata
   */
  async embed(texts, providerType = null) {
    if (!texts || texts.length === 0) {
      return {
        embeddings: [],
        provider: providerType || this.baseClient.defaultProvider,
        responseTime: 0,
        fallbackUsed: false,
        retries: 0
      };
    }

    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      // Use fallback manager for resilient embedding
      const result = await this.fallbackManager.embedWithFallback(texts, providerType);
      
      // Update statistics
      const responseTime = Date.now() - startTime;
      this._updateStats(true, responseTime, result.fallbackUsed);
      
      this.emit('embed:success', {
        textsCount: texts.length,
        provider: result.provider,
        responseTime,
        fallbackUsed: result.fallbackUsed,
        attempt: result.attempt
      });
      
      return {
        embeddings: result.embeddings,
        provider: result.provider,
        responseTime,
        fallbackUsed: result.fallbackUsed,
        retries: result.attempt - 1,
        metadata: {
          timestamp: new Date(),
          textsProcessed: texts.length,
          embeddingDimensions: result.embeddings[0]?.length || 0
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this._updateStats(false, responseTime, false);
      
      // Get detailed error information
      const errorDetails = this.errorHandler.getDetailedErrorMessage(error, {
        provider: providerType || this.baseClient.defaultProvider,
        textsCount: texts.length,
        operation: 'embed'
      });
      
      this.emit('embed:error', {
        error: errorDetails,
        textsCount: texts.length,
        responseTime
      });
      
      // Enhance error with additional context
      const enhancedError = new ProviderError(
        `Embedding failed: ${errorDetails.message}`,
        errorDetails.provider,
        error,
        {
          suggestions: errorDetails.suggestions,
          troubleshooting: errorDetails.troubleshooting,
          documentation: errorDetails.documentation,
          textsCount: texts.length,
          responseTime
        }
      );
      
      throw enhancedError;
    }
  }

  /**
   * Generate embeddings with custom retry and fallback configuration
   * @param {string[]} texts - Array of texts to embed
   * @param {Object} options - Custom options for this request
   * @returns {Promise<Object>} Embedding result
   */
  async embedWithOptions(texts, options = {}) {
    const originalConfig = { ...this.errorHandler.options };
    
    try {
      // Temporarily update error handler configuration
      if (options.maxRetries !== undefined) {
        this.errorHandler.options.maxRetries = options.maxRetries;
      }
      if (options.fallbackProviders) {
        this.errorHandler.options.fallbackProviders = options.fallbackProviders;
      }
      
      return await this.embed(texts, options.provider);
      
    } finally {
      // Restore original configuration
      this.errorHandler.options = originalConfig;
    }
  }

  /**
   * Test provider connectivity with detailed diagnostics
   * @param {string} providerType - Provider type to test
   * @returns {Promise<Object>} Detailed test result
   */
  async testProvider(providerType) {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const basicTest = await this.baseClient.testProvider(providerType);
      
      if (!basicTest.success) {
        return {
          ...basicTest,
          provider: providerType,
          diagnostics: await this._runDiagnostics(providerType, basicTest.error)
        };
      }
      
      // Test with actual embedding request
      const testTexts = ['Hello world', 'Test embedding'];
      const embedResult = await this.baseClient.embed(testTexts, providerType);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        provider: providerType,
        responseTime,
        embeddingDimensions: embedResult[0]?.length || 0,
        testsPerformed: ['connectivity', 'authentication', 'embedding'],
        diagnostics: {
          healthy: true,
          issues: []
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        provider: providerType,
        error: error.message,
        responseTime,
        diagnostics: await this._runDiagnostics(providerType, error)
      };
    }
  }

  /**
   * Test all providers with comprehensive diagnostics
   * @returns {Promise<Object>} Test results for all providers
   */
  async testAllProviders() {
    const results = {};
    const availableProviders = this.baseClient.getAvailableProviders();
    
    this.emit('test:started', { providers: availableProviders });
    
    for (const provider of availableProviders) {
      this.emit('test:provider_started', { provider });
      
      try {
        results[provider] = await this.testProvider(provider);
      } catch (error) {
        results[provider] = {
          success: false,
          provider,
          error: error.message,
          responseTime: 0,
          diagnostics: {
            healthy: false,
            issues: ['Test execution failed']
          }
        };
      }
      
      this.emit('test:provider_completed', { 
        provider, 
        result: results[provider] 
      });
    }
    
    this.emit('test:completed', { results });
    
    return results;
  }

  /**
   * Get comprehensive health status
   * @returns {Object} Health status including statistics and diagnostics
   */
  async getHealthStatus() {
    const providerHealth = this.fallbackManager.getProviderHealth();
    const errorStats = this.errorHandler.getErrorStats();
    const fallbackStats = this.fallbackManager.getFallbackStats();
    
    return {
      overall: {
        healthy: this._calculateOverallHealth(),
        uptime: this._calculateUptime(),
        reliability: this._calculateReliability()
      },
      providers: providerHealth,
      statistics: {
        ...this.stats,
        errors: errorStats,
        fallbacks: fallbackStats
      },
      recommendations: this._generateHealthRecommendations()
    };
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      requests: {
        total: this.stats.totalRequests,
        successful: this.stats.successfulRequests,
        failed: this.stats.failedRequests,
        successRate: this.stats.totalRequests > 0 
          ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
          : 0
      },
      responseTime: {
        average: this.stats.avgResponseTime,
        recent: this.stats.responseTimes.slice(-10),
        percentiles: this._calculatePercentiles()
      },
      reliability: {
        fallbacksUsed: this.stats.fallbacksUsed,
        totalRetries: this.stats.totalRetries,
        fallbackRate: this.stats.totalRequests > 0 
          ? (this.stats.fallbacksUsed / this.stats.totalRequests) * 100 
          : 0
      }
    };
  }

  /**
   * Reset all statistics and health data
   */
  reset() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbacksUsed: 0,
      totalRetries: 0,
      avgResponseTime: 0,
      responseTimes: []
    };
    
    this.errorHandler.resetStats();
    this.fallbackManager.reset();
    
    this.emit('reset', { timestamp: new Date() });
  }

  /**
   * Get the best available provider
   * @param {string[]} preferredOrder - Preferred provider order
   * @returns {Promise<string>} Best available provider
   */
  async getBestProvider(preferredOrder = null) {
    return this.fallbackManager.getBestProvider(preferredOrder);
  }

  /**
   * Switch to a different default provider
   * @param {string} providerType - New default provider type
   */
  switchProvider(providerType) {
    this.baseClient.switchProvider(providerType);
    this.emit('provider:switched', { 
      newProvider: providerType,
      timestamp: new Date()
    });
  }

  /**
   * Get available provider types
   * @returns {string[]} Array of configured provider types
   */
  getAvailableProviders() {
    return this.baseClient.getAvailableProviders();
  }

  /**
   * Add or update a provider configuration
   * @param {string} type - Provider type
   * @param {Object} config - Provider configuration
   */
  addProvider(type, config) {
    this.baseClient.addProvider(type, config);
    this.fallbackManager._initializeProviderHealth();
    
    this.emit('provider:added', { 
      type, 
      config: { ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined }
    });
  }

  /**
   * Remove a provider
   * @param {string} type - Provider type to remove
   */
  removeProvider(type) {
    this.baseClient.removeProvider(type);
    
    this.emit('provider:removed', { type });
  }

  /**
   * Setup event forwarding from components
   * @private
   */
  _setupEventForwarding() {
    // Forward error handler events
    this.errorHandler.on('error:detected', (data) => {
      this.emit('error:detected', data);
    });
    
    this.errorHandler.on('error:recovered', (data) => {
      this.emit('error:recovered', data);
    });
    
    // Forward fallback manager events
    this.fallbackManager.on('fallback:success', (data) => {
      this.emit('fallback:success', data);
    });
    
    this.fallbackManager.on('fallback:exhausted', (data) => {
      this.emit('fallback:exhausted', data);
    });
    
    this.fallbackManager.on('provider:health_updated', (data) => {
      this.emit('provider:health_updated', data);
    });
  }

  /**
   * Update performance statistics
   * @param {boolean} success - Whether request was successful
   * @param {number} responseTime - Response time in milliseconds
   * @param {boolean} fallbackUsed - Whether fallback was used
   * @private
   */
  _updateStats(success, responseTime, fallbackUsed) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
    
    if (fallbackUsed) {
      this.stats.fallbacksUsed++;
    }
    
    // Update response time tracking
    this.stats.responseTimes.push(responseTime);
    if (this.stats.responseTimes.length > 100) {
      this.stats.responseTimes.shift();
    }
    
    this.stats.avgResponseTime = this.stats.responseTimes.reduce((a, b) => a + b) / this.stats.responseTimes.length;
  }

  /**
   * Run diagnostics for a provider
   * @param {string} providerType - Provider type
   * @param {Error} error - Error that occurred
   * @returns {Promise<Object>} Diagnostic results
   * @private
   */
  async _runDiagnostics(providerType, error) {
    const diagnostics = {
      healthy: false,
      issues: [],
      recommendations: []
    };
    
    // Analyze error type
    if (error?.message?.includes('401') || error?.message?.includes('unauthorized')) {
      diagnostics.issues.push('Authentication failure');
      diagnostics.recommendations.push('Check API key configuration');
      diagnostics.recommendations.push('Verify API key permissions');
    }
    
    if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
      diagnostics.issues.push('Rate limit exceeded');
      diagnostics.recommendations.push('Reduce request frequency');
      diagnostics.recommendations.push('Consider upgrading API plan');
    }
    
    if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
      diagnostics.issues.push('Network connectivity issue');
      diagnostics.recommendations.push('Check internet connection');
      diagnostics.recommendations.push('Verify provider endpoint accessibility');
    }
    
    // Check provider configuration
    try {
      const provider = this.baseClient._getProvider(providerType);
      if (!provider.isReady()) {
        diagnostics.issues.push('Provider configuration invalid');
        diagnostics.recommendations.push('Review provider configuration');
      }
    } catch (configError) {
      diagnostics.issues.push('Provider not configured');
      diagnostics.recommendations.push('Add provider configuration');
    }
    
    return diagnostics;
  }

  /**
   * Calculate overall health score
   * @returns {number} Health score (0-100)
   * @private
   */
  _calculateOverallHealth() {
    if (this.stats.totalRequests === 0) return 100;
    
    const successRate = (this.stats.successfulRequests / this.stats.totalRequests) * 100;
    const fallbackPenalty = (this.stats.fallbacksUsed / this.stats.totalRequests) * 10;
    
    return Math.max(0, Math.min(100, successRate - fallbackPenalty));
  }

  /**
   * Calculate uptime percentage
   * @returns {number} Uptime percentage
   * @private
   */
  _calculateUptime() {
    // Simple uptime calculation based on success rate
    if (this.stats.totalRequests === 0) return 100;
    return (this.stats.successfulRequests / this.stats.totalRequests) * 100;
  }

  /**
   * Calculate reliability score
   * @returns {number} Reliability score (0-100)
   * @private
   */
  _calculateReliability() {
    if (this.stats.totalRequests === 0) return 100;
    
    const baseReliability = (this.stats.successfulRequests / this.stats.totalRequests) * 100;
    const retryPenalty = (this.stats.totalRetries / this.stats.totalRequests) * 5;
    
    return Math.max(0, Math.min(100, baseReliability - retryPenalty));
  }

  /**
   * Calculate response time percentiles
   * @returns {Object} Response time percentiles
   * @private
   */
  _calculatePercentiles() {
    if (this.stats.responseTimes.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...this.stats.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  /**
   * Generate health recommendations
   * @returns {string[]} Array of recommendations
   * @private
   */
  _generateHealthRecommendations() {
    const recommendations = [];
    
    if (this.stats.totalRequests > 0) {
      const successRate = (this.stats.successfulRequests / this.stats.totalRequests) * 100;
      const fallbackRate = (this.stats.fallbacksUsed / this.stats.totalRequests) * 100;
      
      if (successRate < 95) {
        recommendations.push('Success rate is below 95%. Consider reviewing provider configurations.');
      }
      
      if (fallbackRate > 10) {
        recommendations.push('High fallback usage detected. Primary provider may be unreliable.');
      }
      
      if (this.stats.avgResponseTime > 5000) {
        recommendations.push('Average response time is high. Consider optimizing batch sizes or switching providers.');
      }
    }
    
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length < 2) {
      recommendations.push('Configure multiple providers for better reliability.');
    }
    
    return recommendations;
  }
}