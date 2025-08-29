/**
 * Performance Optimization Demo
 * Demonstrates all performance optimization features
 */

import { 
  PerformanceOptimizer,
  AdaptiveBatchOptimizer,
  OptimizationStrategyManager,
  MemoryUsageOptimizer,
  PerformanceBenchmarkSuite,
  quickPerformanceBenchmark
} from '../lib/performance/index.js';

// Mock embedding client for demonstration
class MockEmbeddingClient {
  constructor(provider = 'openai') {
    this.provider = provider;
    this.requestCount = 0;
  }

  async embed(texts) {
    this.requestCount++;
    
    // Simulate different response times based on batch size and provider
    const baseTime = this.provider === 'ollama' ? 3000 : 1500;
    const batchPenalty = texts.length > 50 ? texts.length * 10 : 0;
    const responseTime = baseTime + batchPenalty + Math.random() * 500;
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, responseTime));
    
    // Return mock embeddings
    return texts.map(() => Array(1536).fill(0).map(() => Math.random()));
  }

  getProviderLimits() {
    return {
      maxTokensPerRequest: 8000,
      recommendedBatchSize: this.provider === 'ollama' ? 20 : 100,
      maxConcurrency: this.provider === 'ollama' ? 2 : 5
    };
  }
}

async function demonstrateAdaptiveBatchOptimization() {
  console.log('\n=== Adaptive Batch Optimization Demo ===');
  
  const optimizer = new AdaptiveBatchOptimizer({
    targetResponseTime: 2000,
    initialBatchSize: 50,
    minBatchSize: 10,
    maxBatchSize: 200
  });
  
  const client = new MockEmbeddingClient('openai');
  
  // Simulate processing with varying response times
  console.log('Initial batch size:', optimizer.getCurrentBatchSize());
  
  for (let i = 0; i < 10; i++) {
    const batchSize = optimizer.getCurrentBatchSize();
    const texts = Array(batchSize).fill(`Test text ${i}`);
    
    const startTime = Date.now();
    await client.embed(texts);
    const responseTime = Date.now() - startTime;
    
    const decision = optimizer.recordResult({
      responseTime,
      batchSize,
      itemCount: batchSize,
      provider: 'openai'
    });
    
    console.log(`Batch ${i + 1}: size=${batchSize}, time=${responseTime}ms, adapted=${decision.shouldAdapt}, new_size=${optimizer.getCurrentBatchSize()}`);
  }
  
  const metrics = optimizer.getMetrics();
  console.log('Final metrics:', {
    finalBatchSize: metrics.currentBatchSize,
    totalAdaptations: metrics.totalAdaptations,
    stability: metrics.stability.score.toFixed(2)
  });
}

async function demonstrateProviderOptimization() {
  console.log('\n=== Provider-Specific Optimization Demo ===');
  
  const strategyManager = new OptimizationStrategyManager();
  
  // Register strategies for different providers
  strategyManager.registerStrategy('openai', {
    defaultBatchSize: 100,
    maxBatchSize: 2048,
    rateLimitSensitive: true
  });
  
  strategyManager.registerStrategy('ollama', {
    defaultBatchSize: 20,
    maxBatchSize: 100,
    memoryPerBatch: 50
  });
  
  // Test OpenAI optimization
  strategyManager.switchStrategy('openai');
  let recommendations = strategyManager.getOptimizationRecommendations({
    memoryUsage: 0.6,
    avgResponseTime: 1500
  });
  
  console.log('OpenAI recommendations:', recommendations);
  
  // Simulate performance recording
  const adaptations = strategyManager.recordPerformanceAndAdapt('openai', {
    avgResponseTime: 3000,
    errorRate: 0.02,
    throughput: 15
  });
  
  console.log('OpenAI adaptations:', adaptations);
  
  // Test Ollama optimization
  strategyManager.switchStrategy('ollama');
  recommendations = strategyManager.getOptimizationRecommendations({
    memoryUsage: 0.8,
    cpuUsage: 0.7,
    availableMemory: 512
  });
  
  console.log('Ollama recommendations:', recommendations);
}

async function demonstrateMemoryOptimization() {
  console.log('\n=== Memory Usage Optimization Demo ===');
  
  const memoryOptimizer = new MemoryUsageOptimizer({
    maxMemoryMB: 256,
    targetMemoryUsage: 0.7,
    criticalMemoryUsage: 0.9
  });
  
  memoryOptimizer.start();
  
  // Monitor memory optimization events
  memoryOptimizer.on('memory:pressure', (data) => {
    console.log(`Memory pressure detected: ${data.level} (${data.percent.toFixed(1)}%)`);
  });
  
  memoryOptimizer.on('optimizations:applied', (data) => {
    console.log('Memory optimizations applied:', data.optimizations);
  });
  
  // Test optimization recommendations
  const currentSettings = {
    chunkSize: 1000,
    batchSize: 100,
    concurrency: 5
  };
  
  console.log('Current settings:', currentSettings);
  
  const recommendations = memoryOptimizer.getOptimizationRecommendations(currentSettings);
  console.log('Memory recommendations:', recommendations);
  
  const optimizedSettings = memoryOptimizer.applyOptimizations(currentSettings);
  console.log('Optimized settings:', optimizedSettings);
  
  // Create memory-aware processor
  const processor = memoryOptimizer.createMemoryAwareProcessor(
    async (items) => {
      // Simulate memory-intensive processing
      const results = items.map(item => ({
        processed: item,
        embedding: Array(1536).fill(0).map(() => Math.random())
      }));
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return results;
    },
    { initialChunkSize: 50 }
  );
  
  // Process some test data
  const testData = Array(200).fill(0).map((_, i) => `Test item ${i}`);
  let processedCount = 0;
  
  console.log('Processing with memory-aware processor...');
  for await (const result of processor(testData)) {
    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`Processed ${processedCount} items`);
    }
  }
  
  const metrics = memoryOptimizer.getMetrics();
  console.log('Memory optimization metrics:', {
    peakMemoryUsage: metrics.peakMemoryUsage.toFixed(1) + '%',
    optimizationEvents: metrics.optimizationEvents,
    gcEvents: metrics.gcEvents
  });
  
  memoryOptimizer.stop();
}

async function demonstratePerformanceBenchmarking() {
  console.log('\n=== Performance Benchmarking Demo ===');
  
  // Quick benchmark with mock providers
  const mockProviders = {
    openai: {
      type: 'openai',
      model: 'text-embedding-3-small',
      apiKey: 'mock-key'
    },
    ollama: {
      type: 'ollama',
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434'
    }
  };
  
  console.log('Running quick performance benchmark...');
  
  // Note: This would normally test real providers
  // For demo purposes, we'll show the structure
  const benchmarkSuite = new PerformanceBenchmarkSuite({
    benchmarkDuration: 5000, // 5 seconds for demo
    testDataSizes: [50, 100],
    concurrencyLevels: [1, 3],
    batchSizes: [25, 50]
  });
  
  // Simulate benchmark results
  const mockResults = {
    timestamp: new Date().toISOString(),
    duration: 5000,
    benchmarks: {
      optimization: {
        batchSizeOptimization: {
          25: { success: true, throughput: { average: 15.2 } },
          50: { success: true, throughput: { average: 18.7 } }
        },
        concurrencyOptimization: {
          1: { success: true, throughput: { average: 12.1 } },
          3: { success: true, throughput: { average: 22.3 } }
        }
      }
    },
    summary: {
      keyFindings: [
        'Optimal batch size: 50',
        'Optimal concurrency: 3'
      ]
    },
    recommendations: {
      configuration: {
        recommendedBatchSize: 50,
        recommendedConcurrency: 3
      },
      optimization: [
        'Enable adaptive batch sizing for variable workloads'
      ]
    }
  };
  
  console.log('Benchmark results:', JSON.stringify(mockResults, null, 2));
}

async function demonstrateIntegratedOptimization() {
  console.log('\n=== Integrated Performance Optimization Demo ===');
  
  const optimizer = new PerformanceOptimizer({
    enableAdaptiveBatching: true,
    enableMemoryOptimization: true,
    enableProviderOptimization: true,
    autoTuning: false // Disabled for demo
  });
  
  // Configuration with multiple providers
  const config = {
    providers: {
      openai: {
        type: 'openai',
        model: 'text-embedding-3-small',
        apiKey: 'mock-key'
      },
      ollama: {
        type: 'ollama',
        model: 'nomic-embed-text',
        baseUrl: 'http://localhost:11434'
      }
    }
  };
  
  // Start optimization
  await optimizer.start(config);
  
  // Monitor optimization events
  optimizer.on('optimization:batch_adapted', (data) => {
    console.log(`Batch size adapted: ${data.oldSize} → ${data.newSize} (${data.reason})`);
  });
  
  optimizer.on('optimization:memory_pressure', (data) => {
    console.log(`Memory pressure: ${data.level} (${data.usage.percent?.toFixed(1)}%)`);
  });
  
  // Simulate processing with different providers
  const providers = ['openai', 'ollama'];
  
  for (const provider of providers) {
    console.log(`\nOptimizing for provider: ${provider}`);
    
    const currentSettings = {
      batchSize: 50,
      concurrency: 3,
      chunkSize: 1000
    };
    
    const context = {
      provider,
      memoryUsage: 0.6,
      avgResponseTime: provider === 'ollama' ? 3000 : 1500
    };
    
    // Get optimization recommendations
    const recommendations = optimizer.getRecommendations(context);
    console.log('Recommendations:', recommendations);
    
    // Apply optimizations
    const optimizedSettings = await optimizer.optimize(currentSettings, context);
    console.log('Optimized settings:', optimizedSettings);
    
    // Simulate performance recording
    const mockMetrics = {
      responseTime: context.avgResponseTime + Math.random() * 500,
      throughput: 20 + Math.random() * 10,
      errorRate: Math.random() * 0.05,
      batchSize: optimizedSettings.batchSize,
      processedCount: optimizedSettings.batchSize
    };
    
    optimizer.recordPerformance(mockMetrics, context);
    console.log('Recorded performance:', mockMetrics);
  }
  
  // Get comprehensive metrics
  const metrics = optimizer.getMetrics();
  console.log('\nFinal optimization metrics:', {
    totalOptimizations: metrics.optimizationMetrics.totalOptimizations,
    enabledFeatures: metrics.enabledFeatures,
    performanceHistoryCount: metrics.performanceHistory.length
  });
  
  optimizer.stop();
}

async function runDemo() {
  console.log('🚀 Performance Optimization Features Demo');
  console.log('==========================================');
  
  try {
    await demonstrateAdaptiveBatchOptimization();
    await demonstrateProviderOptimization();
    await demonstrateMemoryOptimization();
    await demonstratePerformanceBenchmarking();
    await demonstrateIntegratedOptimization();
    
    console.log('\n✅ Demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('• Adaptive batch sizing based on API response times');
    console.log('• Provider-specific optimization strategies');
    console.log('• Memory usage optimization for large repositories');
    console.log('• Performance benchmarking and comparison tools');
    console.log('• Integrated optimization with auto-tuning capabilities');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}

export {
  demonstrateAdaptiveBatchOptimization,
  demonstrateProviderOptimization,
  demonstrateMemoryOptimization,
  demonstratePerformanceBenchmarking,
  demonstrateIntegratedOptimization,
  runDemo
};