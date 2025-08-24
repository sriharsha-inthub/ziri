import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RepositoryParser } from '../../lib/repository/repository-parser.js';
import { ChangeDetector } from '../../lib/repository/change-detector.js';
import { MetadataManager } from '../../lib/repository/metadata-manager.js';
import { StorageManager } from '../../lib/storage/storage-manager.js';

describe('RepositoryParser', () => {
  let tempDir;
  let repositoryParser;
  let changeDetector;
  let repositoryId;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-temp-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // Setup change detector for tests that need it
    const storageDir = path.join(tempDir, '.ziri');
    const storageManager = new StorageManager(storageDir);
    const metadataManager = new MetadataManager(storageManager);
    changeDetector = new ChangeDetector(tempDir, metadataManager);
    repositoryId = 'test-repo-' + Date.now();
    await storageManager.createRepositoryStorage(repositoryId);
    
    repositoryParser = new RepositoryParser({
      changeDetector: changeDetector
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('discoverFiles', () => {
    it('should discover files using file walker', async () => {
      await fs.writeFile(path.join(tempDir, 'test1.js'), 'console.log("test1");');
      await fs.writeFile(path.join(tempDir, 'test2.ts'), 'console.log("test2");');
      
      const files = [];
      for await (const file of repositoryParser.discoverFiles(tempDir)) {
        files.push(file);
      }

      expect(files).toHaveLength(2);
      expect(files.some(f => f.relativePath === 'test1.js')).toBe(true);
      expect(files.some(f => f.relativePath === 'test2.ts')).toBe(true);
    });
  });

  describe('detectChanges', () => {
    it('should detect added files', async () => {
      // Add files
      await fs.writeFile(path.join(tempDir, 'new.js'), 'console.log("new");');
      
      const changes = [];
      for await (const change of repositoryParser.detectChanges(tempDir, repositoryId)) {
        changes.push(change);
      }

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('added');
      expect(changes[0].path).toBe('new.js');
      expect(changes[0].hash).toBeDefined();
    });

    it('should detect modified files', async () => {
      // Create file
      const filePath = path.join(tempDir, 'modified.js');
      await fs.writeFile(filePath, 'console.log("original");');
      
      // Store initial hash
      const hashInfo = await changeDetector.calculateFileHash(filePath);
      await changeDetector.metadataManager.saveFileHashes(repositoryId, {
        'modified.js': {
          hash: hashInfo.hash,
          size: hashInfo.size,
          lastModified: hashInfo.lastModified
        }
      });

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Modify file
      await fs.writeFile(filePath, 'console.log("modified");');
      
      const changes = [];
      for await (const change of repositoryParser.detectChanges(tempDir, repositoryId)) {
        changes.push(change);
      }

      const modifiedChanges = changes.filter(c => c.changeType === 'modified');
      expect(modifiedChanges).toHaveLength(1);
      expect(modifiedChanges[0].path).toBe('modified.js');
      expect(modifiedChanges[0].hash).not.toBe(hashInfo.hash);
      expect(modifiedChanges[0].previousHash).toBe(hashInfo.hash);
    });

    it('should detect deleted files', async () => {
      // Store hash for a file that doesn't exist
      await changeDetector.metadataManager.saveFileHashes(repositoryId, {
        'deleted.js': {
          hash: 'some-hash',
          size: 100,
          lastModified: new Date()
        }
      });

      const changes = [];
      for await (const change of repositoryParser.detectChanges(tempDir, repositoryId)) {
        changes.push(change);
      }

      const deletedChanges = changes.filter(c => c.changeType === 'deleted');
      expect(deletedChanges).toHaveLength(1);
      expect(deletedChanges[0].path).toBe('deleted.js');
      expect(deletedChanges[0].previousHash).toBe('some-hash');
    });
  });

  describe('chunkFile', () => {
    it('should chunk a file into text segments', async () => {
      const content = 'A'.repeat(8000); // Large content to ensure chunking
      const filePath = path.join(tempDir, 'large.txt');
      await fs.writeFile(filePath, content);
      
      const chunks = [];
      for await (const chunk of repositoryParser.chunkFile(filePath)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content).toBeDefined();
      expect(chunks[0].filePath).toBe(filePath);
      expect(chunks[0].chunkId).toBeDefined();
    });

    it('should skip non-readable files', async () => {
      const binaryPath = path.join(tempDir, 'binary.bin');
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await fs.writeFile(binaryPath, binaryContent);
      
      const chunks = [];
      for await (const chunk of repositoryParser.chunkFile(binaryPath)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });

    it('should skip empty files', async () => {
      const emptyPath = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyPath, '');
      
      const chunks = [];
      for await (const chunk of repositoryParser.chunkFile(emptyPath)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });
  });

  describe('processFile', () => {
    it('should process file info and return chunks', async () => {
      const content = 'console.log("test");\nconsole.log("more content");';
      const filePath = path.join(tempDir, 'process.js');
      await fs.writeFile(filePath, content);
      
      const fileInfo = {
        path: filePath,
        relativePath: 'process.js',
        size: content.length,
        hash: 'test-hash'
      };
      
      const chunks = [];
      for await (const chunk of repositoryParser.processFile(fileInfo)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].relativePath).toBe('process.js');
    });
  });

  describe('streamRepositoryChunks', () => {
    it('should stream all chunks from repository', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'console.log("file1");');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("file2");');
      
      const chunks = [];
      const files = [];
      
      for await (const chunk of repositoryParser.streamRepositoryChunks(tempDir, {
        onFileStart: (fileInfo) => files.push(fileInfo),
        onChunk: (chunk) => { /* track chunks */ }
      })) {
        chunks.push(chunk);
      }

      expect(files).toHaveLength(2);
      expect(chunks).toHaveLength(2);
      expect(chunks.some(c => c.content.includes('file1'))).toBe(true);
      expect(chunks.some(c => c.content.includes('file2'))).toBe(true);
    });

    it('should call progress callbacks', async () => {
      await fs.writeFile(path.join(tempDir, 'callback-test.js'), 'console.log("test");');
      
      let fileStartCalled = false;
      let chunkCalled = false;
      let fileCompleteCalled = false;
      let completeCalled = false;
      
      const chunks = [];
      for await (const chunk of repositoryParser.streamRepositoryChunks(tempDir, {
        onFileStart: () => { fileStartCalled = true; },
        onChunk: () => { chunkCalled = true; },
        onFileComplete: () => { fileCompleteCalled = true; },
        onComplete: () => { completeCalled = true; }
      })) {
        chunks.push(chunk);
      }

      expect(fileStartCalled).toBe(true);
      expect(chunkCalled).toBe(true);
      expect(fileCompleteCalled).toBe(true);
      expect(completeCalled).toBe(true);
    });
  });

  describe('getRepositoryStats', () => {
    it('should return repository statistics', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'text.js'), 'console.log("text");');
      await fs.writeFile(path.join(tempDir, 'text.py'), 'print("python")');
      
      // Use a non-excluded binary extension
      const binaryPath = path.join(tempDir, 'data.dat');
      await fs.writeFile(binaryPath, Buffer.from([0x00, 0x01, 0x02]));
      
      const stats = await repositoryParser.getRepositoryStats(tempDir);

      expect(stats.fileCount).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.textFiles).toBe(2);
      expect(stats.binaryFiles).toBe(1);
      expect(stats.extensions['.js']).toBe(1);
      expect(stats.extensions['.py']).toBe(1);
      expect(stats.extensions['.dat']).toBe(1);
      expect(stats.averageFileSize).toBeGreaterThan(0);
    });

    it('should handle empty repositories', async () => {
      const stats = await repositoryParser.getRepositoryStats(tempDir);

      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.textFiles).toBe(0);
      expect(stats.binaryFiles).toBe(0);
      expect(stats.averageFileSize).toBe(0);
    });

    it('should respect exclusion patterns in stats', async () => {
      // Create files that should be excluded
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'include.js'), 'console.log("include");');
      await fs.writeFile(path.join(tempDir, 'node_modules', 'exclude.js'), 'console.log("exclude");');
      
      const stats = await repositoryParser.getRepositoryStats(tempDir);

      expect(stats.fileCount).toBe(1); // Only include.js should be counted
    });
  });
});