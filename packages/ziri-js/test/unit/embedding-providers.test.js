/**
 * Tests for Embedding Provider Abstraction Layer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  BaseEmbeddingProvider,
  OpenAIProvider,
  OllamaProvider,
  HuggingFaceProvider,
  CohereProvider,
  ProviderFactory,
  RateLimiter,
  EmbeddingClient,
  createEmbeddingClient,
  createProvider
} from '../../lib/embedding/index.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('BaseEmbeddingProvider', () => {
  let provider;

  beforeEach(() => {
    const config = {
      type: 'test',
      model: 'test-model',
      dimensions: 768,
      maxTokens: 1000,
      rateLimit: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000,
        concurrentRequests: 2,
        retry: {
          maxRetries: 2,
          baseDelay: 100,
          maxDelay: 1000,
          jitter: false,
          backoffMultiplier: 2
        }
      }
    };
    provider = new BaseEmbeddingProvider(config);
  });

  it('should initialize with correct configuration', () => {
    expect(provider.type).toBe('test');
    expect(provider.model).toBe('test-model');
    expect(provider.dimensions).toBe(768);
    expect(provider.maxTokens).toBe(1000);
  });

  it('should validate configuration correctly', () => {
    expect(() => provider.validateConfig()).not.toThrow();
  });

  it('should throw error for missing required config', () => {
    const invalidProvider = new BaseEmbeddingProvider({});
    expect(() => invalidProvider.validateConfig()).toThrow();
  });

  it('should estimate tokens correctly', () => {
    const text = 'Hello world';
    const tokens = provider.estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(typeof tokens).toBe('number');
  });

  it('should return correct limits', () => {
    const limits = provider.getLimits();
    expect(limits.maxTokensPerRequest).toBe(1000);
    expect(limits.embeddingDimensions).toBe(768);
  });

  it('should check readiness correctly', () => {
    expect(provider.isReady()).toBe(true);
  });
});

describe('OpenAIProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: 'test-key'
    });
    vi.clearAllMocks();
  });

  it('should initialize with OpenAI defaults', () => {
    expect(provider.type).toBe('openai');
    expect(provider.model).toBe('text-embedding-3-small');
    expect(provider.dimensions).toBe(1536);
  });

  it('should throw error without API key', () => {
    // Temporarily clear environment variables
    const originalZiriKey = process.env.ZIRI_OPENAI_API_KEY;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    delete process.env.ZIRI_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    try {
      const provider = new OpenAIProvider({});
      expect(() => provider.validateConfig()).toThrow('OpenAI API key is required');
    } finally {
      // Restore environment variables
      if (originalZiriKey) process.env.ZIRI_OPENAI_API_KEY = originalZiriKey;
      if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  it('should make successful embedding request', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        data: [
          { embedding: new Array(1536).fill(0.1) },
          { embedding: new Array(1536).fill(0.2) }
        ]
      })
    };
    
    fetch.mockResolvedValueOnce(mockResponse);

    const texts = ['Hello', 'World'];
    const embeddings = await provider.embed(texts);
    
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(1536);
    expect(embeddings[1]).toHaveLength(1536);
  });

  it('should handle API errors with retry', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    };
    
    const successResponse = {
      ok: true,
      json: () => Promise.resolve({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    };

    fetch
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse);

    const texts = ['Hello'];
    const embeddings = await provider.embed(texts);
    
    expect(embeddings).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should test provider connectivity', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        data: [{ embedding: new Array(1536).fill(0.1) }] // Use correct dimensions
      })
    };
    
    fetch.mockResolvedValueOnce(mockResponse);

    const result = await provider.test();
    
    expect(result.success).toBe(true);
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
    expect(result.modelInfo).toBeDefined();
  });
});

describe('ProviderFactory', () => {
  beforeEach(() => {
    ProviderFactory.clearCache();
  });

  it('should create OpenAI provider', () => {
    const provider = ProviderFactory.createProvider('openai', { apiKey: 'test' });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should create Ollama provider', () => {
    const provider = ProviderFactory.createProvider('ollama', {});
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('should create HuggingFace provider', () => {
    const provider = ProviderFactory.createProvider('huggingface', { apiKey: 'test' });
    expect(provider).toBeInstanceOf(HuggingFaceProvider);
  });

  it('should create Cohere provider', () => {
    const provider = ProviderFactory.createProvider('cohere', { apiKey: 'test' });
    expect(provider).toBeInstanceOf(CohereProvider);
  });

  it('should throw error for unsupported provider', () => {
    expect(() => ProviderFactory.createProvider('unsupported')).toThrow();
  });

  it('should cache provider instances', () => {
    const config = { apiKey: 'test' };
    const provider1 = ProviderFactory.createProvider('openai', config);
    const provider2 = ProviderFactory.createProvider('openai', config);
    
    expect(provider1).toBe(provider2);
    expect(ProviderFactory.getCacheSize()).toBe(1);
  });

  it('should return available providers', () => {
    const providers = ProviderFactory.getAvailableProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('ollama');
    expect(providers).toContain('huggingface');
    expect(providers).toContain('cohere');
  });
});

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      requestsPerMinute: 10,
      tokensPerMinute: 1000,
      concurrentRequests: 2
    });
  });

  afterEach(() => {
    rateLimiter.reset();
  });

  it('should execute requests within limits', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    const result = await rateLimiter.execute(mockFn, 100);
    
    expect(result).toBe('result');
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should track request counts', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    
    await rateLimiter.execute(mockFn, 100);
    
    const status = rateLimiter.getStatus();
    expect(status.requestsInLastMinute).toBe(1);
    expect(status.tokensInLastMinute).toBe(100);
  });

  it('should handle concurrent requests', async () => {
    const mockFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('result'), 100))
    );
    
    const promises = [
      rateLimiter.execute(mockFn, 100),
      rateLimiter.execute(mockFn, 100),
      rateLimiter.execute(mockFn, 100)
    ];
    
    const results = await Promise.all(promises);
    
    expect(results).toEqual(['result', 'result', 'result']);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should provide accurate status', () => {
    const status = rateLimiter.getStatus();
    
    expect(status.requestsPerMinuteLimit).toBe(10);
    expect(status.tokensPerMinuteLimit).toBe(1000);
    expect(status.concurrentRequestsLimit).toBe(2);
    expect(status.canMakeRequest).toBe(true);
  });
});

describe('EmbeddingClient', () => {
  let client;

  beforeEach(() => {
    const config = {
      defaultProvider: 'openai',
      providers: {
        openai: {
          type: 'openai',
          apiKey: 'test-key',
          model: 'text-embedding-3-small',
          dimensions: 1536,
          maxTokens: 8192,
          rateLimit: {
            requestsPerMinute: 100,
            tokensPerMinute: 10000,
            concurrentRequests: 2,
            retry: {
              maxRetries: 2,
              baseDelay: 100,
              maxDelay: 1000,
              jitter: false,
              backoffMultiplier: 2
            }
          },
          enabled: true
        }
      }
    };
    
    client = new EmbeddingClient(config);
    vi.clearAllMocks();
  });

  it('should initialize with configuration', () => {
    expect(client.defaultProvider).toBe('openai');
    expect(client.getAvailableProviders()).toContain('openai');
  });

  it('should embed texts using default provider', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    };
    
    fetch.mockResolvedValueOnce(mockResponse);

    const texts = ['Hello world'];
    const embeddings = await client.embed(texts);
    
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toHaveLength(1536);
  });

  it('should switch providers', () => {
    client.addProvider('ollama', {
      type: 'ollama',
      model: 'nomic-embed-text',
      dimensions: 768,
      maxTokens: 8192,
      rateLimit: {}
    });
    
    client.switchProvider('ollama');
    expect(client.defaultProvider).toBe('ollama');
  });

  it('should get provider limits', () => {
    const limits = client.getProviderLimits('openai');
    expect(limits.embeddingDimensions).toBe(1536);
    expect(limits.maxTokensPerRequest).toBe(8192);
  });

  it('should test provider connectivity', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    };
    
    fetch.mockResolvedValueOnce(mockResponse);

    const result = await client.testProvider('openai');
    expect(result.success).toBe(true);
  });

  it('should get rate limiter status', () => {
    const status = client.getRateLimiterStatus('openai');
    expect(status.canMakeRequest).toBe(true);
    expect(status.requestsInLastMinute).toBe(0);
  });
});

describe('Convenience Functions', () => {
  it('should create embedding client', () => {
    const client = createEmbeddingClient();
    expect(client).toBeInstanceOf(EmbeddingClient);
  });

  it('should create provider', () => {
    const provider = createProvider('openai', { apiKey: 'test' });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });
});