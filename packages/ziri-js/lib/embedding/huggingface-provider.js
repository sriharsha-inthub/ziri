/**
 * Hugging Face Embedding Provider
 * Implements Hugging Face Inference API embeddings
 */

import { BaseEmbeddingProvider } from './base-provider.js';

export class HuggingFaceProvider extends BaseEmbeddingProvider {
  constructor(config) {
    super({
      type: 'huggingface',
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      dimensions: 384, // Default for all-MiniLM-L6-v2
      maxTokens: 512,
      rateLimit: {
        requestsPerMinute: 1000, // Free tier limits
        tokensPerMinute: 100000,
        concurrentRequests: 2,
        retry: {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 30000,
          jitter: true,
          backoffMultiplier: 2
        }
      },
      ...config
    });

    this.apiKey = config.apiKey || process.env.ZIRI_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api-inference.huggingface.co';
    
    if (!this.apiKey) {
      throw new Error('Hugging Face API key is required. Set ZIRI_HUGGINGFACE_API_KEY or HUGGINGFACE_API_KEY environment variable.');
    }
  }

  /**
   * Generate embeddings using Hugging Face Inference API
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embed(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const retryConfig = this.rateLimit.retry;
    const embeddings = [];

    // Process texts in smaller batches due to API limitations
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
        try {
          const response = await fetch(`${this.baseUrl}/pipeline/feature-extraction/${this.model}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'User-Agent': 'ziri-js/1.0.0'
            },
            body: JSON.stringify({
              inputs: batch,
              options: {
                wait_for_model: true,
                use_cache: true
              }
            }),
            timeout: 60000 // 60 second timeout
          });

          if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Hugging Face API error (${response.status}): ${errorText}`);
            error.status = response.status;
            
            // Handle model loading (503 errors are common during cold starts)
            if (response.status === 503) {
              throw error; // Retry on 503
            }
            
            // Don't retry on client errors (4xx)
            if (response.status >= 400 && response.status < 500 && response.status !== 503) {
              throw error;
            }
            
            throw error;
          }

          const data = await response.json();
          
          // Handle different response formats
          let batchEmbeddings;
          if (Array.isArray(data) && Array.isArray(data[0])) {
            // Multiple texts response: [[embedding1], [embedding2], ...]
            batchEmbeddings = data;
          } else if (Array.isArray(data)) {
            // Single text response: [embedding]
            batchEmbeddings = [data];
          } else {
            throw new Error('Unexpected response format from Hugging Face API');
          }

          embeddings.push(...batchEmbeddings);
          break; // Success, move to next batch

        } catch (error) {
          const isLastAttempt = attempt === retryConfig.maxRetries;
          
          if (isLastAttempt) {
            throw new Error(`Hugging Face embeddings failed after ${retryConfig.maxRetries + 1} attempts: ${error.message}`);
          }

          // Calculate delay with exponential backoff and jitter
          const baseDelay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
          const jitter = retryConfig.jitter ? Math.random() * 0.1 * baseDelay : 0;
          const delay = Math.min(baseDelay + jitter, retryConfig.maxDelay);

          console.log(`Hugging Face attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms: ${error.message}`);
          await this._sleep(delay);
        }
      }
    }

    return embeddings;
  }

  /**
   * Test Hugging Face provider connectivity
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
   * Get supported Hugging Face models
   * @returns {string[]} Array of supported model names
   */
  getSupportedModels() {
    return [
      'sentence-transformers/all-MiniLM-L6-v2',
      'sentence-transformers/all-mpnet-base-v2',
      'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      'microsoft/DialoGPT-medium',
      'BAAI/bge-small-en-v1.5',
      'BAAI/bge-base-en-v1.5'
    ];
  }

  /**
   * Get recommended batch size for Hugging Face
   * @returns {number} Recommended batch size
   */
  getRecommendedBatchSize() {
    // Hugging Face has smaller limits, use conservative batch size
    return 10;
  }

  /**
   * Validate Hugging Face-specific configuration
   */
  validateConfig() {
    super.validateConfig();
    
    if (!this.apiKey) {
      throw new Error('Hugging Face API key is required');
    }

    const supportedModels = this.getSupportedModels();
    if (!supportedModels.includes(this.model)) {
      console.warn(`Model '${this.model}' not in known supported models. This may still work if it's a valid Hugging Face model.`);
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