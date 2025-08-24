/**
 * Tests for Change Detection System
 * Requirements: 1.5, 6.3, 6.4, 6.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ChangeDetector } from '../../lib/repository/change-detector.js';
import { MetadataManager } from '../../lib/repository/metadata-manager.js';
import { StorageManager } from '../../lib/storage/storage-manager.js';

describe('ChangeDetector', () => {
  let tempDir;
  let testRepoPath;
  let changeDetector;
  let metadataManager;
  let repositoryId;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-temp-' + Date.now());
    testRepoPath = path.join(tempDir, 'test-repo');
    await fs.mkdir(testRepoPath, { recursive: true });

    // Setup storage and metadata managers
    const storageDir = path.join(tempDir, '.ziri');
    const storageManager = new StorageManager(storageDir);
    metadataManager = new MetadataManager(storageManager);
    
    // Create repository ID for testing
    repositoryId = 'test-repo-' + Date.now();
    await storageManager.createRepositoryStorage(repositoryId);

    changeDetector = new ChangeDetector(testRepoPath, metadataManager);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Hash Calculation', () => {
    it('should calculate SHA256 hash for a file', async () => {
      const testFile = path.join(testRepoPath, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(testFile, content);

      const hashInfo = await changeDetector.calculateFileHash(testFile);

      expect(hashInfo.hash).toBeDefined();
      expect(hashInfo.hash).toHaveLength(64); // SHA256 is 64 hex characters
      expect(hashInfo.size).toBe(content.length);
      expect(hashInfo.lastModified).toBeInstanceOf(Date);
      expect(hashInfo.path).toBe('test.txt');
    });

    it('should return consistent hash for same content', async () => {
      const testFile = path.join(testRepoPath, 'consistent.txt');
      const content = 'Consistent content';
      await fs.writeFile(testFile, content);

      const hash1 = await changeDetector.calculateFileHash(testFile);
      const hash2 = await changeDetector.calculateFileHash(testFile);

      expect(hash1.hash).toBe(hash2.hash);
    });

    it('should return different hash for different content', async () => {
      const testFile1 = path.join(testRepoPath, 'file1.txt');
      const testFile2 = path.join(testRepoPath, 'file2.txt');
      
      await fs.writeFile(testFile1, 'Content 1');
      await fs.writeFile(testFile2, 'Content 2');

      const hash1 = await changeDetector.calculateFileHash(testFile1);
      const hash2 = await changeDetector.calculateFileHash(testFile2);

      expect(hash1.hash).not.toBe(hash2.hash);
    });

    it('should handle file read errors gracefully', async () => {
      const nonExistentFile = path.join(testRepoPath, 'nonexistent.txt');

      await expect(changeDetector.calculateFileHash(nonExistentFile))
        .rejects.toThrow('Failed to calculate hash');
    });

    it('should cache hash results for performance', async () => {
      const testFile = path.join(testRepoPath, 'cached.txt');
      await fs.writeFile(testFile, 'Cached content');

      // First call should calculate hash
      const hash1 = await changeDetector.calculateFileHash(testFile);
      
      // Second call should use cache (same mtime and size)
      const hash2 = await changeDetector.calculateFileHash(testFile);

      expect(hash1.hash).toBe(hash2.hash);
      expect(changeDetector.hashCache.size).toBeGreaterThan(0);
    });
  });

  describe('Quick Change Detection', () => {
    it('should identify unchanged files without calculating hashes', async () => {
      const testFile = path.join(testRepoPath, 'unchanged.txt');
      const content = 'Unchanged content';
      await fs.writeFile(testFile, content);

      // Get file stats for stored hashes
      const stats = await fs.stat(testFile);
      const storedHashes = {
        'unchanged.txt': {
          hash: 'stored-hash',
          size: stats.size,
          lastModified: stats.mtime
        }
      };

      const result = await changeDetector.quickChangeDetection([testFile], storedHashes);

      expect(result.definitelyUnchanged).toHaveLength(1);
      expect(result.potentialChanges).toHaveLength(0);
      expect(result.newFiles).toHaveLength(0);
      expect(result.stats.quickCheckSkipped).toBe(1);
    });

    it('should identify potential changes when file stats differ', async () => {
      const testFile = path.join(testRepoPath, 'changed.txt');
      await fs.writeFile(testFile, 'Original content');

      // Create stored hash with different size
      const storedHashes = {
        'changed.txt': {
          hash: 'old-hash',
          size: 5, // Different from actual size
          lastModified: new Date('2020-01-01')
        }
      };

      const result = await changeDetector.quickChangeDetection([testFile], storedHashes);

      expect(result.potentialChanges).toHaveLength(1);
      expect(result.definitelyUnchanged).toHaveLength(0);
      expect(result.stats.hashCalculationRequired).toBe(1);
    });

    it('should identify new files', async () => {
      const testFile = path.join(testRepoPath, 'new.txt');
      await fs.writeFile(testFile, 'New file content');

      const storedHashes = {}; // No stored hashes

      const result = await changeDetector.quickChangeDetection([testFile], storedHashes);

      expect(result.newFiles).toHaveLength(1);
      expect(result.definitelyUnchanged).toHaveLength(0);
      expect(result.potentialChanges).toHaveLength(0);
    });

    it('should handle inaccessible files', async () => {
      const inaccessibleFile = path.join(testRepoPath, 'inaccessible.txt');
      
      const storedHashes = {
        'inaccessible.txt': {
          hash: 'old-hash',
          size: 100,
          lastModified: new Date()
        }
      };

      const result = await changeDetector.quickChangeDetection([inaccessibleFile], storedHashes);

      expect(result.potentialChanges).toHaveLength(1);
    });
  });

  describe('Comprehensive Change Detection', () => {
    it('should detect added files', async () => {
      // Create new files
      const newFile1 = path.join(testRepoPath, 'new1.txt');
      const newFile2 = path.join(testRepoPath, 'new2.txt');
      await fs.writeFile(newFile1, 'New content 1');
      await fs.writeFile(newFile2, 'New content 2');

      // Empty stored hashes (no previous files)
      await metadataManager.saveFileHashes(repositoryId, {});

      const changes = await changeDetector.detectChanges(repositoryId, [newFile1, newFile2]);

      expect(changes.added).toHaveLength(2);
      expect(changes.modified).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
      expect(changes.added[0].changeType).toBe('added');
      expect(changes.added[0].hash).toBeDefined();
    });

    it('should detect modified files', async () => {
      const testFile = path.join(testRepoPath, 'modified.txt');
      
      // Create initial file and store its hash
      await fs.writeFile(testFile, 'Original content');
      const originalHash = await changeDetector.calculateFileHash(testFile);
      
      await metadataManager.saveFileHashes(repositoryId, {
        'modified.txt': {
          hash: originalHash.hash,
          size: originalHash.size,
          lastModified: originalHash.lastModified
        }
      });

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Modify the file
      await fs.writeFile(testFile, 'Modified content');

      const changes = await changeDetector.detectChanges(repositoryId, [testFile]);

      expect(changes.modified).toHaveLength(1);
      expect(changes.added).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
      expect(changes.modified[0].changeType).toBe('modified');
      expect(changes.modified[0].previousHash).toBe(originalHash.hash);
      expect(changes.modified[0].hash).not.toBe(originalHash.hash);
    });

    it('should detect deleted files', async () => {
      // Store hash for a file that doesn't exist anymore
      await metadataManager.saveFileHashes(repositoryId, {
        'deleted.txt': {
          hash: 'deleted-file-hash',
          size: 100,
          lastModified: new Date()
        },
        'existing.txt': {
          hash: 'existing-file-hash',
          size: 50,
          lastModified: new Date()
        }
      });

      // Only create one of the files
      const existingFile = path.join(testRepoPath, 'existing.txt');
      await fs.writeFile(existingFile, 'Still exists');

      const changes = await changeDetector.detectChanges(repositoryId, [existingFile]);

      expect(changes.deleted).toHaveLength(1);
      expect(changes.deleted[0].changeType).toBe('deleted');
      expect(changes.deleted[0].path).toBe('deleted.txt');
      expect(changes.deleted[0].previousHash).toBe('deleted-file-hash');
    });

    it('should detect mixed changes (added, modified, deleted)', async () => {
      // Setup initial state
      const existingFile = path.join(testRepoPath, 'existing.txt');
      const modifiedFile = path.join(testRepoPath, 'modified.txt');
      
      await fs.writeFile(existingFile, 'Existing content');
      await fs.writeFile(modifiedFile, 'Original content');
      
      const existingHash = await changeDetector.calculateFileHash(existingFile);
      const originalModifiedHash = await changeDetector.calculateFileHash(modifiedFile);

      await metadataManager.saveFileHashes(repositoryId, {
        'existing.txt': {
          hash: existingHash.hash,
          size: existingHash.size,
          lastModified: existingHash.lastModified
        },
        'modified.txt': {
          hash: originalModifiedHash.hash,
          size: originalModifiedHash.size,
          lastModified: originalModifiedHash.lastModified
        },
        'deleted.txt': {
          hash: 'deleted-hash',
          size: 100,
          lastModified: new Date()
        }
      });

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Make changes
      await fs.writeFile(modifiedFile, 'Modified content'); // Modify
      const newFile = path.join(testRepoPath, 'new.txt');
      await fs.writeFile(newFile, 'New content'); // Add
      // deleted.txt is not created, so it's deleted

      const changes = await changeDetector.detectChanges(repositoryId, [
        existingFile, modifiedFile, newFile
      ]);

      expect(changes.added).toHaveLength(1);
      expect(changes.modified).toHaveLength(1);
      expect(changes.deleted).toHaveLength(1);
      expect(changes.unchanged).toHaveLength(1);

      expect(changes.added[0].path).toBe('new.txt');
      expect(changes.modified[0].path).toBe('modified.txt');
      expect(changes.deleted[0].path).toBe('deleted.txt');
      expect(changes.unchanged[0]).toBe('existing.txt');
    });

    it('should report progress during change detection', async () => {
      const testFiles = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testRepoPath, `file${i}.txt`);
        await fs.writeFile(filePath, `Content ${i}`);
        testFiles.push(filePath);
      }

      const progressReports = [];
      await changeDetector.detectChanges(repositoryId, testFiles, {
        onProgress: (progress) => progressReports.push(progress)
      });

      expect(progressReports.length).toBeGreaterThan(0);
      expect(progressReports.some(p => p.phase === 'quick_check')).toBe(true);
      expect(progressReports.some(p => p.phase === 'hashing')).toBe(true);
    });

    it('should use optimization by default', async () => {
      const testFile = path.join(testRepoPath, 'test.txt');
      await fs.writeFile(testFile, 'Test content');

      const changes = await changeDetector.detectChanges(repositoryId, [testFile]);

      expect(changes.stats.optimizationUsed).toBe(true);
      expect(changes.stats.hashCalculationsPerformed).toBeDefined();
      expect(changes.stats.hashCalculationsSkipped).toBeDefined();
    });

    it('should allow disabling optimization', async () => {
      const testFile = path.join(testRepoPath, 'test.txt');
      await fs.writeFile(testFile, 'Test content');

      const changes = await changeDetector.detectChanges(repositoryId, [testFile], {
        useOptimization: false
      });

      expect(changes.stats.optimizationUsed).toBe(false);
      expect(changes.stats.hashCalculationsSkipped).toBe(0);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup deleted files from metadata', async () => {
      // Initialize metadata first
      await metadataManager.initializeRepository(repositoryId, testRepoPath);
      
      // Setup initial hashes
      await metadataManager.saveFileHashes(repositoryId, {
        'file1.txt': { hash: 'hash1', size: 100, lastModified: new Date() },
        'file2.txt': { hash: 'hash2', size: 200, lastModified: new Date() },
        'deleted.txt': { hash: 'deleted-hash', size: 150, lastModified: new Date() }
      });

      const deletedFiles = [
        { path: 'deleted.txt', changeType: 'deleted', previousHash: 'deleted-hash' }
      ];

      const result = await changeDetector.cleanupDeletedFiles(repositoryId, deletedFiles);

      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify file was removed from hashes
      const updatedHashes = await metadataManager.loadFileHashes(repositoryId);
      expect(updatedHashes['deleted.txt']).toBeUndefined();
      expect(updatedHashes['file1.txt']).toBeDefined();
      expect(updatedHashes['file2.txt']).toBeDefined();
    });

    it('should handle cleanup with no deleted files', async () => {
      const result = await changeDetector.cleanupDeletedFiles(repositoryId, []);

      expect(result.cleaned).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update metadata after cleanup', async () => {
      // Initialize metadata first
      await metadataManager.initializeRepository(repositoryId, testRepoPath);
      
      await metadataManager.saveFileHashes(repositoryId, {
        'deleted.txt': { hash: 'deleted-hash', size: 100, lastModified: new Date() }
      });

      const deletedFiles = [
        { path: 'deleted.txt', changeType: 'deleted', previousHash: 'deleted-hash' }
      ];

      await changeDetector.cleanupDeletedFiles(repositoryId, deletedFiles);

      const metadata = await metadataManager.loadMetadata(repositoryId);
      expect(metadata.lastCleanup).toBeInstanceOf(Date);
      expect(metadata.filesDeleted).toBe(1);
    });
  });

  describe('Validation and Statistics', () => {
    it('should validate change detection accuracy', async () => {
      // Create test files and store their hashes
      const testFiles = [];
      const storedHashes = {};
      
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(testRepoPath, `validate${i}.txt`);
        const content = `Validation content ${i}`;
        await fs.writeFile(filePath, content);
        
        const hashInfo = await changeDetector.calculateFileHash(filePath);
        storedHashes[`validate${i}.txt`] = {
          hash: hashInfo.hash,
          size: hashInfo.size,
          lastModified: hashInfo.lastModified
        };
        testFiles.push(filePath);
      }

      await metadataManager.saveFileHashes(repositoryId, storedHashes);

      const validation = await changeDetector.validateChangeDetection(repositoryId, 2);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.sampleSize).toBe(2);
      expect(validation.totalFiles).toBe(3);
    });

    it('should detect validation errors when files have changed', async () => {
      // Create file and store old hash
      const testFile = path.join(testRepoPath, 'changed.txt');
      await fs.writeFile(testFile, 'Original content');
      
      await metadataManager.saveFileHashes(repositoryId, {
        'changed.txt': {
          hash: 'old-hash-that-wont-match',
          size: 100,
          lastModified: new Date()
        }
      });

      const validation = await changeDetector.validateChangeDetection(repositoryId, 1);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].issue).toBe('hash_mismatch');
    });

    it('should return statistics about change detection', async () => {
      // Setup some tracked files
      await metadataManager.saveFileHashes(repositoryId, {
        'file1.txt': { hash: 'hash1', size: 100, lastModified: new Date() },
        'file2.txt': { hash: 'hash2', size: 200, lastModified: new Date() }
      });

      await metadataManager.saveMetadata(repositoryId, {
        repositoryId,
        repositoryPath: testRepoPath,
        lastIndexed: new Date(),
        lastCleanup: new Date(),
        totalChunks: 0,
        embeddingProvider: 'test',
        version: '1.0.0'
      });

      const stats = await changeDetector.getChangeDetectionStats(repositoryId);

      expect(stats.trackedFiles).toBe(2);
      expect(stats.lastIndexed).toBeInstanceOf(Date);
      // lastCleanup might be undefined if no cleanup has occurred
      if (stats.lastCleanup) {
        expect(stats.lastCleanup).toBeInstanceOf(Date);
      }
      expect(stats.cacheSize).toBeDefined();
      expect(stats.cacheHitRate).toBeDefined();
    });

    it('should clear caches', () => {
      // Add something to cache first
      changeDetector.hashCache.set('test', { hash: 'test' });
      expect(changeDetector.hashCache.size).toBeGreaterThan(0);

      changeDetector.clearCaches();

      expect(changeDetector.hashCache.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle metadata loading errors gracefully', async () => {
      // Use non-existent repository ID
      const invalidRepoId = 'nonexistent-repo';

      const changes = await changeDetector.detectChanges(invalidRepoId, []);

      expect(changes.added).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
    });

    it('should skip files that cannot be read during hash calculation', async () => {
      const validFile = path.join(testRepoPath, 'valid.txt');
      const invalidFile = path.join(testRepoPath, 'nonexistent.txt');
      
      await fs.writeFile(validFile, 'Valid content');

      // This should not throw, but should skip the invalid file
      const changes = await changeDetector.detectChanges(repositoryId, [validFile, invalidFile]);

      expect(changes.added).toHaveLength(1); // Only valid file should be processed
      expect(changes.added[0].path).toBe('valid.txt');
    });

    it('should handle cleanup errors gracefully', async () => {
      // Try to cleanup with invalid repository ID
      const deletedFiles = [
        { path: 'test.txt', changeType: 'deleted', previousHash: 'hash' }
      ];

      const result = await changeDetector.cleanupDeletedFiles('invalid-repo', deletedFiles);

      expect(result.cleaned).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});