import { FileWalker } from './file-walker.js';
import { FileReader } from './file-reader.js';
import { FileChunker } from './file-chunker.js';
import { ChangeDetector } from './change-detector.js';

/**
 * Repository Parser
 * Orchestrates streaming file discovery, reading, and chunking
 */
export class RepositoryParser {
  constructor(options = {}) {
    this.fileWalker = new FileWalker(options.fileWalker);
    this.fileReader = new FileReader(options.fileReader);
    this.fileChunker = new FileChunker(options.fileChunker);
    this.changeDetector = options.changeDetector;
    
    this.defaultChunkOptions = {
      targetChars: 4000,
      overlapRatio: 0.15,
      maxChars: 8000,
      minChars: 100,
      respectLineBreaks: true,
      respectWordBoundaries: true
    };
  }

  /**
   * Discover files in a repository with exclusion pattern support
   */
  async* discoverFiles(repoPath, excludePatterns = []) {
    yield* this.fileWalker.discoverFiles(repoPath, excludePatterns);
  }

  /**
   * Detect changes since last index using the enhanced change detection system
   */
  async* detectChanges(repoPath, repositoryId, options = {}) {
    if (!this.changeDetector) {
      throw new Error('ChangeDetector not configured. Please provide changeDetector in constructor options.');
    }

    // Collect current files
    const currentFilePaths = [];
    for await (const fileInfo of this.discoverFiles(repoPath, options.excludePatterns || [])) {
      currentFilePaths.push(fileInfo.path);
    }

    // Use the enhanced change detection system
    const changes = await this.changeDetector.detectChanges(repositoryId, currentFilePaths, {
      onProgress: options.onProgress,
      useOptimization: options.useOptimization !== false
    });

    // Yield all changes
    for (const change of changes.added) {
      yield change;
    }
    for (const change of changes.modified) {
      yield change;
    }
    for (const change of changes.deleted) {
      yield change;
    }

    // Return summary information
    return {
      stats: changes.stats,
      currentHashes: changes.currentHashes,
      summary: {
        added: changes.added.length,
        modified: changes.modified.length,
        deleted: changes.deleted.length,
        unchanged: changes.unchanged.length
      }
    };
  }

  /**
   * Detect changes and return as object (non-streaming version)
   */
  async detectChangesComplete(repoPath, repositoryId, options = {}) {
    if (!this.changeDetector) {
      throw new Error('ChangeDetector not configured. Please provide changeDetector in constructor options.');
    }

    // Collect current files
    const currentFilePaths = [];
    for await (const fileInfo of this.discoverFiles(repoPath, options.excludePatterns || [])) {
      currentFilePaths.push(fileInfo.path);
    }

    // Use the enhanced change detection system
    return await this.changeDetector.detectChanges(repositoryId, currentFilePaths, {
      onProgress: options.onProgress,
      useOptimization: options.useOptimization !== false
    });
  }

  /**
   * Chunk a file into processable text segments
   */
  async* chunkFile(filePath, options = {}) {
    try {
      // Get file metadata first
      const metadata = await this.fileReader.getFileMetadata(filePath);
      
      if (!metadata.readable) {
        return; // Skip non-readable files
      }
      
      // Read file content
      const content = await this.fileReader.readFileContent(filePath);
      
      if (!content || content.trim().length === 0) {
        return; // Skip empty files
      }
      
      // Generate relative path (this should be passed from caller ideally)
      const relativePath = filePath; // Simplified for now
      
      // Chunk the content
      const chunkOptions = { ...this.defaultChunkOptions, ...options };
      yield* this.fileChunker.chunkFile(filePath, relativePath, content, chunkOptions);
      
    } catch (error) {
      // Log error but don't stop processing
      console.warn(`Failed to chunk file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Process a single file: read and chunk it
   */
  async* processFile(fileInfo, options = {}) {
    try {
      // Read file content
      const content = await this.fileReader.readFileContent(fileInfo.path);
      
      if (!content || content.trim().length === 0) {
        return; // Skip empty files
      }
      
      // Chunk the content
      const chunkOptions = { ...this.defaultChunkOptions, ...options };
      yield* this.fileChunker.chunkFile(
        fileInfo.path, 
        fileInfo.relativePath, 
        content, 
        chunkOptions
      );
      
    } catch (error) {
      // Log error but don't stop processing
      console.warn(`Failed to process file ${fileInfo.path}: ${error.message}`);
    }
  }

  /**
   * Stream all chunks from a repository
   */
  async* streamRepositoryChunks(repoPath, options = {}) {
    const excludePatterns = options.excludePatterns || [];
    const chunkOptions = options.chunkOptions || {};
    
    let fileCount = 0;
    let chunkCount = 0;
    
    for await (const fileInfo of this.discoverFiles(repoPath, excludePatterns)) {
      fileCount++;
      
      // Emit progress if callback provided
      if (options.onFileStart) {
        options.onFileStart(fileInfo, fileCount);
      }
      
      for await (const chunk of this.processFile(fileInfo, chunkOptions)) {
        chunkCount++;
        
        // Emit progress if callback provided
        if (options.onChunk) {
          options.onChunk(chunk, chunkCount);
        }
        
        yield chunk;
      }
      
      // Emit progress if callback provided
      if (options.onFileComplete) {
        options.onFileComplete(fileInfo, fileCount);
      }
    }
    
    // Emit final stats if callback provided
    if (options.onComplete) {
      options.onComplete({ fileCount, chunkCount });
    }
  }

  /**
   * Get repository statistics without processing
   */
  async getRepositoryStats(repoPath, excludePatterns = []) {
    let fileCount = 0;
    let totalSize = 0;
    let textFiles = 0;
    let binaryFiles = 0;
    const extensions = new Map();
    
    for await (const fileInfo of this.discoverFiles(repoPath, excludePatterns)) {
      fileCount++;
      totalSize += fileInfo.size;
      
      // Count extensions
      const ext = fileInfo.extension || 'no-extension';
      extensions.set(ext, (extensions.get(ext) || 0) + 1);
      
      // Check if file is text
      try {
        const metadata = await this.fileReader.getFileMetadata(fileInfo.path);
        if (metadata.isText) {
          textFiles++;
        } else {
          binaryFiles++;
        }
      } catch {
        binaryFiles++;
      }
    }
    
    return {
      fileCount,
      totalSize,
      textFiles,
      binaryFiles,
      extensions: Object.fromEntries(extensions),
      averageFileSize: fileCount > 0 ? totalSize / fileCount : 0
    };
  }
}