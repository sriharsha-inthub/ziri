/**
 * Checkpoint Manager
 * Provides resumable indexing with checkpoint system
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

export class CheckpointManager extends EventEmitter {
  constructor(baseDirectory, options = {}) {
    super();
    
    this.baseDirectory = baseDirectory;
    this.options = {
      checkpointInterval: options.checkpointInterval || 100, // Save every 100 items
      maxCheckpoints: options.maxCheckpoints || 5,
      compressionEnabled: options.compressionEnabled !== false,
      autoCleanup: options.autoCleanup !== false,
      ...options
    };
    
    this.currentCheckpoint = null;
    this.processedCount = 0;
    this.lastCheckpointTime = Date.now();
  }

  /**
   * Initialize checkpoint system for a repository
   */
  async initialize(repositoryId, operationType = 'indexing') {
    const checkpointDir = this._getCheckpointDirectory(repositoryId, operationType);
    
    try {
      await mkdir(checkpointDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    this.currentCheckpoint = {
      repositoryId,
      operationType,
      startTime: Date.now(),
      processedFiles: [],
      processedChunks: 0,
      currentFile: null,
      metadata: {},
      version: '1.0.0'
    };
    
    this.emit('checkpoint:initialized', {
      repositoryId,
      operationType,
      checkpointDir
    });
  }

  /**
   * Save current checkpoint
   */
  async saveCheckpoint(additionalData = {}) {
    if (!this.currentCheckpoint) {
      throw new Error('Checkpoint not initialized');
    }
    
    const checkpoint = {
      ...this.currentCheckpoint,
      ...additionalData,
      savedAt: Date.now(),
      processedCount: this.processedCount
    };
    
    const checkpointPath = this._getCheckpointPath(
      checkpoint.repositoryId,
      checkpoint.operationType,
      checkpoint.savedAt
    );
    
    try {
      // Ensure directory exists
      await mkdir(dirname(checkpointPath), { recursive: true });
      
      // Save checkpoint
      const checkpointData = this.options.compressionEnabled
        ? this._compressCheckpoint(checkpoint)
        : checkpoint;
      
      await writeFile(checkpointPath, JSON.stringify(checkpointData, null, 2));
      
      // Update current checkpoint
      this.currentCheckpoint = checkpoint;
      this.lastCheckpointTime = Date.now();
      
      this.emit('checkpoint:saved', {
        path: checkpointPath,
        processedCount: this.processedCount,
        size: JSON.stringify(checkpointData).length
      });
      
      // Cleanup old checkpoints
      if (this.options.autoCleanup) {
        await this._cleanupOldCheckpoints(
          checkpoint.repositoryId,
          checkpoint.operationType
        );
      }
      
      return checkpointPath;
      
    } catch (error) {
      this.emit('checkpoint:error', { error, type: 'save' });
      throw error;
    }
  }

  /**
   * Load the latest checkpoint for resuming
   */
  async loadLatestCheckpoint(repositoryId, operationType = 'indexing') {
    try {
      const checkpointDir = this._getCheckpointDirectory(repositoryId, operationType);
      const checkpoints = await this._listCheckpoints(checkpointDir);
      
      if (checkpoints.length === 0) {
        return null;
      }
      
      // Get the most recent checkpoint
      const latestCheckpoint = checkpoints[checkpoints.length - 1];
      const checkpointData = JSON.parse(await readFile(latestCheckpoint.path, 'utf8'));
      
      // Decompress if needed
      const checkpoint = this.options.compressionEnabled
        ? this._decompressCheckpoint(checkpointData)
        : checkpointData;
      
      this.currentCheckpoint = checkpoint;
      this.processedCount = checkpoint.processedCount || 0;
      
      this.emit('checkpoint:loaded', {
        path: latestCheckpoint.path,
        processedCount: this.processedCount,
        age: Date.now() - checkpoint.savedAt
      });
      
      return checkpoint;
      
    } catch (error) {
      this.emit('checkpoint:error', { error, type: 'load' });
      return null;
    }
  }

  /**
   * Update checkpoint with processed file
   */
  updateProgress(fileInfo, chunksProcessed = 0) {
    if (!this.currentCheckpoint) {
      return;
    }
    
    this.currentCheckpoint.currentFile = fileInfo;
    this.currentCheckpoint.processedChunks += chunksProcessed;
    this.processedCount++;
    
    // Add to processed files list
    this.currentCheckpoint.processedFiles.push({
      path: fileInfo.path || fileInfo.filePath,
      processedAt: Date.now(),
      chunks: chunksProcessed,
      hash: fileInfo.hash || fileInfo.fileHash
    });
    
    // Auto-save checkpoint if interval reached
    if (this.processedCount % this.options.checkpointInterval === 0) {
      this.saveCheckpoint().catch(error => {
        this.emit('checkpoint:error', { error, type: 'auto_save' });
      });
    }
  }

  /**
   * Mark operation as complete and cleanup
   */
  async completeOperation(finalData = {}) {
    if (!this.currentCheckpoint) {
      return;
    }
    
    // Save final checkpoint
    await this.saveCheckpoint({
      ...finalData,
      completed: true,
      completedAt: Date.now(),
      duration: Date.now() - this.currentCheckpoint.startTime
    });
    
    this.emit('checkpoint:completed', {
      repositoryId: this.currentCheckpoint.repositoryId,
      operationType: this.currentCheckpoint.operationType,
      processedCount: this.processedCount,
      duration: Date.now() - this.currentCheckpoint.startTime
    });
    
    // Cleanup all checkpoints for this operation
    if (this.options.autoCleanup) {
      await this._cleanupAllCheckpoints(
        this.currentCheckpoint.repositoryId,
        this.currentCheckpoint.operationType
      );
    }
    
    this.currentCheckpoint = null;
    this.processedCount = 0;
  }

  /**
   * Check if we should resume from checkpoint
   */
  async shouldResume(repositoryId, operationType = 'indexing') {
    const checkpoint = await this.loadLatestCheckpoint(repositoryId, operationType);
    
    if (!checkpoint || checkpoint.completed) {
      return { shouldResume: false, checkpoint: null };
    }
    
    // Check if checkpoint is recent enough (within 24 hours by default)
    const maxAge = this.options.maxCheckpointAge || 24 * 60 * 60 * 1000;
    const age = Date.now() - checkpoint.savedAt;
    
    if (age > maxAge) {
      this.emit('checkpoint:expired', { checkpoint, age, maxAge });
      return { shouldResume: false, checkpoint, reason: 'expired' };
    }
    
    return { shouldResume: true, checkpoint };
  }

  /**
   * Get processed files from checkpoint
   */
  getProcessedFiles() {
    return this.currentCheckpoint?.processedFiles || [];
  }

  /**
   * Check if file was already processed
   */
  isFileProcessed(filePath) {
    if (!this.currentCheckpoint) {
      return false;
    }
    
    return this.currentCheckpoint.processedFiles.some(
      file => file.path === filePath
    );
  }

  /**
   * Get checkpoint statistics
   */
  getStats() {
    if (!this.currentCheckpoint) {
      return null;
    }
    
    const elapsed = Date.now() - this.currentCheckpoint.startTime;
    const timeSinceLastCheckpoint = Date.now() - this.lastCheckpointTime;
    
    return {
      repositoryId: this.currentCheckpoint.repositoryId,
      operationType: this.currentCheckpoint.operationType,
      processedCount: this.processedCount,
      processedChunks: this.currentCheckpoint.processedChunks,
      elapsed,
      timeSinceLastCheckpoint,
      currentFile: this.currentCheckpoint.currentFile,
      throughput: this.processedCount / (elapsed / 1000)
    };
  }

  /**
   * Create a resumable stream processor
   */
  createResumableProcessor(processorFn, options = {}) {
    const {
      skipProcessed = true,
      batchSize = 50
    } = options;
    
    return async function* resumableProcessor(iterable) {
      let batch = [];
      let skippedCount = 0;
      
      for await (const item of iterable) {
        // Skip if already processed
        if (skipProcessed && this.isFileProcessed(item.path || item.filePath)) {
          skippedCount++;
          continue;
        }
        
        batch.push(item);
        
        // Process batch when full
        if (batch.length >= batchSize) {
          const results = await processorFn(batch);
          
          // Update progress for each item
          for (let i = 0; i < batch.length; i++) {
            this.updateProgress(batch[i], results[i]?.chunks || 0);
          }
          
          // Yield results
          for (const result of results) {
            yield result;
          }
          
          batch = [];
        }
      }
      
      // Process remaining items
      if (batch.length > 0) {
        const results = await processorFn(batch);
        
        for (let i = 0; i < batch.length; i++) {
          this.updateProgress(batch[i], results[i]?.chunks || 0);
        }
        
        for (const result of results) {
          yield result;
        }
      }
      
      this.emit('processor:completed', {
        processedCount: this.processedCount,
        skippedCount
      });
    }.bind(this);
  }

  // Private helper methods

  /**
   * Get checkpoint directory path
   * @private
   */
  _getCheckpointDirectory(repositoryId, operationType) {
    return join(this.baseDirectory, 'checkpoints', repositoryId, operationType);
  }

  /**
   * Get checkpoint file path
   * @private
   */
  _getCheckpointPath(repositoryId, operationType, timestamp) {
    const filename = `checkpoint-${timestamp}.json`;
    return join(this._getCheckpointDirectory(repositoryId, operationType), filename);
  }

  /**
   * List available checkpoints
   * @private
   */
  async _listCheckpoints(checkpointDir) {
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(checkpointDir);
      
      const checkpoints = [];
      
      for (const file of files) {
        if (file.startsWith('checkpoint-') && file.endsWith('.json')) {
          const filePath = join(checkpointDir, file);
          const stats = await stat(filePath);
          const timestamp = parseInt(file.match(/checkpoint-(\d+)\.json/)?.[1] || '0');
          
          checkpoints.push({
            path: filePath,
            timestamp,
            size: stats.size,
            created: stats.birthtime
          });
        }
      }
      
      // Sort by timestamp
      return checkpoints.sort((a, b) => a.timestamp - b.timestamp);
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Cleanup old checkpoints
   * @private
   */
  async _cleanupOldCheckpoints(repositoryId, operationType) {
    try {
      const checkpointDir = this._getCheckpointDirectory(repositoryId, operationType);
      const checkpoints = await this._listCheckpoints(checkpointDir);
      
      // Keep only the most recent checkpoints
      if (checkpoints.length > this.options.maxCheckpoints) {
        const toDelete = checkpoints.slice(0, -this.options.maxCheckpoints);
        
        for (const checkpoint of toDelete) {
          const { unlink } = await import('fs/promises');
          await unlink(checkpoint.path);
          
          this.emit('checkpoint:cleaned', {
            path: checkpoint.path,
            age: Date.now() - checkpoint.timestamp
          });
        }
      }
    } catch (error) {
      this.emit('checkpoint:error', { error, type: 'cleanup' });
    }
  }

  /**
   * Cleanup all checkpoints for an operation
   * @private
   */
  async _cleanupAllCheckpoints(repositoryId, operationType) {
    try {
      const checkpointDir = this._getCheckpointDirectory(repositoryId, operationType);
      const checkpoints = await this._listCheckpoints(checkpointDir);
      
      for (const checkpoint of checkpoints) {
        const { unlink } = await import('fs/promises');
        await unlink(checkpoint.path);
      }
      
      this.emit('checkpoint:all_cleaned', {
        repositoryId,
        operationType,
        count: checkpoints.length
      });
      
    } catch (error) {
      this.emit('checkpoint:error', { error, type: 'cleanup_all' });
    }
  }

  /**
   * Compress checkpoint data
   * @private
   */
  _compressCheckpoint(checkpoint) {
    // Simple compression: remove redundant data and compress file list
    const compressed = {
      ...checkpoint,
      processedFiles: checkpoint.processedFiles.map(file => ({
        p: file.path,
        t: file.processedAt,
        c: file.chunks,
        h: file.hash
      }))
    };
    
    return compressed;
  }

  /**
   * Decompress checkpoint data
   * @private
   */
  _decompressCheckpoint(compressed) {
    const decompressed = {
      ...compressed,
      processedFiles: compressed.processedFiles.map(file => ({
        path: file.p,
        processedAt: file.t,
        chunks: file.c,
        hash: file.h
      }))
    };
    
    return decompressed;
  }
}