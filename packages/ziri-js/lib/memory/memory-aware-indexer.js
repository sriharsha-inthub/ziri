/**
 * Memory-Aware Indexer
 * Integrates memory optimization with the existing indexing pipeline
 */

import { EventEmitter } from 'events';
import { resolveHome } from '../home.js';
import { MemoryMonitor, CheckpointManager, StreamingProcessor } from './index.js';
import { RepositoryParser } from '../repository/repository-parser.js';
import { EmbeddingPipeline } from '../embedding/embedding-pipeline.js';
import { IndexStore } from '../storage/index-store.js';
import { MetadataManager } from '../repository/metadata-manager.js';
import { ChangeDetector } from '../repository/change-detector.js';
import { StorageManager } from '../storage/storage-manager.js';

export class MemoryAwareIndexer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      memoryLimitMB: options.memoryLimitMB || 512,
      batchSize: options.batchSize || 50,
      checkpointInterval: options.checkpointInterval || 100,
      enableCheckpoints: options.enableCheckpoints !== false,
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      baseDirectory: options.baseDirectory || '~/.ziri',
      ...options
    };

    // Initialize components
    this.embeddingPipeline = new EmbeddingPipeline(
      options.embeddingClient,
      options.embeddingPipeline
    );
    this.indexStore = new IndexStore(resolveHome());

    // Initialize memory management
    this.checkpointManager = new CheckpointManager(resolveHome(), {
      checkpointInterval: this.options.checkpointInterval,
      maxCheckpoints: 5,
      autoCleanup: true
    });

    this.streamingProcessor = new StreamingProcessor({
      memoryLimitMB: this.options.memoryLimitMB,
      batchSize: this.options.batchSize,
      checkpointManager: this.checkpointManager,
      enableMemoryMonitoring: this.options.enableMemoryMonitoring,
      pauseOnMemoryPressure: true
    });

    // Setup event forwarding
    this._setupEventForwarding();
  }

  /**
   * Get or create repository parser with proper dependencies
   * @private
   */
  _getRepositoryParser(repoPath, repositoryId) {
    if (!this.repositoryParser) {
      // Create storage and metadata managers
      const storageManager = new StorageManager(resolveHome());
      const metadataManager = new MetadataManager(storageManager);

      // Create change detector with required dependencies
      const changeDetector = new ChangeDetector(repoPath, metadataManager);

      // Create repository parser with change detector
      this.repositoryParser = new RepositoryParser({
        changeDetector: changeDetector
      });
    }
    return this.repositoryParser;
  }

  /**
   * Index a repository with memory optimization and checkpointing
   */
  async indexRepository(repoPath, options = {}) {
    const {
      provider = 'openai',
      excludePatterns = [],
      forceFullIndex = false,
      resumeFromCheckpoint = true
    } = options;
    
    try {
      // Initialize storage
      await this.indexStore.initialize();
      
      // Create or get repository
      const repositoryId = await this.indexStore.createRepository(repoPath);
      
      this.emit('indexing:started', {
        repositoryId,
        repoPath,
        provider,
        memoryLimitMB: this.options.memoryLimitMB
      });
      
      // Check if we should resume from checkpoint
      let shouldResume = false;
      if (!forceFullIndex && resumeFromCheckpoint) {
        const resumeInfo = await this.checkpointManager.shouldResume(repositoryId, 'indexing');
        shouldResume = resumeInfo.shouldResume;
        
        if (shouldResume) {
          this.emit('indexing:resumed', {
            repositoryId,
            processedCount: resumeInfo.checkpoint.processedCount
          });
        }
      }
      
      // Determine which files to process
      const fileStream = shouldResume
        ? this._getIncrementalFiles(repoPath, repositoryId, excludePatterns)
        : this._getAllFiles(repoPath, excludePatterns);
      
      // Create the processing pipeline
      const processorFn = this._createIndexingProcessor(repositoryId, provider);
      
      // Process files with streaming and memory management
      let totalProcessed = 0;
      let totalChunks = 0;
      
      for await (const result of this.streamingProcessor.processStream(
        fileStream,
        processorFn,
        {
          repositoryId,
          operationType: 'indexing',
          resumeFromCheckpoint: shouldResume
        }
      )) {
        totalProcessed++;
        totalChunks += result.chunks || 0;
        
        this.emit('file:processed', {
          filePath: result.filePath,
          chunks: result.chunks,
          success: result.success,
          totalProcessed
        });
      }
      
      // Update repository metadata
      const metadata = await this.indexStore.getMetadata(repositoryId);
      metadata.lastIndexed = new Date();
      metadata.embeddingProvider = provider;
      await this.indexStore.updateMetadata(repositoryId, metadata);
      
      const stats = this.streamingProcessor.getStats();
      
      this.emit('indexing:completed', {
        repositoryId,
        totalProcessed,
        totalChunks,
        duration: stats.elapsed,
        memoryStats: stats.memory
      });
      
      return {
        repositoryId,
        filesProcessed: totalProcessed,
        chunksGenerated: totalChunks,
        duration: stats.elapsed,
        memoryPeakUsage: stats.memory.peakUsage
      };
      
    } catch (error) {
      this.emit('indexing:error', { error, repoPath });
      throw error;
    }
  }

  /**
   * Update repository incrementally with memory optimization
   */
  async updateRepository(repoPath, options = {}) {
    const {
      provider = 'openai',
      excludePatterns = []
    } = options;

    try {
      // Get repository ID
      const repositoryId = this.indexStore.storageManager.generateRepositoryId(repoPath);

      if (!await this.indexStore.repositoryExists(repositoryId)) {
        throw new Error(`Repository not found: ${repoPath}`);
      }

      this.emit('update:started', { repositoryId, repoPath });

      // Get repository parser with proper dependencies
      const repositoryParser = this._getRepositoryParser(repoPath, repositoryId);

      // Detect changes
      const changes = await repositoryParser.detectChangesComplete(
        repoPath,
        repositoryId,
        { excludePatterns }
      );
      
      if (changes.added.length === 0 && changes.modified.length === 0 && changes.deleted.length === 0) {
        this.emit('update:no_changes', { repositoryId });
        return { repositoryId, changes: 0 };
      }
      
      // Remove deleted files from index
      if (changes.deleted.length > 0) {
        const deletedChunkIds = [];
        for (const deletedFile of changes.deleted) {
          // This would need to be implemented to find chunk IDs for deleted files
          // For now, we'll skip this step
        }
        
        if (deletedChunkIds.length > 0) {
          await this.indexStore.removeEmbeddings(repositoryId, deletedChunkIds);
        }
      }
      
      // Process changed files
      const changedFiles = [...changes.added, ...changes.modified];
      
      if (changedFiles.length > 0) {
        const processorFn = this._createIndexingProcessor(repositoryId, provider);
        
        let processedCount = 0;
        
        for await (const result of this.streamingProcessor.processStream(
          changedFiles,
          processorFn,
          {
            repositoryId,
            operationType: 'update',
            resumeFromCheckpoint: false
          }
        )) {
          processedCount++;
          
          this.emit('file:updated', {
            filePath: result.filePath,
            chunks: result.chunks,
            success: result.success
          });
        }
      }
      
      // Update metadata
      const metadata = await this.indexStore.getMetadata(repositoryId);
      metadata.lastIndexed = new Date();
      // Convert currentHashes to Map if it's not already
      metadata.fileHashes = changes.currentHashes instanceof Map 
        ? changes.currentHashes 
        : new Map(Object.entries(changes.currentHashes || {}));
      await this.indexStore.updateMetadata(repositoryId, metadata);
      
      this.emit('update:completed', {
        repositoryId,
        changes: changedFiles.length,
        deleted: changes.deleted.length
      });
      
      return {
        repositoryId,
        changes: changedFiles.length,
        deleted: changes.deleted.length
      };
      
    } catch (error) {
      this.emit('update:error', { error, repoPath });
      throw error;
    }
  }

  /**
   * Get indexing statistics including memory usage
   */
  async getIndexingStats(repositoryId) {
    const indexStats = await this.indexStore.getIndexStats(repositoryId);
    const storageStats = await this.indexStore.getStorageStats(repositoryId);
    const processingStats = this.streamingProcessor.getStats();
    
    return {
      index: indexStats,
      storage: storageStats,
      processing: processingStats,
      memory: processingStats.memory
    };
  }

  /**
   * Pause indexing operation
   */
  pause() {
    this.streamingProcessor.pause();
    this.emit('indexing:paused');
  }

  /**
   * Resume indexing operation
   */
  resume() {
    this.streamingProcessor.resume();
    this.emit('indexing:resumed');
  }

  /**
   * Get all files for full indexing
   * @private
   */
  async* _getAllFiles(repoPath, excludePatterns) {
    const repositoryId = this.indexStore.storageManager.generateRepositoryId(repoPath);
    const repositoryParser = this._getRepositoryParser(repoPath, repositoryId);
    for await (const fileInfo of repositoryParser.discoverFiles(repoPath, excludePatterns)) {
      yield fileInfo;
    }
  }

  /**
   * Get incremental files for update indexing
   * @private
   */
  async* _getIncrementalFiles(repoPath, repositoryId, excludePatterns) {
    const repositoryParser = this._getRepositoryParser(repoPath, repositoryId);
    for await (const change of repositoryParser.detectChanges(
      repoPath,
      repositoryId,
      { excludePatterns }
    )) {
      if (change.changeType === 'added' || change.changeType === 'modified') {
        yield change;
      }
    }
  }

  /**
   * Create the indexing processor function
   * @private
   */
  _createIndexingProcessor(repositoryId, provider) {
    return async (fileBatch) => {
      const results = [];

      for (const fileInfo of fileBatch) {
        try {
          // Get repository parser with proper dependencies
          const repoPath = fileInfo.path || fileInfo.filePath;
          // Extract repository path from file path (simplified approach)
          const repositoryPath = repoPath.split('/').slice(0, -1).join('/') || '.';
          const repositoryParser = this._getRepositoryParser(repositoryPath, repositoryId);

          // Generate chunks for the file
          const chunks = [];

          for await (const chunk of repositoryParser.processFile(fileInfo)) {
            chunks.push(chunk);
          }

          if (chunks.length === 0) {
            results.push({
              filePath: fileInfo.path || fileInfo.filePath,
              chunks: 0,
              success: true,
              skipped: true
            });
            continue;
          }

          // Generate embeddings
          const embeddedChunks = [];

          for await (const embeddedChunk of this.embeddingPipeline.processChunks(
            this._arrayToAsyncIterable(chunks),
            provider
          )) {
            embeddedChunks.push({
              chunkId: embeddedChunk.id,
              content: embeddedChunk.content,
              filePath: embeddedChunk.filePath,
              startLine: embeddedChunk.startLine,
              endLine: embeddedChunk.endLine,
              embedding: embeddedChunk.embedding,
              fileHash: fileInfo.hash || fileInfo.fileHash,
              provider: provider
            });
          }

          // Store embeddings
          if (embeddedChunks.length > 0) {
            await this.indexStore.storeEmbeddings(repositoryId, embeddedChunks);
          }

          results.push({
            filePath: fileInfo.path || fileInfo.filePath,
            chunks: embeddedChunks.length,
            success: true
          });

        } catch (error) {
          results.push({
            filePath: fileInfo.path || fileInfo.filePath,
            chunks: 0,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    };
  }

  /**
   * Convert array to async iterable
   * @private
   */
  async* _arrayToAsyncIterable(array) {
    for (const item of array) {
      yield item;
    }
  }

  /**
   * Setup event forwarding from components
   * @private
   */
  _setupEventForwarding() {
    // Forward streaming processor events
    this.streamingProcessor.on('processing:started', (data) => {
      this.emit('processing:started', data);
    });
    
    this.streamingProcessor.on('batch:completed', (data) => {
      this.emit('batch:completed', data);
    });
    
    this.streamingProcessor.on('memory:warning', (data) => {
      this.emit('memory:warning', data);
    });
    
    this.streamingProcessor.on('memory:critical', (data) => {
      this.emit('memory:critical', data);
    });
    
    this.streamingProcessor.on('processing:paused', (data) => {
      this.emit('processing:paused', data);
    });
    
    this.streamingProcessor.on('checkpoint:saved', (data) => {
      this.emit('checkpoint:saved', data);
    });
    
    // Forward embedding pipeline events
    this.embeddingPipeline.on('batch:complete', (data) => {
      this.emit('embedding:batch:complete', data);
    });
    
    this.embeddingPipeline.on('batch:error', (data) => {
      this.emit('embedding:batch:error', data);
    });
  }
}
