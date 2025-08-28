/**
 * Storage Manager for Repository Isolation
 * Handles directory structure creation and management
 */

import { join, resolve } from 'path';
import { mkdir, access, readdir, stat, rm } from 'fs/promises';
import { homedir } from 'os';
import { createHash } from 'crypto';

export class StorageManager {
  constructor(baseDirectory = '~/.ziri') {
    this.baseDirectory = baseDirectory.startsWith('~') 
      ? join(homedir(), baseDirectory.slice(2))
      : resolve(baseDirectory);
  }

  /**
   * Initialize the storage directory structure
   */
  async initialize() {
    const directories = [
      this.baseDirectory,
      join(this.baseDirectory, 'repositories'),
      join(this.baseDirectory, 'config'),
      join(this.baseDirectory, 'logs'),
      join(this.baseDirectory, 'cache'),
      join(this.baseDirectory, 'backups')
    ];

    for (const dir of directories) {
      await this.ensureDirectory(dir);
    }
  }

  /**
   * Generate a unique repository ID from path
   */
  generateRepositoryId(repoPath) {
    const normalizedPath = resolve(repoPath);
    return createHash('sha256')
      .update(normalizedPath)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get the storage directory for a repository
   * Uses the same logic as legacy indexer for compatibility
   */
  getRepositoryDirectory(repositoryId, alias) {
    // Use legacy-style directory naming for consistency
    const shortId = repositoryId.slice(0, 6);
    return join(this.baseDirectory, 'repos', `${alias}--${shortId}`);
  }

  /**
   * Create isolated storage for a repository
   */
  async createRepositoryStorage(repositoryId, alias) {
    const repoDir = this.getRepositoryDirectory(repositoryId, alias);

    const directories = [
      repoDir,
      join(repoDir, 'vectors'),
      join(repoDir, 'metadata'),
      join(repoDir, 'cache')
    ];

    for (const dir of directories) {
      await this.ensureDirectory(dir);
    }

    return repoDir;
  }

  /**
   * Get paths for repository storage files
   */
  getRepositoryPaths(repositoryId) {
    const repoDir = this.getRepositoryDirectory(repositoryId);
    
    return {
      base: repoDir,
      vectors: join(repoDir, 'vectors', 'embeddings.db'),
      metadata: join(repoDir, 'metadata', 'index.json'),
      fileHashes: join(repoDir, 'metadata', 'file-hashes.json'),
      projectSummary: join(repoDir, 'project_summary.md'),
      config: join(repoDir, 'metadata', 'config.json'),
      cache: join(repoDir, 'cache')
    };
  }

  /**
   * Check if repository storage exists
   */
  async repositoryExists(repositoryId) {
    try {
      const repoDir = this.getRepositoryDirectory(repositoryId);
      await access(repoDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete repository storage
   */
  async deleteRepository(repositoryId) {
    const repoDir = this.getRepositoryDirectory(repositoryId);
    
    try {
      await rm(repoDir, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete repository ${repositoryId}:`, error);
      return false;
    }
  }

  /**
   * List all repositories
   */
  async listRepositories() {
    const repositoriesDir = join(this.baseDirectory, 'repositories');
    
    try {
      const entries = await readdir(repositoriesDir);
      const repositories = [];
      
      for (const entry of entries) {
        const entryPath = join(repositoriesDir, entry);
        const stats = await stat(entryPath);
        
        if (stats.isDirectory()) {
          repositories.push({
            id: entry,
            path: entryPath,
            createdAt: stats.birthtime,
            lastModified: stats.mtime
          });
        }
      }
      
      return repositories;
    } catch {
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(repositoryId) {
    const repoDir = this.getRepositoryDirectory(repositoryId);
    
    try {
      const stats = await this.calculateDirectorySize(repoDir);
      return {
        totalSize: stats.size,
        fileCount: stats.files,
        lastModified: stats.lastModified
      };
    } catch (error) {
      return {
        totalSize: 0,
        fileCount: 0,
        lastModified: null,
        error: error.message
      };
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  async ensureDirectory(dirPath) {
    try {
      await access(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Calculate directory size recursively
   */
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    let lastModified = new Date(0);

    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const entryPath = join(dirPath, entry);
        const stats = await stat(entryPath);
        
        if (stats.isDirectory()) {
          const subStats = await this.calculateDirectorySize(entryPath);
          totalSize += subStats.size;
          fileCount += subStats.files;
          if (subStats.lastModified > lastModified) {
            lastModified = subStats.lastModified;
          }
        } else {
          totalSize += stats.size;
          fileCount++;
          if (stats.mtime > lastModified) {
            lastModified = stats.mtime;
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }

    return {
      size: totalSize,
      files: fileCount,
      lastModified
    };
  }

  /**
   * Clean up old repositories based on age or size
   */
  async cleanup(maxAge = 30, maxSize = 1024) {
    const repositories = await this.listRepositories();
    const now = new Date();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000; // Convert days to ms
    const maxSizeBytes = maxSize * 1024 * 1024; // Convert MB to bytes
    
    let totalSize = 0;
    const reposWithStats = [];
    
    // Calculate total size and collect repo stats
    for (const repo of repositories) {
      const stats = await this.getStorageStats(repo.id);
      totalSize += stats.totalSize;
      reposWithStats.push({
        ...repo,
        size: stats.totalSize,
        age: now - repo.lastModified
      });
    }
    
    // Sort by age (oldest first) for cleanup
    reposWithStats.sort((a, b) => b.age - a.age);
    
    const cleanedUp = [];
    
    // Clean up by age
    for (const repo of reposWithStats) {
      if (repo.age > maxAgeMs) {
        await this.deleteRepository(repo.id);
        cleanedUp.push({ id: repo.id, reason: 'age', age: repo.age });
        totalSize -= repo.size;
      }
    }
    
    // Clean up by size (if still over limit)
    if (totalSize > maxSizeBytes) {
      for (const repo of reposWithStats) {
        if (totalSize <= maxSizeBytes) break;
        
        if (!cleanedUp.find(c => c.id === repo.id)) {
          await this.deleteRepository(repo.id);
          cleanedUp.push({ id: repo.id, reason: 'size', size: repo.size });
          totalSize -= repo.size;
        }
      }
    }
    
    return {
      cleanedUp,
      remainingSize: totalSize,
      remainingRepos: repositories.length - cleanedUp.length
    };
  }
}
