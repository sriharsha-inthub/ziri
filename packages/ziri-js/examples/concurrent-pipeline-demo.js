#!/usr/bin/env node

/**
 * Concurrent Embedding Pipeline Demo
 * Demonstrates the performance benefits of concurrent processing with adaptive batching
 */

import { createEmbeddingClient, createEmbeddingPipeline } from '../lib/embedding/index.js';

// Mock text chunks for demonstration
function createMockChunks(count, contentLength = 200) {
  const chunks = [];
  for (let i = 0; i < count; i++) {
    chunks.push({
      id: `chunk_${i}`,
      content: `This is sample text content for chunk ${i}. `.repeat(Math.floor(contentLength / 50)),
      filePath: `src/file_${Math.floor(i / 10)}.js`,
      startLine: i * 20,
      endLine: (i + 1) * 20
    });
  }
  return chunks;
}

// Create async iterable from array
async function* createAsyncIterable(items) {
  for (const item of items) {
    yield item;
  }
}

async function demonstratePipeline() {
  console.log('🚀 Concurrent Embedding Pipeline Demo\n');

  // Create embedding client with OpenAI provider
  const client = createEmbeddingClient({
    defaultProvider: 'openai',
    providers: {
      openai: {
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'demo-key',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        maxTokens: 8000,
        rateLimit: {
          requestsPerMinute: 500,
          tokensPerMinute: 1000000,
          concurrentRequests: 3
        }
      }
    }
  });

  // Test provider connectivity (will fail without real API key, but shows the interface)
  console.log('🔍 Testing provider connectivity...');
  try {
    const testResult = await client.testProvider('openai');
    console.log(`✅ Provider test: ${testResult.success ? 'PASSED' : 'FAILED'}`);
    if (!testResult.success) {
      console.log(`   Error: ${testResult.error}`);
      console.log('   💡 Set OPENAI_API_KEY environment variable for real testing\n');
    }
  } catch (error) {
    console.log(`❌ Provider test failed: ${error.message}`);
    console.log('   💡 This is expected without a valid API key\n');
  }

  // Create pipeline with performance-optimized settings
  const pipeline = createEmbeddingPipeline(client, {
    concurrency: 3,              // Process 3 batches concurrently
    initialBatchSize: 50,        // Start with 50 chunks per batch
    maxBatchSize: 100,           // Maximum 100 chunks per batch
    minBatchSize: 10,            // Minimum 10 chunks per batch
    adaptiveBatching: true,      // Enable adaptive batch sizing
    targetResponseTime: 2000,    // Target 2 second response time
    maxRetries: 3,               // Retry failed requests up to 3 times
    retryDelay: 1000            // Base retry delay of 1 second
  });

  // Set up event listeners for monitoring
  pipeline.on('pipeline:start', (event) => {
    console.log(`🏁 Pipeline started with provider: ${event.provider}`);
    console.log(`   Concurrency: ${event.concurrency}, Initial batch size: ${event.initialBatchSize}\n`);
  });

  pipeline.on('batch:start', (event) => {
    process.stdout.write(`📦 Processing batch of ${event.batchSize} chunks... `);
  });

  pipeline.on('batch:complete', (event) => {
    const throughput = event.throughput.toFixed(1);
    console.log(`✅ (${event.responseTime}ms, ${throughput} chunks/sec)`);
  });

  pipeline.on('batch:error', (event) => {
    console.log(`❌ Batch failed: ${event.error.message} (${event.responseTime}ms)`);
  });

  pipeline.on('batch:size:increased', (event) => {
    console.log(`📈 Batch size increased: ${event.oldSize} → ${event.newSize} (${event.reason})`);
  });

  pipeline.on('batch:size:decreased', (event) => {
    console.log(`📉 Batch size decreased: ${event.oldSize} → ${event.newSize} (${event.reason})`);
  });

  pipeline.on('retry', (event) => {
    console.log(`🔄 Retry ${event.attempt}/${event.maxRetries} after ${event.delay}ms: ${event.error}`);
  });

  pipeline.on('progress', (event) => {
    const throughput = event.throughput.toFixed(1);
    console.log(`📊 Progress: ${event.processed} processed, ${event.errors} errors, ${throughput} chunks/sec, batch size: ${event.currentBatchSize}`);
  });

  pipeline.on('pipeline:complete', (event) => {
    console.log(`\n🎉 Pipeline completed!`);
    console.log(`   Total processed: ${event.totalProcessed}`);
    console.log(`   Total errors: ${event.totalErrors}`);
    console.log(`   Duration: ${event.elapsed.toFixed(1)}s`);
    console.log(`   Average throughput: ${event.avgThroughput.toFixed(1)} chunks/sec`);
    console.log(`   Average response time: ${event.avgResponseTime.toFixed(0)}ms`);
    console.log(`   Final batch size: ${event.finalBatchSize}`);
  });

  // Create sample chunks
  const chunkCount = 200;
  console.log(`📝 Creating ${chunkCount} sample text chunks...`);
  const chunks = createMockChunks(chunkCount);
  console.log(`✅ Created ${chunks.length} chunks\n`);

  // Process chunks through pipeline
  console.log('⚡ Starting concurrent processing...\n');
  
  const results = [];
  const startTime = Date.now();
  
  try {
    // Note: This will fail without a real API key, but demonstrates the interface
    for await (const result of pipeline.processChunks(createAsyncIterable(chunks))) {
      results.push(result);
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\n✨ Successfully processed ${results.length} chunks in ${duration.toFixed(1)}s`);
    console.log(`   Overall throughput: ${(results.length / duration).toFixed(1)} chunks/sec`);
    
  } catch (error) {
    console.log(`\n❌ Pipeline failed: ${error.message}`);
    console.log('   💡 This is expected without a valid API key');
    
    // Show pipeline statistics even on failure
    const stats = pipeline.getStats();
    console.log(`\n📊 Pipeline Statistics:`);
    console.log(`   Processed: ${stats.totalProcessed}`);
    console.log(`   Errors: ${stats.totalErrors}`);
    console.log(`   Duration: ${stats.elapsed.toFixed(1)}s`);
    console.log(`   Current batch size: ${stats.currentBatchSize}`);
  }

  // Demonstrate manual configuration
  console.log(`\n🔧 Demonstrating manual configuration...`);
  
  console.log(`   Current concurrency: ${pipeline.options.concurrency}`);
  pipeline.setConcurrency(5);
  console.log(`   Updated concurrency: ${pipeline.options.concurrency}`);
  
  console.log(`   Current batch size: ${pipeline.currentBatchSize}`);
  pipeline.setBatchSize(75);
  console.log(`   Updated batch size: ${pipeline.currentBatchSize}`);

  // Show rate limiter status
  console.log(`\n📈 Rate Limiter Status:`);
  try {
    const status = client.getRateLimiterStatus('openai');
    console.log(`   Requests in last minute: ${status.requestsInLastMinute}/${status.requestsPerMinuteLimit}`);
    console.log(`   Tokens in last minute: ${status.tokensInLastMinute}/${status.tokensPerMinuteLimit}`);
    console.log(`   Active requests: ${status.activeRequests}/${status.concurrentRequestsLimit}`);
    console.log(`   Queue length: ${status.queueLength}`);
    console.log(`   Can make request: ${status.canMakeRequest}`);
  } catch (error) {
    console.log(`   Status unavailable: ${error.message}`);
  }

  console.log(`\n🎯 Demo completed! Key features demonstrated:`);
  console.log(`   ✅ Concurrent batch processing`);
  console.log(`   ✅ Adaptive batch sizing`);
  console.log(`   ✅ Retry logic with exponential backoff`);
  console.log(`   ✅ Real-time progress monitoring`);
  console.log(`   ✅ Performance statistics`);
  console.log(`   ✅ Rate limiting integration`);
  console.log(`   ✅ Error handling and recovery`);
}

// Performance comparison demo
async function demonstratePerformanceComparison() {
  console.log('\n🏁 Performance Comparison Demo\n');

  const client = createEmbeddingClient({
    defaultProvider: 'openai',
    providers: {
      openai: {
        type: 'openai',
        apiKey: 'demo-key', // Will fail, but shows timing differences
        model: 'text-embedding-3-small'
      }
    }
  });

  const chunks = createMockChunks(100);

  // Sequential processing simulation
  console.log('📊 Simulating sequential processing...');
  const sequentialStart = Date.now();
  let sequentialTime = 0;
  
  // Simulate sequential API calls (100ms each)
  for (let i = 0; i < Math.ceil(chunks.length / 50); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    sequentialTime += 100;
  }
  
  console.log(`   Sequential time (simulated): ${sequentialTime}ms`);

  // Concurrent processing simulation
  console.log('📊 Simulating concurrent processing...');
  const concurrentStart = Date.now();
  
  // Simulate concurrent API calls (3 concurrent, 100ms each)
  const batches = Math.ceil(chunks.length / 50);
  const concurrentBatches = Math.ceil(batches / 3);
  await new Promise(resolve => setTimeout(resolve, concurrentBatches * 100));
  
  const concurrentTime = concurrentBatches * 100;
  console.log(`   Concurrent time (simulated): ${concurrentTime}ms`);

  const speedup = (sequentialTime / concurrentTime).toFixed(1);
  console.log(`   🚀 Speedup: ${speedup}x faster with concurrency`);

  console.log(`\n💡 Real-world benefits:`);
  console.log(`   • Reduced total processing time`);
  console.log(`   • Better resource utilization`);
  console.log(`   • Adaptive optimization based on API performance`);
  console.log(`   • Graceful handling of failures and rate limits`);
}

// Run the demo
async function main() {
  try {
    await demonstratePipeline();
    await demonstratePerformanceComparison();
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { demonstratePipeline, demonstratePerformanceComparison };