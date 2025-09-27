/**
 * Tests for parallel file system walk implementation
 */

import { ParallelWalker, parallelWalk, parallelWalkWithProgress } from './parallel-walk.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ParallelWalker', () => {
  let testDir;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp('ziri-test-');
    
    // Create test directory structure
    await fs.mkdir(path.join(testDir, 'dir1'));
    await fs.mkdir(path.join(testDir, 'dir2'));
    await fs.mkdir(path.join(testDir, 'dir1', 'subdir'));
    
    // Create test files
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
    await fs.writeFile(path.join(testDir, 'dir1', 'file3.txt'), 'content3');
    await fs.writeFile(path.join(testDir, 'dir1', 'subdir', 'file4.txt'), 'content4');
    await fs.writeFile(path.join(testDir, 'dir2', 'file5.txt'), 'content5');
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (testDir && testDir.startsWith('/tmp/ziri-test-')) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  describe('constructor', () => {
    it('should create walker with default options', () => {
      const walker = new ParallelWalker();
      expect(walker.concurrency).toBe(4);
      expect(walker.bufferSize).toBe(100);
    });
    
    it('should create walker with custom options', () => {
      const walker = new ParallelWalker({
        concurrency: 8,
        bufferSize: 50
      });
      expect(walker.concurrency).toBe(8);
      expect(walker.bufferSize).toBe(50);
    });
  });
  
  describe('isExcluded', () => {
    it('should exclude node_modules', () => {
      const walker = new ParallelWalker();
      expect(walker.isExcluded('node_modules/some-package/index.js')).toBe(true);
    });
    
    it('should exclude .git directories', () => {
      const walker = new ParallelWalker();
      expect(walker.isExcluded('.git/config')).toBe(true);
    });
    
    it('should not exclude regular files', () => {
      const walker = new ParallelWalker();
      expect(walker.isExcluded('src/index.js')).toBe(false);
    });
  });
  
  describe('simpleWalk', () => {
    it('should walk directory tree and return all files', async () => {
      const walker = new ParallelWalker();
      const files = [];
      
      for await (const entry of walker.simpleWalk(testDir)) {
        files.push(entry);
      }
      
      expect(files).toHaveLength(5);
      
      const filePaths = files.map(f => f.rel).sort();
      expect(filePaths).toEqual([
        'dir1/file3.txt',
        'dir1/subdir/file4.txt',
        'dir2/file5.txt',
        'file1.txt',
        'file2.txt'
      ]);
    });
    
    it('should respect exclude patterns', async () => {
      // Create excluded directory
      await fs.mkdir(path.join(testDir, 'node_modules'));
      await fs.writeFile(path.join(testDir, 'node_modules', 'package.js'), 'content');
      
      const walker = new ParallelWalker();
      const files = [];
      
      for await (const entry of walker.simpleWalk(testDir)) {
        files.push(entry);
      }
      
      // Should not include node_modules files
      const filePaths = files.map(f => f.rel);
      expect(filePaths).not.toContain('node_modules/package.js');
    });
  });
});

describe('parallelWalk', () => {
  let testDir;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp('ziri-test-');
    
    // Create test files
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (testDir && testDir.startsWith('/tmp/ziri-test-')) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  it('should walk directory and return files', async () => {
    const files = [];
    
    for await (const entry of parallelWalk(testDir)) {
      files.push(entry);
    }
    
    expect(files).toHaveLength(2);
    
    const filePaths = files.map(f => f.rel).sort();
    expect(filePaths).toEqual(['file1.txt', 'file2.txt']);
  });
  
  it('should respect custom concurrency', async () => {
    const files = [];
    
    for await (const entry of parallelWalk(testDir, { concurrency: 2 })) {
      files.push(entry);
    }
    
    expect(files).toHaveLength(2);
  });
});

describe('parallelWalkWithProgress', () => {
  let testDir;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp('ziri-test-');
    
    // Create test files
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (testDir && testDir.startsWith('/tmp/ziri-test-')) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  it('should report progress', async () => {
    const files = [];
    const progressReports = [];
    
    const onProgress = (count) => {
      progressReports.push(count);
    };
    
    for await (const entry of parallelWalkWithProgress(testDir, {}, onProgress)) {
      files.push(entry);
    }
    
    expect(files).toHaveLength(2);
    expect(progressReports.length).toBeGreaterThan(0);
  });
});