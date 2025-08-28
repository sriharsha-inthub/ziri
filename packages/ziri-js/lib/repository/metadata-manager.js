/**
 * Repository Metadata Manager
 * Handles repository metadata storage, retrieval, and file hash tracking
 */

import { join } from 'path';
import { readFile, writeFile, access, stat } from 'fs/promises';
import { createHash } from 'crypto';

export class MetadataManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
  }

  /**
   * Initialize metadata for a new repository
   */
  async initializeRepository(repositoryId, repositoryPath, config = {}) {
    const metadata = {
      repositoryId,
      repositoryPath: repositoryPath,
      lastIndexed: new Date(),
      fileHashes: {},
      totalChunks: 0,
      embeddingProvider: config.provider || 'openai',
      version: '1.0.0',
      config: {
        chunkSize: config.chunkSize || 1000,
        chunkOverlap: config.chunkOverlap || 200,
        excludePatterns: config.excludePatterns || [],
        maxFileSize: config.maxFileSize || 1024 * 1024
      },
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    await this.saveMetadata(repositoryId, metadata);
    return metadata;
  }

  /**
   * Load repository metadata
   */
  async loadMetadata(repositoryId) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    try {
      const metadataContent = await readFile(paths.metadata, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      // Convert date strings back to Date objects
      if (metadata.lastIndexed) metadata.lastIndexed = new Date(metadata.lastIndexed);
      if (metadata.createdAt) metadata.createdAt = new Date(metadata.createdAt);
      if (metadata.lastUpdated) metadata.lastUpdated = new Date(metadata.lastUpdated);
      if (metadata.lastCleanup) metadata.lastCleanup = new Date(metadata.lastCleanup);
      
      return metadata;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Metadata doesn't exist
      }
      throw new Error(`Failed to load metadata for repository ${repositoryId}: ${error.message}`);
    }
  }

  /**
   * Save repository metadata
   */
  async saveMetadata(repositoryId, metadata) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    // Ensure repository storage exists
    await this.storageManager.createRepositoryStorage(repositoryId);
    
    // Update timestamp
    metadata.lastUpdated = new Date();
    
    try {
      await writeFile(paths.metadata, JSON.stringify(metadata, null, 2));
    } catch (error) {
      throw new Error(`Failed to save metadata for repository ${repositoryId}: ${error.message}`);
    }
  }

  /**
   * Update repository metadata
   */
  async updateMetadata(repositoryId, updates) {
    const metadata = await this.loadMetadata(repositoryId);
    if (!metadata) {
      throw new Error(`Repository ${repositoryId} metadata not found`);
    }

    // Merge updates
    Object.assign(metadata, updates);
    metadata.lastUpdated = new Date();

    await this.saveMetadata(repositoryId, metadata);
    return metadata;
  }

  /**
   * Load file hashes for change detection
   */
  async loadFileHashes(repositoryId) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    try {
      const hashContent = await readFile(paths.fileHashes, 'utf8');
      return JSON.parse(hashContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // No hashes exist yet
      }
      throw new Error(`Failed to load file hashes for repository ${repositoryId}: ${error.message}`);
    }
  }

  /**
   * Save file hashes for change detection
   */
  async saveFileHashes(repositoryId, fileHashes) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    // Ensure repository storage exists
    await this.storageManager.createRepositoryStorage(repositoryId);
    
    try {
      await writeFile(paths.fileHashes, JSON.stringify(fileHashes, null, 2));
    } catch (error) {
      throw new Error(`Failed to save file hashes for repository ${repositoryId}: ${error.message}`);
    }
  }

  /**
   * Calculate file hash for change detection
   */
  async calculateFileHash(filePath) {
    try {
      const content = await readFile(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate hash for file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Update file hash in tracking system
   */
  async updateFileHash(repositoryId, filePath, hash) {
    const fileHashes = await this.loadFileHashes(repositoryId);
    fileHashes[filePath] = {
      hash,
      lastModified: new Date(),
      size: await this.getFileSize(filePath)
    };
    await this.saveFileHashes(repositoryId, fileHashes);
  }

  /**
   * Remove file hash from tracking system
   */
  async removeFileHash(repositoryId, filePath) {
    const fileHashes = await this.loadFileHashes(repositoryId);
    delete fileHashes[filePath];
    await this.saveFileHashes(repositoryId, fileHashes);
  }

  /**
   * Detect file changes since last indexing
   */
  async detectFileChanges(repositoryId, currentFiles) {
    const storedHashes = await this.loadFileHashes(repositoryId);
    const changes = {
      added: [],
      modified: [],
      deleted: []
    };

    // Check for added and modified files
    for (const [filePath, currentHash] of Object.entries(currentFiles)) {
      const storedInfo = storedHashes[filePath];
      
      if (!storedInfo) {
        changes.added.push({
          path: filePath,
          changeType: 'added',
          hash: currentHash
        });
      } else if (storedInfo.hash !== currentHash) {
        changes.modified.push({
          path: filePath,
          changeType: 'modified',
          hash: currentHash,
          previousHash: storedInfo.hash
        });
      }
    }

    // Check for deleted files
    for (const filePath of Object.keys(storedHashes)) {
      if (!currentFiles[filePath]) {
        changes.deleted.push({
          path: filePath,
          changeType: 'deleted',
          previousHash: storedHashes[filePath].hash
        });
      }
    }

    return changes;
  }

  /**
   * Get repository configuration
   */
  async getRepositoryConfig(repositoryId) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    try {
      const configContent = await readFile(paths.config, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Return default config if none exists
        return this.getDefaultRepositoryConfig();
      }
      throw new Error(`Failed to load config for repository ${repositoryId}: ${error.message}`);
    }
  }

  /**
   * Save repository configuration
   */
  async saveRepositoryConfig(repositoryId, config) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    // Ensure repository storage exists
    await this.storageManager.createRepositoryStorage(repositoryId);
    
    try {
      await writeFile(paths.config, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config for repository ${repositoryId}: ${error.message}`);
    }
  }

  /**
   * Get default repository configuration
   */
  getDefaultRepositoryConfig() {
    return {
      chunkSize: 1000,
      chunkOverlap: 200,
      excludePatterns: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log'
      ],
      maxFileSize: 1024 * 1024, // 1MB
      embeddingProvider: 'openai',
      lastIndexed: null,
      indexVersion: '1.0.0'
    };
  }

  /**
   * Get file size
   */
  async getFileSize(filePath) {
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Check if repository metadata exists
   */
  async repositoryMetadataExists(repositoryId) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    try {
      await access(paths.metadata);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(repositoryId) {
    const metadata = await this.loadMetadata(repositoryId);
    const fileHashes = await this.loadFileHashes(repositoryId);
    const storageStats = await this.storageManager.getStorageStats(repositoryId);

    if (!metadata) {
      return null;
    }

    return {
      repositoryId,
      repositoryPath: metadata.repositoryPath,
      totalFiles: Object.keys(fileHashes).length,
      totalChunks: metadata.totalChunks,
      embeddingProvider: metadata.embeddingProvider,
      lastIndexed: metadata.lastIndexed,
      createdAt: metadata.createdAt,
      lastUpdated: metadata.lastUpdated,
      storageSize: storageStats.totalSize,
      version: metadata.version
    };
  }

  /**
   * Cleanup orphaned file hashes
   */
  async cleanupOrphanedHashes(repositoryId, existingFiles) {
    const fileHashes = await this.loadFileHashes(repositoryId);
    const cleanedHashes = {};
    let removedCount = 0;

    for (const [filePath, hashInfo] of Object.entries(fileHashes)) {
      if (existingFiles.includes(filePath)) {
        cleanedHashes[filePath] = hashInfo;
      } else {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.saveFileHashes(repositoryId, cleanedHashes);
    }

    return removedCount;
  }
}