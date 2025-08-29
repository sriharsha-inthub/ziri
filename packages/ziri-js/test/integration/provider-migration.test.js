import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RepositoryManager } from '../../lib/repository/repository-manager.js';
import { ConfigManager } from '../../lib/config/config-manager.js';
import { ProviderSwitcher } from '../../lib/config/provider-switcher.js';

describe('Provider Switching and Data Migration Tests', () => {
  let tempDir;
  let testRepoPath;
  let ziriConfigDir;
  let indexManager;
  let configManager;
  let providerSwitcher;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'ziri-provider-test-' + Date.now());
    testRepoPath = path.join(tempDir, 'test-repo');
    ziriConfigDir = path.join(tempDir, '.ziri');
    
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(testRepoPath, { recursive: true });
    await fs.mkdir(ziriConfigDir, { recursive: true });
    
    configManager = new ConfigManager(ziriConfigDir);
    indexManager = new RepositoryManager(ziriConfigDir);
    providerSwitcher = new ProviderSwitcher(configManager, indexManager);
    
    // Create test repository
    await createTestRepository(testRepoPath);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Provider Configuration Management', () => {
    it('should validate provider configurations', async () => {
      // Test valid configurations
      const validConfigs = [
        {
          type: 'openai',
          model: 'text-embedding-3-small',
          dimensions: 1536,
          maxTokens: 8191
        },
        {
          type: 'ollama',
          model: 'nomic-embed-text',
          dimensions: 768,
          baseUrl: 'http://localhost:11434'
        },
        {
          type: 'huggingface',
          model: 'sentence-transformers/all-MiniLM-L6-v2',
          dimensions: 384
        },
        {
          type: 'cohere',
          model: 'embed-english-v3.0',
          dimensions: 1024,
          apiKey: 'test-key'
        }
      ];

      for (const config of validConfigs) {
        await expect(
          configManager.updateConfig({
            providers: { test: config }
          })
        ).resolves.not.toThrow();
      }

      // Test invalid configurations
      const invalidConfigs = [
        { type: 'unknown-provider' },
        { type: 'openai' }, // Missing required fields
        { type: 'openai', model: 'test', dimensions: 'invalid' },
        { type: 'ollama', dimensions: -1 }
      ];

      for (const config of invalidConfigs) {
        await expect(
          configManager.updateConfig({
            providers: { invalid: config }
          })
        ).rejects.toThrow();
      }
    });

    it('should handle provider switching configuration', async () => {
      // Configure multiple providers
      await configManager.updateConfig({
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768,
            baseUrl: 'http://localhost:11434'
          },
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
          }
        }
      });

      // Switch default provider
      await configManager.updateConfig({
        defaultProvider: 'ollama'
      });

      const config = await configManager.getConfig();
      expect(config.defaultProvider).toBe('ollama');
      expect(config.providers.openai).toBeDefined();
      expect(config.providers.ollama).toBeDefined();
    });
  });

  describe('Provider Switching Workflows', () => {
    let repositoryId;

    beforeEach(async () => {
      // Initial setup with Ollama provider
      await configManager.updateConfig({
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768,
            baseUrl: 'http://localhost:11434'
          },
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            maxTokens: 8191
          }
        }
      });

      const result = await indexManager.indexRepository(testRepoPath, {
        provider: 'openai',
        forceFullIndex: true
      });
      repositoryId = result.repositoryId;
    });

    it('should switch to provider with same dimensions', async () => {
      // Add another provider with same dimensions
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          'openai-large': {
            type: 'openai',
            model: 'text-embedding-3-large',
            dimensions: 1536 // Same dimensions
          }
        }
      });

      const switchResult = await providerSwitcher.switchProvider(
        testRepoPath,
        'openai-large'
      );

      expect(switchResult.migrationRequired).toBe(false);
      expect(switchResult.repositoryId).toBe(repositoryId);
      expect(switchResult.embeddingsPreserved).toBe(true);

      // Verify provider was updated in metadata
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.embeddingProvider).toBe('openai-large');
      expect(repoStatus.embeddingDimensions).toBe(1536);
    });

    it('should migrate data when switching to provider with different dimensions', async () => {
      // Add provider with different dimensions
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
            dimensions: 768, // Different dimensions
            baseUrl: 'http://localhost:11434'
          }
        }
      });

      const switchResult = await providerSwitcher.switchProvider(
        testRepoPath,
        'ollama'
      );

      expect(switchResult.migrationRequired).toBe(true);
      expect(switchResult.repositoryId).toBe(repositoryId);
      expect(switchResult.embeddingsRegenerated).toBeGreaterThan(0);

      // Verify provider and dimensions were updated
      const repoStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(repoStatus.embeddingProvider).toBe('ollama');
      expect(repoStatus.embeddingDimensions).toBe(768);
    });

    it('should handle provider switching with configuration validation', async () => {
      // Try to switch to non-existent provider
      await expect(
        providerSwitcher.switchProvider(testRepoPath, 'non-existent')
      ).rejects.toThrow(/Provider.*not found/);

      // Try to switch to provider with invalid configuration
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          invalid: {
            type: 'openai'
            // Missing required fields
          }
        }
      });

      await expect(
        providerSwitcher.switchProvider(testRepoPath, 'invalid')
      ).rejects.toThrow(/Invalid provider configuration/);
    });

    it('should preserve metadata during provider switching', async () => {
      const initialStatus = await indexManager.getRepositoryStatus(testRepoPath);
      const initialFileCount = initialStatus.fileHashes.size;
      const initialChunkCount = initialStatus.totalChunks;

      // Switch to provider with same dimensions
      await configManager.updateConfig({
        providers: {
          openai: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          'openai-alt': {
            type: 'openai',
            model: 'text-embedding-ada-002',
            dimensions: 1536
          }
        }
      });

      await providerSwitcher.switchProvider(testRepoPath, 'openai-alt');

      const finalStatus = await indexManager.getRepositoryStatus(testRepoPath);

      // File metadata should be preserved
      expect(finalStatus.fileHashes.size).toBe(initialFileCount);
      expect(finalStatus.totalChunks).toBe(initialChunkCount);
      expect(finalStatus.repositoryPath).toBe(initialStatus.repositoryPath);

      // Only provider-specific metadata should change
      expect(finalStatus.embeddingProvider).toBe('openai-alt');
      expect(finalStatus.embeddingDimensions).toBe(1536);
    });
  });

  describe('Data Migration Scenarios', () => {
    it('should handle complete data migration', async () => {
      // Index with first provider
      await configManager.updateConfig({
        providers: {
          provider1: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          provider2: {
            type: 'huggingface',
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            dimensions: 384
          }
        }
      });

      const initialResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'provider1',
        forceFullIndex: true
      });

      // Migrate to second provider
      const migrationResult = await providerSwitcher.migrateRepository(
        testRepoPath,
        'provider2'
      );

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.filesProcessed).toBe(initialResult.filesProcessed);
      expect(migrationResult.embeddingsRegenerated).toBeGreaterThan(0);

      // Verify migration completed successfully
      const finalStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(finalStatus.embeddingProvider).toBe('provider2');
      expect(finalStatus.embeddingDimensions).toBe(384);
    });

    it('should handle partial migration failures gracefully', async () => {
      // Index with working provider
      await configManager.updateConfig({
        providers: {
          working: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          failing: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 768,
            apiKey: 'invalid-key' // Will cause failures
          }
        }
      });

      await indexManager.indexRepository(testRepoPath, {
        provider: 'working',
        forceFullIndex: true
      });

      // Attempt migration to failing provider
      await expect(
        providerSwitcher.migrateRepository(testRepoPath, 'failing')
      ).rejects.toThrow();

      // Verify original data is preserved
      const status = await indexManager.getRepositoryStatus(testRepoPath);
      expect(status.embeddingProvider).toBe('working');
      expect(status.embeddingDimensions).toBe(1536);
    });

    it('should support rollback after failed migration', async () => {
      await configManager.updateConfig({
        providers: {
          stable: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          unstable: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 768,
            apiKey: 'invalid-key'
          }
        }
      });

      const initialResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'stable',
        forceFullIndex: true
      });

      const initialStatus = await indexManager.getRepositoryStatus(testRepoPath);

      // Attempt migration that will fail
      try {
        await providerSwitcher.migrateRepository(testRepoPath, 'unstable');
        expect.fail('Migration should have failed');
      } catch (error) {
        // Expected failure
      }

      // Rollback to previous state
      await providerSwitcher.rollbackMigration(testRepoPath);

      const rolledBackStatus = await indexManager.getRepositoryStatus(testRepoPath);
      expect(rolledBackStatus.embeddingProvider).toBe(initialStatus.embeddingProvider);
      expect(rolledBackStatus.embeddingDimensions).toBe(initialStatus.embeddingDimensions);
      expect(rolledBackStatus.totalChunks).toBe(initialStatus.totalChunks);
    });
  });

  describe('Provider Performance Comparison', () => {
    it('should benchmark provider switching performance', async () => {
      const providers = [
        {
          name: 'openai-small',
          config: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          }
        },
        {
          name: 'openai-large',
          config: {
            type: 'openai',
            model: 'text-embedding-3-large',
            dimensions: 3072
          }
        }
      ];

      await configManager.updateConfig({
        providers: Object.fromEntries(
          providers.map(p => [p.name, p.config])
        )
      });

      const benchmarkResults = [];

      for (const provider of providers) {
        const startTime = Date.now();

        const result = await indexManager.indexRepository(testRepoPath, {
          provider: provider.name,
          forceFullIndex: true
        });

        const duration = Date.now() - startTime;
        const throughput = result.filesProcessed / (duration / 1000);

        benchmarkResults.push({
          provider: provider.name,
          dimensions: provider.config.dimensions,
          duration,
          throughput,
          filesProcessed: result.filesProcessed
        });

        console.log(`🔌 ${provider.name}: ${duration}ms, ${throughput.toFixed(2)} files/sec`);
      }

      // Verify all providers completed successfully
      expect(benchmarkResults.length).toBe(providers.length);
      benchmarkResults.forEach(result => {
        expect(result.filesProcessed).toBeGreaterThan(0);
        expect(result.throughput).toBeGreaterThan(0);
      });
    });

    it('should measure migration overhead', async () => {
      await configManager.updateConfig({
        providers: {
          source: {
            type: 'openai',
            model: 'text-embedding-3-small',
            dimensions: 1536
          },
          target: {
            type: 'huggingface',
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            dimensions: 384
          }
        }
      });

      // Initial indexing
      const initialStart = Date.now();
      const initialResult = await indexManager.indexRepository(testRepoPath, {
        provider: 'source',
        forceFullIndex: true
      });
      const initialDuration = Date.now() - initialStart;

      // Migration
      const migrationStart = Date.now();
      const migrationResult = await providerSwitcher.migrateRepository(
        testRepoPath,
        'target'
      );
      const migrationDuration = Date.now() - migrationStart;

      // Calculate overhead
      const overhead = migrationDuration / initialDuration;

      console.log(`📊 Migration overhead: ${overhead.toFixed(2)}x initial indexing time`);
      console.log(`⏱️ Initial: ${initialDuration}ms, Migration: ${migrationDuration}ms`);

      // Migration should be reasonably efficient
      expect(overhead).toBeLessThan(2.0); // Less than 2x the initial time
      expect(migrationResult.filesProcessed).toBe(initialResult.filesProcessed);
    });
  });

  // Helper function to create test repository
  async function createTestRepository(repoPath) {
    await fs.mkdir(path.join(repoPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(repoPath, 'tests'), { recursive: true });

    const files = [
      {
        path: 'README.md',
        content: '# Test Repository\n\nThis is a test repository for provider migration testing.'
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'test-repo',
          version: '1.0.0',
          description: 'Test repository for provider migration'
        }, null, 2)
      },
      {
        path: 'src/index.js',
        content: 'export default function main() {\n  return "Hello from main";\n}'
      },
      {
        path: 'src/utils.js',
        content: 'export function helper() {\n  return "utility function";\n}\n\nexport const constant = 42;'
      },
      {
        path: 'src/config.js',
        content: 'export const config = {\n  apiUrl: "https://api.example.com",\n  timeout: 5000\n};'
      },
      {
        path: 'tests/index.test.js',
        content: 'import { test, expect } from "vitest";\nimport main from "../src/index.js";\n\ntest("main function", () => {\n  expect(main()).toBe("Hello from main");\n});'
      }
    ];

    for (const file of files) {
      await fs.writeFile(path.join(repoPath, file.path), file.content);
    }
  }
});