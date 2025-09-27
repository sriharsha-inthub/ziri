/**
 * AST Performance Optimization System
 * Provides caching, incremental parsing, and memory management for AST operations
 */

import { createHash } from 'crypto';

export class ASTPerformanceOptimizer {
  constructor() {
    this.astCache = new Map();
    this.fileHashes = new Map();
    this.parseCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.maxCacheSize = 1000; // Maximum number of cached ASTs
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB memory threshold
  }

  /**
   * Get or create cached AST for a file
   */
  async getCachedAST(content, filePath, language, parserFn) {
    const fileHash = this.generateFileHash(content, filePath);
    
    // Check if file has changed
    if (this.fileHashes.get(filePath) === fileHash && this.astCache.has(filePath)) {
      this.cacheHits++;
      return this.astCache.get(filePath);
    }

    // File has changed or not cached, parse it
    this.cacheMisses++;
    const startTime = performance.now();
    
    try {
      const ast = await parserFn(content, filePath, language);
      const parseTime = performance.now() - startTime;
      
      // Cache the result
      this.cacheAST(filePath, fileHash, ast);
      
      this.parseCount++;
      return ast;
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Cache AST with memory management
   */
  cacheAST(filePath, fileHash, ast) {
    // Check memory usage and clean up if needed
    this.checkMemoryUsage();
    
    // Remove oldest entries if cache is full
    if (this.astCache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }
    
    // Store the cached AST
    this.astCache.set(filePath, {
      ast: ast,
      hash: fileHash,
      timestamp: Date.now(),
      size: this.estimateASTSize(ast)
    });
    
    this.fileHashes.set(filePath, fileHash);
  }

  /**
   * Perform incremental AST parsing for changed files
   */
  async incrementalParse(content, filePath, language, parserFn, oldContent = null) {
    if (!oldContent) {
      // No old content, do full parse
      return await this.getCachedAST(content, filePath, language, parserFn);
    }

    const oldHash = this.generateFileHash(oldContent, filePath);
    const newHash = this.generateFileHash(content, filePath);
    
    if (oldHash === newHash) {
      // File hasn't changed, return cached AST
      return this.getCachedAST(content, filePath, language, parserFn);
    }

    // File has changed, try incremental update
    const changes = this.detectChanges(oldContent, content);
    
    if (changes.isMinor) {
      // Minor changes, try to update existing AST
      return await this.updateASTIncrementally(
        this.astCache.get(filePath)?.ast, 
        changes, 
        content, 
        filePath, 
        language, 
        parserFn
      );
    } else {
      // Major changes, do full reparse
      return await this.getCachedAST(content, filePath, language, parserFn);
    }
  }

  /**
   * Detect changes between old and new content
   */
  detectChanges(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const changes = {
      addedLines: [],
      removedLines: [],
      modifiedLines: [],
      isMinor: true
    };

    // Find differences
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (!oldLine && newLine) {
        changes.addedLines.push(i);
      } else if (oldLine && !newLine) {
        changes.removedLines.push(i);
      } else if (oldLine !== newLine) {
        changes.modifiedLines.push(i);
      }
    }

    // Determine if changes are minor
    const totalChanges = changes.addedLines.length + 
                        changes.removedLines.length + 
                        changes.modifiedLines.length;
    
    const changeRatio = totalChanges / Math.max(oldLines.length, newLines.length);
    
    // Consider changes minor if less than 20% of file changed
    changes.isMinor = changeRatio < 0.2 && totalChanges < 50;
    
    return changes;
  }

  /**
   * Update AST incrementally (simplified implementation)
   */
  async updateASTIncrementally(oldAST, changes, newContent, filePath, language, parserFn) {
    if (!oldAST) {
      // No existing AST, do full parse
      return await this.getCachedAST(newContent, filePath, language, parserFn);
    }

    // For now, we'll do a full reparse
    // In a more sophisticated implementation, we would:
    // 1. Apply changes to the existing AST
    // 2. Update only affected nodes
    // 3. Rebuild only modified parts of the AST
    
    return await this.getCachedAST(newContent, filePath, language, parserFn);
  }

  /**
   * Generate file hash for change detection
   */
  generateFileHash(content, filePath) {
    const hash = createHash('sha256');
    hash.update(content);
    hash.update(filePath); // Include filePath in hash to avoid collisions
    return hash.digest('hex');
  }

  /**
   * Estimate AST size in bytes
   */
  estimateASTSize(ast) {
    // Simple estimation based on JSON stringification
    try {
      return JSON.stringify(ast).length * 2; // Rough estimate of memory usage
    } catch {
      return 1024; // Default 1KB estimate
    }
  }

  /**
   * Check memory usage and clean up if needed
   */
  checkMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      const heapUsed = memoryUsage.heapUsed;
      
      if (heapUsed > this.memoryThreshold) {
        console.warn('Memory threshold exceeded, cleaning up AST cache');
        this.evictLeastRecentlyUsed();
      }
    }
  }

  /**
   * Evict oldest entries from cache
   */
  evictOldestEntries() {
    const entries = Array.from(this.astCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove 20% of oldest entries
    const removeCount = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < removeCount; i++) {
      const [filePath] = entries[i];
      this.astCache.delete(filePath);
      this.fileHashes.delete(filePath);
    }
  }

  /**
   * Evict least recently used entries
   */
  evictLeastRecentlyUsed() {
    const entries = Array.from(this.astCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove 30% of LRU entries
    const removeCount = Math.ceil(entries.length * 0.3);
    for (let i = 0; i < removeCount; i++) {
      const [filePath] = entries[i];
      this.astCache.delete(filePath);
      this.fileHashes.delete(filePath);
    }
  }

  /**
   * Clear all cached ASTs
   */
  clearCache() {
    this.astCache.clear();
    this.fileHashes.clear();
    this.parseCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
    
    const totalCacheSize = Array.from(this.astCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    return {
      parseCount: this.parseCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: hitRate.toFixed(2) + '%',
      cachedFiles: this.astCache.size,
      totalCacheSize: this.formatBytes(totalCacheSize),
      maxCacheSize: this.maxCacheSize,
      memoryThreshold: this.formatBytes(this.memoryThreshold)
    };
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate cached AST integrity
   */
  validateCache() {
    const invalidEntries = [];
    
    for (const [filePath, entry] of this.astCache.entries()) {
      try {
        // Try to access the AST to ensure it's valid
        if (!entry.ast || typeof entry.ast !== 'object') {
          invalidEntries.push(filePath);
        }
      } catch (error) {
        invalidEntries.push(filePath);
      }
    }
    
    // Remove invalid entries
    for (const filePath of invalidEntries) {
      this.astCache.delete(filePath);
      this.fileHashes.delete(filePath);
    }
    
    return {
      validatedFiles: this.astCache.size,
      removedInvalidFiles: invalidEntries.length
    };
  }
}

/**
 * Parallel AST Parser for processing multiple files concurrently
 */
export class ParallelASTParser {
  constructor(maxConcurrency = 4) {
    this.maxConcurrency = maxConcurrency;
    this.optimizer = new ASTPerformanceOptimizer();
  }

  /**
   * Parse multiple files in parallel
   */
  async parseFiles(files, parserFn) {
    const results = new Map();
    const chunks = this.chunkArray(files, this.maxConcurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async ({ filePath, content, language }) => {
        try {
          const ast = await this.optimizer.getCachedAST(
            content, 
            filePath, 
            language, 
            parserFn
          );
          return { filePath, ast, error: null };
        } catch (error) {
          return { filePath, ast: null, error: error.message };
        }
      });
      
      const chunkResults = await Promise.all(promises);
      
      for (const result of chunkResults) {
        results.set(result.filePath, result);
      }
    }
    
    return results;
  }

  /**
   * Split array into chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return this.optimizer.getStats();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.optimizer.clearCache();
  }
}

// Create singleton instances
export const astPerformanceOptimizer = new ASTPerformanceOptimizer();
export const parallelASTParser = new ParallelASTParser();

export default ASTPerformanceOptimizer;
