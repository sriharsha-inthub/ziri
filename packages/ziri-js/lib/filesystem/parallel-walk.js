/**
 * Parallel file system walk implementation
 * Optimized directory traversal using worker pools
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// Import existing exclusion patterns
import { EX as EXCLUDE_PATTERNS, RX as EXCLUDE_REGEX } from '../filewalk.js';

/**
 * Parallel directory walker with configurable concurrency
 */
export class ParallelWalker {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.concurrency - Number of concurrent workers (default: 4)
   * @param {number} options.bufferSize - Size of result buffer (default: 100)
   * @param {Array<string>} options.excludePatterns - Additional patterns to exclude
   */
  constructor(options = {}) {
    this.concurrency = options.concurrency || 4;
    this.bufferSize = options.bufferSize || 100;
    this.excludePatterns = options.excludePatterns || [];
    this.excludeRegex = [...EXCLUDE_REGEX, ...this.excludePatterns.map(pattern => this.toRegex(pattern))];
  }

  /**
   * Convert glob pattern to regex
   * @param {string} pattern - Glob pattern
   * @returns {RegExp} Regex pattern
   */
  toRegex(pattern) {
    // First replace ** with a placeholder to avoid conflicts
    let s = pattern.replace(/\*\*/g, '__DOUBLESTAR__');
    // Replace single * with placeholder
    s = s.replace(/\*/g, '__SINGLESTAR__');
    // Escape special regex characters
    s = s.replace(/[.+^${}()|[\]\\]/g, '\\$&'); 
    // Convert glob patterns to regex
    s = s.replace(/__DOUBLESTAR__/g, '.*').replace(/__SINGLESTAR__/g, '[^/]*').replace(/\?/g, '.'); 
    return new RegExp('^' + s + '$');
  }

  /**
   * Check if path should be excluded
   * @param {string} relativePath - Relative path to check
   * @returns {boolean} True if path should be excluded
   */
  isExcluded(relativePath) {
    return this.excludeRegex.some(r => r.test(relativePath));
  }

  /**
   * Walk directory tree in parallel
   * @param {string} root - Root directory to walk
   * @returns {AsyncGenerator<{full: string, rel: string}, void, void>} File entries
   */
  async *walk(root) {
    // Delegate to simpleWalk for now
    yield* this.simpleWalk(root);
  }

  /**
   * Simple parallel walk with basic concurrency
   * @param {string} root - Root directory to walk
   * @returns {AsyncGenerator<{full: string, rel: string}, void, void>} File entries
   */
  async *simpleWalk(root) {
    const queue = [root];
    
    while (queue.length > 0) {
      // Process directories in batches
      const batch = queue.splice(0, this.concurrency);
      const promises = batch.map(dir => this.processDirectory(dir, root, queue));
      
      // Wait for batch to complete
      const results = await Promise.all(promises);
      
      // Flatten and yield results
      for (const result of results) {
        if (result && Array.isArray(result)) {
          for (const entry of result) {
            yield entry;
          }
        }
      }
    }
  }

  /**
   * Process a single directory
   * @param {string} dir - Directory to process
   * @param {string} root - Root directory
   * @param {Array} queue - Queue to add subdirectories
   * @returns {Promise<Array<{full: string, rel: string}>>} File entries
   */
  async processDirectory(dir, root, queue) {
    const results = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(root, full).replace(/\\/g, '/');
        
        // Check if this path should be excluded
        if (this.isExcluded(rel)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Add directory to queue for processing
          queue.push(full);
        } else if (entry.isFile()) {
          // Add file to results
          results.push({ full, rel });
        }
      }
    } catch (error) {
      // Log error but continue processing
      console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
    }
    return results;
  }
}

/**
 * Walk directory tree in parallel with configurable options
 * @param {string} root - Root directory to walk
 * @param {Object} options - Configuration options
 * @returns {AsyncGenerator<{full: string, rel: string}, void, void>} File entries
 */
export async function* parallelWalk(root, options = {}) {
  const walker = new ParallelWalker(options);
  yield* walker.simpleWalk(root);
}

/**
 * Enhanced parallel walk with progress reporting
 * @param {string} root - Root directory to walk
 * @param {Object} options - Configuration options
 * @param {Function} onProgress - Progress callback function
 * @returns {AsyncGenerator<{full: string, rel: string}, void, void>} File entries
 */
export async function* parallelWalkWithProgress(root, options = {}, onProgress) {
  const walker = new ParallelWalker(options);
  let fileCount = 0;
  
  for await (const entry of walker.simpleWalk(root)) {
    fileCount++;
    if (onProgress && fileCount % 100 === 0) {
      onProgress(fileCount);
    }
    yield entry;
  }
  
  if (onProgress) {
    onProgress(fileCount);
  }
}