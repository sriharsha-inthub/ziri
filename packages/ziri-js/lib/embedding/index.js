/**
 * Embedding Provider Abstraction Layer
 * Main exports for the embedding system
 */

export { BaseEmbeddingProvider } from './base-provider.js';
export { OpenAIProvider } from './openai-provider.js';
export { OllamaProvider } from './ollama-provider.js';
export { HuggingFaceProvider } from './huggingface-provider.js';
export { CohereProvider } from './cohere-provider.js';
export { ProviderFactory } from './provider-factory.js';
export { RateLimiter } from './rate-limiter.js';
export { EmbeddingClient } from './embedding-client.js';
export { EmbeddingPipeline, EmbeddingBatcher, ConcurrencyManager } from './embedding-pipeline.js';
export { ProviderBenchmark, benchmarkProviders, quickProviderComparison } from './provider-benchmark.js';

// Error handling exports
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
} from '../error/error-handler.js';
export { ProviderFallbackManager } from '../error/provider-fallback.js';
export { ResilientEmbeddingClient } from '../error/resilient-embedding-client.js';

// Import classes for convenience functions
import { EmbeddingClient } from './embedding-client.js';
import { ProviderFactory } from './provider-factory.js';
import { EmbeddingPipeline } from './embedding-pipeline.js';
import { ProviderBenchmark } from './provider-benchmark.js';

// Convenience function to create an embedding client with default configuration
export function createEmbeddingClient(config = {}) {
  return new EmbeddingClient(config);
}

// Convenience function to create a provider directly
export function createProvider(type, config = {}) {
  return ProviderFactory.createProvider(type, config);
}

// Convenience function to create an embedding pipeline
export function createEmbeddingPipeline(embeddingClient, options = {}) {
  return new EmbeddingPipeline(embeddingClient, options);
}

// Convenience function to create a provider benchmark
export function createProviderBenchmark(options = {}) {
  return new ProviderBenchmark(options);
}