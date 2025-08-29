/**
 * Repository Manager
 * High-level interface for repository isolation and management
 */

import { StorageManager } from '../storage/storage-manager.js';
import { MetadataManager } from './metadata-manager.js';
import { ChangeDetector } from './change-detector.js';
import { computeRepoId } from '../repoid.js';
import { resolve } from 'path';

export class RepositoryManager {
  constructor(baseDirectory = '~/.ziri') {
    this.storageManager = new StorageManager(baseDirectory);
    this.metadataManager = new MetadataManager(this.storageManager);
    this.changeDetectors = new Map(); // Cache change detectors per repository
  }

  /**
   * Initialize the repository manager
   */
  async initialize() {
    await this.storageManager.initialize();
    return this; // Return self for chaining
  }

  /**
   * Get repository directory
   */
  getRepositoryDirectory(repositoryId, alias) {
    return this.storageManager.getRepositoryDirectory(repositoryId, alias);
  }

  /**
   * Create or get repository isolation
   */
  async createRepository(repositoryPath, options = {}) {
    const absolutePath = resolve(repositoryPath);
    
    // Generate unique repository ID
    const { repoId, alias } = await computeRepoId(absolutePath);
    
    // Check if repository already exists
    const exists = await this.storageManager.repositoryExists(repoId);
    
    if (!exists) {
      // Create storage structure
      await this.storageManager.createRepositoryStorage(repoId, alias);

      // Initialize metadata
      await this.metadataManager.initializeRepository(repoId, absolutePath, {
        provider: options.provider || 'openai',
        chunkSize: options.chunkSize || 1000,
        chunkOverlap: options.chunkOverlap || 200,
        excludePatterns: options.excludePatterns || [],
        maxFileSize: options.maxFileSize || 1024 * 1024
      });
    }

    return {
      repositoryId: repoId,
      alias,
      path: absolutePath,
      exists,
      storagePath: this.storageManager.getRepositoryDirectory(repoId, alias)
    };
  }

  /**
   * Get repository information
   */
  async getRepository(repositoryPath) {
    const absolutePath = resolve(repositoryPath);
    const { repoId, alias } = await computeRepoId(absolutePath);
    
    const exists = await this.storageManager.repositoryExists(repoId);
    if (!exists) {
      return null;
    }

    const metadata = await this.metadataManager.loadMetadata(repoId);
    const stats = await this.metadataManager.getRepositoryStats(repoId);

    return {
      repositoryId: repoId,
      alias,
      path: absolutePath,
      metadata,
      stats,
      storagePath: this.storageManager.getRepositoryDirectory(repoId, alias)
    };
  }

  /**
   * List all repositories
   */
  async listRepositories() {
    const repositories = await this.storageManager.listRepositories();
    const repositoryList = [];

    for (const repo of repositories) {
      try {
        const metadata = await this.metadataManager.loadMetadata(repo.id);
        const stats = await this.metadataManager.getRepositoryStats(repo.id);
        
        repositoryList.push({
          repositoryId: repo.id,
          path: metadata?.repositoryPath || 'Unknown',
          createdAt: repo.createdAt,
          lastModified: repo.lastModified,
          metadata,
          stats
        });
      } catch (error) {
        // Skip repositories with corrupted metadata
        console.warn(`Skipping repository ${repo.id} due to metadata error:`, error.message);
      }
    }

    return repositoryList;
  }

  /**
   * Delete repository and all its data
   */
  async deleteRepository(repositoryPath) {
    const absolutePath = resolve(repositoryPath);
    const { repoId } = await computeRepoId(absolutePath);
    
    return await this.storageManager.deleteRepository(repoId);
  }

  /**
   * Get repository paths for file operations
   */
  getRepositoryPaths(repositoryId) {
    return this.storageManager.getRepositoryPaths(repositoryId);
  }

  /**
   * Update repository metadata
   */
  async updateRepositoryMetadata(repositoryId, updates) {
    return await this.metadataManager.updateMetadata(repositoryId, updates);
  }

  /**
   * Get repository configuration
   */
  async getRepositoryConfig(repositoryId) {
    return await this.metadataManager.getRepositoryConfig(repositoryId);
  }

  /**
   * Update repository configuration
   */
  async updateRepositoryConfig(repositoryId, config) {
    return await this.metadataManager.saveRepositoryConfig(repositoryId, config);
  }

  /**
   * Get or create change detector for a repository
   */
  getChangeDetector(repositoryId, repositoryPath) {
    if (!this.changeDetectors.has(repositoryId)) {
      const changeDetector = new ChangeDetector(repositoryPath, this.metadataManager);
      this.changeDetectors.set(repositoryId, changeDetector);
    }
    return this.changeDetectors.get(repositoryId);
  }

  /**
   * Calculate file hash for change detection
   */
  async calculateFileHash(filePath) {
    return await this.metadataManager.calculateFileHash(filePath);
  }

  /**
   * Detect file changes since last indexing using enhanced change detection
   */
  async detectFileChanges(repositoryId, currentFilePaths, repositoryPath, options = {}) {
    const changeDetector = this.getChangeDetector(repositoryId, repositoryPath);
    return await changeDetector.detectChanges(repositoryId, currentFilePaths, options);
  }

  /**
   * Cleanup deleted files from repository
   */
  async cleanupDeletedFiles(repositoryId, repositoryPath, deletedFiles) {
    const changeDetector = this.getChangeDetector(repositoryId, repositoryPath);
    return await changeDetector.cleanupDeletedFiles(repositoryId, deletedFiles);
  }

  /**
   * Validate change detection accuracy
   */
  async validateChangeDetection(repositoryId, repositoryPath, sampleSize = 10) {
    const changeDetector = this.getChangeDetector(repositoryId, repositoryPath);
    return await changeDetector.validateChangeDetection(repositoryId, sampleSize);
  }

  /**
   * Get change detection statistics
   */
  async getChangeDetectionStats(repositoryId, repositoryPath) {
    const changeDetector = this.getChangeDetector(repositoryId, repositoryPath);
    return await changeDetector.getChangeDetectionStats(repositoryId);
  }

  /**
   * Update file hashes after processing
   */
  async updateFileHashes(repositoryId, fileHashes) {
    return await this.metadataManager.saveFileHashes(repositoryId, fileHashes);
  }

  /**
   * Get file hashes for repository
   */
  async getFileHashes(repositoryId) {
    return await this.metadataManager.loadFileHashes(repositoryId);
  }

  /**
   * Remove file hash when file is deleted
   */
  async removeFileHash(repositoryId, filePath) {
    return await this.metadataManager.removeFileHash(repositoryId, filePath);
  }

  /**
   * Cleanup orphaned file hashes
   */
  async cleanupOrphanedHashes(repositoryId, existingFiles) {
    return await this.metadataManager.cleanupOrphanedHashes(repositoryId, existingFiles);
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(repositoryId) {
    return await this.metadataManager.getRepositoryStats(repositoryId);
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(repositoryPath) {
    const absolutePath = resolve(repositoryPath);
    const { repoId } = await computeRepoId(absolutePath);
    return await this.storageManager.repositoryExists(repoId);
  }

  /**
   * Cleanup old repositories
   */
  async cleanup(maxAge = 30, maxSize = 1024) {
    return await this.storageManager.cleanup(maxAge, maxSize);
  }

  /**
   * Validate repository integrity
   */
  async validateRepository(repositoryId) {
    const errors = [];
    const warnings = [];

    try {
      // Check if storage directory exists
      const exists = await this.storageManager.repositoryExists(repositoryId);
      if (!exists) {
        errors.push('Repository storage directory does not exist');
        return { valid: false, errors, warnings };
      }

      // Check metadata
      const metadata = await this.metadataManager.loadMetadata(repositoryId);
      if (!metadata) {
        errors.push('Repository metadata is missing');
      } else {
        // Validate metadata structure
        if (!metadata.repositoryPath) {
          errors.push('Repository path is missing from metadata');
        }
        if (!metadata.version) {
          warnings.push('Repository version is missing');
        }
      }

      // Check file hashes
      try {
        await this.metadataManager.loadFileHashes(repositoryId);
      } catch (error) {
        warnings.push('File hashes could not be loaded: ' + error.message);
      }

      // Check configuration
      try {
        await this.metadataManager.getRepositoryConfig(repositoryId);
      } catch (error) {
        warnings.push('Repository configuration could not be loaded: ' + error.message);
      }

    } catch (error) {
      errors.push('Validation failed: ' + error.message);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Repair repository if possible
   */
  async repairRepository(repositoryId, repositoryPath) {
    const validation = await this.validateRepository(repositoryId);
    const repairs = [];

    if (!validation.valid) {
      // Try to recreate missing metadata
      try {
        const absolutePath = resolve(repositoryPath);
        await this.metadataManager.initializeRepository(repositoryId, absolutePath);
        repairs.push('Recreated missing metadata');
      } catch (error) {
        throw new Error(`Failed to repair repository: ${error.message}`);
      }
    }

    return {
      repaired: repairs.length > 0,
      repairs
    };
  }
}
