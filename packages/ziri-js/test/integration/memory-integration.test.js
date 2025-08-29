/**
 * Memory Integration Tests
 * Tests the integration of memory optimization with the full indexing pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryAwareIndexer } from '../../lib/memory/memory-aware-indexer.js';
import { EmbeddingClient } from '../../lib/embedding/embedding-client.js';
import { ChangeDetector } from '../../lib/repository/change-detector.js';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

describe('Memory Integration', () => {
  let tempDir;
  let testRepoDir;
  let memoryAwareIndexer;
  let embeddingClient;
  
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ziri-memory-integration-'));
    testRepoDir = join(tempDir, 'test-repo');
    
    // Create test repository
    await mkdir(testRepoDir, { recursive: true });
    
    // Create mock embedding client
    embeddingClient = new EmbeddingClient();
    
    // Mock the embed method to return fake embeddings
    vi.spyOn(embeddingClient, 'embed').mockImplementation(async (texts) => {
      return texts.map(() => new Array(384).fill(0).map(() => Math.random()));
    });
    
    // Mock provider limits
    vi.spyOn(embeddingClient, 'getProviderLimits').mockReturnValue({
      maxTokensPerRequest: 8000,
      recommendedBatchSize: 50,
      maxConcurrency: 3
    });
    
    // Create change detector with metadata manager
    const { MetadataManager } = await import('../../lib/repository/metadata-manager.js');
    const { StorageManager } = await import('../../lib/storage/storage-manager.js');
    const storageManager = new StorageManager(tempDir);
    const metadataManager = new MetadataManager(storageManager);
    const changeDetector = new ChangeDetector(testRepoDir, metadataManager);
    
    // Initialize memory-aware indexer
    memoryAwareIndexer = new MemoryAwareIndexer({
      memoryLimitMB: 128,
      batchSize: 10,
      checkpointInterval: 5,
      baseDirectory: tempDir,
      embeddingClient,
      repositoryParser: {
        changeDetector
      }
    });
  });
  
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should index a repository with memory optimization', async () => {
    // Create test files
    const testFiles = [
      { name: 'file1.js', content: 'function test1() { return "hello"; }' },
      { name: 'file2.js', content: 'function test2() { return "world"; }' },
      { name: 'file3.js', content: 'const data = { key: "value" };' },
      { name: 'subdir/file4.js', content: 'export default class TestClass {}' },
      { name: 'README.md', content: '# Test Repository\n\nThis is a test.' }
    ];
    
    // Write test files
    for (const file of testFiles) {
      const filePath = join(testRepoDir, file.name);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, file.content);
    }
    
    // Track events
    const events = [];
    memoryAwareIndexer.on('indexing:started', (data) => events.push({ type: 'started', data }));
    memoryAwareIndexer.on('file:processed', (data) => events.push({ type: 'file_processed', data }));
    memoryAwareIndexer.on('indexing:completed', (data) => events.push({ type: 'completed', data }));
    
    // Index the repository
    const result = await memoryAwareIndexer.indexRepository(testRepoDir, {
      provider: 'openai',
      excludePatterns: ['**/node_modules/**']
    });
    
    // Verify results
    expect(result).toHaveProperty('repositoryId');
    expect(result).toHaveProperty('filesProcessed');
    expect(result).toHaveProperty('chunksGenerated');
    expect(result).toHaveProperty('duration');
    expect(result.filesProcessed).toBeGreaterThan(0);
    
    // Verify events were emitted
    expect(events.some(e => e.type === 'started')).toBe(true);
    expect(events.some(e => e.type === 'completed')).toBe(true);
    expect(events.filter(e => e.type === 'file_processed')).toHaveLength(result.filesProcessed);
    
    // Verify embedding client was called
    expect(embeddingClient.embed).toHaveBeenCalled();
  });

  it('should handle memory pressure during indexing', async () => {
    // Create indexer with very low memory limit
    const lowMemoryIndexer = new MemoryAwareIndexer({
      memoryLimitMB: 32, // Very low limit
      batchSize: 5,
      baseDirectory: tempDir,
      embeddingClient
    });
    
    // Create many test files to trigger memory pressure
    const testFiles = Array.from({ length: 50 }, (_, i) => ({
      name: `file${i}.js`,
      content: `// File ${i}\n${'x'.repeat(1000)}` // 1KB per file
    }));
    
    for (const file of testFiles) {
      await writeFile(join(testRepoDir, file.name), file.content);
    }
    
    // Track memory events
    const memoryEvents = [];
    lowMemoryIndexer.on('memory:warning', (data) => memoryEvents.push({ type: 'warning', data }));
    lowMemoryIndexer.on('processing:paused', (data) => memoryEvents.push({ type: 'paused', data }));
    
    // Index with memory constraints
    const result = await lowMemoryIndexer.indexRepository(testRepoDir);
    
    expect(result.filesProcessed).toBe(testFiles.length);
    // Memory events might or might not occur depending on actual memory usage
  });

  it('should checkpoint progress and resume indexing', async () => {
    // Create test files
    const testFiles = Array.from({ length: 20 }, (_, i) => ({
      name: `file${i}.js`,
      content: `function test${i}() { return ${i}; }`
    }));
    
    for (const file of testFiles) {
      await writeFile(join(testRepoDir, file.name), file.content);
    }
    
    // Track checkpoint events
    const checkpointEvents = [];
    memoryAwareIndexer.on('checkpoint:saved', (data) => checkpointEvents.push(data));
    
    // Index repository (should create checkpoints)
    const result = await memoryAwareIndexer.indexRepository(testRepoDir, {
      provider: 'openai'
    });
    
    expect(result.filesProcessed).toBe(testFiles.length);
    expect(checkpointEvents.length).toBeGreaterThan(0);
    
    // Verify checkpoints were saved at intervals
    const checkpointManager = memoryAwareIndexer.checkpointManager;
    const resumeInfo = await checkpointManager.shouldResume(result.repositoryId, 'indexing');
    
    // Since indexing completed, should not resume
    expect(resumeInfo.shouldResume).toBe(false);
  });

  it('should update repository incrementally', async () => {
    // Create initial files
    const initialFiles = [
      { name: 'file1.js', content: 'function original() { return 1; }' },
      { name: 'file2.js', content: 'function original() { return 2; }' }
    ];
    
    for (const file of initialFiles) {
      await writeFile(join(testRepoDir, file.name), file.content);
    }
    
    // Initial indexing
    const indexResult = await memoryAwareIndexer.indexRepository(testRepoDir);
    expect(indexResult.filesProcessed).toBe(2);
    
    // Modify and add files
    await writeFile(join(testRepoDir, 'file1.js'), 'function modified() { return 1; }');
    await writeFile(join(testRepoDir, 'file3.js'), 'function new() { return 3; }');
    
    // Track update events
    const updateEvents = [];
    memoryAwareIndexer.on('update:started', (data) => updateEvents.push({ type: 'started', data }));
    memoryAwareIndexer.on('file:updated', (data) => updateEvents.push({ type: 'file_updated', data }));
    memoryAwareIndexer.on('update:completed', (data) => updateEvents.push({ type: 'completed', data }));
    
    // Update repository
    const updateResult = await memoryAwareIndexer.updateRepository(testRepoDir);
    
    expect(updateResult.changes).toBeGreaterThanOrEqual(2); // At least 1 modified + 1 added
    expect(updateEvents.some(e => e.type === 'started')).toBe(true);
    expect(updateEvents.some(e => e.type === 'completed')).toBe(true);
  });

  it('should provide comprehensive indexing statistics', async () => {
    // Create test files
    const testFiles = [
      { name: 'test1.js', content: 'console.log("test1");' },
      { name: 'test2.js', content: 'console.log("test2");' }
    ];
    
    for (const file of testFiles) {
      await writeFile(join(testRepoDir, file.name), file.content);
    }
    
    // Index repository
    const result = await memoryAwareIndexer.indexRepository(testRepoDir);
    
    // Get statistics
    const stats = await memoryAwareIndexer.getIndexingStats(result.repositoryId);
    
    expect(stats).toHaveProperty('index');
    expect(stats).toHaveProperty('storage');
    expect(stats).toHaveProperty('processing');
    expect(stats).toHaveProperty('memory');
    
    expect(stats.index).toHaveProperty('totalVectors');
    expect(stats.storage).toHaveProperty('totalChunks');
    expect(stats.processing).toHaveProperty('processedCount');
    expect(stats.memory).toHaveProperty('peakUsage');
  });

  it('should handle pause and resume operations', async () => {
    // Create test files
    const testFiles = Array.from({ length: 10 }, (_, i) => ({
      name: `file${i}.js`,
      content: `function test${i}() { return ${i}; }`
    }));
    
    for (const file of testFiles) {
      await writeFile(join(testRepoDir, file.name), file.content);
    }
    
    // Track pause/resume events
    const pauseResumeEvents = [];
    memoryAwareIndexer.on('indexing:paused', () => pauseResumeEvents.push('paused'));
    memoryAwareIndexer.on('indexing:resumed', () => pauseResumeEvents.push('resumed'));
    
    // Test pause/resume functionality
    expect(memoryAwareIndexer.streamingProcessor.isPaused).toBe(false);
    
    memoryAwareIndexer.pause();
    expect(memoryAwareIndexer.streamingProcessor.isPaused).toBe(true);
    
    memoryAwareIndexer.resume();
    expect(memoryAwareIndexer.streamingProcessor.isPaused).toBe(false);
    
    // Index normally
    const result = await memoryAwareIndexer.indexRepository(testRepoDir);
    expect(result.filesProcessed).toBe(testFiles.length);
  });

  it('should handle errors gracefully during indexing', async () => {
    // Create test files
    await writeFile(join(testRepoDir, 'good.js'), 'function good() { return true; }');
    
    // Mock embedding client to occasionally fail
    let callCount = 0;
    embeddingClient.embed.mockImplementation(async (texts) => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Simulated embedding failure');
      }
      return texts.map(() => new Array(384).fill(0).map(() => Math.random()));
    });
    
    // Index repository (should handle errors gracefully)
    const result = await memoryAwareIndexer.indexRepository(testRepoDir);
    
    // Should still complete indexing despite some errors
    expect(result).toHaveProperty('repositoryId');
    expect(result).toHaveProperty('filesProcessed');
  }, 10000); // 10 second timeout

  it('should work with different embedding providers', async () => {
    // Create test file
    await writeFile(join(testRepoDir, 'test.js'), 'function test() { return "provider test"; }');
    
    // Test with different providers
    const providers = ['openai', 'ollama'];
    
    for (const provider of providers) {
      // Mock provider-specific behavior
      embeddingClient.getProviderLimits.mockReturnValue({
        maxTokensPerRequest: provider === 'openai' ? 8000 : 4000,
        recommendedBatchSize: provider === 'openai' ? 50 : 25,
        maxConcurrency: 3
      });
      
      const result = await memoryAwareIndexer.indexRepository(testRepoDir, {
        provider,
        forceFullIndex: true
      });
      
      expect(result.filesProcessed).toBe(1);
      expect(embeddingClient.embed).toHaveBeenCalled();
    }
  });
});