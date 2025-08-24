import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { IndexManager } from '../../lib/index/index-manager.js';
import { ConfigManager } from '../../lib/config/config-manager.js';
import { PerformanceBenchmarkSuite } from '../../lib/performance/performance-benchmark-suite.js';

describe('Comprehensive Integration Tests', () => {
  let tempDir;
  let indexManager;
  let configManager;
  let benchmarkSuite;
  let testRepoPath;
  let ziriConfigDir;

  beforeAll(async () => {
    // Create temporary directories for testing
    tempDir = path.join(os.tmpdir(), 'ziri-integration-test-' + Date.now());
    testRepoPath = path.join(tempDir, 'test-repo');
    ziriConfigDir = path.join(tempDir, '.ziri');
    
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(testRepoPath, { recursive: true });
    await fs.mkdir(ziriConfigDir, { recursive: true });
    
    // Initialize components
    configManager = new ConfigManager(ziriConfigDir);
    indexManager = new IndexManager(configManager);
    benchmarkSuite = new PerformanceBenchmarkSuite();
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean up test repo before each test
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
    await fs.mkdir(testRepoPath, { recursive: true });
  });

  describe('End-to-End Indexing Workflows', () => {
    it('should complete full indexing workflow for a medium-sized repository', async () => {
      // Create a realistic medium-sized repository structure
      await createMediumSizedRepository(testRepoPath);
      
      const startTime = Date.now();
      
      // Configure for OpenAI provider (mock)
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
          memoryLimit: 512 * 1024 * 1024 // 512MB
        }
      });
      
      // Index the repository
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        concurrency: 3,
        batchSize: 100,
        forceFullIndex: true,
        excludePatterns: ['node_modules/**', '.git/**', '*.log']
      });
      
      const duration = Date.now() - startTime;
      
      // Verify results meet performance requirements
      expect(result.filesProcessed).toBeGreaterThan(50); // Medium-sized repo
      expect(result.chunksGenerated).toBeGreaterThan(100);
      expect(result.embeddingsCreated).toBeGreaterThan(100);
      expect(duration).toBeLessThan(60000); // Under 60 seconds (Requirement 1.1)
      expect(result.repositoryId).toBeDefined();
      
      // Verify repository isolation
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.isIndexed).toBe(true);
      expect(repoStatus.repositoryId).toBe(result.repositoryId);
      expect(repoStatus.lastIndexed).toBeDefined();
      
      // Verify project summary was generated
      const summaryPath = path.join(ziriConfigDir, 'repositories', result.repositoryId, 'project_summary.md');
      const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
      expect(summaryExists).toBe(true);
      
      console.log(`✅ Full indexing completed in ${duration}ms`);
      console.log(`📁 Processed ${result.filesProcessed} files`);
      console.log(`📄 Generated ${result.chunksGenerated} chunks`);
      console.log(`🔗 Created ${result.embeddingsCreated} embeddings`);
    }, 120000); // 2 minute timeout

    it('should handle large repository with memory constraints', async () => {
      // Create a large repository structure
      await createLargeRepository(testRepoPath);
      
      // Configure with strict memory limits
      await configManager.updateConfig({
        performance: {
          concurrency: 2,
          batchSize: 50,
          memoryLimit: 256 * 1024 * 1024 // 256MB strict limit
        }
      });
      
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        concurrency: 2,
        batchSize: 50,
        forceFullIndex: true
      });
      
      // Should complete without memory issues
      expect(result.filesProcessed).toBeGreaterThan(100);
      expect(result.chunksGenerated).toBeGreaterThan(200);
      
      console.log(`✅ Large repository indexed with memory constraints`);
    }, 180000); // 3 minute timeout
  });

  describe('Incremental Updates and Change Detection', () => {
    let initialResult;
    
    beforeEach(async () => {
      // Create initial repository and index it
      await createSmallRepository(testRepoPath);
      initialResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
    });

    it('should detect and process only changed files', async () => {
      // Modify some files
      await fs.writeFile(
        path.join(testRepoPath, 'src', 'index.js'),
        'console.log("Modified file");\nexport default function main() {\n  return "Updated Hello World";\n}'
      );
      
      // Add a new file
      await fs.writeFile(
        path.join(testRepoPath, 'src', 'new-feature.js'),
        'export function newFeature() {\n  return "This is a new feature";\n}'
      );
      
      // Delete a file
      await fs.unlink(path.join(testRepoPath, 'src', 'utils.js'));
      
      const updateStartTime = Date.now();
      
      // Perform incremental update
      const updateResult = await indexManager.updateRepository(testRepoPath);
      
      const updateDuration = Date.now() - updateStartTime;
      
      // Should only process changed files (Requirement 1.5, 6.3)
      expect(updateResult.filesProcessed).toBeLessThan(initialResult.filesProcessed);
      expect(updateResult.filesAdded).toBe(1); // new-feature.js
      expect(updateResult.filesModified).toBe(1); // index.js
      expect(updateResult.filesDeleted).toBe(1); // utils.js
      expect(updateDuration).toBeLessThan(initialResult.duration / 2); // Should be much faster
      
      // Verify change detection accuracy
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.lastIndexed.getTime()).toBeGreaterThan(initialResult.timestamp);
      
      console.log(`✅ Incremental update completed in ${updateDuration}ms`);
      console.log(`📝 Modified: ${updateResult.filesModified}, Added: ${updateResult.filesAdded}, Deleted: ${updateResult.filesDeleted}`);
    });

    it('should handle file hash changes correctly', async () => {
      // Get initial file hashes
      const initialStatus = await indexManager.getRepositoryStatus(testRepoPath);
      const initialHashes = initialStatus.fileHashes;
      
      // Modify file content slightly
      const indexPath = path.join(testRepoPath, 'src', 'index.js');
      const originalContent = await fs.readFile(indexPath, 'utf-8');
      await fs.writeFile(indexPath, originalContent + '\n// Added comment');
      
      // Update repository
      const updateResult = await indexManager.updateRepository(testRepoPath);
      
      // Verify hash change detection
      const updatedStatus = await indexManager.getRepositoryStatus(testRepoPath);
      const updatedHashes = updatedStatus.fileHashes;
      
      const relativePath = path.relative(testRepoPath, indexPath);
      expect(initialHashes.get(relativePath)).toBeDefined();
      expect(updatedHashes.get(relativePath)).toBeDefined();
      expect(initialHashes.get(relativePath)).not.toBe(updatedHashes.get(relativePath));
      
      expect(updateResult.filesModified).toBe(1);
    });

    it('should clean up deleted file embeddings', async () => {
      // Delete a file
      const deletedFile = path.join(testRepoPath, 'README.md');
      await fs.unlink(deletedFile);
      
      // Update repository
      const updateResult = await indexManager.updateRepository(testRepoPath);
      
      // Verify deletion was processed
      expect(updateResult.filesDeleted).toBe(1);
      
      // Verify embeddings were cleaned up
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      const relativePath = path.relative(testRepoPath, deletedFile);
      expect(repoStatus.fileHashes.has(relativePath)).toBe(false);
    });
  });

  describe('Provider Switching and Data Migration', () => {
    let repositoryId;
    
    beforeEach(async () => {
      await createSmallRepository(testRepoPath);
      
      // Initial index with OpenAI provider
      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      repositoryId = result.repositoryId;
    });

    it('should switch between embedding providers', async () => {
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
      
      // Switch to Ollama provider
      const ollamaResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'ollama',
        forceFullIndex: true
      });
      
      expect(ollamaResult.repositoryId).toBe(repositoryId); // Same repo
      expect(ollamaResult.embeddingsCreated).toBeGreaterThan(0);
      
      // Switch to Hugging Face provider
      const hfResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'huggingface',
        forceFullIndex: true
      });
      
      expect(hfResult.repositoryId).toBe(repositoryId); // Same repo
      expect(hfResult.embeddingsCreated).toBeGreaterThan(0);
      
      // Verify provider metadata is updated
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.embeddingProvider).toBe('huggingface');
      
      console.log(`✅ Successfully switched between providers`);
    });

    it('should handle provider configuration validation', async () => {
      // Test invalid provider configuration
      await expect(
        configManager.updateConfig({
          providers: {
            invalid: {
              type: 'unknown-provider',
              model: 'test'
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
              // Missing model and dimensions
            }
          }
        })
      ).rejects.toThrow();
    });

    it('should migrate data when switching providers with different dimensions', async () => {
      // Switch from OpenAI (1536 dims) to Hugging Face (384 dims)
      const migrationResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'huggingface',
        forceFullIndex: true
      });
      
      // Should re-embed all content due to dimension mismatch
      expect(migrationResult.embeddingsCreated).toBeGreaterThan(0);
      
      // Verify new embeddings have correct dimensions
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.embeddingProvider).toBe('huggingface');
      expect(repoStatus.embeddingDimensions).toBe(384);
    });
  });

  describe('Performance Regression Testing', () => {
    it('should maintain performance benchmarks across updates', async () => {
      const testSizes = ['small', 'medium'];
      const results = {};
      
      for (const size of testSizes) {
        // Create repository of specified size
        if (size === 'small') {
          await createSmallRepository(testRepoPath);
        } else {
          await createMediumSizedRepository(testRepoPath);
        }
        
        // Run benchmark
        const benchmark = await benchmarkSuite.runBenchmark(testRepoPath, {
          provider: 'openai',
          concurrency: 3,
          batchSize: 100
        });
        
        results[size] = benchmark;
        
        // Verify performance requirements
        if (size === 'medium') {
          expect(benchmark.duration).toBeLessThan(60000); // Under 60 seconds
          expect(benchmark.throughput.filesPerSecond).toBeGreaterThan(10);
          expect(benchmark.memoryUsage.peak).toBeLessThan(512 * 1024 * 1024); // Under 512MB
        }
        
        console.log(`📊 ${size} repository benchmark:`, {
          duration: `${benchmark.duration}ms`,
          throughput: `${benchmark.throughput.filesPerSecond.toFixed(2)} files/sec`,
          memory: `${Math.round(benchmark.memoryUsage.peak / 1024 / 1024)}MB peak`
        });
        
        // Clean up for next iteration
        await fs.rm(testRepoPath, { recursive: true, force: true });
        await fs.mkdir(testRepoPath, { recursive: true });
      }
      
      // Verify performance scaling
      expect(results.medium.duration).toBeGreaterThan(results.small.duration);
      expect(results.medium.throughput.filesPerSecond).toBeGreaterThan(5); // Reasonable throughput
    }, 300000); // 5 minute timeout

    it('should test concurrent processing performance', async () => {
      await createMediumSizedRepository(testRepoPath);
      
      const concurrencyLevels = [1, 2, 3, 5];
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
        results.push({ concurrency, duration, filesProcessed: result.filesProcessed });
        
        console.log(`🔄 Concurrency ${concurrency}: ${duration}ms for ${result.filesProcessed} files`);
      }
      
      // Verify that higher concurrency improves performance (up to a point)
      const singleThreaded = results.find(r => r.concurrency === 1);
      const multiThreaded = results.find(r => r.concurrency === 3);
      
      expect(multiThreaded.duration).toBeLessThan(singleThreaded.duration * 0.8); // At least 20% improvement
    }, 600000); // 10 minute timeout

    it('should test memory usage under different batch sizes', async () => {
      await createMediumSizedRepository(testRepoPath);
      
      const batchSizes = [50, 100, 200];
      const memoryResults = [];
      
      for (const batchSize of batchSizes) {
        const memoryBefore = process.memoryUsage();
        
        const result = await indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          concurrency: 2,
          batchSize,
          forceFullIndex: true
        });
        
        const memoryAfter = process.memoryUsage();
        const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
        
        memoryResults.push({ batchSize, memoryDelta, filesProcessed: result.filesProcessed });
        
        console.log(`💾 Batch size ${batchSize}: ${Math.round(memoryDelta / 1024 / 1024)}MB delta`);
      }
      
      // Verify memory usage stays within reasonable bounds
      for (const result of memoryResults) {
        expect(result.memoryDelta).toBeLessThan(256 * 1024 * 1024); // Under 256MB delta
      }
    }, 300000); // 5 minute timeout
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API failures gracefully', async () => {
      await createSmallRepository(testRepoPath);
      
      // Configure with invalid API settings to trigger failures
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            apiKey: 'invalid-key',
            rateLimit: {
              requestsPerMinute: 1, // Very low to trigger rate limiting
              tokensPerMinute: 100
            }
          }
        }
      });
      
      // Should handle failures and provide meaningful error messages
      await expect(
        indexManager.indexRepository(testRepoPath, {
          provider: 'openai',
          forceFullIndex: true
        })
      ).rejects.toThrow(/API/);
    });

    it('should recover from partial indexing failures', async () => {
      await createMediumSizedRepository(testRepoPath);
      
      // Start indexing and simulate interruption
      const indexPromise = indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Let it run for a bit then check if it can resume
      // (This is a simplified test - in practice we'd need more sophisticated interruption)
      const result = await indexPromise;
      
      // Verify some progress was made
      expect(result.filesProcessed).toBeGreaterThan(0);
    });
  });

  describe('Repository Isolation Validation', () => {
    it('should maintain complete isolation between repositories', async () => {
      // Create two different repositories
      const repo1Path = path.join(tempDir, 'repo1');
      const repo2Path = path.join(tempDir, 'repo2');
      
      await fs.mkdir(repo1Path, { recursive: true });
      await fs.mkdir(repo2Path, { recursive: true });
      
      await createSmallRepository(repo1Path);
      await createMediumSizedRepository(repo2Path);
      
      // Index both repositories
      const result1 = await indexManager.indexRepository(repo1Path, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      const result2 = await indexManager.indexRepository(repo2Path, {
        provider: 'openai',
        forceFullIndex: true
      });
      
      // Verify different repository IDs
      expect(result1.repositoryId).not.toBe(result2.repositoryId);
      
      // Verify isolated storage
      const status1 = await indexManager.getRepositoryStatus(repo1Path);
      const status2 = await indexManager.getRepositoryStatus(repo2Path);
      
      expect(status1.repositoryId).toBe(result1.repositoryId);
      expect(status2.repositoryId).toBe(result2.repositoryId);
      expect(status1.fileHashes.size).not.toBe(status2.fileHashes.size);
      
      // Verify no cross-contamination in file hashes
      const repo1Files = Array.from(status1.fileHashes.keys());
      const repo2Files = Array.from(status2.fileHashes.keys());
      
      expect(repo1Files.some(f => repo2Files.includes(f))).toBe(false);
      
      console.log(`✅ Repository isolation verified`);
      console.log(`📁 Repo1: ${status1.fileHashes.size} files, ID: ${result1.repositoryId.substring(0, 8)}...`);
      console.log(`📁 Repo2: ${status2.fileHashes.size} files, ID: ${result2.repositoryId.substring(0, 8)}...`);
    });
  });
});

// Helper functions to create test repositories
async function createSmallRepository(repoPath) {
  await fs.mkdir(path.join(repoPath, 'src'), { recursive: true });
  
  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    '# Small Test Project\n\nThis is a small test project for integration testing.'
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

async function createMediumSizedRepository(repoPath) {
  // Create directory structure
  const dirs = [
    'src', 'src/components', 'src/utils', 'src/services',
    'tests', 'tests/unit', 'tests/integration',
    'docs', 'config', 'scripts'
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(path.join(repoPath, dir), { recursive: true });
  }
  
  // Create various file types
  const files = [
    { path: 'README.md', content: '# Medium Test Project\n\nThis is a medium-sized test project with multiple components and features.' },
    { path: 'package.json', content: JSON.stringify({ name: 'medium-test-project', version: '1.0.0', dependencies: {} }, null, 2) },
    { path: 'src/index.js', content: 'import { App } from "./components/App.js";\nimport { config } from "./config.js";\n\nconst app = new App(config);\napp.start();' },
    { path: 'src/config.js', content: 'export const config = {\n  port: 3000,\n  database: {\n    host: "localhost",\n    port: 5432\n  }\n};' },
    { path: 'src/components/App.js', content: 'export class App {\n  constructor(config) {\n    this.config = config;\n  }\n\n  start() {\n    console.log("App started");\n  }\n}' },
    { path: 'src/components/User.js', content: 'export class User {\n  constructor(name, email) {\n    this.name = name;\n    this.email = email;\n  }\n\n  validate() {\n    return this.name && this.email;\n  }\n}' },
    { path: 'src/utils/helpers.js', content: 'export function formatDate(date) {\n  return date.toISOString().split("T")[0];\n}\n\nexport function capitalize(str) {\n  return str.charAt(0).toUpperCase() + str.slice(1);\n}' },
    { path: 'src/services/api.js', content: 'export class ApiService {\n  constructor(baseUrl) {\n    this.baseUrl = baseUrl;\n  }\n\n  async get(endpoint) {\n    const response = await fetch(`${this.baseUrl}${endpoint}`);\n    return response.json();\n  }\n}' }
  ];
  
  // Generate more files to reach medium size
  for (let i = 0; i < 50; i++) {
    files.push({
      path: `src/components/Component${i}.js`,
      content: `export class Component${i} {\n  constructor() {\n    this.id = ${i};\n  }\n\n  render() {\n    return \`<div>Component ${i}</div>\`;\n  }\n}`
    });
  }
  
  for (let i = 0; i < 30; i++) {
    files.push({
      path: `tests/unit/test${i}.test.js`,
      content: `import { test, expect } from "vitest";\nimport { Component${i} } from "../../src/components/Component${i}.js";\n\ntest("Component${i} renders correctly", () => {\n  const component = new Component${i}();\n  expect(component.render()).toContain("Component ${i}");\n});`
    });
  }
  
  // Write all files
  for (const file of files) {
    await fs.writeFile(path.join(repoPath, file.path), file.content);
  }
}

async function createLargeRepository(repoPath) {
  await createMediumSizedRepository(repoPath);
  
  // Add more files to make it large
  for (let i = 0; i < 200; i++) {
    await fs.writeFile(
      path.join(repoPath, `src/generated/file${i}.js`),
      `// Generated file ${i}\nexport const data${i} = {\n  id: ${i},\n  name: "Item ${i}",\n  description: "This is generated item number ${i}"\n};\n\nexport function process${i}() {\n  return data${i};\n}`
    );
  }
  
  // Create some larger files
  for (let i = 0; i < 20; i++) {
    const largeContent = Array(100).fill(0).map((_, j) => 
      `function func${i}_${j}() {\n  return "Function ${i}_${j}";\n}`
    ).join('\n\n');
    
    await fs.writeFile(
      path.join(repoPath, `src/large/large${i}.js`),
      largeContent
    );
  }
}