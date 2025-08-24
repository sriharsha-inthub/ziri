/**
 * Tests for IndexStore - Vector Storage and Retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexStore } from '../../lib/storage/index-store.js';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

describe('IndexStore', () => {
  let indexStore;
  let testDir;
  let repositoryId;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = join(tmpdir(), `ziri-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    indexStore = new IndexStore(testDir);
    await indexStore.initialize();
    
    // Create test repository
    repositoryId = await indexStore.createRepository('/test/repo');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Repository Management', () => {
    it('should create a new repository', async () => {
      const newRepoId = await indexStore.createRepository('/another/test/repo');
      
      expect(newRepoId).toBeDefined();
      expect(typeof newRepoId).toBe('string');
      expect(newRepoId.length).toBe(16); // SHA256 substring
      
      const exists = await indexStore.repositoryExists(newRepoId);
      expect(exists).toBe(true);
    });

    it('should check repository existence', async () => {
      const exists = await indexStore.repositoryExists(repositoryId);
      expect(exists).toBe(true);
      
      const notExists = await indexStore.repositoryExists('nonexistent');
      expect(notExists).toBe(false);
    });

    it('should delete repository', async () => {
      const success = await indexStore.deleteRepository(repositoryId);
      expect(success).toBe(true);
      
      const exists = await indexStore.repositoryExists(repositoryId);
      expect(exists).toBe(false);
    });
  });

  describe('Metadata Management', () => {
    it('should get and update metadata', async () => {
      const metadata = await indexStore.getMetadata(repositoryId);
      
      expect(metadata).toBeDefined();
      expect(metadata.repositoryId).toBe(repositoryId);
      expect(metadata.totalChunks).toBe(0);
      expect(metadata.fileHashes).toBeInstanceOf(Map);
      
      // Update metadata
      metadata.totalChunks = 5;
      metadata.embeddingProvider = 'openai';
      await indexStore.updateMetadata(repositoryId, metadata);
      
      // Verify update
      const updatedMetadata = await indexStore.getMetadata(repositoryId);
      expect(updatedMetadata.totalChunks).toBe(5);
      expect(updatedMetadata.embeddingProvider).toBe('openai');
    });
  });

  describe('Embedding Storage', () => {
    const createTestEmbeddings = (count = 3) => {
      const embeddings = [];
      
      for (let i = 0; i < count; i++) {
        embeddings.push({
          chunkId: `chunk-${i}`,
          content: `This is test content for chunk ${i}`,
          filePath: `/test/file${i}.js`,
          startLine: i * 10,
          endLine: (i * 10) + 5,
          fileHash: `hash-${i}`,
          embedding: Array.from({ length: 384 }, () => Math.random()),
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        });
      }
      
      return embeddings;
    };

    it('should store embeddings', async () => {
      const embeddings = createTestEmbeddings(3);
      
      await indexStore.storeEmbeddings(repositoryId, embeddings);
      
      // Verify metadata was updated
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(3);
      expect(metadata.embeddingProvider).toBe('test-provider');
      expect(metadata.dimensions).toBe(384);
    });

    it('should handle empty embeddings array', async () => {
      await indexStore.storeEmbeddings(repositoryId, []);
      
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(0);
    });

    it('should store embeddings in batches', async () => {
      const batch1 = createTestEmbeddings(2);
      const batch2 = createTestEmbeddings(3).map((emb, i) => ({
        ...emb,
        chunkId: `chunk-batch2-${i}`,
        content: `Batch 2 content ${i}`
      }));
      
      await indexStore.storeEmbeddings(repositoryId, batch1);
      await indexStore.storeEmbeddings(repositoryId, batch2);
      
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(5);
    });
  });

  describe('Vector Retrieval', () => {
    beforeEach(async () => {
      // Store test embeddings
      const embeddings = [
        {
          chunkId: 'chunk-1',
          content: 'JavaScript function implementation',
          filePath: '/test/file1.js',
          startLine: 1,
          endLine: 10,
          fileHash: 'hash-1',
          embedding: [0.1, 0.2, 0.3, 0.4],
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        },
        {
          chunkId: 'chunk-2',
          content: 'Python class definition',
          filePath: '/test/file2.py',
          startLine: 15,
          endLine: 25,
          fileHash: 'hash-2',
          embedding: [0.2, 0.3, 0.4, 0.5],
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        },
        {
          chunkId: 'chunk-3',
          content: 'HTML template structure',
          filePath: '/test/file3.html',
          startLine: 1,
          endLine: 20,
          fileHash: 'hash-3',
          embedding: [0.8, 0.7, 0.6, 0.5],
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        }
      ];
      
      await indexStore.storeEmbeddings(repositoryId, embeddings);
    });

    it('should query embeddings by similarity', async () => {
      const queryVector = [0.15, 0.25, 0.35, 0.45]; // Similar to chunk-1 and chunk-2
      
      const results = await indexStore.queryEmbeddings(repositoryId, queryVector, 2);
      
      expect(results).toHaveLength(2);
      expect(results[0].chunkId).toBeDefined();
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].content).toBeDefined();
      expect(results[0].filePath).toBeDefined();
      expect(results[0].embedding).toHaveLength(4);
      expect(results[0].metadata).toBeDefined();
      expect(results[0].metadata.fileHash).toBeDefined();
      expect(results[0].metadata.provider).toBe('test-provider');
    });

    it('should respect limit parameter', async () => {
      const queryVector = [0.5, 0.5, 0.5, 0.5];
      
      const results = await indexStore.queryEmbeddings(repositoryId, queryVector, 1);
      
      expect(results).toHaveLength(1);
    });

    it('should handle empty index', async () => {
      const emptyRepoId = await indexStore.createRepository('/empty/repo');
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      
      const results = await indexStore.queryEmbeddings(emptyRepoId, queryVector, 10);
      
      expect(results).toHaveLength(0);
    });

    it('should apply similarity threshold', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      
      // High threshold should return fewer results
      const results = await indexStore.queryEmbeddings(repositoryId, queryVector, 10, 0.9);
      
      expect(results.length).toBeLessThanOrEqual(3);
      
      // All results should meet threshold
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe('Embedding Removal', () => {
    beforeEach(async () => {
      const embeddings = [
        {
          chunkId: 'chunk-1',
          content: 'Content 1',
          filePath: '/test/file1.js',
          startLine: 1,
          endLine: 10,
          fileHash: 'hash-1',
          embedding: [0.1, 0.2, 0.3, 0.4],
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        },
        {
          chunkId: 'chunk-2',
          content: 'Content 2',
          filePath: '/test/file2.js',
          startLine: 11,
          endLine: 20,
          fileHash: 'hash-2',
          embedding: [0.2, 0.3, 0.4, 0.5],
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        },
        {
          chunkId: 'chunk-3',
          content: 'Content 3',
          filePath: '/test/file3.js',
          startLine: 21,
          endLine: 30,
          fileHash: 'hash-3',
          embedding: [0.3, 0.4, 0.5, 0.6],
          provider: 'test-provider',
          modelVersion: 'test-model-v1'
        }
      ];
      
      await indexStore.storeEmbeddings(repositoryId, embeddings);
    });

    it('should remove embeddings by chunk IDs', async () => {
      await indexStore.removeEmbeddings(repositoryId, ['chunk-2']);
      
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(2);
      
      // Verify chunk-2 is not in results
      const queryVector = [0.2, 0.3, 0.4, 0.5];
      const results = await indexStore.queryEmbeddings(repositoryId, queryVector, 10);
      
      const chunkIds = results.map(r => r.chunkId);
      expect(chunkIds).not.toContain('chunk-2');
      expect(chunkIds).toContain('chunk-1');
      expect(chunkIds).toContain('chunk-3');
    });

    it('should handle removal of non-existent chunks', async () => {
      await indexStore.removeEmbeddings(repositoryId, ['non-existent']);
      
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(3); // Should remain unchanged
    });

    it('should handle empty removal array', async () => {
      await indexStore.removeEmbeddings(repositoryId, []);
      
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(3); // Should remain unchanged
    });
  });

  describe('Storage Statistics', () => {
    it('should get storage statistics', async () => {
      const embeddings = createTestEmbeddings(5);
      await indexStore.storeEmbeddings(repositoryId, embeddings);
      
      const stats = await indexStore.getStorageStats(repositoryId);
      
      expect(stats.totalChunks).toBe(5);
      expect(stats.totalFiles).toBe(0); // No file hashes set in test
      expect(stats.storageSize).toBeGreaterThan(0);
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
      expect(stats.providerStats).toBeInstanceOf(Map);
      expect(stats.providerStats.get('test-provider')).toBe(5);
    });

    it('should get index statistics', async () => {
      const embeddings = createTestEmbeddings(3);
      await indexStore.storeEmbeddings(repositoryId, embeddings);
      
      const stats = await indexStore.getIndexStats(repositoryId);
      
      expect(stats.totalVectors).toBe(3);
      expect(stats.dimensions).toBe(384);
      expect(stats.indexType).toBe('FlatIP');
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Index Validation', () => {
    it('should validate index integrity', async () => {
      const embeddings = createTestEmbeddings(3);
      await indexStore.storeEmbeddings(repositoryId, embeddings);
      
      const validation = await indexStore.validateIndex(repositoryId);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.stats.vectorCount).toBe(3);
      expect(validation.stats.recordCount).toBe(3);
      expect(validation.stats.uniqueChunks).toBe(3);
    });

    it('should detect validation issues', async () => {
      // This test would require manually corrupting data
      // For now, just test the validation structure
      const validation = await indexStore.validateIndex('non-existent-repo');
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.stats).toBe(null);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch store operations', async () => {
      const batch1 = createTestEmbeddings(2);
      const batch2 = createTestEmbeddings(3).map((emb, i) => ({
        ...emb,
        chunkId: `batch2-chunk-${i}`
      }));
      
      await indexStore.batchStoreEmbeddings(repositoryId, [batch1, batch2]);
      
      const metadata = await indexStore.getMetadata(repositoryId);
      expect(metadata.totalChunks).toBe(5);
    });
  });

  describe('Repository Isolation', () => {
    it('should maintain isolation between repositories', async () => {
      const repo1Id = await indexStore.createRepository('/repo1');
      const repo2Id = await indexStore.createRepository('/repo2');
      
      const embeddings1 = [{
        chunkId: 'repo1-chunk',
        content: 'Repository 1 content',
        filePath: '/repo1/file.js',
        startLine: 1,
        endLine: 10,
        fileHash: 'repo1-hash',
        embedding: [0.1, 0.2, 0.3, 0.4],
        provider: 'test-provider',
        modelVersion: 'test-model-v1'
      }];
      
      const embeddings2 = [{
        chunkId: 'repo2-chunk',
        content: 'Repository 2 content',
        filePath: '/repo2/file.js',
        startLine: 1,
        endLine: 10,
        fileHash: 'repo2-hash',
        embedding: [0.5, 0.6, 0.7, 0.8],
        provider: 'test-provider',
        modelVersion: 'test-model-v1'
      }];
      
      await indexStore.storeEmbeddings(repo1Id, embeddings1);
      await indexStore.storeEmbeddings(repo2Id, embeddings2);
      
      // Query each repository
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      
      const results1 = await indexStore.queryEmbeddings(repo1Id, queryVector, 10);
      const results2 = await indexStore.queryEmbeddings(repo2Id, queryVector, 10);
      
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].chunkId).toBe('repo1-chunk');
      expect(results2[0].chunkId).toBe('repo2-chunk');
      
      // Verify metadata isolation
      const metadata1 = await indexStore.getMetadata(repo1Id);
      const metadata2 = await indexStore.getMetadata(repo2Id);
      
      expect(metadata1.totalChunks).toBe(1);
      expect(metadata2.totalChunks).toBe(1);
    });
  });

  // Helper function to create test embeddings
  function createTestEmbeddings(count = 3) {
    const embeddings = [];
    
    for (let i = 0; i < count; i++) {
      embeddings.push({
        chunkId: `chunk-${i}`,
        content: `This is test content for chunk ${i}`,
        filePath: `/test/file${i}.js`,
        startLine: i * 10,
        endLine: (i * 10) + 5,
        fileHash: `hash-${i}`,
        embedding: Array.from({ length: 384 }, () => Math.random()),
        provider: 'test-provider',
        modelVersion: 'test-model-v1'
      });
    }
    
    return embeddings;
  }
});