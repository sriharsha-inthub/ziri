import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { IndexManager } from '../../lib/index/index-manager.js';
import { ConfigManager } from '../../lib/config/config-manager.js';
import { PerformanceBenchmarkSuite } from '../../lib/performance/performance-benchmark-suite.js';

describe('Performance Regression Tests', () => {
  let tempDir;
  let indexManager;
  let configManager;
  let benchmarkSuite;
  let performanceBaselines;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), 'ziri-perf-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    const ziriConfigDir = path.join(tempDir, '.ziri');
    await fs.mkdir(ziriConfigDir, { recursive: true });
    
    configManager = new ConfigManager(ziriConfigDir);
    indexManager = new IndexManager(configManager);
    benchmarkSuite = new PerformanceBenchmarkSuite();
    
    // Load performance baselines (if they exist)
    performanceBaselines = await loadPerformanceBaselines();
    
    // Configure for consistent testing
    await configManager.updateConfig({
      defaultProvider: 'openai',
      providers: {
        openai: {
          type: 'openai',
          model: 'text-embedding-3-small',
          dimensions: 1536,
          maxTokens: 8191,
          rateLimit: {
            requestsPerMinute: 3000,
            tokensPerMinute: 1000000
          }
        }
      },
      performance: {
        concurrency: 3,
        batchSize: 100,
        memoryLimit: 512 * 1024 * 1024
      }
    });
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Indexing Performance Benchmarks', () => {
    it('should meet performance requirements for small repositories', async () => {
      const testRepoPath = path.join(tempDir, 'small-repo');
      await createBenchmarkRepository(testRepoPath, 'small');
      
      const benchmark = await runPerformanceBenchmark(testRepoPath, 'small');
      
      // Performance requirements for small repositories
      expect(benchmark.duration).toBeLessThan(10000); // Under 10 seconds
      expect(benchmark.throughput.filesPerSecond).toBeGreaterThan(5);
      expect(benchmark.memoryUsage.peak).toBeLessThan(128 * 1024 * 1024); // Under 128MB
      
      // Compare against baseline if available
      if (performanceBaselines.small) {
        const regression = calculateRegression(benchmark, performanceBaselines.small);
        expect(regression.duration).toBeLessThan(1.2); // No more than 20% slower
        expect(regression.throughput).toBeGreaterThan(0.8); // No less than 80% throughput
      }
      
      await savePerformanceResult('small', benchmark);
      console.log('📊 Small repository benchmark:', formatBenchmarkResult(benchmark));
    });

    it('should meet performance requirements for medium repositories', async () => {
      const testRepoPath = path.join(tempDir, 'medium-repo');
      await createBenchmarkRepository(testRepoPath, 'medium');
      
      const benchmark = await runPerformanceBenchmark(testRepoPath, 'medium');
      
      // Performance requirements for medium repositories (Requirement 1.1)
      expect(benchmark.duration).toBeLessThan(60000); // Under 60 seconds
      expect(benchmark.throughput.filesPerSecond).toBeGreaterThan(10);
      expect(benchmark.memoryUsage.peak).toBeLessThan(512 * 1024 * 1024); // Under 512MB
      
      // Compare against baseline if available
      if (performanceBaselines.medium) {
        const regression = calculateRegression(benchmark, performanceBaselines.medium);
        expect(regression.duration).toBeLessThan(1.2); // No more than 20% slower
        expect(regression.throughput).toBeGreaterThan(0.8); // No less than 80% throughput
      }
      
      await savePerformanceResult('medium', benchmark);
      console.log('📊 Medium repository benchmark:', formatBenchmarkResult(benchmark));
    }, 120000);

    it('should scale efficiently with repository size', async () => {
      const sizes = ['small', 'medium', 'large'];
      const results = {};
      
      for (const size of sizes) {
        const testRepoPath = path.join(tempDir, `${size}-repo`);
        await createBenchmarkRepository(testRepoPath, size);
        
        results[size] = await runPerformanceBenchmark(testRepoPath, size);
        
        // Clean up immediately to save space
        await fs.rm(testRepoPath, { recursive: true, force: true });
      }
      
      // Verify scaling characteristics
      expect(results.medium.duration).toBeGreaterThan(results.small.duration);
      expect(results.large.duration).toBeGreaterThan(results.medium.duration);
      
      // Throughput should remain reasonable even for large repos
      expect(results.large.throughput.filesPerSecond).toBeGreaterThan(5);
      
      // Memory usage should scale sub-linearly
      const memoryScaling = results.large.memoryUsage.peak / results.small.memoryUsage.peak;
      expect(memoryScaling).toBeLessThan(10); // Should not scale linearly with size
      
      console.log('📈 Scaling analysis:');
      for (const [size, result] of Object.entries(results)) {
        console.log(`  ${size}: ${formatBenchmarkResult(result)}`);
      }
    }, 300000);
  });

  describe('Concurrency Performance Tests', () => {
    it('should optimize performance with concurrent processing', async () => {
      const testRepoPath = path.join(tempDir, 'concurrency-test');
      await createBenchmarkRepository(testRepoPath, 'medium');
      
      const concurrencyLevels = [1, 2, 3, 5, 8];
      const results = [];
      
      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();
        
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          concurrency,
          batchSize: 100,
          forceFullIndex: true
        });
        
        const duration = Date.now() - startTime;
        const throughput = result.filesProcessed / (duration / 1000);
        
        results.push({
          concurrency,
          duration,
          throughput,
          filesProcessed: result.filesProcessed
        });
        
        console.log(`🔄 Concurrency ${concurrency}: ${duration}ms, ${throughput.toFixed(2)} files/sec`);
      }
      
      // Find optimal concurrency level
      const optimalResult = results.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );
      
      // Verify concurrency improves performance
      const singleThreaded = results.find(r => r.concurrency === 1);
      expect(optimalResult.throughput).toBeGreaterThan(singleThreaded.throughput * 1.5); // At least 50% improvement
      
      // Verify optimal concurrency is reasonable (not too high)
      expect(optimalResult.concurrency).toBeLessThanOrEqual(5);
      
      console.log(`🎯 Optimal concurrency: ${optimalResult.concurrency} (${optimalResult.throughput.toFixed(2)} files/sec)`);
    }, 180000);

    it('should handle batch size optimization', async () => {
      const testRepoPath = path.join(tempDir, 'batch-test');
      await createBenchmarkRepository(testRepoPath, 'medium');
      
      const batchSizes = [25, 50, 100, 200, 400];
      const results = [];
      
      for (const batchSize of batchSizes) {
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage();
        
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          concurrency: 3,
          batchSize,
          forceFullIndex: true
        });
        
        const duration = Date.now() - startTime;
        const memoryAfter = process.memoryUsage();
        const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
        
        results.push({
          batchSize,
          duration,
          memoryDelta,
          throughput: result.filesProcessed / (duration / 1000)
        });
        
        console.log(`📦 Batch ${batchSize}: ${duration}ms, ${Math.round(memoryDelta / 1024 / 1024)}MB`);
      }
      
      // Find optimal batch size (best throughput with reasonable memory)
      const optimalResult = results
        .filter(r => r.memoryDelta < 256 * 1024 * 1024) // Under 256MB
        .reduce((best, current) => 
          current.throughput > best.throughput ? current : best
        );
      
      expect(optimalResult).toBeDefined();
      expect(optimalResult.batchSize).toBeGreaterThanOrEqual(50);
      expect(optimalResult.batchSize).toBeLessThanOrEqual(200);
      
      console.log(`🎯 Optimal batch size: ${optimalResult.batchSize} (${optimalResult.throughput.toFixed(2)} files/sec)`);
    }, 180000);
  });

  describe('Memory Usage Regression Tests', () => {
    it('should maintain memory efficiency for large repositories', async () => {
      const testRepoPath = path.join(tempDir, 'memory-test');
      await createBenchmarkRepository(testRepoPath, 'large');
      
      const memoryBefore = process.memoryUsage();
      let peakMemory = memoryBefore.heapUsed;
      
      // Monitor memory during indexing
      const memoryMonitor = setInterval(() => {
        const current = process.memoryUsage().heapUsed;
        if (current > peakMemory) {
          peakMemory = current;
        }
      }, 100);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        concurrency: 3,
        batchSize: 100,
        forceFullIndex: true
      });
      
      clearInterval(memoryMonitor);
      
      const memoryAfter = process.memoryUsage();
      const memoryDelta = peakMemory - memoryBefore.heapUsed;
      
      // Memory requirements (Requirement 1.4)
      expect(memoryDelta).toBeLessThan(512 * 1024 * 1024); // Under 512MB peak
      
      // Memory should be released after indexing
      const finalMemory = memoryAfter.heapUsed - memoryBefore.heapUsed;
      expect(finalMemory).toBeLessThan(memoryDelta * 0.5); // At least 50% released
      
      console.log(`💾 Memory usage: ${Math.round(memoryDelta / 1024 / 1024)}MB peak, ${Math.round(finalMemory / 1024 / 1024)}MB retained`);
      console.log(`📁 Processed ${result.filesProcessed} files`);
    }, 240000);

    it('should handle memory pressure gracefully', async () => {
      const testRepoPath = path.join(tempDir, 'pressure-test');
      await createBenchmarkRepository(testRepoPath, 'large');
      
      // Configure with very strict memory limits
      await configManager.updateConfig({
        performance: {
          concurrency: 1,
          batchSize: 25,
          memoryLimit: 128 * 1024 * 1024 // Very strict 128MB limit
        }
      });
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        concurrency: 1,
        batchSize: 25,
        forceFullIndex: true
      });
      
      // Should complete successfully even with strict limits
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(result.embeddingsCreated).toBeGreaterThan(0);
      
      console.log(`🔒 Completed under memory pressure: ${result.filesProcessed} files processed`);
    }, 300000);
  });

  describe('Provider Performance Comparison', () => {
    it('should benchmark different embedding providers', async () => {
      const testRepoPath = path.join(tempDir, 'provider-test');
      await createBenchmarkRepository(testRepoPath, 'small');
      
      const providers = ['openai', 'ollama', 'huggingface'];
      const results = {};
      
      // Configure all providers
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768,
            baseUrl: 'http://localhost:11434'
          },
          huggingface: {
            type: 'huggingface',
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            dimensions: 384
          }
        }
      });
      
      for (const provider of providers) {
        try {
          const benchmark = await runPerformanceBenchmark(testRepoPath, 'small', provider);
          results[provider] = benchmark;
          
          console.log(`🔌 ${provider}: ${formatBenchmarkResult(benchmark)}`);
        } catch (error) {
          console.log(`⚠️ ${provider}: ${error.message}`);
          results[provider] = { error: error.message };
        }
      }
      
      // At least one provider should work
      const successfulProviders = Object.entries(results).filter(([_, result]) => !result.error);
      expect(successfulProviders.length).toBeGreaterThan(0);
      
      // Compare provider performance
      if (successfulProviders.length > 1) {
        const [fastest] = successfulProviders.reduce((best, current) => 
          current[1].duration < best[1].duration ? current : best
        );
        
        console.log(`🏆 Fastest provider: ${fastest}`);
      }
    }, 180000);
  });

  // Helper functions
  async function runPerformanceBenchmark(repoPath, size, provider = 'openai') {
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();
    let peakMemory = memoryBefore.heapUsed;
    
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage().heapUsed;
      if (current > peakMemory) {
        peakMemory = current;
      }
    }, 100);
    
    try {
      const result = await indexManager.indexRepository(repoPath, {
        provider,
        concurrency: 3,
        batchSize: 100,
        forceFullIndex: true
      });
      
      const duration = Date.now() - startTime;
      clearInterval(memoryMonitor);
      
      return {
        duration,
        filesProcessed: result.filesProcessed,
        chunksGenerated: result.chunksGenerated,
        embeddingsCreated: result.embeddingsCreated,
        throughput: {
          filesPerSecond: result.filesProcessed / (duration / 1000),
          chunksPerSecond: result.chunksGenerated / (duration / 1000)
        },
        memoryUsage: {
          peak: peakMemory - memoryBefore.heapUsed,
          final: process.memoryUsage().heapUsed - memoryBefore.heapUsed
        }
      };
    } finally {
      clearInterval(memoryMonitor);
    }
  }

  async function createBenchmarkRepository(repoPath, size) {
    await fs.mkdir(repoPath, { recursive: true });
    
    const fileCounts = {
      small: 20,
      medium: 100,
      large: 500
    };
    
    const fileCount = fileCounts[size] || 20;
    
    // Create directory structure
    await fs.mkdir(path.join(repoPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(repoPath, 'tests'), { recursive: true });
    await fs.mkdir(path.join(repoPath, 'docs'), { recursive: true });
    
    // Create main files
    await fs.writeFile(
      path.join(repoPath, 'README.md'),
      `# ${size.charAt(0).toUpperCase() + size.slice(1)} Benchmark Repository\n\nThis is a ${size} repository for performance benchmarking.`
    );
    
    await fs.writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ name: `${size}-benchmark-repo`, version: '1.0.0' }, null, 2)
    );
    
    // Generate files based on size
    for (let i = 0; i < fileCount; i++) {
      const content = generateFileContent(i, size);
      await fs.writeFile(path.join(repoPath, 'src', `file${i}.js`), content);
      
      if (i < fileCount / 2) {
        const testContent = generateTestContent(i);
        await fs.writeFile(path.join(repoPath, 'tests', `file${i}.test.js`), testContent);
      }
    }
  }

  function generateFileContent(index, size) {
    const complexityMultiplier = { small: 1, medium: 2, large: 3 }[size] || 1;
    const functionCount = 5 * complexityMultiplier;
    
    let content = `// Generated file ${index}\n\n`;
    
    for (let i = 0; i < functionCount; i++) {
      content += `export function func${index}_${i}() {\n`;
      content += `  // Function ${index}_${i} implementation\n`;
      content += `  const data = { id: ${index}, index: ${i} };\n`;
      content += `  return processData(data);\n`;
      content += `}\n\n`;
    }
    
    content += `function processData(data) {\n`;
    content += `  return { ...data, processed: true, timestamp: Date.now() };\n`;
    content += `}\n`;
    
    return content;
  }

  function generateTestContent(index) {
    return `import { test, expect } from 'vitest';
import { func${index}_0 } from '../src/file${index}.js';

test('func${index}_0 works correctly', () => {
  const result = func${index}_0();
  expect(result).toBeDefined();
  expect(result.processed).toBe(true);
});`;
  }

  async function loadPerformanceBaselines() {
    try {
      const baselinesPath = path.join(process.cwd(), 'performance-baselines.json');
      const data = await fs.readFile(baselinesPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  async function savePerformanceResult(size, benchmark) {
    try {
      const baselinesPath = path.join(process.cwd(), 'performance-baselines.json');
      let baselines = {};
      
      try {
        const data = await fs.readFile(baselinesPath, 'utf-8');
        baselines = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start fresh
      }
      
      baselines[size] = {
        ...benchmark,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.1'
      };
      
      await fs.writeFile(baselinesPath, JSON.stringify(baselines, null, 2));
    } catch (error) {
      console.warn('Could not save performance baseline:', error.message);
    }
  }

  function calculateRegression(current, baseline) {
    return {
      duration: current.duration / baseline.duration,
      throughput: current.throughput.filesPerSecond / baseline.throughput.filesPerSecond,
      memory: current.memoryUsage.peak / baseline.memoryUsage.peak
    };
  }

  function formatBenchmarkResult(benchmark) {
    return `${benchmark.duration}ms, ${benchmark.throughput.filesPerSecond.toFixed(2)} files/sec, ${Math.round(benchmark.memoryUsage.peak / 1024 / 1024)}MB peak`;
  }
});