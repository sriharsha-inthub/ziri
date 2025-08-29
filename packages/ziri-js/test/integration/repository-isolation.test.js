/**
 * Tests for Repository Isolation and Storage Structure
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

import { RepositoryManager } from '../../lib/repository/repository-manager.js';
import { MetadataManager } from '../../lib/repository/metadata-manager.js';
import { FileHashTracker } from '../../lib/repository/file-hash-tracker.js';
import { StorageManager } from '../../lib/storage/storage-manager.js';

describe('Repository Isolation and Storage Structure', () => {
  let tempDir;
  let testRepoPath;
  let repositoryManager;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'ziri-test-'));
    testRepoPath = join(tempDir, 'test-repo');
    
    // Create test repository directory
    await mkdir(testRepoPath, { recursive: true });
    
    // Initialize repository manager with test directory
    const storageDir = join(tempDir, '.ziri');
    repositoryManager = new RepositoryManager(storageDir);
    await repositoryManager.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Repository Hash Generation', () => {
    it('should generate unique repository ID from path', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      assert(result.repositoryId, 'Repository ID should be generated');
      assert(typeof result.repositoryId === 'string', 'Repository ID should be a string');
      assert(result.repositoryId.length > 0, 'Repository ID should not be empty');
      assert(result.alias, 'Repository alias should be generated');
    });

    it('should generate consistent ID for same path', async () => {
      const result1 = await repositoryManager.createRepository(testRepoPath);
      const result2 = await repositoryManager.createRepository(testRepoPath);
      
      assert.equal(result1.repositoryId, result2.repositoryId, 'Same path should generate same ID');
    });

    it('should generate different IDs for different paths', async () => {
      const testRepoPath2 = join(tempDir, 'test-repo-2');
      await mkdir(testRepoPath2, { recursive: true });
      
      const result1 = await repositoryManager.createRepository(testRepoPath);
      const result2 = await repositoryManager.createRepository(testRepoPath2);
      
      assert.notEqual(result1.repositoryId, result2.repositoryId, 'Different paths should generate different IDs');
    });
  });

  describe('Directory Creation and Management', () => {
    it('should create isolated storage directory', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      assert(result.storagePath, 'Storage path should be provided');
      assert(result.exists === false, 'Repository should be newly created');
      
      // Verify storage structure exists
      const storageManager = new StorageManager(join(tempDir, '.ziri'));
      const exists = await storageManager.repositoryExists(result.repositoryId);
      assert(exists, 'Repository storage should exist');
    });

    it('should create proper directory structure', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      const paths = repositoryManager.getRepositoryPaths(result.repositoryId);
      
      // Check that all expected paths are defined
      assert(paths.base, 'Base path should be defined');
      assert(paths.vectors, 'Vectors path should be defined');
      assert(paths.metadata, 'Metadata path should be defined');
      assert(paths.fileHashes, 'File hashes path should be defined');
      assert(paths.projectSummary, 'Project summary path should be defined');
      assert(paths.config, 'Config path should be defined');
    });

    it('should handle existing repository', async () => {
      // Create repository first time
      const result1 = await repositoryManager.createRepository(testRepoPath);
      assert(result1.exists === false, 'First creation should be new');
      
      // Create same repository again
      const result2 = await repositoryManager.createRepository(testRepoPath);
      assert(result2.exists === true, 'Second creation should detect existing');
      assert.equal(result1.repositoryId, result2.repositoryId, 'Repository ID should be same');
    });
  });

  describe('Configuration File Handling', () => {
    it('should initialize repository metadata', async () => {
      const result = await repositoryManager.createRepository(testRepoPath, {
        provider: 'openai',
        chunkSize: 1500,
        chunkOverlap: 300
      });
      
      const metadata = await repositoryManager.metadataManager.loadMetadata(result.repositoryId);
      
      assert(metadata, 'Metadata should be created');
      assert.equal(metadata.repositoryPath, testRepoPath, 'Repository path should be stored');
      assert.equal(metadata.embeddingProvider, 'openai', 'Provider should be stored');
      assert.equal(metadata.config.chunkSize, 1500, 'Chunk size should be stored');
      assert.equal(metadata.config.chunkOverlap, 300, 'Chunk overlap should be stored');
      assert(metadata.createdAt instanceof Date, 'Created date should be set');
    });

    it('should save and load repository configuration', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      const config = {
        chunkSize: 2000,
        chunkOverlap: 400,
        excludePatterns: ['*.test.js'],
        maxFileSize: 2048 * 1024
      };
      
      await repositoryManager.updateRepositoryConfig(result.repositoryId, config);
      const loadedConfig = await repositoryManager.getRepositoryConfig(result.repositoryId);
      
      assert.equal(loadedConfig.chunkSize, 2000, 'Chunk size should be saved');
      assert.equal(loadedConfig.chunkOverlap, 400, 'Chunk overlap should be saved');
      assert.deepEqual(loadedConfig.excludePatterns, ['*.test.js'], 'Exclude patterns should be saved');
    });

    it('should provide default configuration when none exists', async () => {
      const storageManager = new StorageManager(join(tempDir, '.ziri'));
      const metadataManager = new MetadataManager(storageManager);
      
      const config = await metadataManager.getRepositoryConfig('nonexistent');
      
      assert(config, 'Default config should be provided');
      assert(config.chunkSize > 0, 'Default chunk size should be positive');
      assert(Array.isArray(config.excludePatterns), 'Default exclude patterns should be array');
    });
  });

  describe('File Hash Tracking System', () => {
    it('should calculate file hash', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      // Create test file
      const testFile = join(testRepoPath, 'test.txt');
      await writeFile(testFile, 'Hello, World!');
      
      const hash = await repositoryManager.calculateFileHash(testFile);
      
      assert(hash, 'Hash should be calculated');
      assert(typeof hash === 'string', 'Hash should be a string');
      assert(hash.length === 64, 'SHA256 hash should be 64 characters');
    });

    it('should track file changes', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      // Create test files
      const testFile1 = join(testRepoPath, 'file1.txt');
      const testFile2 = join(testRepoPath, 'file2.txt');
      await writeFile(testFile1, 'Content 1');
      await writeFile(testFile2, 'Content 2');
      
      // Calculate initial hashes
      const hash1 = await repositoryManager.calculateFileHash(testFile1);
      const hash2 = await repositoryManager.calculateFileHash(testFile2);
      
      const initialHashes = {
        'file1.txt': {
          hash: hash1,
          lastModified: new Date(),
          size: 'Content 1'.length
        },
        'file2.txt': {
          hash: hash2,
          lastModified: new Date(),
          size: 'Content 2'.length
        }
      };
      
      await repositoryManager.updateFileHashes(result.repositoryId, initialHashes);
      
      // Modify one file
      await writeFile(testFile1, 'Modified Content 1');
      const newHash1 = await repositoryManager.calculateFileHash(testFile1);
      
      const currentHashes = {
        'file1.txt': newHash1,
        'file2.txt': hash2
      };
      
      const changes = await repositoryManager.detectFileChanges(result.repositoryId, currentHashes);
      
      assert.equal(changes.modified.length, 1, 'Should detect one modified file');
      assert.equal(changes.modified[0].path, 'file1.txt', 'Should detect correct modified file');
      assert.equal(changes.added.length, 0, 'Should not detect added files');
      assert.equal(changes.deleted.length, 0, 'Should not detect deleted files');
    });

    it('should detect added and deleted files', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      // Initial state with one file
      const testFile1 = join(testRepoPath, 'file1.txt');
      await writeFile(testFile1, 'Content 1');
      const hash1 = await repositoryManager.calculateFileHash(testFile1);
      
      await repositoryManager.updateFileHashes(result.repositoryId, {
        'file1.txt': {
          hash: hash1,
          lastModified: new Date(),
          size: 'Content 1'.length
        },
        'deleted.txt': {
          hash: 'old-hash',
          lastModified: new Date(),
          size: 100
        }
      });
      
      // New state: add file2, keep file1, remove deleted.txt
      const testFile2 = join(testRepoPath, 'file2.txt');
      await writeFile(testFile2, 'Content 2');
      const hash2 = await repositoryManager.calculateFileHash(testFile2);
      
      const currentHashes = {
        'file1.txt': hash1,
        'file2.txt': hash2
      };
      
      const changes = await repositoryManager.detectFileChanges(result.repositoryId, currentHashes);
      
      assert.equal(changes.added.length, 1, 'Should detect one added file');
      assert.equal(changes.added[0].path, 'file2.txt', 'Should detect correct added file');
      assert.equal(changes.deleted.length, 1, 'Should detect one deleted file');
      assert.equal(changes.deleted[0].path, 'deleted.txt', 'Should detect correct deleted file');
      assert.equal(changes.modified.length, 0, 'Should not detect modified files');
    });
  });

  describe('File Hash Tracker Optimization', () => {
    it('should optimize change detection using file stats', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      const tracker = new FileHashTracker(testRepoPath, repositoryManager.metadataManager);
      
      // Create test files
      const testFile1 = join(testRepoPath, 'file1.txt');
      const testFile2 = join(testRepoPath, 'file2.txt');
      await writeFile(testFile1, 'Content 1');
      await writeFile(testFile2, 'Content 2');
      
      // Calculate and store initial hashes
      const initialHashes = await tracker.calculateFileHashes([testFile1, testFile2]);
      await tracker.batchUpdateHashes(result.repositoryId, initialHashes);
      
      // Test optimization - no files changed
      const optimizedResult = await tracker.detectChangesOptimized(
        result.repositoryId, 
        [testFile1, testFile2]
      );
      
      assert(optimizedResult.optimizationStats, 'Should provide optimization stats');
      assert(optimizedResult.optimizationStats.hashCalculationsSkipped >= 0, 'Should track skipped calculations');
      assert.equal(optimizedResult.changes.added.length, 0, 'Should detect no changes');
      assert.equal(optimizedResult.changes.modified.length, 0, 'Should detect no changes');
    });

    it('should cache file hashes for performance', async () => {
      const tracker = new FileHashTracker(testRepoPath, repositoryManager.metadataManager);
      
      const testFile = join(testRepoPath, 'test.txt');
      await writeFile(testFile, 'Test content');
      
      // First call should calculate hash
      const hash1 = await tracker.getFileHash(testFile);
      assert(hash1, 'Should calculate hash');
      
      // Second call should use cache
      const hash2 = await tracker.getFileHash(testFile);
      assert.equal(hash1, hash2, 'Should return same hash from cache');
      
      const cacheStats = tracker.getCacheStats();
      assert(cacheStats.size > 0, 'Cache should contain entries');
    });
  });

  describe('Repository Management', () => {
    it('should list all repositories', async () => {
      // Create multiple repositories
      const repo1Path = join(tempDir, 'repo1');
      const repo2Path = join(tempDir, 'repo2');
      await mkdir(repo1Path, { recursive: true });
      await mkdir(repo2Path, { recursive: true });
      
      await repositoryManager.createRepository(repo1Path);
      await repositoryManager.createRepository(repo2Path);
      
      const repositories = await repositoryManager.listRepositories();
      
      assert(repositories.length >= 2, 'Should list created repositories');
      assert(repositories.every(repo => repo.repositoryId), 'All repos should have IDs');
      assert(repositories.every(repo => repo.metadata), 'All repos should have metadata');
    });

    it('should get repository information', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      const repoInfo = await repositoryManager.getRepository(testRepoPath);
      
      assert(repoInfo, 'Should return repository information');
      assert.equal(repoInfo.repositoryId, result.repositoryId, 'Should return correct ID');
      assert(repoInfo.metadata, 'Should include metadata');
      assert(repoInfo.stats, 'Should include statistics');
    });

    it('should validate repository integrity', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      const validation = await repositoryManager.validateRepository(result.repositoryId);
      
      assert(validation.valid, 'New repository should be valid');
      assert.equal(validation.errors.length, 0, 'Should have no errors');
    });

    it('should delete repository', async () => {
      const result = await repositoryManager.createRepository(testRepoPath);
      
      // Verify repository exists
      let exists = await repositoryManager.repositoryExists(testRepoPath);
      assert(exists, 'Repository should exist before deletion');
      
      // Delete repository
      const deleted = await repositoryManager.deleteRepository(testRepoPath);
      assert(deleted, 'Repository deletion should succeed');
      
      // Verify repository no longer exists
      exists = await repositoryManager.repositoryExists(testRepoPath);
      assert(!exists, 'Repository should not exist after deletion');
    });
  });
});