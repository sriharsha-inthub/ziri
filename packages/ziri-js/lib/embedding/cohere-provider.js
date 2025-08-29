/**
 * Cohere Embedding Provider
 * Implements Cohere embeddings API
 */

import { BaseEmbeddingProvider } from './base-provider.js';

export class CohereProvider extends BaseEmbeddingProvider {
  constructor(config) {
    super({
      type: 'cohere',
      model: 'embed-english-v3.0',
      dimensions: 1024, // Default for embed-english-v3.0
      maxTokens: 512,
      rateLimit: {
        requestsPerMinute: 1000,
        tokensPerMinute: 1000000,
        concurrentRequests: 5,
        retry: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 30000,
          jitter: true,
          backoffMultiplier: 2
        }
      },
      ...config
    });

    this.apiKey = config.apiKey || process.env.ZIRI_COHERE_API_KEY || process.env.COHERE_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.cohere.ai/v1';
    
    if (!this.apiKey) {
      throw new Error('Cohere API key is required. Set ZIRI_COHERE_API_KEY or COHERE_API_KEY environment variable.');
    }
  }

  /**
   * Generate embeddings using Cohere API
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embed(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const retryConfig = this.rateLimit.retry;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'ziri-js/1.0.0'
          },
          body: JSON.stringify({
            model: this.model,
            texts: texts,
            input_type: 'search_document', // Optimized for search/retrieval
            embedding_types: ['float']
          }),
          timeout: 30000 // 30 second timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Cohere API error (${response.status}): ${errorText}`);
          error.status = response.status;
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          
          throw error;
        }

        const data = await response.json();
        
        if (!data.embeddings || !Array.isArray(data.embeddings)) {
          throw new Error('Invalid embedding response from Cohere API');
        }

        // Validate embedding dimensions
        if (data.embeddings.length > 0 && data.embeddings[0].length !== this.dimensions) {
          console.warn(`Expected ${this.dimensions} dimensions, got ${data.embeddings[0].length}`);
        }

        return data.embeddings;

      } catch (error) {
        const isLastAttempt = attempt === retryConfig.maxRetries;
        
        if (isLastAttempt) {
          throw new Error(`Cohere embeddings failed after ${retryConfig.maxRetries + 1} attempts: ${error.message}`);
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
        const jitter = retryConfig.jitter ? Math.random() * 0.1 * baseDelay : 0;
        const delay = Math.min(baseDelay + jitter, retryConfig.maxDelay);

        console.log(`Cohere attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms: ${error.message}`);
        await this._sleep(delay);
      }
    }
  }

  /**
   * Test Cohere provider connectivity
   * @returns {Promise<ProviderTestResult>} Test result
   */
  async test() {
    const startTime = Date.now();
    
    try {
      const testText = ['Hello, world!'];
      const embeddings = await this.embed(testText);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        modelInfo: {
          name: this.model,
          dimensions: embeddings[0]?.length || this.dimensions,
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

  /**
   * Get supported Cohere models
   * @returns {string[]} Array of supported model names
   */
  getSupportedModels() {
    return [
      'embed-english-v3.0',
      'embed-multilingual-v3.0',
      'embed-english-light-v3.0',
      'embed-multilingual-light-v3.0',
      'embed-english-v2.0',
      'embed-multilingual-v2.0'
    ];
  }

  /**
   * Get recommended batch size for Cohere
   * @returns {number} Recommended batch size
   */
  getRecommendedBatchSize() {
    // Cohere can handle moderate batch sizes
    return Math.min(96, Math.floor(this.maxTokens / 50));
  }

  /**
   * Validate Cohere-specific configuration
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.apiKey) {
      throw new Error('Cohere API key is required');
    }

    const supportedModels = this.getSupportedModels();
    if (!supportedModels.includes(this.model)) {
      throw new Error(`Unsupported Cohere model: ${this.model}. Supported models: ${supportedModels.join(', ')}`);
    }
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}