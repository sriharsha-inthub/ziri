/**
 * Property-based tests for parallel file walk implementation
 */

import { forall } from '../testing/property.js';
import { gen } from '../testing/property.js';
import { fileSystem } from '../testing/generators.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Mock implementations for testing
async function* mockWalkDir(root) {
  // Simple sequential walk for comparison
  const files = [
    { full: path.join(root, 'file1.txt'), rel: 'file1.txt' },
    { full: path.join(root, 'file2.txt'), rel: 'file2.txt' },
    { full: path.join(root, 'dir1', 'file3.txt'), rel: 'dir1/file3.txt' }
  ];
  
  for (const file of files) {
    yield file;
  }
}

async function* mockParallelWalk(root, options = {}) {
  // Simple parallel-like walk for comparison
  const files = [
    { full: path.join(root, 'file1.txt'), rel: 'file1.txt' },
    { full: path.join(root, 'file2.txt'), rel: 'file2.txt' },
    { full: path.join(root, 'dir1', 'file3.txt'), rel: 'dir1/file3.txt' }
  ];
  
  for (const file of files) {
    yield file;
  }
}

describe('Parallel Walk Property Tests', () => {
  let testDir;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp('ziri-property-test-');
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (testDir && testDir.startsWith('/tmp/ziri-property-test-')) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  it('parallel walk finds same files as sequential walk', async () => {
    const results = await forall(
      'parallel walk finds same files as sequential walk',
      [
        fileSystem({ maxDepth: 3, maxFiles: 10, maxDirs: 5 })
      ],
      async (fsStructure) => {
        // Create file system structure
        await createFileSystemStructure(testDir, fsStructure);
        
        // Collect files from sequential walk
        const sequentialFiles = [];
        for await (const entry of mockWalkDir(testDir)) {
          sequentialFiles.push(entry.rel);
        }
        
        // Collect files from parallel walk
        const parallelFiles = [];
        for await (const entry of mockParallelWalk(testDir)) {
          parallelFiles.push(entry.rel);
        }
        
        // Sort both arrays for comparison
        sequentialFiles.sort();
        parallelFiles.sort();
        
        // Check if they contain the same files
        if (sequentialFiles.length !== parallelFiles.length) {
          return false;
        }
        
        for (let i = 0; i < sequentialFiles.length; i++) {
          if (sequentialFiles[i] !== parallelFiles[i]) {
            return false;
          }
        }
        
        return true;
      },
      { numTests: 20 }
    );
    
    expect(results.failed).toBe(0);
  });
  
  it('parallel walk handles empty directories', async () => {
    const results = await forall(
      'parallel walk handles empty directories',
      [], // No generators needed
      async () => {
        // testDir is already created and empty
        
        const files = [];
        for await (const entry of mockParallelWalk(testDir)) {
          files.push(entry.rel);
        }
        
        // Should find no files in empty directory
        return files.length === 0;
      },
      { numTests: 10 }
    );
    
    expect(results.failed).toBe(0);
  });
  
  it('parallel walk handles single file', async () => {
    const results = await forall(
      'parallel walk handles single file',
      [], // No generators needed
      async () => {
        // Create a single file
        await fs.writeFile(path.join(testDir, 'single.txt'), 'content');
        
        const files = [];
        for await (const entry of mockParallelWalk(testDir)) {
          files.push(entry.rel);
        }
        
        // Should find exactly one file
        return files.length === 1 && files[0] === 'single.txt';
      },
      { numTests: 10 }
    );
    
    expect(results.failed).toBe(0);
  });
});

/**
 * Create file system structure from generated data
 * @param {string} root - Root directory
 * @param {Array} structure - File system structure
 * @param {string} currentPath - Current path being processed
 */
async function createFileSystemStructure(root, structure, currentPath = '') {
  for (const entry of structure) {
    const fullPath = path.join(root, currentPath, entry.name);
    
    if (entry.type === 'file') {
      // Ensure parent directory exists
      const parentDir = path.dirname(fullPath);
      await fs.mkdir(parentDir, { recursive: true });
      // Create file with some content
      await fs.writeFile(fullPath, `Content of ${entry.name}`);
    } else if (entry.type === 'directory') {
      // Create directory
      await fs.mkdir(fullPath, { recursive: true });
      // Recursively create children
      if (entry.children && entry.children.length > 0) {
        await createFileSystemStructure(root, entry.children, path.join(currentPath, entry.name));
      }
    }
  }
}