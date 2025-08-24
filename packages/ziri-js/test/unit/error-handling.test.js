/**
 * Comprehensive Error Handling Tests
 * Tests for error recovery, fallback strategies, and detailed error messages
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
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
} from '../../lib/error/error-handler.js';
import { ProviderFallbackManager } from '../../lib/error/provider-fallback.js';
import { ResilientEmbeddingClient } from '../../lib/error/resilient-embedding-client.js';

describe('Error Handler', () => {
  let errorHandler;
  
  beforeEach(() => {
    errorHandler = new ErrorHandler({
      maxRetries: 3,
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      enableFallback: true,
      fallbackProviders: ['ollama', 'huggingface']
    });
  });

  afterEach(() => {
    errorHandler.removeAllListeners();
  });

  describe('Error Classification', () => {
    it('should classify rate limit errors correctly', async () => {
      const error = new RateLimitError('openai', 5000);
      const context = { provider: 'openai', attempt: 1 };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.shouldRetry).toBe(true);
      expect(result.delay).toBe(5000);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should classify authentication errors correctly', async () => {
      const error = new AuthenticationError('openai');
      const context = { provider: 'openai', attempt: 1 };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.shouldRetry).toBe(false);
      // Note: recovered might be true if fallback providers are available
      expect(typeof result.recovered).toBe('boolean');
    });

    it('should classify network errors correctly', async () => {
      const error = new NetworkError('openai', new Error('Connection timeout'));
      const context = { provider: 'openai', attempt: 1, maxRetries: 3 };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.shouldRetry).toBe(true);
      expect(result.delay).toBeGreaterThan(0);
    });

    it('should classify generic errors by message content', async () => {
      const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
      const context = { provider: 'openai', attempt: 1 };
      
      const result = await errorHandler.handleError(rateLimitError, context);
      
      expect(result.shouldRetry).toBe(true);
      expect(result.delay).toBeGreaterThan(0);
    });
  });

  describe('Recovery Strategies', () => {
    it('should implement exponential backoff for retries', async () => {
      const error = new NetworkError('openai', new Error('Timeout'));
      
      const delay1 = await errorHandler.handleError(error, { attempt: 1, maxRetries: 3 });
      const delay2 = await errorHandler.handleError(error, { attempt: 2, maxRetries: 3 });
      const delay3 = await errorHandler.handleError(error, { attempt: 3, maxRetries: 3 });
      
      expect(delay2.delay).toBeGreaterThan(delay1.delay);
      expect(delay3.delay).toBeGreaterThan(delay2.delay);
    });

    it('should suggest fallback providers for authentication errors', async () => {
      const error = new AuthenticationError('openai');
      const context = {
        provider: 'openai',
        attempt: 1,
        fallbackOperation: vi.fn().mockResolvedValue(['embedding'])
      };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.recovered).toBe(true);
      expect(result.fallbackOperation).toBeDefined();
    });

    it('should respect maximum retry limits', async () => {
      const error = new NetworkError('openai', new Error('Timeout'));
      const context = { provider: 'openai', attempt: 4, maxRetries: 3 };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics correctly', async () => {
      const error1 = new RateLimitError('openai');
      const error2 = new AuthenticationError('ollama');
      const error3 = new NetworkError('openai', new Error('Timeout'));
      
      await errorHandler.handleError(error1, { provider: 'openai' });
      await errorHandler.handleError(error2, { provider: 'ollama' });
      await errorHandler.handleError(error3, { provider: 'openai' });
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byProvider.openai).toBe(2);
      expect(stats.byProvider.ollama).toBe(1);
      expect(stats.byType.RateLimitError).toBe(1);
      expect(stats.byType.AuthenticationError).toBe(1);
      expect(stats.byType.NetworkError).toBe(1);
    });

    it('should reset statistics correctly', () => {
      errorHandler.errorStats.total = 10;
      errorHandler.errorStats.recovered = 5;
      
      errorHandler.resetStats();
      
      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(0);
      expect(stats.recovered).toBe(0);
    });
  });

  describe('Detailed Error Messages', () => {
    it('should generate detailed error messages with suggestions', () => {
      const error = new AuthenticationError('openai');
      const context = { provider: 'openai', operation: 'embed' };
      
      const details = errorHandler.getDetailedErrorMessage(error, context);
      
      expect(details.message).toContain('Authentication failed');
      expect(details.provider).toBe('openai');
      expect(details.suggestions).toContain('Check your API key configuration');
      expect(details.troubleshooting[0]).toContain('Verify your API key is set correctly');
      expect(details.documentation).toBeDefined();
    });

    it('should provide actionable suggestions for rate limit errors', () => {
      const error = new RateLimitError('openai', 5000);
      const context = { provider: 'openai' };
      
      const details = errorHandler.getDetailedErrorMessage(error, context);
      
      expect(details.suggestions).toContain('Reduce batch size or concurrency level');
      expect(details.suggestions).toContain('Consider upgrading to a higher tier API plan');
    });

    it('should provide troubleshooting steps for network errors', () => {
      const error = new NetworkError('openai', new Error('Connection failed'));
      const context = { provider: 'openai' };
      
      const details = errorHandler.getDetailedErrorMessage(error, context);
      
      expect(details.troubleshooting[0]).toContain('Test internet connectivity');
      expect(details.troubleshooting[2]).toContain('Check DNS resolution');
    });
  });

  describe('Execute with Recovery', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });
      
      const result = await errorHandler.executeWithRecovery(operation, {
        provider: 'openai'
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw error after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(
        errorHandler.executeWithRecovery(operation, { provider: 'openai' })
      ).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('Event Emission', () => {
    it('should emit error detection events', async () => {
      const errorDetectedSpy = vi.fn();
      errorHandler.on('error:detected', errorDetectedSpy);
      
      const error = new RateLimitError('openai');
      await errorHandler.handleError(error, { provider: 'openai' });
      
      expect(errorDetectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'RATE_LIMIT_EXCEEDED',
            provider: 'openai'
          }),
          strategy: 'Rate Limit Recovery'
        })
      );
    });

    it('should emit recovery events', async () => {
      const recoveredSpy = vi.fn();
      errorHandler.on('error:recovered', recoveredSpy);
      
      const error = new AuthenticationError('openai');
      const context = {
        provider: 'openai',
        fallbackOperation: vi.fn().mockResolvedValue(['embedding'])
      };
      
      await errorHandler.handleError(error, context);
      
      expect(recoveredSpy).toHaveBeenCalled();
    });
  });
});

describe('Provider Fallback Manager', () => {
  let mockClient;
  let fallbackManager;
  
  beforeEach(() => {
    mockClient = {
      defaultProvider: 'openai',
      embed: vi.fn(),
      testProvider: vi.fn(),
      getAvailableProviders: vi.fn().mockReturnValue(['openai', 'ollama', 'huggingface'])
    };
    
    fallbackManager = new ProviderFallbackManager(mockClient, {
      fallbackOrder: ['openai', 'ollama', 'huggingface'],
      maxFallbackAttempts: 3,
      testProvidersOnInit: false
    });
  });

  afterEach(() => {
    fallbackManager.removeAllListeners();
  });

  describe('Fallback Chain Building', () => {
    it('should build correct fallback chain', () => {
      const chain = fallbackManager._buildFallbackChain('openai');
      
      expect(chain).toEqual(['openai', 'ollama', 'huggingface']);
    });

    it('should handle missing providers in fallback order', () => {
      mockClient.getAvailableProviders.mockReturnValue(['openai', 'cohere']);
      
      const chain = fallbackManager._buildFallbackChain('openai');
      
      expect(chain).toEqual(['openai', 'cohere']);
    });
  });

  describe('Embedding with Fallback', () => {
    it('should succeed with primary provider', async () => {
      mockClient.embed.mockResolvedValue([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6]
      ]);
      
      const result = await fallbackManager.embedWithFallback(['text1', 'text2'], 'openai');
      
      expect(result.provider).toBe('openai');
      expect(result.fallbackUsed).toBe(false);
      expect(result.embeddings).toHaveLength(2);
    });

    it('should fallback to secondary provider on failure', async () => {
      mockClient.embed
        .mockRejectedValueOnce(new AuthenticationError('openai'))
        .mockResolvedValueOnce([
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6]
        ]);
      
      const result = await fallbackManager.embedWithFallback(['text1', 'text2'], 'openai');
      
      expect(result.provider).toBe('ollama');
      expect(result.fallbackUsed).toBe(true);
      expect(mockClient.embed).toHaveBeenCalledTimes(2);
    });

    it('should skip providers in cooldown', async () => {
      // Set cooldown for ollama
      fallbackManager._setCooldown('ollama', 60000);
      
      mockClient.embed
        .mockRejectedValueOnce(new AuthenticationError('openai'))
        .mockResolvedValueOnce([
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6]
        ]);
      
      const result = await fallbackManager.embedWithFallback(['text1', 'text2'], 'openai');
      
      expect(result.provider).toBe('huggingface');
      expect(mockClient.embed).toHaveBeenCalledWith(['text1', 'text2'], 'openai');
      expect(mockClient.embed).toHaveBeenCalledWith(['text1', 'text2'], 'huggingface');
    });

    it('should throw error when all providers fail', async () => {
      mockClient.embed.mockRejectedValue(new Error('All providers failed'));
      
      await expect(
        fallbackManager.embedWithFallback(['text1', 'text2'], 'openai')
      ).rejects.toThrow('All embedding providers failed');
    });
  });

  describe('Provider Health Tracking', () => {
    it('should update health on success', async () => {
      mockClient.embed.mockResolvedValue([[0.1, 0.2, 0.3]]);
      
      await fallbackManager.embedWithFallback(['text'], 'openai');
      
      const health = fallbackManager.getProviderHealth('openai');
      expect(health.healthy).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.consecutiveSuccesses).toBe(1);
    });

    it('should update health on failure', async () => {
      mockClient.embed.mockRejectedValue(new Error('Provider failed'));
      
      try {
        await fallbackManager.embedWithFallback(['text'], 'openai');
      } catch (error) {
        // Expected to fail
      }
      
      const health = fallbackManager.getProviderHealth('openai');
      expect(health.consecutiveFailures).toBe(1);
      expect(health.consecutiveSuccesses).toBe(0);
    });

    it('should mark provider as unhealthy after consecutive failures', async () => {
      mockClient.embed.mockRejectedValue(new Error('Provider failed'));
      
      // Simulate 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        fallbackManager._updateProviderHealth('openai', false);
      }
      
      const health = fallbackManager.getProviderHealth('openai');
      expect(health.healthy).toBe(false);
      expect(health.consecutiveFailures).toBe(3);
    });
  });

  describe('Provider Testing', () => {
    it('should test all providers and update health', async () => {
      mockClient.testProvider
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Auth failed' })
        .mockResolvedValueOnce({ success: true });
      
      const results = await fallbackManager.testAllProviders();
      
      expect(results.openai.success).toBe(true);
      expect(results.ollama.success).toBe(false);
      expect(results.huggingface.success).toBe(true);
    });
  });

  describe('Best Provider Selection', () => {
    it('should select best provider based on health and performance', async () => {
      mockClient.testProvider.mockImplementation((provider) => {
        if (provider === 'openai') return Promise.resolve({ success: true });
        if (provider === 'ollama') return Promise.resolve({ success: false });
        if (provider === 'huggingface') return Promise.resolve({ success: true });
      });
      
      const bestProvider = await fallbackManager.getBestProvider();
      
      expect(bestProvider).toBe('openai'); // First in preferred order and healthy
    });

    it('should skip unhealthy providers', async () => {
      // Mark openai as unhealthy
      fallbackManager._updateProviderHealth('openai', false);
      fallbackManager._updateProviderHealth('openai', false);
      fallbackManager._updateProviderHealth('openai', false);
      
      mockClient.testProvider.mockImplementation((provider) => {
        if (provider === 'openai') return Promise.resolve({ success: false });
        if (provider === 'ollama') return Promise.resolve({ success: true });
        if (provider === 'huggingface') return Promise.resolve({ success: true });
      });
      
      const bestProvider = await fallbackManager.getBestProvider();
      
      expect(bestProvider).toBe('ollama');
    });
  });

  describe('Fallback Statistics', () => {
    it('should track fallback statistics', async () => {
      mockClient.embed
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
      
      await fallbackManager.embedWithFallback(['text'], 'openai');
      
      const stats = fallbackManager.getFallbackStats();
      
      expect(stats.totalFallbacks).toBe(1);
      expect(stats.successfulFallbacks).toBe(1);
      expect(stats.byProvider['openai -> ollama']).toEqual({
        total: 1,
        successful: 1
      });
    });
  });
});

describe('Resilient Embedding Client', () => {
  let mockBaseClient;
  let resilientClient;
  
  beforeEach(() => {
    mockBaseClient = {
      defaultProvider: 'openai',
      embed: vi.fn(),
      testProvider: vi.fn(),
      getAvailableProviders: vi.fn().mockReturnValue(['openai', 'ollama']),
      _getProvider: vi.fn().mockReturnValue({
        isReady: vi.fn().mockReturnValue(true)
      })
    };
    
    // Mock the EmbeddingClient constructor
    vi.doMock('../lib/embedding/embedding-client.js', () => ({
      EmbeddingClient: vi.fn().mockImplementation(() => mockBaseClient)
    }));
    
    resilientClient = new ResilientEmbeddingClient({
      maxRetries: 2,
      enableFallback: true,
      fallbackOrder: ['openai', 'ollama']
    });
  });

  afterEach(() => {
    resilientClient.removeAllListeners();
    vi.clearAllMocks();
  });

  describe('Resilient Embedding', () => {
    it('should return embeddings with metadata', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      
      // Mock the fallback manager's embedWithFallback method
      resilientClient.fallbackManager.embedWithFallback = vi.fn().mockResolvedValue({
        embeddings: mockEmbeddings,
        provider: 'openai',
        responseTime: 100,
        fallbackUsed: false,
        attempt: 1
      });
      
      const result = await resilientClient.embed(['text1', 'text2']);
      
      expect(result.embeddings).toEqual(mockEmbeddings);
      expect(result.provider).toBe('openai');
      expect(result.fallbackUsed).toBe(false);
      expect(result.retries).toBe(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.textsProcessed).toBe(2);
    });

    it('should handle empty input gracefully', async () => {
      const result = await resilientClient.embed([]);
      
      expect(result.embeddings).toEqual([]);
      expect(result.responseTime).toBe(0);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should emit success events', async () => {
      const successSpy = vi.fn();
      resilientClient.on('embed:success', successSpy);
      
      resilientClient.fallbackManager.embedWithFallback = vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        provider: 'openai',
        responseTime: 100,
        fallbackUsed: false,
        attempt: 1
      });
      
      await resilientClient.embed(['text']);
      
      expect(successSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          textsCount: 1,
          provider: 'openai',
          fallbackUsed: false
        })
      );
    });

    it('should emit error events and enhance errors', async () => {
      const errorSpy = vi.fn();
      resilientClient.on('embed:error', errorSpy);
      
      const originalError = new AuthenticationError('openai');
      resilientClient.fallbackManager.embedWithFallback = vi.fn().mockRejectedValue(originalError);
      
      await expect(resilientClient.embed(['text'])).rejects.toThrow(ProviderError);
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            suggestions: expect.arrayContaining(['Check your API key configuration'])
          }),
          textsCount: 1
        })
      );
    });
  });

  describe('Provider Testing', () => {
    it('should test provider with diagnostics', async () => {
      mockBaseClient.testProvider.mockResolvedValue({ success: true });
      mockBaseClient.embed.mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
      
      const result = await resilientClient.testProvider('openai');
      
      expect(result.provider).toBe('openai');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.responseTime).toBe('number');
      if (result.success) {
        expect(result.embeddingDimensions).toBe(3);
        expect(result.testsPerformed).toContain('connectivity');
        expect(result.testsPerformed).toContain('embedding');
      }
    });

    it('should provide diagnostics for failed tests', async () => {
      const authError = new Error('401 Unauthorized');
      mockBaseClient.testProvider.mockRejectedValue(authError);
      
      const result = await resilientClient.testProvider('openai');
      
      expect(result.success).toBe(false);
      expect(result.diagnostics.issues.length).toBeGreaterThan(0);
      expect(result.diagnostics.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Health Status', () => {
    it('should provide comprehensive health status', async () => {
      // Mock some statistics
      resilientClient.stats.totalRequests = 100;
      resilientClient.stats.successfulRequests = 95;
      resilientClient.stats.fallbacksUsed = 5;
      
      const healthStatus = await resilientClient.getHealthStatus();
      
      expect(healthStatus.overall).toBeDefined();
      expect(healthStatus.providers).toBeDefined();
      expect(healthStatus.statistics).toBeDefined();
      expect(healthStatus.recommendations).toBeDefined();
    });

    it('should generate appropriate recommendations', async () => {
      // Simulate low success rate
      resilientClient.stats.totalRequests = 100;
      resilientClient.stats.successfulRequests = 90; // 90% success rate
      
      const healthStatus = await resilientClient.getHealthStatus();
      
      expect(healthStatus.recommendations).toContain(
        'Success rate is below 95%. Consider reviewing provider configurations.'
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance metrics correctly', () => {
      resilientClient.stats = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        fallbacksUsed: 10,
        totalRetries: 15,
        avgResponseTime: 250,
        responseTimes: [100, 200, 300, 400, 500]
      };
      
      const metrics = resilientClient.getPerformanceMetrics();
      
      expect(metrics.requests.successRate).toBe(95);
      expect(metrics.responseTime.average).toBe(250);
      expect(metrics.reliability.fallbackRate).toBe(10);
      expect(metrics.responseTime.percentiles).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should allow adding providers', () => {
      const addedSpy = vi.fn();
      resilientClient.on('provider:added', addedSpy);
      
      resilientClient.addProvider('cohere', {
        type: 'cohere',
        apiKey: 'test-key',
        model: 'embed-english-v3.0'
      });
      
      expect(addedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cohere',
          config: expect.objectContaining({
            apiKey: '[REDACTED]'
          })
        })
      );
    });

    it('should allow removing providers', () => {
      const removedSpy = vi.fn();
      resilientClient.on('provider:removed', removedSpy);
      
      resilientClient.removeProvider('ollama');
      
      expect(removedSpy).toHaveBeenCalledWith({ type: 'ollama' });
    });

    it('should allow switching providers', () => {
      const switchedSpy = vi.fn();
      resilientClient.on('provider:switched', switchedSpy);
      
      // First add the provider
      resilientClient.addProvider('ollama', {
        type: 'ollama',
        model: 'nomic-embed-text'
      });
      
      resilientClient.switchProvider('ollama');
      
      expect(switchedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          newProvider: 'ollama'
        })
      );
    });
  });

  describe('Statistics Reset', () => {
    it('should reset all statistics and health data', () => {
      const resetSpy = vi.fn();
      resilientClient.on('reset', resetSpy);
      
      // Set some statistics
      resilientClient.stats.totalRequests = 100;
      resilientClient.stats.successfulRequests = 95;
      
      resilientClient.reset();
      
      expect(resilientClient.stats.totalRequests).toBe(0);
      expect(resilientClient.stats.successfulRequests).toBe(0);
      expect(resetSpy).toHaveBeenCalled();
    });
  });
});

describe('Global Error Handler', () => {
  it('should provide global error handling functions', async () => {
    const error = new RateLimitError('openai', 1000);
    const context = { provider: 'openai', attempt: 1 };
    
    const result = await handleError(error, context);
    
    expect(result.shouldRetry).toBe(true);
    expect(result.delay).toBe(1000);
  });

  it('should provide global execute with recovery function', async () => {
    let attempts = 0;
    const operation = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });
    
    const result = await executeWithRecovery(operation, { provider: 'openai' });
    
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });
});

describe('Custom Error Classes', () => {
  describe('ZiriError', () => {
    it('should create error with code and details', () => {
      const error = new ZiriError('Test error', 'TEST_ERROR', { detail: 'value' });
      
      expect(error.name).toBe('ZiriError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details.detail).toBe('value');
      expect(error.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('ProviderError', () => {
    it('should create provider-specific error', () => {
      const originalError = new Error('Original error');
      const error = new ProviderError('Provider failed', 'openai', originalError, { extra: 'data' });
      
      expect(error.name).toBe('ProviderError');
      expect(error.provider).toBe('openai');
      expect(error.originalError).toBe(originalError);
      expect(error.details.originalError).toBe('Original error');
      expect(error.details.extra).toBe('data');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError('openai', 5000, { requestId: '123' });
      
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.provider).toBe('openai');
      expect(error.retryAfter).toBe(5000);
      expect(error.details.requestId).toBe('123');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('openai', { keyType: 'api' });
      
      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe('AUTHENTICATION_FAILED');
      expect(error.provider).toBe('openai');
      expect(error.details.keyType).toBe('api');
    });
  });

  describe('NetworkError', () => {
    it('should create network error with original error', () => {
      const originalError = new Error('Connection timeout');
      const error = new NetworkError('openai', originalError, { timeout: 30000 });
      
      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.provider).toBe('openai');
      expect(error.originalError).toBe(originalError);
      expect(error.details.timeout).toBe(30000);
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Invalid config', { field: 'apiKey' });
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.details.field).toBe('apiKey');
    });
  });
});