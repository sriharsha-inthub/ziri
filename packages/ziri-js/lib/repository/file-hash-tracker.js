/**
 * File Hash Tracker
 * Efficient file change detection using hashes and timestamps
 */

import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { join, relative } from 'path';

export class FileHashTracker {
  constructor(repositoryPath, metadataManager) {
    this.repositoryPath = repositoryPath;
    this.metadataManager = metadataManager;
    this.hashCache = new Map();
  }

  /**
   * Calculate hash for a single file
   */
  async calculateFileHash(filePath) {
    try {
      const content = await readFile(filePath);
      const stats = await stat(filePath);
      
      const hash = createHash('sha256').update(content).digest('hex');
      
      return {
        hash,
        size: stats.size,
        lastModified: stats.mtime,
        path: relative(this.repositoryPath, filePath)
      };
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Calculate hashes for multiple files efficiently
   */
  async calculateFileHashes(filePaths, onProgress) {
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
   * Quick change detection using file stats before calculating hashes
   */
  async quickChangeDetection(filePaths, storedHashes) {
    const potentialChanges = [];
    const definitelyUnchanged = [];
    
    for (const filePath of filePaths) {
      const relativePath = relative(this.repositoryPath, filePath);
      const storedInfo = storedHashes[relativePath];
      
      if (!storedInfo) {
        // New file
        potentialChanges.push(filePath);
        continue;
      }
      
      try {
        const stats = await stat(filePath);
        
        // Quick check: if size or modification time changed, file definitely changed
        if (stats.size !== storedInfo.size || 
            stats.mtime.getTime() !== new Date(storedInfo.lastModified).getTime()) {
          potentialChanges.push(filePath);
        } else {
          // File appears unchanged based on stats
          definitelyUnchanged.push(filePath);
        }
      } catch (error) {
        // File might be deleted or inaccessible
        console.warn(`Cannot stat file ${filePath}: ${error.message}`);
      }
    }
    
    return {
      potentialChanges,
      definitelyUnchanged
    };
  }

  /**
   * Detect changes with optimization
   */
  async detectChangesOptimized(repositoryId, filePaths, onProgress) {
    const storedHashes = await this.metadataManager.loadFileHashes(repositoryId);
    
    // Quick detection first
    const { potentialChanges, definitelyUnchanged } = await this.quickChangeDetection(filePaths, storedHashes);
    
    // Only calculate hashes for files that might have changed
    const newHashes = await this.calculateFileHashes(potentialChanges, (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          phase: 'hashing',
          quickCheckComplete: true,
          potentialChanges: potentialChanges.length,
          definitelyUnchanged: definitelyUnchanged.length
        });
      }
    });
    
    // Combine with unchanged files
    const allCurrentHashes = { ...newHashes };
    for (const filePath of definitelyUnchanged) {
      const relativePath = relative(this.repositoryPath, filePath);
      allCurrentHashes[relativePath] = storedHashes[relativePath];
    }
    
    // Detect actual changes
    const changes = await this.metadataManager.detectFileChanges(repositoryId, 
      Object.fromEntries(
        Object.entries(allCurrentHashes).map(([path, info]) => [path, info.hash])
      )
    );
    
    return {
      changes,
      currentHashes: allCurrentHashes,
      optimizationStats: {
        totalFiles: filePaths.length,
        potentialChanges: potentialChanges.length,
        definitelyUnchanged: definitelyUnchanged.length,
        hashCalculationsSkipped: definitelyUnchanged.length
      }
    };
  }

  /**
   * Batch update file hashes
   */
  async batchUpdateHashes(repositoryId, fileHashes) {
    return await this.metadataManager.saveFileHashes(repositoryId, fileHashes);
  }

  /**
   * Get hash for file from cache or calculate
   */
  async getFileHash(filePath) {
    const relativePath = relative(this.repositoryPath, filePath);
    
    if (this.hashCache.has(relativePath)) {
      const cached = this.hashCache.get(relativePath);
      
      // Check if cache is still valid
      try {
        const stats = await stat(filePath);
        if (stats.mtime.getTime() === cached.lastModified.getTime() && 
            stats.size === cached.size) {
          return cached.hash;
        }
      } catch {
        // File might be deleted, remove from cache
        this.hashCache.delete(relativePath);
        return null;
      }
    }
    
    // Calculate new hash
    try {
      const hashInfo = await this.calculateFileHash(filePath);
      this.hashCache.set(relativePath, hashInfo);
      return hashInfo.hash;
    } catch {
      return null;
    }
  }

  /**
   * Clear hash cache
   */
  clearCache() {
    this.hashCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.hashCache.size,
      entries: Array.from(this.hashCache.keys())
    };
  }

  /**
   * Validate file hashes against stored values
   */
  async validateHashes(repositoryId, filePaths) {
    const storedHashes = await this.metadataManager.loadFileHashes(repositoryId);
    const validationResults = {
      valid: [],
      invalid: [],
      missing: []
    };
    
    for (const filePath of filePaths) {
      const relativePath = relative(this.repositoryPath, filePath);
      const storedInfo = storedHashes[relativePath];
      
      if (!storedInfo) {
        validationResults.missing.push(relativePath);
        continue;
      }
      
      try {
        const currentHash = await this.getFileHash(filePath);
        if (currentHash === storedInfo.hash) {
          validationResults.valid.push(relativePath);
        } else {
          validationResults.invalid.push({
            path: relativePath,
            storedHash: storedInfo.hash,
            currentHash
          });
        }
      } catch (error) {
        validationResults.invalid.push({
          path: relativePath,
          error: error.message
        });
      }
    }
    
    return validationResults;
  }

  /**
   * Create hash snapshot for backup/restore
   */
  async createHashSnapshot(repositoryId) {
    const hashes = await this.metadataManager.loadFileHashes(repositoryId);
    return {
      timestamp: new Date(),
      repositoryId,
      hashes,
      count: Object.keys(hashes).length
    };
  }

  /**
   * Restore from hash snapshot
   */
  async restoreFromSnapshot(repositoryId, snapshot) {
    if (snapshot.repositoryId !== repositoryId) {
      throw new Error('Snapshot repository ID does not match');
    }
    
    await this.metadataManager.saveFileHashes(repositoryId, snapshot.hashes);
    return {
      restored: true,
      count: Object.keys(snapshot.hashes).length,
      timestamp: snapshot.timestamp
    };
  }
}