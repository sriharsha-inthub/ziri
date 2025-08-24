/**
 * Error Handling Demo
 * Demonstrates comprehensive error handling, fallback strategies, and recovery mechanisms
 */

import {
  ErrorHandler,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
  handleError,
  executeWithRecovery
} from '../lib/error/error-handler.js';
import { ProviderFallbackManager } from '../lib/error/provider-fallback.js';
import { ResilientEmbeddingClient } from '../lib/error/resilient-embedding-client.js';

// Mock embedding client for demonstration
class MockEmbeddingClient {
  constructor() {
    this.defaultProvider = 'openai';
    this.providers = new Map([
      ['openai', { healthy: true, failureRate: 0.1 }],
      ['ollama', { healthy: true, failureRate: 0.05 }],
      ['huggingface', { healthy: true, failureRate: 0.15 }]
    ]);
    this.requestCount = 0;
  }

  async embed(texts, providerType = null) {
    const provider = providerType || this.defaultProvider;
    const providerInfo = this.providers.get(provider);
    
    this.requestCount++;
    
    // Simulate various failure scenarios
    if (Math.random() < providerInfo.failureRate) {
      const errorType = Math.random();
      
      if (errorType < 0.3) {
        throw new RateLimitError(provider, 2000 + Math.random() * 3000);
      } else if (errorType < 0.5) {
        throw new AuthenticationError(provider);
      } else if (errorType < 0.7) {
        throw new NetworkError(provider, new Error('Connection timeout'));
      } else {
        throw new ProviderError(`Provider ${provider} internal error`, provider);
      }
    }
    
    // Simulate response time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Return mock embeddings
    return texts.map(() => Array.from({ length: 1536 }, () => Math.random() - 0.5));
  }

  testProvider(providerType) {
    const providerInfo = this.providers.get(providerType);
    return Promise.resolve({
      success: providerInfo?.healthy || false,
      responseTime: 100 + Math.random() * 100
    });
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  _getProvider(type) {
    if (!this.providers.has(type)) {
      throw new Error(`Provider '${type}' not found`);
    }
    return {
      isReady: () => true
    };
  }
}

async function demonstrateBasicErrorHandling() {
  console.log('\n=== Basic Error Handling Demo ===');
  
  const errorHandler = new ErrorHandler({
    maxRetries: 3,
    baseRetryDelay: 500,
    enableFallback: true,
    fallbackProviders: ['ollama', 'huggingface']
  });

  // Listen to error events
  errorHandler.on('error:detected', (data) => {
    console.log(`🚨 Error detected: ${data.error.type} (${data.error.provider})`);
    console.log(`   Strategy: ${data.strategy}`);
  });

  errorHandler.on('error:recovered', (data) => {
    console.log(`✅ Error recovered using ${data.strategy}`);
  });

  // Simulate different error types
  const errors = [
    new RateLimitError('openai', 3000),
    new AuthenticationError('openai'),
    new NetworkError('openai', new Error('Timeout')),
    new ProviderError('Service unavailable', 'openai')
  ];

  for (const error of errors) {
    try {
      console.log(`\nHandling ${error.constructor.name}...`);
      
      const result = await errorHandler.handleError(error, {
        provider: 'openai',
        attempt: 1,
        maxRetries: 3,
        fallbackOperation: (provider) => {
          console.log(`   Fallback to ${provider}`);
          return Promise.resolve(['fallback_embedding']);
        }
      });
      
      console.log(`   Result: ${result.recovered ? 'Recovered' : 'Retry needed'}`);
      if (result.delay) {
        console.log(`   Delay: ${result.delay}ms`);
      }
      
    } catch (recoveryError) {
      console.log(`   Recovery failed: ${recoveryError.message}`);
    }
  }

  // Show error statistics
  console.log('\nError Statistics:');
  console.log(JSON.stringify(errorHandler.getErrorStats(), null, 2));
}

async function demonstrateDetailedErrorMessages() {
  console.log('\n=== Detailed Error Messages Demo ===');
  
  const errorHandler = new ErrorHandler();
  
  const errors = [
    new RateLimitError('openai', 5000),
    new AuthenticationError('openai'),
    new NetworkError('openai', new Error('DNS resolution failed'))
  ];

  for (const error of errors) {
    console.log(`\n--- ${error.constructor.name} ---`);
    
    const details = errorHandler.getDetailedErrorMessage(error, {
      provider: 'openai',
      operation: 'embed',
      textsCount: 10
    });
    
    console.log(`Message: ${details.message}`);
    console.log(`Code: ${details.code}`);
    console.log(`Provider: ${details.provider}`);
    
    console.log('\nSuggestions:');
    details.suggestions.forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion}`);
    });
    
    console.log('\nTroubleshooting Steps:');
    details.troubleshooting.forEach((step) => {
      console.log(`  ${step}`);
    });
    
    console.log(`\nDocumentation: ${details.documentation.general}`);
    if (details.documentation.specific) {
      console.log(`Specific Guide: ${details.documentation.specific}`);
    }
  }
}

async function demonstrateProviderFallback() {
  console.log('\n=== Provider Fallback Demo ===');
  
  const mockClient = new MockEmbeddingClient();
  const fallbackManager = new ProviderFallbackManager(mockClient, {
    fallbackOrder: ['openai', 'ollama', 'huggingface'],
    maxFallbackAttempts: 3,
    testProvidersOnInit: false
  });

  // Listen to fallback events
  fallbackManager.on('provider:attempting', (data) => {
    console.log(`🔄 Attempting provider: ${data.provider} (attempt ${data.attempt})`);
  });

  fallbackManager.on('provider:failed', (data) => {
    console.log(`❌ Provider failed: ${data.provider} - ${data.error}`);
  });

  fallbackManager.on('fallback:success', (data) => {
    console.log(`✅ Fallback successful: ${data.fromProvider} → ${data.toProvider}`);
  });

  // Test provider health
  console.log('\nTesting all providers...');
  const testResults = await fallbackManager.testAllProviders();
  console.log('Test Results:', JSON.stringify(testResults, null, 2));

  // Simulate embedding with fallback
  console.log('\nEmbedding with fallback...');
  try {
    const result = await fallbackManager.embedWithFallback(
      ['Hello world', 'Test embedding'],
      'openai'
    );
    
    console.log(`Success with provider: ${result.provider}`);
    console.log(`Fallback used: ${result.fallbackUsed}`);
    console.log(`Response time: ${result.responseTime}ms`);
    console.log(`Embeddings count: ${result.embeddings.length}`);
    
  } catch (error) {
    console.log(`All providers failed: ${error.message}`);
  }

  // Show provider health
  console.log('\nProvider Health:');
  console.log(JSON.stringify(fallbackManager.getProviderHealth(), null, 2));

  // Show fallback statistics
  console.log('\nFallback Statistics:');
  console.log(JSON.stringify(fallbackManager.getFallbackStats(), null, 2));
}

async function demonstrateResilientClient() {
  console.log('\n=== Resilient Embedding Client Demo ===');
  
  const resilientClient = new ResilientEmbeddingClient({
    maxRetries: 2,
    baseRetryDelay: 500,
    enableFallback: true,
    fallbackOrder: ['openai', 'ollama', 'huggingface'],
    testProvidersOnInit: false
  });

  // Replace the base client with our mock
  resilientClient.baseClient = new MockEmbeddingClient();
  resilientClient.fallbackManager.client = resilientClient.baseClient;

  // Listen to events
  resilientClient.on('embed:success', (data) => {
    console.log(`✅ Embedding successful: ${data.provider} (${data.responseTime}ms)`);
  });

  resilientClient.on('embed:error', (data) => {
    console.log(`❌ Embedding failed: ${data.error.message}`);
  });

  resilientClient.on('fallback:success', (data) => {
    console.log(`🔄 Fallback: ${data.fromProvider} → ${data.toProvider}`);
  });

  // Test multiple embedding requests
  console.log('\nPerforming multiple embedding requests...');
  
  const texts = [
    ['Hello world'],
    ['Test embedding', 'Another test'],
    ['Batch processing', 'Error handling', 'Fallback strategies']
  ];

  for (let i = 0; i < texts.length; i++) {
    try {
      console.log(`\nRequest ${i + 1}: ${texts[i].length} texts`);
      
      const result = await resilientClient.embed(texts[i]);
      
      console.log(`  Provider: ${result.provider}`);
      console.log(`  Fallback used: ${result.fallbackUsed}`);
      console.log(`  Retries: ${result.retries}`);
      console.log(`  Response time: ${result.responseTime}ms`);
      
    } catch (error) {
      console.log(`  Failed: ${error.message}`);
      
      if (error.details?.suggestions) {
        console.log('  Suggestions:');
        error.details.suggestions.slice(0, 2).forEach(s => {
          console.log(`    - ${s}`);
        });
      }
    }
  }

  // Test provider diagnostics
  console.log('\nTesting provider diagnostics...');
  const testResults = await resilientClient.testAllProviders();
  
  for (const [provider, result] of Object.entries(testResults)) {
    console.log(`\n${provider}:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Response time: ${result.responseTime}ms`);
    
    if (result.diagnostics) {
      console.log(`  Healthy: ${result.diagnostics.healthy}`);
      if (result.diagnostics.issues.length > 0) {
        console.log(`  Issues: ${result.diagnostics.issues.join(', ')}`);
      }
    }
  }

  // Show health status
  console.log('\nHealth Status:');
  const healthStatus = await resilientClient.getHealthStatus();
  console.log(`Overall Health: ${healthStatus.overall.healthy.toFixed(1)}%`);
  console.log(`Reliability: ${healthStatus.overall.reliability.toFixed(1)}%`);

  // Show performance metrics
  console.log('\nPerformance Metrics:');
  const metrics = resilientClient.getPerformanceMetrics();
  console.log(`Success Rate: ${metrics.requests.successRate.toFixed(1)}%`);
  console.log(`Average Response Time: ${metrics.responseTime.average.toFixed(0)}ms`);
  console.log(`Fallback Rate: ${metrics.reliability.fallbackRate.toFixed(1)}%`);

  if (healthStatus.recommendations.length > 0) {
    console.log('\nRecommendations:');
    healthStatus.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }
}

async function demonstrateExecuteWithRecovery() {
  console.log('\n=== Execute with Recovery Demo ===');
  
  let attemptCount = 0;
  
  // Simulate an unreliable operation
  const unreliableOperation = async () => {
    attemptCount++;
    console.log(`  Attempt ${attemptCount}`);
    
    if (attemptCount < 3) {
      const errorTypes = [
        () => new RateLimitError('openai', 1000),
        () => new NetworkError('openai', new Error('Timeout')),
        () => new ProviderError('Service temporarily unavailable', 'openai')
      ];
      
      const errorType = Math.floor(Math.random() * errorTypes.length);
      throw errorTypes[errorType]();
    }
    
    return 'Operation successful!';
  };

  try {
    console.log('Executing unreliable operation with recovery...');
    
    const result = await executeWithRecovery(unreliableOperation, {
      provider: 'openai',
      operation: 'embed'
    });
    
    console.log(`✅ ${result} (after ${attemptCount} attempts)`);
    
  } catch (error) {
    console.log(`❌ Operation failed after all retries: ${error.message}`);
  }
}

async function runDemo() {
  console.log('🚀 Ziri Error Handling Comprehensive Demo');
  console.log('==========================================');

  try {
    await demonstrateBasicErrorHandling();
    await demonstrateDetailedErrorMessages();
    await demonstrateProviderFallback();
    await demonstrateResilientClient();
    await demonstrateExecuteWithRecovery();
    
    console.log('\n✅ Demo completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}

export {
  demonstrateBasicErrorHandling,
  demonstrateDetailedErrorMessages,
  demonstrateProviderFallback,
  demonstrateResilientClient,
  demonstrateExecuteWithRecovery,
  runDemo
};