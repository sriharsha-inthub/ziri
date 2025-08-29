#!/usr/bin/env node

/**
 * Demo: Memory Optimization and Streaming
 * 
 * This demo showcases the memory optimization features implemented in Task 8:
 * - Memory monitoring and limits
 * - Checkpoint system for resumable indexing
 * - Streaming processing to avoid loading all files in memory
 * - Memory stress testing with large repositories
 */

import { MemoryMonitor, CheckpointManager, StreamingProcessor } from '../lib/memory/index.js';
import { RepositoryParser } from '../lib/repository/repository-parser.js';
import path from 'node:path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

async function demonstrateMemoryOptimization() {
  console.log('🧠 Ziri Memory Optimization and Streaming Demo\n');
  
  // Create temporary directory for checkpoints
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ziri-memory-demo-'));
  
  try {
    await runMemoryMonitoringDemo();
    await runCheckpointDemo(tempDir);
    await runStreamingProcessorDemo(tempDir);
    await runMemoryStressTest(tempDir);
  } finally {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Demonstrate memory monitoring capabilities
 */
async function runMemoryMonitoringDemo() {
  console.log('📊 Memory Monitoring Demo');
  console.log('=' .repeat(50));
  
  const memoryMonitor = new MemoryMonitor({
    maxMemoryMB: 256,
    warningThresholdPercent: 70,
    criticalThresholdPercent: 85,
    checkIntervalMs: 500
  });
  
  // Setup event listeners
  memoryMonitor.on('monitoring:started', (data) => {
    console.log(`✅ Memory monitoring started (limit: ${data.maxMemoryMB}MB)`);
  });
  
  memoryMonitor.on('memory:update', (usage) => {
    const usagePercent = memoryMonitor.getMemoryUsagePercent();
    console.log(`   Memory: ${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);
  });
  
  memoryMonitor.on('memory:warning', (data) => {
    console.log(`⚠️  Memory warning: ${data.percent.toFixed(1)}% usage`);
  });
  
  memoryMonitor.on('gc:forced', () => {
    console.log('🗑️  Garbage collection forced');
  });
  
  // Start monitoring
  memoryMonitor.startMonitoring();
  
  // Simulate memory usage
  console.log('\n🔄 Simulating memory usage...');
  const memoryHogs = [];
  
  for (let i = 0; i < 5; i++) {
    // Allocate some memory
    memoryHogs.push(new Array(100000).fill('memory-test-data'));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check current usage
    const usage = memoryMonitor.getCurrentUsage();
    console.log(`   Iteration ${i + 1}: ${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  }
  
  // Force garbage collection
  console.log('\n🗑️  Forcing garbage collection...');
  const gcResult = memoryMonitor.forceGC();
  console.log(`   GC available: ${gcResult}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get final stats
  const stats = memoryMonitor.getStats();
  console.log('\n📈 Memory Statistics:');
  console.log(`   Peak usage: ${(stats.peakUsage / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Current usage: ${(stats.currentUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Warning count: ${stats.warningCount}`);
  console.log(`   GC count: ${stats.gcCount}`);
  
  memoryMonitor.stopMonitoring();
  console.log('✅ Memory monitoring demo completed\n');
}

/**
 * Demonstrate checkpoint system
 */
async function runCheckpointDemo(tempDir) {
  console.log('💾 Checkpoint System Demo');
  console.log('=' .repeat(50));
  
  const checkpointManager = new CheckpointManager(tempDir, {
    checkpointInterval: 5,
    maxCheckpoints: 3
  });
  
  // Setup event listeners
  checkpointManager.on('checkpoint:saved', (data) => {
    console.log(`💾 Checkpoint saved: ${data.processedCount} items processed`);
  });
  
  checkpointManager.on('checkpoint:loaded', (data) => {
    console.log(`📂 Checkpoint loaded: ${data.processedCount} items from checkpoint`);
  });
  
  const repositoryId = 'demo-repo';
  const operationType = 'indexing';
  
  // Initialize checkpoint system
  console.log('🚀 Initializing checkpoint system...');
  await checkpointManager.initialize(repositoryId, operationType);
  
  // Simulate processing files
  console.log('\n🔄 Simulating file processing...');
  const mockFiles = Array.from({ length: 25 }, (_, i) => ({
    path: `/demo/file${i}.js`,
    hash: `hash${i}`,
    size: Math.floor(Math.random() * 5000) + 1000
  }));
  
  for (let i = 0; i < mockFiles.length; i++) {
    const file = mockFiles[i];
    const chunksProcessed = Math.floor(Math.random() * 5) + 1;
    
    checkpointManager.updateProgress(file, chunksProcessed);
    
    if ((i + 1) % 5 === 0) {
      console.log(`   Processed ${i + 1} files...`);
    }
    
    // Small delay to simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Get processing stats
  const stats = checkpointManager.getStats();
  console.log('\n📊 Processing Statistics:');
  console.log(`   Repository: ${stats.repositoryId}`);
  console.log(`   Files processed: ${stats.processedCount}`);
  console.log(`   Chunks processed: ${stats.processedChunks}`);
  console.log(`   Throughput: ${stats.throughput.toFixed(1)} files/sec`);
  
  // Complete operation
  console.log('\n✅ Completing operation...');
  await checkpointManager.completeOperation({
    totalFiles: mockFiles.length,
    success: true
  });
  
  // Test resume functionality
  console.log('\n🔄 Testing resume functionality...');
  
  // Start new operation
  await checkpointManager.initialize(repositoryId, 'resume-test');
  
  // Process some files
  for (let i = 0; i < 10; i++) {
    checkpointManager.updateProgress({
      path: `/resume/file${i}.js`,
      hash: `resume-hash${i}`
    }, 2);
  }
  
  await checkpointManager.saveCheckpoint();
  
  // Check if we should resume
  const resumeInfo = await checkpointManager.shouldResume(repositoryId, 'resume-test');
  console.log(`   Should resume: ${resumeInfo.shouldResume}`);
  console.log(`   Processed count: ${resumeInfo.checkpoint?.processedCount || 0}`);
  
  // Test file processed check
  console.log(`   File 0 processed: ${checkpointManager.isFileProcessed('/resume/file0.js')}`);
  console.log(`   File 15 processed: ${checkpointManager.isFileProcessed('/resume/file15.js')}`);
  
  await checkpointManager.completeOperation();
  console.log('✅ Checkpoint demo completed\n');
}

/**
 * Demonstrate streaming processor
 */
async function runStreamingProcessorDemo(tempDir) {
  console.log('🌊 Streaming Processor Demo');
  console.log('=' .repeat(50));
  
  const checkpointManager = new CheckpointManager(tempDir, {
    checkpointInterval: 10
  });
  
  const streamingProcessor = new StreamingProcessor({
    memoryLimitMB: 128,
    batchSize: 8,
    checkpointManager,
    pauseOnMemoryPressure: true
  });
  
  // Setup event listeners
  streamingProcessor.on('processing:started', (data) => {
    console.log(`🚀 Processing started for ${data.repositoryId}`);
    console.log(`   Memory limit: ${data.memoryLimitMB}MB, Batch size: ${data.batchSize}`);
  });
  
  streamingProcessor.on('batch:started', (data) => {
    console.log(`   📦 Processing batch of ${data.batchSize} items...`);
  });
  
  streamingProcessor.on('batch:completed', (data) => {
    console.log(`   ✅ Batch completed: ${data.throughput.toFixed(1)} items/sec`);
  });
  
  streamingProcessor.on('memory:warning', (data) => {
    console.log(`   ⚠️  Memory warning: ${data.percent.toFixed(1)}% usage`);
  });
  
  streamingProcessor.on('processing:paused', (data) => {
    console.log(`   ⏸️  Processing paused: ${data.reason}`);
  });
  
  streamingProcessor.on('processing:resumed', (data) => {
    console.log(`   ▶️  Processing resumed: ${data.reason}`);
  });
  
  streamingProcessor.on('checkpoint:saved', (data) => {
    console.log(`   💾 Checkpoint saved: ${data.processedCount} items`);
  });
  
  streamingProcessor.on('processing:completed', (data) => {
    console.log(`🎉 Processing completed: ${data.processedCount} items in ${data.duration}ms`);
  });
  
  // Create test dataset
  console.log('\n📁 Creating test dataset...');
  const testDataset = Array.from({ length: 50 }, (_, i) => ({
    path: `/streaming/file${i}.js`,
    content: `// File ${i}\nfunction test${i}() {\n  return "Hello from file ${i}";\n}`,
    size: Math.floor(Math.random() * 2000) + 500
  }));
  
  console.log(`   Created ${testDataset.length} test files`);
  
  // Define processor function
  const processorFn = async (batch) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return batch.map(item => ({
      filePath: item.path,
      chunks: Math.floor(item.content.length / 100) + 1,
      embedding: new Array(384).fill(0).map(() => Math.random()), // Simulate embedding
      success: true
    }));
  };
  
  // Process the dataset
  console.log('\n🔄 Processing dataset with streaming...');
  const results = [];
  
  for await (const result of streamingProcessor.processStream(
    testDataset,
    processorFn,
    { repositoryId: 'streaming-demo' }
  )) {
    results.push(result);
  }
  
  // Get final statistics
  const finalStats = streamingProcessor.getStats();
  console.log('\n📊 Final Statistics:');
  console.log(`   Total processed: ${finalStats.processedCount}`);
  console.log(`   Total errors: ${finalStats.errorCount}`);
  console.log(`   Duration: ${finalStats.elapsed}ms`);
  console.log(`   Throughput: ${finalStats.throughput.toFixed(2)} items/sec`);
  console.log(`   Peak memory: ${(finalStats.memory.peakUsage / 1024 / 1024).toFixed(1)}MB`);
  
  console.log('✅ Streaming processor demo completed\n');
}

/**
 * Demonstrate memory stress testing
 */
async function runMemoryStressTest(tempDir) {
  console.log('🔥 Memory Stress Test');
  console.log('=' .repeat(50));
  
  const checkpointManager = new CheckpointManager(tempDir, {
    checkpointInterval: 100
  });
  
  const streamingProcessor = new StreamingProcessor({
    memoryLimitMB: 64, // Lower limit for stress testing
    batchSize: 20,
    checkpointManager,
    pauseOnMemoryPressure: true
  });
  
  // Create large dataset
  console.log('📊 Creating large dataset for stress testing...');
  const largeDataset = Array.from({ length: 500 }, (_, i) => ({
    path: `/stress/file${i}.js`,
    content: 'x'.repeat(2000), // 2KB per file
    metadata: {
      id: i,
      timestamp: Date.now(),
      tags: ['test', 'stress', `file${i}`]
    }
  }));
  
  console.log(`   Created ${largeDataset.length} files (${(largeDataset.length * 2).toFixed(1)}KB total)`);
  
  // Track memory events
  let memoryWarnings = 0;
  let memoryPauses = 0;
  let checkpointsSaved = 0;
  
  streamingProcessor.on('memory:warning', () => memoryWarnings++);
  streamingProcessor.on('processing:paused', (data) => {
    if (data.reason === 'memory_pressure') memoryPauses++;
  });
  streamingProcessor.on('checkpoint:saved', () => checkpointsSaved++);
  
  // Memory-intensive processor
  const stressProcessorFn = async (batch) => {
    // Simulate memory-intensive processing
    const results = [];
    
    for (const item of batch) {
      // Create large temporary objects
      const tempData = {
        original: item,
        processed: item.content.split('').reverse().join(''),
        chunks: Array.from({ length: 10 }, (_, i) => ({
          id: `${item.path}_chunk_${i}`,
          content: item.content.substring(i * 200, (i + 1) * 200),
          embedding: new Array(768).fill(0).map(() => Math.random()) // Large embedding
        })),
        metadata: {
          ...item.metadata,
          processedAt: Date.now(),
          processingId: Math.random().toString(36)
        }
      };
      
      results.push({
        filePath: item.path,
        chunks: tempData.chunks.length,
        success: true,
        memoryUsage: JSON.stringify(tempData).length
      });
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return results;
  };
  
  console.log('\n🔄 Running stress test...');
  const startTime = Date.now();
  const results = [];
  
  try {
    for await (const result of streamingProcessor.processStream(
      largeDataset,
      stressProcessorFn,
      { repositoryId: 'stress-test' }
    )) {
      results.push(result);
      
      // Progress indicator
      if (results.length % 100 === 0) {
        const progress = (results.length / largeDataset.length * 100).toFixed(1);
        const memUsage = streamingProcessor.memoryMonitor.getMemoryUsagePercent();
        console.log(`   Progress: ${progress}% (Memory: ${memUsage.toFixed(1)}%)`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n🎉 Stress test completed successfully!');
    console.log('\n📊 Stress Test Results:');
    console.log(`   Files processed: ${results.length}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Throughput: ${(results.length / (duration / 1000)).toFixed(2)} files/sec`);
    console.log(`   Memory warnings: ${memoryWarnings}`);
    console.log(`   Memory pauses: ${memoryPauses}`);
    console.log(`   Checkpoints saved: ${checkpointsSaved}`);
    
    const finalStats = streamingProcessor.getStats();
    console.log(`   Peak memory: ${(finalStats.memory.peakUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Average memory: ${(finalStats.memory.averageUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   GC count: ${finalStats.memory.gcCount}`);
    
    // Verify no memory leaks
    const finalMemory = streamingProcessor.memoryMonitor.getCurrentUsage();
    console.log(`   Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
  } catch (error) {
    console.error('❌ Stress test failed:', error.message);
  }
  
  console.log('✅ Memory stress test completed\n');
}

// Run the demo
demonstrateMemoryOptimization().catch(console.error);