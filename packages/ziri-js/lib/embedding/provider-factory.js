/**
 * Embedding Provider Factory
 * Creates and manages embedding provider instances
 */

import { OpenAIProvider } from './openai-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { HuggingFaceProvider } from './huggingface-provider.js';
import { CohereProvider } from './cohere-provider.js';

export class ProviderFactory {
  static providers = new Map();

  /**
   * Create an embedding provider instance
   * @param {string} type - Provider type ('openai', 'ollama', 'huggingface', 'cohere')
   * @param {Object} config - Provider configuration
   * @returns {BaseEmbeddingProvider} Provider instance
   */
  static createProvider(type, config = {}) {
    const cacheKey = `${type}:${JSON.stringify(config)}`;
    
    // Return cached instance if available
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey);
    }

    let provider;
    
    switch (type.toLowerCase()) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'ollama':
        provider = new OllamaProvider(config);
        break;
      case 'huggingface':
        provider = new HuggingFaceProvider(config);
        break;
      case 'cohere':
        provider = new CohereProvider(config);
        break;
      default:
        throw new Error(`Unsupported embedding provider: ${type}. Supported providers: openai, ollama, huggingface, cohere`);
    }

    // Validate the provider configuration
    provider.validateConfig();

    // Cache the provider instance
    this.providers.set(cacheKey, provider);
    
    return provider;
  }

  /**
   * Get available provider types
   * @returns {string[]} Array of supported provider types
   */
  static getAvailableProviders() {
    return ['openai', 'ollama', 'huggingface', 'cohere'];
  }

  /**
   * Test all configured providers
   * @param {Object} providersConfig - Configuration for all providers
   * @returns {Promise<Object>} Test results for each provider
   */
  static async testAllProviders(providersConfig) {
    const results = {};
    
    for (const [type, config] of Object.entries(providersConfig)) {
      if (!config.enabled) {
        results[type] = {
          success: false,
          error: 'Provider disabled in configuration',
          responseTime: 0
        };
        continue;
      }

      try {
        const provider = this.createProvider(type, config);
        results[type] = await provider.test();
      } catch (error) {
        results[type] = {
          success: false,
          error: error.message,
          responseTime: 0
        };
      }
    }
    
    return results;
  }

  /**
   * Get the best available provider based on test results
   * @param {Object} providersConfig - Configuration for all providers
   * @param {string[]} preferredOrder - Preferred provider order
   * @returns {Promise<{type: string, provider: BaseEmbeddingProvider}>} Best provider
   */
  static async getBestProvider(providersConfig, preferredOrder = ['openai', 'ollama', 'huggingface', 'cohere']) {
    const testResults = await this.testAllProviders(providersConfig);
    
    // Try providers in preferred order
    for (const type of preferredOrder) {
      if (testResults[type]?.success) {
        const provider = this.createProvider(type, providersConfig[type]);
        return { type, provider };
      }
    }
    
    // If no preferred provider works, try any working provider
    for (const [type, result] of Object.entries(testResults)) {
      if (result.success) {
        const provider = this.createProvider(type, providersConfig[type]);
        return { type, provider };
      }
    }
    
    throw new Error('No working embedding providers found');
  }

  /**
   * Clear provider cache
   */
  static clearCache() {
    this.providers.clear();
  }

  /**
   * Get cached provider count
   * @returns {number} Number of cached providers
   */
  static getCacheSize() {
    return this.providers.size;
  }
}