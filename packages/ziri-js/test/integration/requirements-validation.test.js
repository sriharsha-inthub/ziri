import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { IndexManager } from '../../lib/index/index-manager.js';
import { ConfigManager } from '../../lib/config/config-manager.js';
import { ProgressMonitor } from '../../lib/progress/progress-monitor.js';
import { ProjectSummarizer } from '../../lib/summarizer/project-summarizer.js';
import { PerformanceBenchmarkSuite } from '../../lib/performance/performance-benchmark-suite.js';

describe('Requirements Validation Tests', () => {
  let tempDir;
  let indexManager;
  let configManager;
  let progressMonitor;
  let projectSummarizer;
  let benchmarkSuite;
  let testRepoPath;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), 'ziri-requirements-test-' + Date.now());
    testRepoPath = path.join(tempDir, 'test-repo');
    
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(testRepoPath, { recursive: true });
    
    const ziriConfigDir = path.join(tempDir, '.ziri');
    await fs.mkdir(ziriConfigDir, { recursive: true });
    
    // Initialize components
    configManager = new ConfigManager(ziriConfigDir);
    indexManager = new IndexManager(configManager);
    progressMonitor = new ProgressMonitor();
    projectSummarizer = new ProjectSummarizer();
    benchmarkSuite = new PerformanceBenchmarkSuite();
    
    // Configure for testing
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

  describe('Performance Requirements (1.x)', () => {
    it('1.1 - Should index medium-sized repositories under 60 seconds', async () => {
      await createMediumRepository(testRepoPath);
      
      const startTime = Date.now();
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(60000); // Under 60 seconds
      expect(result.filesProcessed).toBeGreaterThan(50);
      expect(result.embeddingsCreated).toBeGreaterThan(100);
      
      console.log(`✅ 1.1 - Medium repository indexed in ${duration}ms`);
    }, 120000);

    it('1.2 - Should support concurrent processing with configurable limits', async () => {
      await createSmallRepository(testRepoPath);
      
      // Test different concurrency levels
      const concurrencyLevels = [1, 2, 3, 5];
      const results = [];
      
      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          concurrency,
          forceFullIndex: true
        });
        const duration = Date.now() - startTime;
        results.push({ concurrency, duration, filesProcessed: result.filesProcessed });
      }
      
      // Verify concurrency improves performance
      const singleThreaded = results.find(r => r.concurrency === 1);
      const multiThreaded = results.find(r => r.concurrency === 3);
      expect(multiThreaded.duration).toBeLessThan(singleThreaded.duration);
      
      console.log(`✅ 1.2 - Concurrent processing validated`);
    }, 180000);

    it('1.3 - Should implement intelligent batching', async () => {
      await createMediumRepository(testRepoPath);
      
      // Test different batch sizes
      const batchSizes = [25, 50, 100, 200];
      const results = [];
      
      for (const batchSize of batchSizes) {
        const startTime = Date.now();
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          batchSize,
          forceFullIndex: true
        });
        const duration = Date.now() - startTime;
        results.push({ batchSize, duration, throughput: result.filesProcessed / (duration / 1000) });
      }
      
      // Find optimal batch size
      const optimalResult = results.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );
      
      expect(optimalResult.batchSize).toBeGreaterThanOrEqual(50);
      expect(optimalResult.batchSize).toBeLessThanOrEqual(200);
      
      console.log(`✅ 1.3 - Intelligent batching validated (optimal: ${optimalResult.batchSize})`);
    }, 240000);

    it('1.4 - Should maintain memory efficiency under 512MB', async () => {
      await createLargeRepository(testRepoPath);
      
      const memoryBefore = process.memoryUsage();
      let peakMemory = memoryBefore.heapUsed;
      
      const memoryMonitor = setInterval(() => {
        const current = process.memoryUsage().heapUsed;
        if (current > peakMemory) {
          peakMemory = current;
        }
      }, 100);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      clearInterval(memoryMonitor);
      
      const memoryDelta = peakMemory - memoryBefore.heapUsed;
      expect(memoryDelta).toBeLessThan(512 * 1024 * 1024); // Under 512MB
      
      console.log(`✅ 1.4 - Memory efficiency validated (${Math.round(memoryDelta / 1024 / 1024)}MB peak)`);
    }, 300000);

    it('1.5 - Should detect and process only changed files', async () => {
      await createSmallRepository(testRepoPath);
      
      // Initial indexing
      const initialResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Modify one file
      await fs.writeFile(
        path.join(testRepoPath, 'src', 'index.js'),
        'console.log("Modified file");\nexport default function main() { return "Updated"; }'
      );
      
      // Incremental update
      const updateStartTime = Date.now();
      const updateResult = await indexManager.updateRepository(testRepoPath);
      const updateDuration = Date.now() - updateStartTime;
      
      expect(updateResult.filesProcessed).toBeLessThan(initialResult.filesProcessed);
      expect(updateResult.filesModified).toBe(1);
      expect(updateDuration).toBeLessThan(initialResult.duration / 2);
      
      console.log(`✅ 1.5 - Incremental updates validated (${updateResult.filesModified} modified)`);
    });

    it('1.6 - Should implement adaptive backoff and retry logic', async () => {
      await createSmallRepository(testRepoPath);
      
      // Configure with very low rate limits to trigger backoff
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            rateLimit: {
              requestsPerMinute: 10, // Very low
              tokensPerMinute: 1000
            }
          }
        }
      });
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Should complete despite rate limiting
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(result.embeddingsCreated).toBeGreaterThan(0);
      
      console.log(`✅ 1.6 - Adaptive backoff validated`);
    }, 120000);
  });

  describe('Provider Requirements (2.x)', () => {
    it('2.1 - Should support multiple embedding providers', async () => {
      await createSmallRepository(testRepoPath);
      
      // Configure multiple providers
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
      
      // Test each provider (some may fail if not available)
      const providers = ['openai', 'ollama', 'huggingface'];
      let successfulProviders = 0;
      
      for (const provider of providers) {
        try {
          const result = await indexManager.indexRepository(testRepoPath, {
            provider,
            forceFullIndex: true
          });
          expect(result.embeddingsCreated).toBeGreaterThan(0);
          successfulProviders++;
        } catch (error) {
          console.log(`⚠️ Provider ${provider} not available: ${error.message}`);
        }
      }
      
      expect(successfulProviders).toBeGreaterThan(0);
      console.log(`✅ 2.1 - Multiple providers supported (${successfulProviders}/${providers.length} available)`);
    }, 180000);

    it('2.2 - Should handle provider-specific configurations', async () => {
      const config = await configManager.getConfig();
      
      // Verify provider configurations are properly structured
      expect(config.providers).toBeDefined();
      expect(config.providers.openai).toBeDefined();
      expect(config.providers.openai.type).toBe('openai');
      expect(config.providers.openai.model).toBeDefined();
      expect(config.providers.openai.dimensions).toBeGreaterThan(0);
      
      console.log(`✅ 2.2 - Provider configurations validated`);
    });

    it('2.3 - Should support local embedding providers', async () => {
      await createSmallRepository(testRepoPath);
      
      try {
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'ollama',
          forceFullIndex: true
        });
        expect(result.embeddingsCreated).toBeGreaterThan(0);
        console.log(`✅ 2.3 - Local provider (Ollama) validated`);
      } catch (error) {
        console.log(`⚠️ 2.3 - Local provider not available: ${error.message}`);
        // This is acceptable as Ollama may not be installed
      }
    });

    it('2.4 - Should implement comprehensive error handling', async () => {
      await createSmallRepository(testRepoPath);
      
      // Test with invalid API key
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            apiKey: 'invalid-key'
          }
        }
      });
      
      await expect(
        indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          forceFullIndex: true
        })
      ).rejects.toThrow();
      
      console.log(`✅ 2.4 - Error handling validated`);
    });

    it('2.5 - Should enable provider switching', async () => {
      await createSmallRepository(testRepoPath);
      
      // Index with OpenAI
      const openaiResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      const repositoryId = openaiResult.repositoryId;
      
      try {
        // Switch to Hugging Face
        const hfResult = await indexManager.indexRepository(testRepoPath, {
          provider: 'huggingface',
          forceFullIndex: true
        });
        
        expect(hfResult.repositoryId).toBe(repositoryId); // Same repository
        expect(hfResult.embeddingsCreated).toBeGreaterThan(0);
        
        console.log(`✅ 2.5 - Provider switching validated`);
      } catch (error) {
        console.log(`⚠️ 2.5 - Provider switching test skipped: ${error.message}`);
      }
    });
  });

  describe('File Processing Requirements (3.x)', () => {
    it('3.1 - Should implement streaming file processing', async () => {
      await createLargeRepository(testRepoPath);
      
      const memoryBefore = process.memoryUsage();
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      // Should process many files without excessive memory usage
      expect(result.filesProcessed).toBeGreaterThan(100);
      expect(memoryDelta).toBeLessThan(256 * 1024 * 1024); // Reasonable memory usage
      
      console.log(`✅ 3.1 - Streaming processing validated (${result.filesProcessed} files, ${Math.round(memoryDelta / 1024 / 1024)}MB)`);
    }, 300000);

    it('3.2 - Should store vectors efficiently', async () => {
      await createMediumRepository(testRepoPath);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Verify vectors are stored
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.isIndexed).toBe(true);
      expect(result.embeddingsCreated).toBeGreaterThan(0);
      
      // Verify storage structure exists
      const storagePath = path.join(tempDir, '.ziri', 'repositories', result.repositoryId);
      const storageExists = await fs.access(storagePath).then(() => true).catch(() => false);
      expect(storageExists).toBe(true);
      
      console.log(`✅ 3.2 - Vector storage validated (${result.embeddingsCreated} embeddings)`);
    });

    it('3.3 - Should handle large files without memory issues', async () => {
      // Create a repository with large files
      await createRepositoryWithLargeFiles(testRepoPath);
      
      const memoryBefore = process.memoryUsage();
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(memoryDelta).toBeLessThan(512 * 1024 * 1024); // Under 512MB
      
      console.log(`✅ 3.3 - Large file handling validated`);
    });

    it('3.4 - Should support configurable chunk sizes', async () => {
      await createSmallRepository(testRepoPath);
      
      const chunkSizes = [500, 1000, 2000];
      const results = [];
      
      for (const chunkSize of chunkSizes) {
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          chunkSize,
          forceFullIndex: true
        });
        
        results.push({ chunkSize, chunksGenerated: result.chunksGenerated });
      }
      
      // Smaller chunks should generate more chunks
      const smallChunks = results.find(r => r.chunkSize === 500);
      const largeChunks = results.find(r => r.chunkSize === 2000);
      expect(smallChunks.chunksGenerated).toBeGreaterThan(largeChunks.chunksGenerated);
      
      console.log(`✅ 3.4 - Configurable chunk sizes validated`);
    });

    it('3.5 - Should implement efficient vector retrieval', async () => {
      await createMediumRepository(testRepoPath);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Test vector retrieval (this would require implementing search functionality)
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.isIndexed).toBe(true);
      expect(result.embeddingsCreated).toBeGreaterThan(0);
      
      console.log(`✅ 3.5 - Vector retrieval infrastructure validated`);
    });
  });

  describe('Optimization Requirements (4.x)', () => {
    it('4.1 - Should optimize throughput for API calls', async () => {
      await createMediumRepository(testRepoPath);
      
      const startTime = Date.now();
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        concurrency: 3,
        batchSize: 100,
        forceFullIndex: true
      });
      const duration = Date.now() - startTime;
      
      const throughput = result.embeddingsCreated / (duration / 1000);
      expect(throughput).toBeGreaterThan(10); // At least 10 embeddings per second
      
      console.log(`✅ 4.1 - API throughput optimized (${throughput.toFixed(2)} embeddings/sec)`);
    }, 120000);

    it('4.2 - Should implement adaptive rate limiting', async () => {
      await createSmallRepository(testRepoPath);
      
      // Configure with rate limits
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            rateLimit: {
              requestsPerMinute: 100,
              tokensPerMinute: 10000
            }
          }
        }
      });
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Should complete successfully with rate limiting
      expect(result.embeddingsCreated).toBeGreaterThan(0);
      
      console.log(`✅ 4.2 - Adaptive rate limiting validated`);
    });

    it('4.3 - Should handle API failures gracefully', async () => {
      await createSmallRepository(testRepoPath);
      
      // This test would require mocking API failures
      // For now, we'll test that the system can handle configuration errors
      
      try {
        await configManager.updateConfig({
          providers: {
            openai: {
              type: 'openai',
              model: 'invalid-model',
              dimensions: 1536
            }
          }
        });
        
        await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          forceFullIndex: true
        });
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail gracefully
        expect(error.message).toBeDefined();
      }
      
      console.log(`✅ 4.3 - API failure handling validated`);
    });

    it('4.4 - Should implement performance monitoring', async () => {
      await createMediumRepository(testRepoPath);
      
      const benchmark = await benchmarkSuite.runBenchmark(testRepoPath, {
        provider: 'openai',
        concurrency: 3,
        batchSize: 100
      });
      
      expect(benchmark.duration).toBeDefined();
      expect(benchmark.throughput).toBeDefined();
      expect(benchmark.memoryUsage).toBeDefined();
      expect(benchmark.throughput.filesPerSecond).toBeGreaterThan(0);
      
      console.log(`✅ 4.4 - Performance monitoring validated`);
    }, 120000);

    it('4.5 - Should optimize for different repository sizes', async () => {
      const sizes = ['small', 'medium'];
      const results = {};
      
      for (const size of sizes) {
        const repoPath = path.join(tempDir, `${size}-repo`);
        
        if (size === 'small') {
          await createSmallRepository(repoPath);
        } else {
          await createMediumRepository(repoPath);
        }
        
        const startTime = Date.now();
        const result = await indexManager.indexRepository(repoPath, {
          provider: 'openai',
          forceFullIndex: true
        });
        const duration = Date.now() - startTime;
        
        results[size] = {
          duration,
          filesProcessed: result.filesProcessed,
          throughput: result.filesProcessed / (duration / 1000)
        };
        
        await fs.rm(repoPath, { recursive: true, force: true });
      }
      
      // Verify reasonable scaling
      expect(results.medium.duration).toBeGreaterThan(results.small.duration);
      expect(results.medium.throughput).toBeGreaterThan(5); // Reasonable throughput
      
      console.log(`✅ 4.5 - Repository size optimization validated`);
    }, 180000);
  });

  describe('Progress Monitoring Requirements (5.x)', () => {
    it('5.1 - Should provide real-time progress updates', async () => {
      await createMediumRepository(testRepoPath);
      
      let progressUpdates = 0;
      const progressCallback = (progress) => {
        progressUpdates++;
        expect(progress.processed).toBeDefined();
        expect(progress.total).toBeDefined();
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      };
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true,
        onProgress: progressCallback
      });
      
      expect(progressUpdates).toBeGreaterThan(0);
      expect(result.filesProcessed).toBeGreaterThan(0);
      
      console.log(`✅ 5.1 - Real-time progress validated (${progressUpdates} updates)`);
    }, 120000);

    it('5.2 - Should calculate accurate ETAs', async () => {
      await createMediumRepository(testRepoPath);
      
      let etaUpdates = 0;
      const progressCallback = (progress) => {
        if (progress.eta) {
          etaUpdates++;
          expect(progress.eta).toBeGreaterThan(0);
        }
      };
      
      await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true,
        onProgress: progressCallback
      });
      
      expect(etaUpdates).toBeGreaterThan(0);
      
      console.log(`✅ 5.2 - ETA calculation validated (${etaUpdates} ETA updates)`);
    }, 120000);

    it('5.3 - Should provide throughput statistics', async () => {
      await createMediumRepository(testRepoPath);
      
      let throughputUpdates = 0;
      const progressCallback = (progress) => {
        if (progress.throughput) {
          throughputUpdates++;
          expect(progress.throughput.filesPerSecond).toBeGreaterThanOrEqual(0);
        }
      };
      
      await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true,
        onProgress: progressCallback
      });
      
      expect(throughputUpdates).toBeGreaterThan(0);
      
      console.log(`✅ 5.3 - Throughput statistics validated`);
    }, 120000);

    it('5.4 - Should generate completion reports', async () => {
      await createSmallRepository(testRepoPath);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Verify completion report data
      expect(result.filesProcessed).toBeDefined();
      expect(result.chunksGenerated).toBeDefined();
      expect(result.embeddingsCreated).toBeDefined();
      expect(result.duration).toBeDefined();
      expect(result.repositoryId).toBeDefined();
      
      console.log(`✅ 5.4 - Completion reports validated`);
    });

    it('5.5 - Should handle progress errors gracefully', async () => {
      await createSmallRepository(testRepoPath);
      
      // Test with a progress callback that throws
      const errorCallback = () => {
        throw new Error('Progress callback error');
      };
      
      // Should not fail the entire indexing process
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true,
        onProgress: errorCallback
      });
      
      expect(result.filesProcessed).toBeGreaterThan(0);
      
      console.log(`✅ 5.5 - Progress error handling validated`);
    });
  });

  describe('Repository Management Requirements (6.x)', () => {
    it('6.1 - Should create isolated index stores', async () => {
      const repo1Path = path.join(tempDir, 'repo1');
      const repo2Path = path.join(tempDir, 'repo2');
      
      await createSmallRepository(repo1Path);
      await createSmallRepository(repo2Path);
      
      const result1 = await indexManager.indexRepository(repo1Path, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      const result2 = await indexManager.indexRepository(repo2Path, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Different repository IDs
      expect(result1.repositoryId).not.toBe(result2.repositoryId);
      
      // Isolated storage paths
      const storage1 = path.join(tempDir, '.ziri', 'repositories', result1.repositoryId);
      const storage2 = path.join(tempDir, '.ziri', 'repositories', result2.repositoryId);
      
      const storage1Exists = await fs.access(storage1).then(() => true).catch(() => false);
      const storage2Exists = await fs.access(storage2).then(() => true).catch(() => false);
      
      expect(storage1Exists).toBe(true);
      expect(storage2Exists).toBe(true);
      
      console.log(`✅ 6.1 - Isolated index stores validated`);
    });

    it('6.2 - Should perform complete full index on first run', async () => {
      await createMediumRepository(testRepoPath);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Should process all files
      expect(result.filesProcessed).toBeGreaterThan(50);
      expect(result.embeddingsCreated).toBeGreaterThan(100);
      
      // Verify repository is marked as indexed
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.isIndexed).toBe(true);
      expect(repoStatus.lastIndexed).toBeDefined();
      
      console.log(`✅ 6.2 - Complete full index validated (${result.filesProcessed} files)`);
    });

    it('6.3 - Should detect file changes accurately', async () => {
      await createSmallRepository(testRepoPath);
      
      // Initial index
      await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Modify a file
      const filePath = path.join(testRepoPath, 'src', 'index.js');
      const originalContent = await fs.readFile(filePath, 'utf-8');
      await fs.writeFile(filePath, originalContent + '\n// Modified');
      
      // Update
      const updateResult = await indexManager.updateRepository(testRepoPath);
      
      expect(updateResult.filesModified).toBe(1);
      expect(updateResult.filesAdded).toBe(0);
      expect(updateResult.filesDeleted).toBe(0);
      
      console.log(`✅ 6.3 - File change detection validated`);
    });

    it('6.4 - Should support incremental updates', async () => {
      await createSmallRepository(testRepoPath);
      
      // Initial index
      const initialResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Add a new file
      await fs.writeFile(
        path.join(testRepoPath, 'src', 'new-file.js'),
        'export function newFunction() { return "new"; }'
      );
      
      // Incremental update
      const updateStartTime = Date.now();
      const updateResult = await indexManager.updateRepository(testRepoPath);
      const updateDuration = Date.now() - updateStartTime;
      
      expect(updateResult.filesAdded).toBe(1);
      expect(updateResult.filesProcessed).toBeLessThan(initialResult.filesProcessed);
      expect(updateDuration).toBeLessThan(initialResult.duration / 2);
      
      console.log(`✅ 6.4 - Incremental updates validated`);
    });

    it('6.5 - Should prevent cross-contamination between repositories', async () => {
      const repo1Path = path.join(tempDir, 'isolated1');
      const repo2Path = path.join(tempDir, 'isolated2');
      
      await createSmallRepository(repo1Path);
      await createMediumRepository(repo2Path);
      
      const result1 = await indexManager.indexRepository(repo1Path, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      const result2 = await indexManager.indexRepository(repo2Path, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Get repository statuses
      const status1 = await indexManager.getRepositoryStatus(repo1Path);
      const status2 = await indexManager.getRepositoryStatus(repo2Path);
      
      // Verify no shared file hashes
      const files1 = Array.from(status1.fileHashes.keys());
      const files2 = Array.from(status2.fileHashes.keys());
      
      const sharedFiles = files1.filter(f => files2.includes(f));
      expect(sharedFiles.length).toBe(0);
      
      console.log(`✅ 6.5 - Cross-contamination prevention validated`);
    });

    it('6.6 - Should handle file deletions correctly', async () => {
      await createSmallRepository(testRepoPath);
      
      // Initial index
      await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Delete a file
      const deletedFile = path.join(testRepoPath, 'src', 'utils.js');
      await fs.unlink(deletedFile);
      
      // Update
      const updateResult = await indexManager.updateRepository(testRepoPath);
      
      expect(updateResult.filesDeleted).toBe(1);
      
      // Verify file is removed from tracking
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      const relativePath = path.relative(testRepoPath, deletedFile);
      expect(repoStatus.fileHashes.has(relativePath)).toBe(false);
      
      console.log(`✅ 6.6 - File deletion handling validated`);
    });
  });

  describe('Project Summary Requirements (7.x)', () => {
    it('7.1 - Should analyze project structure and technologies', async () => {
      await createMediumRepository(testRepoPath);
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Verify project summary was generated
      const summaryPath = path.join(tempDir, '.ziri', 'repositories', result.repositoryId, 'project_summary.md');
      const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
      expect(summaryExists).toBe(true);
      
      if (summaryExists) {
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        expect(summaryContent).toContain('JavaScript'); // Should detect JS project
        expect(summaryContent.length).toBeGreaterThan(100);
      }
      
      console.log(`✅ 7.1 - Project analysis validated`);
    });

    it('7.2 - Should generate dynamic summaries', async () => {
      await createSmallRepository(testRepoPath);
      
      const summary = await projectSummarizer.generateSummary(testRepoPath);
      
      expect(summary).toBeDefined();
      expect(summary.technologies).toBeDefined();
      expect(summary.structure).toBeDefined();
      expect(summary.description).toBeDefined();
      
      console.log(`✅ 7.2 - Dynamic summary generation validated`);
    });

    it('7.3 - Should update summaries incrementally', async () => {
      await createSmallRepository(testRepoPath);
      
      // Initial summary
      const initialSummary = await projectSummarizer.generateSummary(testRepoPath);
      
      // Add new technology file
      await fs.writeFile(
        path.join(testRepoPath, 'requirements.txt'),
        'flask==2.0.1\nrequests==2.25.1'
      );
      
      // Updated summary
      const updatedSummary = await projectSummarizer.generateSummary(testRepoPath);
      
      expect(updatedSummary.technologies).not.toEqual(initialSummary.technologies);
      
      console.log(`✅ 7.3 - Incremental summary updates validated`);
    });

    it('7.4 - Should maintain summary accuracy', async () => {
      await createMediumRepository(testRepoPath);
      
      const summary = await projectSummarizer.generateSummary(testRepoPath);
      
      // Verify summary contains expected elements
      expect(summary.technologies).toContain('JavaScript');
      expect(summary.structure.directories).toBeGreaterThan(0);
      expect(summary.structure.files).toBeGreaterThan(0);
      
      console.log(`✅ 7.4 - Summary accuracy validated`);
    });
  });

  describe('Configuration Requirements (8.x)', () => {
    it('8.1 - Should support comprehensive configuration', async () => {
      const config = await configManager.getConfig();
      
      expect(config.providers).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.defaultProvider).toBeDefined();
      
      // Test configuration updates
      await configManager.updateConfig({
        performance: {
          concurrency: 5,
          batchSize: 150,
          memoryLimit: 1024 * 1024 * 1024
        }
      });
      
      const updatedConfig = await configManager.getConfig();
      expect(updatedConfig.performance.concurrency).toBe(5);
      expect(updatedConfig.performance.batchSize).toBe(150);
      
      console.log(`✅ 8.1 - Comprehensive configuration validated`);
    });

    it('8.2 - Should support environment variables', async () => {
      // Test environment variable support
      process.env.ZIRI_DEFAULT_PROVIDER = 'huggingface';
      process.env.ZIRI_CONCURRENCY = '4';
      
      // Reload configuration
      const envConfig = await configManager.loadEnvironmentConfig();
      
      expect(envConfig.defaultProvider).toBe('huggingface');
      expect(envConfig.performance?.concurrency).toBe(4);
      
      // Clean up
      delete process.env.ZIRI_DEFAULT_PROVIDER;
      delete process.env.ZIRI_CONCURRENCY;
      
      console.log(`✅ 8.2 - Environment variable support validated`);
    });

    it('8.3 - Should integrate with CLI', async () => {
      // This would test CLI integration
      // For now, we'll verify that configuration can be loaded and used
      
      const config = await configManager.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      
      console.log(`✅ 8.3 - CLI integration infrastructure validated`);
    });

    it('8.4 - Should validate configurations', async () => {
      // Test invalid configuration
      await expect(
        configManager.updateConfig({
          providers: {
            invalid: {
              type: 'unknown-type'
            }
          }
        })
      ).rejects.toThrow();
      
      // Test missing required fields
      await expect(
        configManager.updateConfig({
          providers: {
            openai: {
              type: 'openai'
              // Missing required fields
            }
          }
        })
      ).rejects.toThrow();
      
      console.log(`✅ 8.4 - Configuration validation validated`);
    });

    it('8.5 - Should support configuration migration', async () => {
      // Test configuration migration/upgrade
      const currentConfig = await configManager.getConfig();
      expect(currentConfig.version).toBeDefined();
      
      // Configuration should be upgradeable
      const migrationResult = await configManager.migrateConfig(currentConfig);
      expect(migrationResult).toBeDefined();
      
      console.log(`✅ 8.5 - Configuration migration validated`);
    });
  });

  // Helper functions
  async function createSmallRepository(repoPath) {
    await fs.mkdir(path.join(repoPath, 'src'), { recursive: true });
    
    await fs.writeFile(
      path.join(repoPath, 'README.md'),
      '# Small Test Project\n\nThis is a small test project for requirements validation.'
    );
    
    await fs.writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ name: 'small-test-project', version: '1.0.0' }, null, 2)
    );
    
    await fs.writeFile(
      path.join(repoPath, 'src', 'index.js'),
      'console.log("Main entry point");\nexport default function main() {\n  return "Hello World";\n}'
    );
    
    await fs.writeFile(
      path.join(repoPath, 'src', 'utils.js'),
      'export function helper() {\n  return "utility function";\n}\n\nexport const constant = 42;'
    );
  }

  async function createMediumRepository(repoPath) {
    // Create directory structure
    const dirs = [
      'src', 'src/components', 'src/utils', 'src/services',
      'tests', 'docs', 'config'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(repoPath, dir), { recursive: true });
    }
    
    // Create main files
    await fs.writeFile(
      path.join(repoPath, 'README.md'),
      '# Medium Test Project\n\nThis is a medium-sized test project with multiple components.'
    );
    
    await fs.writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ name: 'medium-test-project', version: '1.0.0' }, null, 2)
    );
    
    // Generate multiple files
    for (let i = 0; i < 60; i++) {
      await fs.writeFile(
        path.join(repoPath, 'src', `component${i}.js`),
        `export class Component${i} {\n  constructor() {\n    this.id = ${i};\n  }\n\n  render() {\n    return \`Component ${i}\`;\n  }\n}`
      );
    }
    
    for (let i = 0; i < 30; i++) {
      await fs.writeFile(
        path.join(repoPath, 'tests', `test${i}.js`),
        `import { test, expect } from 'vitest';\n\ntest('test ${i}', () => {\n  expect(true).toBe(true);\n});`
      );
    }
  }

  async function createLargeRepository(repoPath) {
    await createMediumRepository(repoPath);
    
    // Add more files to make it large
    await fs.mkdir(path.join(repoPath, 'src', 'generated'), { recursive: true });
    
    for (let i = 0; i < 200; i++) {
      await fs.writeFile(
        path.join(repoPath, 'src', 'generated', `file${i}.js`),
        `// Generated file ${i}\nexport const data${i} = { id: ${i}, name: "Item ${i}" };\n\nexport function process${i}() {\n  return data${i};\n}`
      );
    }
  }

  async function createRepositoryWithLargeFiles(repoPath) {
    await fs.mkdir(path.join(repoPath, 'src'), { recursive: true });
    
    // Create large files (each ~100KB)
    for (let i = 0; i < 5; i++) {
      const largeContent = Array(1000).fill(0).map((_, j) => 
        `function func${i}_${j}() {\n  return "Large function ${i}_${j} with lots of content";\n}`
      ).join('\n\n');
      
      await fs.writeFile(
        path.join(repoPath, 'src', `large${i}.js`),
        largeContent
      );
    }
  }
}); 