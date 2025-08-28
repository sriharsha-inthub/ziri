/**
 * OpenAI Embedding Provider
 * Implements OpenAI embeddings with retry logic and rate limiting
 */

import { BaseEmbeddingProvider } from './base-provider.js';

export class OpenAIProvider extends BaseEmbeddingProvider {
  constructor(config) {
    super({
      type: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxTokens: 8192,
      rateLimit: {
        requestsPerMinute: 3000,
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

    this.apiKey = config.apiKey || process.env.ZIRI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  /**
   * Validate OpenAI-specific configuration
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set ZIRI_OPENAI_API_KEY or OPENAI_API_KEY environment variable.');
    }

    const supportedModels = this.getSupportedModels();
    if (!supportedModels.includes(this.model)) {
      throw new Error(`Unsupported OpenAI model: ${this.model}. Supported models: ${supportedModels.join(', ')}`);
    }
  }

  /**
   * Generate embeddings using OpenAI API
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embed(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const startTime = Date.now();
    const retryConfig = this.rateLimit.retry;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'ziri-js/1.0.0'
          },
          body: JSON.stringify({
            model: this.model,
            input: texts,
            encoding_format: 'float'
          }),
          timeout: 30000 // 30 second timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`OpenAI API error (${response.status}): ${errorText}`);
          error.status = response.status;
          error.response = errorText;
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          
          throw error;
        }

        const data = await response.json();
        const embeddings = data.data.map(item => item.embedding);
        
        // Validate embedding dimensions
        if (embeddings.length > 0 && embeddings[0].length !== this.dimensions) {
          console.warn(`Expected ${this.dimensions} dimensions, got ${embeddings[0].length}`);
        }

        return embeddings;

      } catch (error) {
        const isLastAttempt = attempt === retryConfig.maxRetries;
        
        if (isLastAttempt) {
          throw new Error(`OpenAI embeddings failed after ${retryConfig.maxRetries + 1} attempts: ${error.message}`);
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
        const jitter = retryConfig.jitter ? Math.random() * 0.1 * baseDelay : 0;
        const delay = Math.min(baseDelay + jitter, retryConfig.maxDelay);

        console.log(`OpenAI attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms: ${error.message}`);
        await this._sleep(delay);
      }
    }
  }

  /**
   * Test OpenAI provider connectivity
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

  /**
   * Get supported OpenAI models
   * @returns {string[]} Array of supported model names
   */
  getSupportedModels() {
    return [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002'
    ];
  }

  /**
   * Get recommended batch size for OpenAI
   * @returns {number} Recommended batch size
   */
  getRecommendedBatchSize() {
    // OpenAI can handle larger batches efficiently
    return Math.min(2048, Math.floor(this.maxTokens / 100));
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