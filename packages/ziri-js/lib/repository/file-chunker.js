import crypto from 'node:crypto';
import path from 'node:path';

/**
 * Advanced File Chunker with configurable chunk sizes and overlap
 * Provides intelligent text chunking for embedding generation
 */
export class FileChunker {
  constructor(options = {}) {
    this.defaultOptions = {
      targetChars: 4000,
      overlapRatio: 0.15,
      maxChars: 8000,
      minChars: 100,
      respectLineBreaks: true,
      respectWordBoundaries: true
    };
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  _estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate unique chunk ID
   */
  _generateChunkId(filePath, chunkIndex, content) {
    const hash = crypto.createHash('md5')
      .update(`${filePath}:${chunkIndex}:${content.substring(0, 100)}`)
      .digest('hex');
    return `chunk_${hash.substring(0, 12)}`;
  }

  /**
   * Find the best split point respecting boundaries
   */
  _findSplitPoint(text, targetIndex, respectLineBreaks, respectWordBoundaries) {
    if (targetIndex >= text.length) {
      return text.length;
    }

    let splitIndex = targetIndex;

    // Try to respect line breaks first
    if (respectLineBreaks) {
      // Look backwards for a line break
      for (let i = targetIndex; i >= Math.max(0, targetIndex - 200); i--) {
        if (text[i] === '\n') {
          splitIndex = i + 1;
          break;
        }
      }
      
      // If no line break found nearby, look forward
      if (splitIndex === targetIndex) {
        for (let i = targetIndex; i < Math.min(text.length, targetIndex + 200); i++) {
          if (text[i] === '\n') {
            splitIndex = i + 1;
            break;
          }
        }
      }
    }

    // Try to respect word boundaries if line breaks didn't work
    if (respectWordBoundaries && splitIndex === targetIndex) {
      // Look backwards for whitespace
      for (let i = targetIndex; i >= Math.max(0, targetIndex - 100); i--) {
        if (/\s/.test(text[i])) {
          splitIndex = i + 1;
          break;
        }
      }
      
      // If no whitespace found nearby, look forward
      if (splitIndex === targetIndex) {
        for (let i = targetIndex; i < Math.min(text.length, targetIndex + 100); i++) {
          if (/\s/.test(text[i])) {
            splitIndex = i + 1;
            break;
          }
        }
      }
    }

    return splitIndex;
  }

  /**
   * Calculate line numbers for a chunk
   */
  _calculateLineNumbers(text, chunkStart, chunkEnd) {
    const beforeChunk = text.substring(0, chunkStart);
    const chunkText = text.substring(chunkStart, chunkEnd);
    
    const startLine = (beforeChunk.match(/\n/g) || []).length + 1;
    const linesInChunk = (chunkText.match(/\n/g) || []).length;
    const endLine = startLine + linesInChunk;
    
    return { startLine, endLine };
  }

  /**
   * Chunk text content with configurable options
   */
  chunkText(text, filePath, relativePath, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const chunks = [];
    
    if (!text || text.trim().length === 0) {
      return chunks;
    }

    // If text is smaller than minimum chunk size, return as single chunk
    if (text.length <= opts.minChars) {
      const { startLine, endLine } = this._calculateLineNumbers(text, 0, text.length);
      
      chunks.push({
        content: text,
        filePath,
        relativePath,
        startLine,
        endLine,
        chunkId: this._generateChunkId(filePath, 0, text),
        size: text.length,
        tokenCount: this._estimateTokenCount(text)
      });
      
      return chunks;
    }

    const overlap = Math.floor(opts.targetChars * opts.overlapRatio);
    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < text.length) {
      // Calculate target end position
      let targetEnd = Math.min(text.length, currentIndex + opts.targetChars);
      
      // Don't exceed maximum chunk size
      if (targetEnd - currentIndex > opts.maxChars) {
        targetEnd = currentIndex + opts.maxChars;
      }

      // Find the best split point
      const actualEnd = this._findSplitPoint(
        text, 
        targetEnd, 
        opts.respectLineBreaks, 
        opts.respectWordBoundaries
      );

      // Extract chunk content
      const chunkContent = text.substring(currentIndex, actualEnd).trim();
      
      // Skip empty chunks
      if (chunkContent.length === 0) {
        currentIndex = actualEnd;
        continue;
      }

      // Calculate line numbers
      const { startLine, endLine } = this._calculateLineNumbers(text, currentIndex, actualEnd);

      // Create chunk object
      chunks.push({
        content: chunkContent,
        filePath,
        relativePath,
        startLine,
        endLine,
        chunkId: this._generateChunkId(filePath, chunkIndex, chunkContent),
        size: chunkContent.length,
        tokenCount: this._estimateTokenCount(chunkContent)
      });

      // Move to next chunk with overlap
      if (actualEnd === text.length) {
        break;
      }

      // Calculate next starting position with overlap
      const nextStart = Math.max(currentIndex + 1, actualEnd - overlap);
      currentIndex = this._findSplitPoint(
        text,
        nextStart,
        opts.respectLineBreaks,
        opts.respectWordBoundaries
      );

      // Prevent infinite loops
      if (currentIndex <= chunkIndex) {
        currentIndex = actualEnd;
      }

      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Chunk file content asynchronously
   */
  async* chunkFile(filePath, relativePath, content, options = {}) {
    const chunks = this.chunkText(content, filePath, relativePath, options);
    
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  /**
   * Get chunking statistics for a text
   */
  getChunkingStats(text, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const chunks = this.chunkText(text, 'temp', 'temp', opts);
    
    const sizes = chunks.map(c => c.size);
    const tokenCounts = chunks.map(c => c.tokenCount);
    
    return {
      totalChunks: chunks.length,
      totalCharacters: text.length,
      averageChunkSize: sizes.reduce((a, b) => a + b, 0) / sizes.length || 0,
      minChunkSize: Math.min(...sizes) || 0,
      maxChunkSize: Math.max(...sizes) || 0,
      totalTokens: tokenCounts.reduce((a, b) => a + b, 0),
      averageTokensPerChunk: tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length || 0
    };
  }
}