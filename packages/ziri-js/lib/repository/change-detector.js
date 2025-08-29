/**
 * Change Detection System
 * Implements comprehensive file change detection using hashes and timestamps
 * Requirements: 1.5, 6.3, 6.4, 6.6
 */

import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { relative, join } from 'path';

export class ChangeDetector {
  constructor(repositoryPath, metadataManager) {
    this.repositoryPath = repositoryPath;
    this.metadataManager = metadataManager;
    this.hashCache = new Map();
    this.statCache = new Map();
  }

  /**
   * Calculate SHA256 hash for a file with caching
   */
  async calculateFileHash(filePath) {
    const relativePath = relative(this.repositoryPath, filePath);
    
    try {
      // Check if we have a cached hash that's still valid
      const cachedHash = await this._getCachedHash(filePath, relativePath);
      if (cachedHash) {
        return cachedHash;
      }

      // Calculate new hash
      const content = await readFile(filePath);
      const stats = await stat(filePath);
      const hash = createHash('sha256').update(content).digest('hex');
      
      const hashInfo = {
        hash,
        size: stats.size,
        lastModified: stats.mtime,
        path: relativePath
      };

      // Cache the result
      this.hashCache.set(relativePath, hashInfo);
      
      return hashInfo;
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get cached hash if still valid based on file stats
   */
  async _getCachedHash(filePath, relativePath) {
    const cached = this.hashCache.get(relativePath);
    if (!cached) {
      return null;
    }

    try {
      const stats = await stat(filePath);
      
      // Check if file hasn't changed based on size and modification time
      if (stats.size === cached.size && 
          stats.mtime.getTime() === cached.lastModified.getTime()) {
        return cached;
      }
    } catch {
      // File might be deleted, remove from cache
      this.hashCache.delete(relativePath);
    }

    return null;
  }

  /**
   * Perform quick change detection using file stats before calculating hashes
   */
  async quickChangeDetection(filePaths, storedHashes) {
    const results = {
      definitelyUnchanged: [],
      potentialChanges: [],
      newFiles: [],
      stats: {
        totalFiles: filePaths.length,
        quickCheckSkipped: 0,
        hashCalculationRequired: 0
      }
    };

    for (const filePath of filePaths) {
      const relativePath = relative(this.repositoryPath, filePath);
      const storedInfo = storedHashes[relativePath];
      
      if (!storedInfo) {
        // New file - needs hash calculation
        results.newFiles.push(filePath);
        results.stats.hashCalculationRequired++;
        continue;
      }

      try {
        const stats = await stat(filePath);
        
        // Quick check: if size or modification time changed, file definitely changed
        if (stats.size !== storedInfo.size || 
            stats.mtime.getTime() !== new Date(storedInfo.lastModified).getTime()) {
          results.potentialChanges.push(filePath);
          results.stats.hashCalculationRequired++;
        } else {
          // File appears unchanged based on stats - skip hash calculation
          results.definitelyUnchanged.push(filePath);
          results.stats.quickCheckSkipped++;
        }
      } catch (error) {
        // File might be deleted or inaccessible - treat as potential change
        results.potentialChanges.push(filePath);
        results.stats.hashCalculationRequired++;
      }
    }

    return results;
  }

  /**
   * Detect all types of changes: added, modified, deleted
   */
  async detectChanges(repositoryId, currentFilePaths, options = {}) {
    const { onProgress, useOptimization = true } = options;
    
    // Load stored file hashes
    const storedHashes = await this.metadataManager.loadFileHashes(repositoryId);
    
    let hashCalculationResults;
    
    if (useOptimization) {
      // Use optimization to skip unchanged files
      hashCalculationResults = await this._detectChangesOptimized(
        currentFilePaths, 
        storedHashes, 
        onProgress
      );
    } else {
      // Calculate hashes for all files
      hashCalculationResults = await this._detectChangesComplete(
        currentFilePaths, 
        storedHashes, 
        onProgress
      );
    }

    // Detect deleted files
    const deletedFiles = this._detectDeletedFiles(currentFilePaths, storedHashes);

    return {
      added: hashCalculationResults.added,
      modified: hashCalculationResults.modified,
      deleted: deletedFiles,
      unchanged: hashCalculationResults.unchanged,
      currentHashes: hashCalculationResults.currentHashes,
      stats: {
        ...hashCalculationResults.stats,
        deletedCount: deletedFiles.length
      }
    };
  }

  /**
   * Optimized change detection using quick stat checks
   */
  async _detectChangesOptimized(currentFilePaths, storedHashes, onProgress) {
    // Quick detection first
    const quickResults = await this.quickChangeDetection(currentFilePaths, storedHashes);
    
    if (onProgress) {
      onProgress({
        phase: 'quick_check',
        totalFiles: quickResults.stats.totalFiles,
        quickCheckSkipped: quickResults.stats.quickCheckSkipped,
        hashCalculationRequired: quickResults.stats.hashCalculationRequired
      });
    }

    // Calculate hashes only for files that might have changed
    const filesToHash = [...quickResults.potentialChanges, ...quickResults.newFiles];
    const newHashes = await this._calculateHashesForFiles(filesToHash, onProgress);

    // Build complete current hashes map
    const currentHashes = { ...newHashes };
    
    // Add unchanged files from stored hashes
    for (const filePath of quickResults.definitelyUnchanged) {
      const relativePath = relative(this.repositoryPath, filePath);
      currentHashes[relativePath] = storedHashes[relativePath];
    }

    // Detect changes by comparing hashes
    const changes = this._compareHashes(storedHashes, newHashes);

    return {
      added: changes.added,
      modified: changes.modified,
      unchanged: quickResults.definitelyUnchanged.map(fp => relative(this.repositoryPath, fp)),
      currentHashes,
      stats: {
        totalFiles: quickResults.stats.totalFiles,
        hashCalculationsSkipped: quickResults.stats.quickCheckSkipped,
        hashCalculationsPerformed: quickResults.stats.hashCalculationRequired,
        optimizationUsed: true
      }
    };
  }

  /**
   * Complete change detection without optimization
   */
  async _detectChangesComplete(currentFilePaths, storedHashes, onProgress) {
    const allHashes = await this._calculateHashesForFiles(currentFilePaths, onProgress);
    const changes = this._compareHashes(storedHashes, allHashes);

    return {
      added: changes.added,
      modified: changes.modified,
      unchanged: changes.unchanged,
      currentHashes: allHashes,
      stats: {
        totalFiles: currentFilePaths.length,
        hashCalculationsSkipped: 0,
        hashCalculationsPerformed: currentFilePaths.length,
        optimizationUsed: false
      }
    };
  }

  /**
   * Calculate hashes for a list of files with progress reporting
   */
  async _calculateHashesForFiles(filePaths, onProgress) {
    const hashes = {};
    let processed = 0;

    for (const filePath of filePaths) {
      try {
        const hashInfo = await this.calculateFileHash(filePath);
        hashes[hashInfo.path] = {
          hash: hashInfo.hash,
          size: hashInfo.size,
          lastModified: hashInfo.lastModified
        };

        processed++;
        if (onProgress) {
          onProgress({
            phase: 'hashing',
            processed,
            total: filePaths.length,
            currentFile: hashInfo.path,
            percentage: Math.round((processed / filePaths.length) * 100)
          });
        }
      } catch (error) {
        console.warn(`Skipping file ${filePath}: ${error.message}`);
      }
    }

    return hashes;
  }

  /**
   * Compare stored hashes with current hashes to detect changes
   */
  _compareHashes(storedHashes, currentHashes) {
    const added = [];
    const modified = [];
    const unchanged = [];

    for (const [relativePath, currentInfo] of Object.entries(currentHashes)) {
      const storedInfo = storedHashes[relativePath];

      if (!storedInfo) {
        // New file
        added.push({
          path: relativePath,
          changeType: 'added',
          hash: currentInfo.hash,
          size: currentInfo.size,
          lastModified: currentInfo.lastModified
        });
      } else if (storedInfo.hash !== currentInfo.hash) {
        // Modified file
        modified.push({
          path: relativePath,
          changeType: 'modified',
          hash: currentInfo.hash,
          previousHash: storedInfo.hash,
          size: currentInfo.size,
          lastModified: currentInfo.lastModified
        });
      } else {
        // Unchanged file
        unchanged.push(relativePath);
      }
    }

    return { added, modified, unchanged };
  }

  /**
   * Detect deleted files by comparing current files with stored hashes
   */
  _detectDeletedFiles(currentFilePaths, storedHashes) {
    const currentRelativePaths = new Set(
      currentFilePaths.map(fp => relative(this.repositoryPath, fp))
    );

    const deleted = [];
    for (const [relativePath, storedInfo] of Object.entries(storedHashes)) {
      if (!currentRelativePaths.has(relativePath)) {
        deleted.push({
          path: relativePath,
          changeType: 'deleted',
          previousHash: storedInfo.hash,
          size: storedInfo.size,
          lastModified: storedInfo.lastModified
        });
      }
    }

    return deleted;
  }

  /**
   * Cleanup deleted files from storage and metadata
   */
  async cleanupDeletedFiles(repositoryId, deletedFiles) {
    if (deletedFiles.length === 0) {
      return { cleaned: 0, errors: [] };
    }

    const errors = [];
    let cleaned = 0;

    try {
      // Remove file hashes for deleted files
      const currentHashes = await this.metadataManager.loadFileHashes(repositoryId);
      
      for (const deletedFile of deletedFiles) {
        if (currentHashes[deletedFile.path]) {
          delete currentHashes[deletedFile.path];
          cleaned++;
        }
      }

      // Save updated hashes
      await this.metadataManager.saveFileHashes(repositoryId, currentHashes);

      // Update metadata to reflect cleanup
      await this.metadataManager.updateMetadata(repositoryId, {
        lastCleanup: new Date(),
        filesDeleted: deletedFiles.length
      });

    } catch (error) {
      errors.push(`Failed to cleanup deleted files: ${error.message}`);
    }

    return { cleaned, errors };
  }

  /**
   * Validate change detection accuracy by re-checking a sample of files
   */
  async validateChangeDetection(repositoryId, sampleSize = 10) {
    const storedHashes = await this.metadataManager.loadFileHashes(repositoryId);
    const storedPaths = Object.keys(storedHashes);
    
    if (storedPaths.length === 0) {
      return { valid: true, errors: [], sampleSize: 0 };
    }

    // Sample random files for validation
    const samplePaths = this._sampleArray(storedPaths, Math.min(sampleSize, storedPaths.length));
    const errors = [];

    for (const relativePath of samplePaths) {
      try {
        const fullPath = join(this.repositoryPath, relativePath);
        const currentHashInfo = await this.calculateFileHash(fullPath);
        const storedInfo = storedHashes[relativePath];

        if (currentHashInfo.hash !== storedInfo.hash) {
          errors.push({
            path: relativePath,
            issue: 'hash_mismatch',
            stored: storedInfo.hash,
            current: currentHashInfo.hash
          });
        }
      } catch (error) {
        errors.push({
          path: relativePath,
          issue: 'validation_error',
          error: error.message
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sampleSize: samplePaths.length,
      totalFiles: storedPaths.length
    };
  }

  /**
   * Get change detection statistics
   */
  async getChangeDetectionStats(repositoryId) {
    const storedHashes = await this.metadataManager.loadFileHashes(repositoryId);
    const metadata = await this.metadataManager.loadMetadata(repositoryId);

    return {
      trackedFiles: Object.keys(storedHashes).length,
      lastIndexed: metadata?.lastIndexed,
      lastCleanup: metadata?.lastCleanup,
      cacheSize: this.hashCache.size,
      cacheHitRate: this._calculateCacheHitRate()
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.hashCache.clear();
    this.statCache.clear();
  }

  /**
   * Sample array elements randomly
   */
  _sampleArray(array, size) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  /**
   * Calculate cache hit rate (simplified implementation)
   */
  _calculateCacheHitRate() {
    // This would need more sophisticated tracking in a real implementation
    return this.hashCache.size > 0 ? 0.8 : 0; // Placeholder
  }
}