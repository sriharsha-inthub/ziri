/**
 * Ollama Embedding Provider
 * Implements local Ollama embeddings
 */

import { BaseEmbeddingProvider } from './base-provider.js';

export class OllamaProvider extends BaseEmbeddingProvider {
  constructor(config) {
    super({
      type: 'ollama',
      model: 'nomic-embed-text',
      dimensions: 768, // Default for nomic-embed-text
      maxTokens: 8192,
      rateLimit: {
        requestsPerMinute: 1000, // Local server, higher limits
        tokensPerMinute: 500000,
        concurrentRequests: 3, // Conservative for local resources
        retry: {
          maxRetries: 2,
          baseDelay: 500,
          maxDelay: 5000,
          jitter: false,
          backoffMultiplier: 2
        }
      },
      ...config
    });

    this.baseUrl = config.baseUrl || 
                   process.env.ZIRI_OLLAMA_BASE_URL || 
                   process.env.OLLAMA_BASE_URL || 
                   'http://localhost:11434';
    
    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  /**
   * Generate embeddings using Ollama API
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embed(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const retryConfig = this.rateLimit.retry;
    const embeddings = [];

    // Ollama processes one text at a time
    for (const text of texts) {
      for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
        try {
          const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: this.model,
              prompt: text
            }),
            timeout: 60000 // 60 second timeout for local processing
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          
          if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid embedding response from Ollama');
          }

          embeddings.push(data.embedding);
          break; // Success, move to next text

        } catch (error) {
          const isLastAttempt = attempt === retryConfig.maxRetries;
          
          if (isLastAttempt) {
            throw new Error(`Ollama embeddings failed after ${retryConfig.maxRetries + 1} attempts: ${error.message}`);
          }

          const delay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
          console.log(`Ollama attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`);
          await this._sleep(delay);
        }
      }
    }

    return embeddings;
  }

  /**
   * Test Ollama provider connectivity
   * @returns {Promise<ProviderTestResult>} Test result
   */
  async test() {
    const startTime = Date.now();
    
    try {
      // First check if Ollama is running
      const healthResponse = await fetch(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });

      if (!healthResponse.ok) {
        throw new Error(`Ollama server not accessible: ${healthResponse.status}`);
      }

      // Check if model is available
      const modelsData = await healthResponse.json();
      const availableModels = modelsData.models?.map(m => m.name) || [];
      
      if (!availableModels.some(name => name.includes(this.model))) {
        throw new Error(`Model '${this.model}' not found. Available models: ${availableModels.join(', ')}`);
      }

      // Test embedding generation
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
   * Get supported Ollama models (common embedding models)
   * @returns {string[]} Array of supported model names
   */
  getSupportedModels() {
    return [
      'nomic-embed-text',
      'mxbai-embed-large',
      'snowflake-arctic-embed',
      'all-minilm'
    ];
  }

  /**
   * Get recommended batch size for Ollama
   * @returns {number} Recommended batch size
   */
  getRecommendedBatchSize() {
    // Ollama processes one at a time, so batch size is effectively 1
    // But we can queue multiple requests
    return 10;
  }

  /**
   * Validate Ollama-specific configuration
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.baseUrl) {
      throw new Error('Ollama base URL is required');
    }

    try {
      new URL(this.baseUrl);
    } catch {
      throw new Error(`Invalid Ollama base URL: ${this.baseUrl}`);
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