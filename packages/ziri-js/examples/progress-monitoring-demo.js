/**
 * Progress Monitoring Demo
 * Demonstrates the comprehensive progress monitoring and statistics system
 */

import { ProgressManager } from '../lib/progress/progress-manager.js';
import { ProgressMonitor } from '../lib/progress/progress-monitor.js';
import { ProgressReporter } from '../lib/progress/progress-reporter.js';
import { StatisticsCollector } from '../lib/progress/statistics-collector.js';

// Demo configuration
const DEMO_CONFIG = {
  totalFiles: 1000,
  avgFileSize: 2048,
  avgChunksPerFile: 8,
  batchSize: 50,
  concurrency: 3,
  simulateErrors: true,
  simulateSkips: true
};

/**
 * Simulate a complete indexing operation with progress monitoring
 */
async function simulateIndexingWithProgress() {
  console.log('🎯 Progress Monitoring Demo\n');
  
  // Create progress manager with full monitoring
  const progressManager = new ProgressManager({
    enableReporting: true,
    enableStatistics: true,
    reportingOptions: {
      showProgressBar: true,
      showThroughput: true,
      showETA: true,
      showDetailedStats: true,
      progressBarWidth: 40
    },
    statisticsOptions: {
      collectDetailedMetrics: true,
      trackMemoryUsage: true,
      trackApiMetrics: true
    }
  });

  try {
    // Start indexing
    progressManager.start({
      repositoryName: 'example-project',
      repositoryId: 'abc123def456789',
      provider: 'openai',
      options: {
        concurrency: DEMO_CONFIG.concurrency,
        batchSize: DEMO_CONFIG.batchSize,
        memoryLimit: '512MB'
      }
    });

    // Phase 1: Discovery
    console.log('Phase 1: File Discovery');
    progressManager.setPhase('discovery', { 
      excludePatterns: ['node_modules', '.git', '*.log'] 
    });
    
    await simulateDiscovery(progressManager);

    // Phase 2: File Processing
    console.log('\nPhase 2: File Processing');
    progressManager.setPhase('processing', { 
      concurrency: DEMO_CONFIG.concurrency 
    });
    
    await simulateFileProcessing(progressManager);

    // Phase 3: Embedding Generation
    console.log('\nPhase 3: Embedding Generation');
    progressManager.setPhase('embedding', { 
      provider: 'openai',
      batchSize: DEMO_CONFIG.batchSize 
    });
    
    await simulateEmbeddingGeneration(progressManager);

    // Phase 4: Storage
    console.log('\nPhase 4: Vector Storage');
    progressManager.setPhase('storage');
    
    await simulateVectorStorage(progressManager);

    // Complete indexing
    const completionReport = progressManager.complete({
      repositoryId: 'abc123def456789',
      indexVersion: '1.0.0'
    });

    // Show additional insights
    console.log('\n📊 Additional Insights:');
    showPerformanceInsights(completionReport);
    showRecommendations(progressManager);

    return completionReport;

  } catch (error) {
    progressManager.recordError(error, {
      phase: 'demo',
      suggestion: 'Check demo configuration and try again'
    });
    throw error;
  } finally {
    progressManager.cleanup();
  }
}

/**
 * Simulate file discovery phase
 */
async function simulateDiscovery(progressManager) {
  const startTime = Date.now();
  
  // Simulate discovery time
  await sleep(500);
  
  const discoveryStats = {
    totalFiles: DEMO_CONFIG.totalFiles,
    totalChunks: DEMO_CONFIG.totalFiles * DEMO_CONFIG.avgChunksPerFile,
    totalBytes: DEMO_CONFIG.totalFiles * DEMO_CONFIG.avgFileSize,
    duration: Date.now() - startTime
  };
  
  progressManager.recordDiscovery(discoveryStats);
}

/**
 * Simulate file processing phase
 */
async function simulateFileProcessing(progressManager) {
  const totalFiles = DEMO_CONFIG.totalFiles;
  let processedFiles = 0;
  let skippedFiles = 0;
  let errorFiles = 0;

  // Process files in batches to simulate concurrency
  const batchSize = DEMO_CONFIG.concurrency;
  
  for (let i = 0; i < totalFiles; i += batchSize) {
    const batch = Math.min(batchSize, totalFiles - i);
    
    // Process batch concurrently
    const batchPromises = [];
    for (let j = 0; j < batch; j++) {
      batchPromises.push(simulateFileProcessing_single(progressManager, i + j));
    }
    
    const results = await Promise.all(batchPromises);
    
    // Count results
    results.forEach(result => {
      if (result.success) processedFiles++;
      else if (result.skipped) skippedFiles++;
      else if (result.error) errorFiles++;
    });
    
    // Small delay to show progress
    await sleep(50);
  }
  
  console.log(`\n  📄 Processed: ${processedFiles}, Skipped: ${skippedFiles}, Errors: ${errorFiles}`);
}

/**
 * Simulate processing a single file
 */
async function simulateFileProcessing_single(progressManager, fileIndex) {
  // Simulate processing time
  await sleep(Math.random() * 100 + 50);
  
  // Simulate different outcomes
  const random = Math.random();
  
  if (DEMO_CONFIG.simulateSkips && random < 0.1) {
    // 10% skip rate (unchanged files)
    progressManager.recordFileProcessing({
      skipped: true,
      path: `src/file_${fileIndex}.js`
    });
    return { skipped: true };
  } else if (DEMO_CONFIG.simulateErrors && random < 0.15) {
    // 5% error rate
    progressManager.recordFileProcessing({
      error: true,
      path: `src/file_${fileIndex}.js`
    });
    return { error: true };
  } else {
    // Successful processing
    const chunks = Math.floor(Math.random() * 10) + 5; // 5-14 chunks
    const tokens = chunks * 50; // ~50 tokens per chunk
    
    progressManager.recordFileProcessing({
      success: true,
      path: `src/file_${fileIndex}.js`,
      size: DEMO_CONFIG.avgFileSize + Math.random() * 1000,
      chunks,
      tokens
    });
    return { success: true };
  }
}

/**
 * Simulate embedding generation phase
 */
async function simulateEmbeddingGeneration(progressManager) {
  const totalChunks = DEMO_CONFIG.totalFiles * DEMO_CONFIG.avgChunksPerFile * 0.85; // Account for skips/errors
  const batchSize = DEMO_CONFIG.batchSize;
  const totalBatches = Math.ceil(totalChunks / batchSize);
  
  console.log(`  🤖 Generating embeddings for ${Math.floor(totalChunks)} chunks in ${totalBatches} batches`);
  
  for (let i = 0; i < totalBatches; i++) {
    const currentBatchSize = Math.min(batchSize, totalChunks - (i * batchSize));
    
    // Simulate API call with variable response time
    const responseTime = simulateApiResponseTime();
    await sleep(responseTime);
    
    // Simulate occasional API errors
    const hasError = Math.random() < 0.02; // 2% error rate
    
    if (hasError) {
      progressManager.recordBatch({
        batchSize: currentBatchSize,
        embeddings: 0,
        errors: 1,
        responseTime,
        error: new Error('API rate limit exceeded'),
        rateLimited: true
      });
      
      // Simulate retry
      progressManager.recordRetry({ rateLimited: true });
      await sleep(2000); // Backoff delay
      
      // Retry successful
      const retryResponseTime = simulateApiResponseTime() * 1.5;
      await sleep(retryResponseTime);
      
      progressManager.recordBatch({
        batchSize: currentBatchSize,
        embeddings: currentBatchSize,
        responseTime: retryResponseTime,
        throughput: currentBatchSize / (retryResponseTime / 1000)
      });
    } else {
      progressManager.recordBatch({
        batchSize: currentBatchSize,
        embeddings: currentBatchSize,
        responseTime,
        throughput: currentBatchSize / (responseTime / 1000)
      });
    }
  }
}

/**
 * Simulate vector storage phase
 */
async function simulateVectorStorage(progressManager) {
  // Simulate storage operations
  await sleep(1000);
  
  console.log('  💾 Storing vectors and metadata...');
}

/**
 * Simulate API response time with realistic variation
 */
function simulateApiResponseTime() {
  // Base response time: 1-3 seconds
  const baseTime = 1000 + Math.random() * 2000;
  
  // Add occasional spikes (10% chance of 2x slower)
  if (Math.random() < 0.1) {
    return baseTime * 2;
  }
  
  return baseTime;
}

/**
 * Show performance insights from the completion report
 */
function showPerformanceInsights(report) {
  console.log('  🚀 Performance Analysis:');
  
  if (report.performance.filesPerSecond > 5) {
    console.log('    ✅ Good file processing throughput');
  } else {
    console.log('    ⚠️  File processing could be faster');
  }
  
  if (report.performance.avgThroughput > 20) {
    console.log('    ✅ Good embedding throughput');
  } else {
    console.log('    ⚠️  Embedding throughput could be improved');
  }
  
  if (report.quality.successRate > 90) {
    console.log('    ✅ High success rate');
  } else {
    console.log('    ⚠️  Success rate could be improved');
  }
  
  // Memory analysis
  if (report.detailedStats?.rawMetrics?.memory?.peakUsage) {
    const peakMB = report.detailedStats.rawMetrics.memory.peakUsage / (1024 * 1024);
    console.log(`    📊 Peak memory usage: ${peakMB.toFixed(1)}MB`);
  }
}

/**
 * Show recommendations from the progress manager
 */
function showRecommendations(progressManager) {
  const recommendations = progressManager.getRecommendations();
  
  if (recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  } else {
    console.log('\n✅ No performance recommendations - system is running optimally!');
  }
}

/**
 * Demo individual components
 */
async function demoIndividualComponents() {
  console.log('\n🔧 Individual Component Demos\n');
  
  // Demo ProgressMonitor
  console.log('1. ProgressMonitor Demo:');
  await demoProgressMonitor();
  
  // Demo ProgressReporter
  console.log('\n2. ProgressReporter Demo:');
  demoProgressReporter();
  
  // Demo StatisticsCollector
  console.log('\n3. StatisticsCollector Demo:');
  await demoStatisticsCollector();
}

/**
 * Demo ProgressMonitor standalone
 */
async function demoProgressMonitor() {
  const monitor = new ProgressMonitor({
    updateInterval: 500,
    etaWindowSize: 5
  });
  
  monitor.on('progress', (progress) => {
    console.log(`  Progress: ${progress.percentage}% | ETA: ${progress.eta ? progress.eta.toFixed(1) + 's' : 'calculating...'}`);
  });
  
  monitor.start({ totalItems: 50 });
  
  for (let i = 0; i < 50; i += 5) {
    monitor.updateProgress(5);
    await sleep(200);
  }
  
  const report = monitor.complete();
  console.log(`  Completed in ${report.performance.totalDuration.toFixed(1)}s`);
}

/**
 * Demo ProgressReporter standalone
 */
function demoProgressReporter() {
  const reporter = new ProgressReporter({
    showProgressBar: true,
    showThroughput: true,
    showETA: true
  });
  
  // Mock progress data
  const mockProgress = {
    progress: 0.75,
    percentage: 75,
    processed: 750,
    total: 1000,
    phase: 'embedding',
    throughput: 12.5,
    eta: 20,
    errors: 3
  };
  
  console.log('  Sample progress line:');
  reporter.reportProgress(mockProgress);
  console.log(''); // New line after progress
}

/**
 * Demo StatisticsCollector standalone
 */
async function demoStatisticsCollector() {
  const collector = new StatisticsCollector({
    collectDetailedMetrics: true,
    trackMemoryUsage: false // Disable for demo
  });
  
  collector.start();
  
  // Simulate some operations
  collector.startPhase('processing');
  
  for (let i = 0; i < 10; i++) {
    collector.recordFileDiscovery({ path: `file${i}.js`, size: 1024 + i * 100 });
    collector.recordFileProcessing({ success: true, size: 1024, chunks: 5 });
    collector.recordEmbeddingBatch({ success: true, embeddings: 5, responseTime: 1500 });
  }
  
  collector.endPhase('processing');
  
  const report = collector.generateReport();
  console.log('  Statistics Summary:');
  console.log(`    Files processed: ${report.summary.processedFiles}`);
  console.log(`    Embeddings generated: ${report.summary.totalEmbeddings}`);
  console.log(`    Avg response time: ${report.rawMetrics.embeddings.avgResponseTime}ms`);
  
  collector.cleanup();
}

/**
 * Utility function for delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main demo function
 */
async function main() {
  try {
    console.log('🎯 Ziri Progress Monitoring System Demo\n');
    console.log('This demo showcases the comprehensive progress monitoring capabilities.\n');
    
    // Run main simulation
    await simulateIndexingWithProgress();
    
    // Demo individual components
    await demoIndividualComponents();
    
    console.log('\n✅ Demo completed successfully!');
    console.log('\nThe progress monitoring system provides:');
    console.log('  • Real-time progress tracking with ETA calculations');
    console.log('  • Comprehensive performance statistics');
    console.log('  • Detailed completion reports');
    console.log('  • Performance recommendations');
    console.log('  • Memory and API usage monitoring');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  simulateIndexingWithProgress,
  demoIndividualComponents,
  demoProgressMonitor,
  demoProgressReporter,
  demoStatisticsCollector
};