/**
 * Base Embedding Provider
 * Abstract base class for all embedding providers
 */

export class BaseEmbeddingProvider {
  constructor(config) {
    this.config = config;
    this.type = config.type;
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.maxTokens = config.maxTokens;
    this.rateLimit = config.rateLimit;
    this.enabled = config.enabled !== false;
  }

  /**
   * Generate embeddings for an array of texts
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embed(texts) {
    throw new Error('embed() method must be implemented by subclass');
  }

  /**
   * Test provider connectivity and authentication
   * @returns {Promise<ProviderTestResult>} Test result
   */
  async test() {
    throw new Error('test() method must be implemented by subclass');
  }

  /**
   * Get provider-specific limits and capabilities
   * @returns {ProviderLimits} Provider limits
   */
  getLimits() {
    return {
      maxTokensPerRequest: this.maxTokens,
      maxRequestsPerMinute: this.rateLimit.requestsPerMinute,
      maxTokensPerMinute: this.rateLimit.tokensPerMinute,
      recommendedBatchSize: this.getRecommendedBatchSize(),
      embeddingDimensions: this.dimensions,
      supportedModels: this.getSupportedModels()
    };
  }

  /**
   * Get recommended batch size for this provider
   * @returns {number} Recommended batch size
   */
  getRecommendedBatchSize() {
    // Default implementation based on token limits
    return Math.min(100, Math.floor(this.maxTokens / 50)); // Assume ~50 tokens per text
  }

  /**
   * Get supported models for this provider
   * @returns {string[]} Array of supported model names
   */
  getSupportedModels() {
    return [this.model];
  }

  /**
   * Validate configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.type) {
      throw new Error('Provider type is required');
    }
    if (!this.model) {
      throw new Error('Model name is required');
    }
    if (!this.dimensions || this.dimensions <= 0) {
      throw new Error('Valid embedding dimensions are required');
    }
    if (!this.maxTokens || this.maxTokens <= 0) {
      throw new Error('Valid maxTokens value is required');
    }
  }

  /**
   * Calculate estimated token count for text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if provider is enabled and configured
   * @returns {boolean} Whether provider is ready to use
   */
  isReady() {
    try {
      this.validateConfig();
      return this.enabled;
    } catch {
      return false;
    }
  }
}