/**
 * Embedding Client
 * Main interface for embedding operations with provider abstraction
 */

import { ProviderFactory } from './provider-factory.js';
import { RateLimiter } from './rate-limiter.js';

export class EmbeddingClient {
  constructor(config = {}) {
    this.config = config;
    this.providers = new Map();
    this.rateLimiters = new Map();
    this.defaultProvider = config.defaultProvider || 'openai';
    
    // Initialize providers from config
    if (config.providers) {
      this._initializeProviders(config.providers);
    }
  }

  /**
   * Generate embeddings using specified or default provider
   * @param {string[]} texts - Array of texts to embed
   * @param {string} providerType - Provider type to use (optional)
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embed(texts, providerType = null) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const type = providerType || this.defaultProvider;
    const provider = this._getProvider(type);
    const rateLimiter = this._getRateLimiter(type);

    // Estimate tokens for rate limiting
    const estimatedTokens = texts.reduce((sum, text) => sum + provider.estimateTokens(text), 0);

    // Execute with rate limiting
    return await rateLimiter.execute(
      () => provider.embed(texts),
      estimatedTokens
    );
  }

  /**
   * Get provider limits and capabilities
   * @param {string} providerType - Provider type
   * @returns {Object} Provider limits
   */
  getProviderLimits(providerType) {
    const provider = this._getProvider(providerType);
    return provider.getLimits();
  }

  /**
   * Test provider connectivity and authentication
   * @param {string} providerType - Provider type to test
   * @returns {Promise<Object>} Test result
   */
  async testProvider(providerType) {
    try {
      const provider = this._getProvider(providerType);
      return await provider.test();
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTime: 0
      };
    }
  }

  /**
   * Test all configured providers
   * @returns {Promise<Object>} Test results for all providers
   */
  async testAllProviders() {
    const results = {};
    
    for (const [type, provider] of this.providers) {
      results[type] = await this.testProvider(type);
    }
    
    return results;
  }

  /**
   * Switch to a different default provider
   * @param {string} providerType - New default provider type
   */
  switchProvider(providerType) {
    if (!this.providers.has(providerType)) {
      throw new Error(`Provider '${providerType}' is not configured`);
    }
    
    this.defaultProvider = providerType;
  }

  /**
   * Get available provider types
   * @returns {string[]} Array of configured provider types
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get the best available provider based on connectivity tests
   * @param {string[]} preferredOrder - Preferred provider order
   * @returns {Promise<string>} Best available provider type
   */
  async getBestProvider(preferredOrder = null) {
    const testResults = await this.testAllProviders();
    const order = preferredOrder || [this.defaultProvider, ...this.getAvailableProviders()];
    
    // Try providers in preferred order
    for (const type of order) {
      if (testResults[type]?.success) {
        return type;
      }
    }
    
    throw new Error('No working embedding providers found');
  }

  /**
   * Get rate limiter status for a provider
   * @param {string} providerType - Provider type
   * @returns {Object} Rate limiter status
   */
  getRateLimiterStatus(providerType) {
    const rateLimiter = this._getRateLimiter(providerType);
    return rateLimiter.getStatus();
  }

  /**
   * Get rate limiter status for all providers
   * @returns {Object} Rate limiter status for all providers
   */
  getAllRateLimiterStatus() {
    const status = {};
    
    for (const type of this.providers.keys()) {
      status[type] = this.getRateLimiterStatus(type);
    }
    
    return status;
  }

  /**
   * Add or update a provider configuration
   * @param {string} type - Provider type
   * @param {Object} config - Provider configuration
   */
  addProvider(type, config) {
    const provider = ProviderFactory.createProvider(type, config);
    this.providers.set(type, provider);
    
    // Create rate limiter for the provider
    const rateLimiter = new RateLimiter(config.rateLimit || {});
    this.rateLimiters.set(type, rateLimiter);
  }

  /**
   * Remove a provider
   * @param {string} type - Provider type to remove
   */
  removeProvider(type) {
    this.providers.delete(type);
    this.rateLimiters.delete(type);
    
    // Switch to another provider if this was the default
    if (this.defaultProvider === type && this.providers.size > 0) {
      this.defaultProvider = this.providers.keys().next().value;
    }
  }

  /**
   * Initialize providers from configuration
   * @param {Object} providersConfig - Providers configuration
   * @private
   */
  _initializeProviders(providersConfig) {
    for (const [type, config] of Object.entries(providersConfig)) {
      if (config.enabled !== false) {
        try {
          this.addProvider(type, config);
        } catch (error) {
          console.warn(`Failed to initialize provider '${type}': ${error.message}`);
        }
      }
    }
  }

  /**
   * Get provider instance
   * @param {string} type - Provider type
   * @returns {BaseEmbeddingProvider} Provider instance
   * @private
   */
  _getProvider(type) {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider '${type}' is not configured. Available providers: ${this.getAvailableProviders().join(', ')}`);
    }
    return provider;
  }

  /**
   * Get rate limiter for provider
   * @param {string} type - Provider type
   * @returns {RateLimiter} Rate limiter instance
   * @private
   */
  _getRateLimiter(type) {
    const rateLimiter = this.rateLimiters.get(type);
    if (!rateLimiter) {
      throw new Error(`Rate limiter for provider '${type}' is not configured`);
    }
    return rateLimiter;
  }
}