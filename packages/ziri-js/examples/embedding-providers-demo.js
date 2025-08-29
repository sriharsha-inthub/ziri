/**
 * Embedding Providers Demo
 * Demonstrates the embedding provider abstraction layer
 */

import { 
  createEmbeddingClient, 
  createProvider, 
  ProviderFactory 
} from '../lib/embedding/index.js';

async function demonstrateEmbeddingProviders() {
  console.log('🚀 Embedding Providers Demo\n');

  // Configuration for multiple providers
  const config = {
    defaultProvider: 'openai',
    providers: {
      openai: {
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'demo-key',
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
        enabled: true
      },
      ollama: {
        type: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        maxTokens: 8192,
        baseUrl: 'http://localhost:11434',
        rateLimit: {
          requestsPerMinute: 1000,
          tokensPerMinute: 500000,
          concurrentRequests: 3,
          retry: {
            maxRetries: 2,
            baseDelay: 500,
            maxDelay: 5000,
            jitter: false,
            backoffMultiplier: 2
          }
        },
        enabled: true
      },
      huggingface: {
        type: 'huggingface',
        apiKey: process.env.HUGGINGFACE_API_KEY || 'demo-key',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        dimensions: 384,
        maxTokens: 512,
        rateLimit: {
          requestsPerMinute: 1000,
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
        enabled: true
      }
    }
  };

  // 1. Create embedding client with configuration
  console.log('1. Creating embedding client...');
  const client = createEmbeddingClient(config);
  console.log(`   Default provider: ${client.defaultProvider}`);
  console.log(`   Available providers: ${client.getAvailableProviders().join(', ')}\n`);

  // 2. Test all providers
  console.log('2. Testing provider connectivity...');
  const testResults = await client.testAllProviders();
  
  for (const [provider, result] of Object.entries(testResults)) {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `(${result.responseTime}ms)` : '';
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`   ${status} ${provider} ${time}${error}`);
  }
  console.log();

  // 3. Get provider limits
  console.log('3. Provider capabilities:');
  for (const provider of client.getAvailableProviders()) {
    try {
      const limits = client.getProviderLimits(provider);
      console.log(`   ${provider}:`);
      console.log(`     - Dimensions: ${limits.embeddingDimensions}`);
      console.log(`     - Max tokens/request: ${limits.maxTokensPerRequest}`);
      console.log(`     - Requests/minute: ${limits.maxRequestsPerMinute}`);
      console.log(`     - Recommended batch size: ${limits.recommendedBatchSize}`);
    } catch (error) {
      console.log(`   ${provider}: Error - ${error.message}`);
    }
  }
  console.log();

  // 4. Create individual providers
  console.log('4. Creating individual providers...');
  try {
    const openaiProvider = createProvider('openai', config.providers.openai);
    console.log(`   ✅ OpenAI provider created (${openaiProvider.model})`);
    
    const ollamaProvider = createProvider('ollama', config.providers.ollama);
    console.log(`   ✅ Ollama provider created (${ollamaProvider.model})`);
    
    const hfProvider = createProvider('huggingface', config.providers.huggingface);
    console.log(`   ✅ HuggingFace provider created (${hfProvider.model})`);
  } catch (error) {
    console.log(`   ❌ Error creating provider: ${error.message}`);
  }
  console.log();

  // 5. Demonstrate provider switching
  console.log('5. Provider switching:');
  console.log(`   Current default: ${client.defaultProvider}`);
  
  if (client.getAvailableProviders().includes('ollama')) {
    client.switchProvider('ollama');
    console.log(`   Switched to: ${client.defaultProvider}`);
    
    client.switchProvider('openai');
    console.log(`   Switched back to: ${client.defaultProvider}`);
  }
  console.log();

  // 6. Rate limiter status
  console.log('6. Rate limiter status:');
  const rateLimiterStatus = client.getAllRateLimiterStatus();
  for (const [provider, status] of Object.entries(rateLimiterStatus)) {
    console.log(`   ${provider}:`);
    console.log(`     - Queue length: ${status.queueLength}`);
    console.log(`     - Active requests: ${status.activeRequests}/${status.concurrentRequestsLimit}`);
    console.log(`     - Can make request: ${status.canMakeRequest}`);
  }
  console.log();

  // 7. Factory methods
  console.log('7. Factory methods:');
  console.log(`   Available providers: ${ProviderFactory.getAvailableProviders().join(', ')}`);
  console.log(`   Cache size: ${ProviderFactory.getCacheSize()}`);
  console.log();

  // 8. Simulate embedding generation (mock mode)
  console.log('8. Simulating embedding generation...');
  const sampleTexts = [
    'Hello, world!',
    'This is a test document.',
    'Embedding providers are useful for AI applications.'
  ];

  console.log(`   Sample texts (${sampleTexts.length}):`);
  sampleTexts.forEach((text, i) => {
    console.log(`     ${i + 1}. "${text}"`);
  });

  // Note: In a real scenario, you would call:
  // const embeddings = await client.embed(sampleTexts);
  // But for demo purposes, we'll just show the configuration
  
  console.log(`   Would generate embeddings using: ${client.defaultProvider}`);
  console.log(`   Expected dimensions: ${client.getProviderLimits(client.defaultProvider).embeddingDimensions}`);
  console.log();

  console.log('✨ Demo completed successfully!');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateEmbeddingProviders().catch(console.error);
}

export { demonstrateEmbeddingProviders };