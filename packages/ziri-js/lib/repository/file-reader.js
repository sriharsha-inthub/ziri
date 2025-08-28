import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Streaming File Reader
 * Processes files one at a time with memory efficiency
 */
export class FileReader {
  constructor(options = {}) {
    this.encoding = options.encoding || 'utf8';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.chunkSize = options.chunkSize || 64 * 1024; // 64KB chunks for streaming
  }

  /**
   * Check if file is text-based and readable
   */
  async _isTextFile(filePath) {
    try {
      // Read first few bytes to detect binary content
      const buffer = Buffer.alloc(512);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fd.read(buffer, 0, 512, 0);
      await fd.close();
      
      // Empty files are considered text files
      if (bytesRead === 0) return true;
      
      // Check for null bytes (common in binary files)
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) return false;
      }
      
      // Check for high ratio of non-printable characters
      let printableCount = 0;
      for (let i = 0; i < bytesRead; i++) {
        const byte = buffer[i];
        if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
          printableCount++;
        }
      }
      
      return (printableCount / bytesRead) > 0.7;
    } catch (error) {
      return false;
    }
  }

  /**
   * Read file content as string with streaming for large files
   */
  async readFileContent(filePath) {
    try {
      const stat = await fs.stat(filePath);
      
      // Skip files that are too large
      if (stat.size > this.maxFileSize) {
        throw new Error(`File too large: ${stat.size} bytes (max: ${this.maxFileSize})`);
      }
      
      // Check if file is text-based
      if (!(await this._isTextFile(filePath))) {
        throw new Error('File appears to be binary');
      }
      
      // For smaller files, read directly
      if (stat.size < this.chunkSize) {
        return await fs.readFile(filePath, this.encoding);
      }
      
      // For larger files, use streaming
      return await this._readFileStreaming(filePath);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Read large file using streaming
   */
  async _readFileStreaming(filePath) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = createReadStream(filePath, { 
        encoding: this.encoding,
        highWaterMark: this.chunkSize 
      });
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        resolve(chunks.join(''));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Read file line by line (useful for very large files)
   */
  async* readFileLines(filePath) {
    try {
      const stat = await fs.stat(filePath);
      
      if (stat.size > this.maxFileSize) {
        throw new Error(`File too large: ${stat.size} bytes`);
      }
      
      if (!(await this._isTextFile(filePath))) {
        throw new Error('File appears to be binary');
      }
      
      const fileStream = createReadStream(filePath, { encoding: this.encoding });
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      let lineNumber = 1;
      for await (const line of rl) {
        yield { line, lineNumber: lineNumber++ };
      }
    } catch (error) {
      throw new Error(`Failed to read file lines ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get file metadata without reading content
   */
  async getFileMetadata(filePath) {
    try {
      const stat = await fs.stat(filePath);
      const isText = await this._isTextFile(filePath);
      
      return {
        size: stat.size,
        lastModified: stat.mtime,
        isText,
        readable: isText && stat.size <= this.maxFileSize
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata ${filePath}: ${error.message}`);
    }
  }
}