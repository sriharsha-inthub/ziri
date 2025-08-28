/**
 * FAISS-based Index Store Implementation
 * Provides efficient vector storage and retrieval with repository isolation
 */

import faissNode from 'faiss-node';
const { IndexFlatIP, IndexFlatL2, MetricType } = faissNode;
import { join } from 'path';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { StorageManager } from './storage-manager.js';

export class IndexStore {
  constructor(baseDirectory = '~/.ziri') {
    this.storageManager = new StorageManager(baseDirectory);
    this.indexes = new Map(); // Cache for loaded indexes
    this.metadata = new Map(); // Cache for metadata
  }

  /**
   * Initialize the storage system
   */
  async initialize() {
    await this.storageManager.initialize();
  }

  /**
   * Create a new repository index store
   */
  async createRepository(repoPath) {
    const repositoryId = this.storageManager.generateRepositoryId(repoPath);
    
    // Create storage directories
    await this.storageManager.createRepositoryStorage(repositoryId);
    
    // Initialize metadata
    const metadata = {
      repositoryPath: repoPath,
      repositoryId,
      lastIndexed: new Date(),
      fileHashes: new Map(),
      totalChunks: 0,
      embeddingProvider: null,
      version: '1.0.0',
      dimensions: null,
      metricType: 'cosine'
    };
    
    await this.updateMetadata(repositoryId, metadata);
    
    return repositoryId;
  }

  /**
   * Store embeddings in batch for performance
   */
  async storeEmbeddings(repositoryId, embeddings) {
    if (!embeddings || embeddings.length === 0) {
      return;
    }

    // Load or create index
    const index = await this.getOrCreateIndex(repositoryId, embeddings[0].embedding.length);
    
    // Prepare vectors and metadata
    const vectors = [];
    const records = [];
    
    for (const embedding of embeddings) {
      vectors.push(embedding.embedding);
      records.push({
        id: embedding.chunkId,
        content: embedding.content,
        filePath: embedding.filePath,
        startLine: embedding.startLine,
        endLine: embedding.endLine,
        fileHash: embedding.fileHash,
        createdAt: new Date(),
        provider: embedding.provider || 'unknown',
        modelVersion: embedding.modelVersion || 'unknown'
      });
    }

    // Add vectors to FAISS index
    const startId = index.ntotal();
    
    // FAISS expects a flat array of all vector components
    const flatVectors = [];
    for (const vector of vectors) {
      flatVectors.push(...vector);
    }
    
    index.add(flatVectors);
    
    // Store metadata records
    await this.storeRecords(repositoryId, records, startId);
    
    // Store vectors separately for retrieval
    await this.storeVectors(repositoryId, vectors, startId);
    
    // Save index to disk
    await this.saveIndex(repositoryId, index);
    
    // Update repository metadata
    const metadata = await this.getMetadata(repositoryId);
    metadata.totalChunks += embeddings.length;
    metadata.lastIndexed = new Date();
    if (!metadata.embeddingProvider && embeddings[0].provider) {
      metadata.embeddingProvider = embeddings[0].provider;
    }
    await this.updateMetadata(repositoryId, metadata);
  }

  /**
   * Remove embeddings by chunk IDs
   */
  async removeEmbeddings(repositoryId, chunkIds) {
    if (!chunkIds || chunkIds.length === 0) {
      return;
    }

    // Load records to find vector IDs
    const records = await this.loadRecords(repositoryId);
    const vectorIds = [];
    
    for (let i = 0; i < records.length; i++) {
      if (chunkIds.includes(records[i].id)) {
        vectorIds.push(i);
      }
    }

    if (vectorIds.length === 0) {
      return;
    }

    // Remove from FAISS index (requires rebuilding)
    const index = await this.getOrCreateIndex(repositoryId);
    const vectors = await this.loadVectors(repositoryId);
    const remainingRecords = [];
    const remainingVectors = [];
    
    for (let i = 0; i < records.length; i++) {
      if (!vectorIds.includes(i)) {
        remainingRecords.push(records[i]);
        // Get vector from stored vectors
        const vectorData = vectors.find(v => v.id === i);
        if (vectorData) {
          remainingVectors.push(vectorData.vector);
        }
      }
    }

    // Rebuild index with remaining vectors
    const newIndex = await this.createNewIndex(repositoryId, remainingVectors.length > 0 ? remainingVectors[0].length : 0);
    if (remainingVectors.length > 0) {
      // FAISS expects a flat array of all vector components
      const flatVectors = [];
      for (const vector of remainingVectors) {
        flatVectors.push(...vector);
      }
      newIndex.add(flatVectors);
    }
    
    // Save updated index and records with proper re-indexing
    await this.saveIndex(repositoryId, newIndex);
    
    // Re-index records and vectors with sequential IDs
    const reindexedRecords = remainingRecords.map((record, index) => ({
      ...record,
      vectorId: index
    }));
    
    const reindexedVectors = remainingVectors.map((vector, index) => ({
      id: index,
      vector: vector
    }));
    
    // Store with replace=true to overwrite existing data
    await writeFile(
      this.storageManager.getRepositoryPaths(repositoryId).vectors.replace('.db', '-records.json'),
      JSON.stringify(reindexedRecords, null, 2)
    );
    
    await writeFile(
      this.storageManager.getRepositoryPaths(repositoryId).vectors.replace('.db', '-vectors.json'),
      JSON.stringify(reindexedVectors, null, 2)
    );
    
    // Update cache
    this.indexes.set(repositoryId, newIndex);
    
    // Update metadata
    const metadata = await this.getMetadata(repositoryId);
    metadata.totalChunks = remainingRecords.length;
    metadata.lastIndexed = new Date();
    await this.updateMetadata(repositoryId, metadata);
  }

  /**
   * Query embeddings by similarity
   */
  async queryEmbeddings(repositoryId, queryVector, limit = 10, threshold = 0.0) {
    try {
      const index = await this.getOrCreateIndex(repositoryId, queryVector.length);
      
      if (index.ntotal() === 0) {
        return [];
      }
    } catch (error) {
      // If index doesn't exist or can't be created, return empty results
      return [];
    }
    
    const index = await this.getOrCreateIndex(repositoryId, queryVector.length);

    // Perform similarity search
    const result = index.search(queryVector, Math.min(limit, index.ntotal()));
    
    // Load records and vectors to get metadata
    const records = await this.loadRecords(repositoryId);
    const vectors = await this.loadVectors(repositoryId);
    
    // Build search results
    const searchResults = [];
    
    for (let i = 0; i < result.labels.length; i++) {
      const vectorId = result.labels[i];
      const score = this.convertDistanceToScore(result.distances[i]);
      
      if (score >= threshold && vectorId < records.length) {
        const record = records[vectorId];
        const vectorData = vectors.find(v => v.id === vectorId);
        const vector = vectorData ? vectorData.vector : [];
        
        searchResults.push({
          chunkId: record.id,
          score,
          content: record.content,
          filePath: record.filePath,
          startLine: record.startLine,
          endLine: record.endLine,
          embedding: vector,
          metadata: {
            fileHash: record.fileHash,
            createdAt: record.createdAt,
            provider: record.provider,
            modelVersion: record.modelVersion,
            size: record.content.length,
            tokenCount: this.estimateTokenCount(record.content)
          }
        });
      }
    }

    return searchResults;
  }

  /**
   * Get repository metadata
   */
  async getMetadata(repositoryId) {
    if (this.metadata.has(repositoryId)) {
      return this.metadata.get(repositoryId);
    }

    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    try {
      const metadataJson = await readFile(paths.metadata, 'utf8');
      const metadata = JSON.parse(metadataJson);
      
      // Convert Map from JSON
      if (metadata.fileHashes && typeof metadata.fileHashes === 'object') {
        metadata.fileHashes = new Map(Object.entries(metadata.fileHashes));
      } else {
        metadata.fileHashes = new Map();
      }
      
      // Convert dates
      metadata.lastIndexed = new Date(metadata.lastIndexed);
      
      this.metadata.set(repositoryId, metadata);
      return metadata;
    } catch (error) {
      // Return default metadata if file doesn't exist
      const defaultMetadata = {
        repositoryPath: '',
        repositoryId,
        lastIndexed: new Date(),
        fileHashes: new Map(),
        totalChunks: 0,
        embeddingProvider: null,
        version: '1.0.0',
        dimensions: null,
        metricType: 'cosine'
      };
      
      this.metadata.set(repositoryId, defaultMetadata);
      return defaultMetadata;
    }
  }

  /**
   * Update repository metadata
   */
  async updateMetadata(repositoryId, metadata) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    // Convert Map to JSON-serializable format
    const serializable = {
      ...metadata,
      fileHashes: Object.fromEntries(metadata.fileHashes || new Map()),
      lastIndexed: metadata.lastIndexed.toISOString()
    };
    
    await writeFile(paths.metadata, JSON.stringify(serializable, null, 2));
    this.metadata.set(repositoryId, metadata);
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(repositoryId) {
    return await this.storageManager.repositoryExists(repositoryId);
  }

  /**
   * Delete entire repository index
   */
  async deleteRepository(repositoryId) {
    // Remove from caches
    this.indexes.delete(repositoryId);
    this.metadata.delete(repositoryId);
    
    // Delete from storage
    return await this.storageManager.deleteRepository(repositoryId);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(repositoryId) {
    const metadata = await this.getMetadata(repositoryId);
    const storageStats = await this.storageManager.getStorageStats(repositoryId);
    
    // Count provider distribution
    const records = await this.loadRecords(repositoryId);
    const providerStats = new Map();
    
    for (const record of records) {
      const provider = record.provider || 'unknown';
      providerStats.set(provider, (providerStats.get(provider) || 0) + 1);
    }
    
    return {
      totalChunks: metadata.totalChunks,
      totalFiles: metadata.fileHashes.size,
      storageSize: storageStats.totalSize,
      createdAt: metadata.lastIndexed, // Use lastIndexed as creation proxy
      lastUpdated: metadata.lastIndexed,
      providerStats
    };
  }

  // Private helper methods

  /**
   * Get or create FAISS index for repository
   */
  async getOrCreateIndex(repositoryId, dimensions = null) {
    if (this.indexes.has(repositoryId)) {
      return this.indexes.get(repositoryId);
    }

    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    try {
      // Try to load existing index
      await access(paths.vectors);
      const index = IndexFlatIP.read(paths.vectors);
      this.indexes.set(repositoryId, index);
      return index;
    } catch (error) {
      // Create new index
      if (!dimensions) {
        throw new Error(`Cannot create index without dimensions for repository ${repositoryId}`);
      }
      
      const index = await this.createNewIndex(repositoryId, dimensions);
      this.indexes.set(repositoryId, index);
      return index;
    }
  }

  /**
   * Create a new FAISS index
   */
  async createNewIndex(repositoryId, dimensions) {
    // Use Inner Product (cosine similarity) by default
    const index = new IndexFlatIP(dimensions);
    
    // Update metadata with dimensions
    const metadata = await this.getMetadata(repositoryId);
    metadata.dimensions = dimensions;
    await this.updateMetadata(repositoryId, metadata);
    
    return index;
  }

  /**
   * Save FAISS index to disk
   */
  async saveIndex(repositoryId, index) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    
    // Ensure directory exists
    await mkdir(join(paths.vectors, '..'), { recursive: true });
    
    // Save index
    index.write(paths.vectors);
  }

  /**
   * Store vector records metadata
   */
  async storeRecords(repositoryId, records, startId = 0) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    const recordsPath = paths.vectors.replace('.db', '-records.json');
    
    // Add vector IDs to records
    const recordsWithIds = records.map((record, index) => ({
      ...record,
      vectorId: startId + index
    }));
    
    await writeFile(recordsPath, JSON.stringify(recordsWithIds, null, 2));
  }

  /**
   * Store vectors separately for retrieval
   */
  async storeVectors(repositoryId, vectors, startId = 0, replace = false) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    const vectorsPath = paths.vectors.replace('.db', '-vectors.json');
    
    let existingVectors = [];
    if (!replace) {
      try {
        const existingData = await readFile(vectorsPath, 'utf8');
        existingVectors = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist, start with empty array
      }
    }
    
    // Add new vectors
    const vectorsWithIds = vectors.map((vector, index) => ({
      id: startId + index,
      vector: vector
    }));
    
    if (replace) {
      existingVectors = vectorsWithIds;
    } else {
      existingVectors.push(...vectorsWithIds);
    }
    
    await writeFile(vectorsPath, JSON.stringify(existingVectors, null, 2));
  }

  /**
   * Load vectors by ID
   */
  async loadVectors(repositoryId) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    const vectorsPath = paths.vectors.replace('.db', '-vectors.json');
    
    try {
      const vectorsData = await readFile(vectorsPath, 'utf8');
      return JSON.parse(vectorsData);
    } catch (error) {
      return [];
    }
  }

  /**
   * Load vector records metadata
   */
  async loadRecords(repositoryId) {
    const paths = this.storageManager.getRepositoryPaths(repositoryId);
    const recordsPath = paths.vectors.replace('.db', '-records.json');
    
    try {
      const recordsJson = await readFile(recordsPath, 'utf8');
      const records = JSON.parse(recordsJson);
      
      // Convert date strings back to Date objects
      return records.map(record => ({
        ...record,
        createdAt: new Date(record.createdAt)
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Convert FAISS distance to similarity score
   */
  convertDistanceToScore(distance) {
    // For Inner Product (IP), higher values mean more similar
    // For L2, lower values mean more similar
    // Normalize to 0-1 range where 1 is most similar
    
    // For IP (cosine similarity), distance is already similarity
    return Math.max(0, Math.min(1, distance));
  }

  /**
   * Estimate token count for text
   */
  estimateTokenCount(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Batch write operations for better performance
   */
  async batchStoreEmbeddings(repositoryId, embeddingBatches) {
    const allEmbeddings = embeddingBatches.flat();
    
    if (allEmbeddings.length === 0) {
      return;
    }

    // Process in chunks to avoid memory issues
    const chunkSize = 1000;
    
    for (let i = 0; i < allEmbeddings.length; i += chunkSize) {
      const chunk = allEmbeddings.slice(i, i + chunkSize);
      await this.storeEmbeddings(repositoryId, chunk);
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(repositoryId) {
    try {
      const index = await this.getOrCreateIndex(repositoryId);
      const metadata = await this.getMetadata(repositoryId);
      
      return {
        totalVectors: index.ntotal(),
        dimensions: metadata.dimensions,
        metricType: metadata.metricType,
        indexType: 'FlatIP',
        memoryUsage: this.estimateIndexMemoryUsage(index.ntotal(), metadata.dimensions)
      };
    } catch (error) {
      return {
        totalVectors: 0,
        dimensions: 0,
        metricType: 'unknown',
        indexType: 'none',
        memoryUsage: 0
      };
    }
  }

  /**
   * Estimate memory usage of index
   */
  estimateIndexMemoryUsage(vectorCount, dimensions) {
    // Each float32 is 4 bytes
    return vectorCount * dimensions * 4;
  }

  /**
   * Optimize index for better search performance
   */
  async optimizeIndex(repositoryId) {
    // For FlatIP, no optimization needed as it's already optimal for exact search
    // This method is here for future index types that might benefit from optimization
    const metadata = await this.getMetadata(repositoryId);
    metadata.lastIndexed = new Date();
    await this.updateMetadata(repositoryId, metadata);
    
    return true;
  }

  /**
   * Validate index integrity
   */
  async validateIndex(repositoryId) {
    try {
      const index = await this.getOrCreateIndex(repositoryId);
      const records = await this.loadRecords(repositoryId);
      const metadata = await this.getMetadata(repositoryId);
      
      const issues = [];
      
      // Check if vector count matches record count
      if (index.ntotal() !== records.length) {
        issues.push(`Vector count (${index.ntotal()}) doesn't match record count (${records.length})`);
      }
      
      // Check if metadata total matches actual count
      if (metadata.totalChunks !== records.length) {
        issues.push(`Metadata total (${metadata.totalChunks}) doesn't match record count (${records.length})`);
      }
      
      // Check for duplicate chunk IDs
      const chunkIds = new Set();
      const duplicates = [];
      
      for (const record of records) {
        if (chunkIds.has(record.id)) {
          duplicates.push(record.id);
        } else {
          chunkIds.add(record.id);
        }
      }
      
      if (duplicates.length > 0) {
        issues.push(`Duplicate chunk IDs found: ${duplicates.join(', ')}`);
      }
      
      return {
        valid: issues.length === 0,
        issues,
        stats: {
          vectorCount: index.ntotal(),
          recordCount: records.length,
          metadataTotal: metadata.totalChunks,
          uniqueChunks: chunkIds.size
        }
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Validation failed: ${error.message}`],
        stats: null
      };
    }
  }
}
