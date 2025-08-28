/**
 * Error Handling System
 * Comprehensive error handling, recovery, and fallback mechanisms
 */

export {
  ErrorHandler,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
  ConfigurationError,
  ZiriError,
  globalErrorHandler,
  handleError,
  executeWithRecovery
} from './error-handler.js';

export { ProviderFallbackManager } from './provider-fallback.js';
export { ResilientEmbeddingClient } from './resilient-embedding-client.js';

// Convenience functions
import { ErrorHandler } from './error-handler.js';
import { ProviderFallbackManager } from './provider-fallback.js';
import { ResilientEmbeddingClient } from './resilient-embedding-client.js';

/**
 * Create a new error handler with custom configuration
 * @param {Object} options - Error handler options
 * @returns {ErrorHandler} Error handler instance
 */
export function createErrorHandler(options = {}) {
  return new ErrorHandler(options);
}

/**
 * Create a provider fallback manager
 * @param {Object} embeddingClient - Embedding client instance
 * @param {Object} options - Fallback manager options
 * @returns {ProviderFallbackManager} Fallback manager instance
 */
export function createProviderFallbackManager(embeddingClient, options = {}) {
  return new ProviderFallbackManager(embeddingClient, options);
}

/**
 * Create a resilient embedding client with error handling and fallback
 * @param {Object} config - Client configuration
 * @returns {ResilientEmbeddingClient} Resilient client instance
 */
export function createResilientEmbeddingClient(config = {}) {
  return new ResilientEmbeddingClient(config);
}