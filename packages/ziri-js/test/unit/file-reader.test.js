import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileReader } from '../../lib/repository/file-reader.js';

describe('FileReader', () => {
  let tempDir;
  let fileReader;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-temp-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    fileReader = new FileReader();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('readFileContent', () => {
    it('should read text file content', async () => {
      const content = 'console.log("Hello, World!");';
      const filePath = path.join(tempDir, 'test.js');
      await fs.writeFile(filePath, content);

      const result = await fileReader.readFileContent(filePath);
      expect(result).toBe(content);
    });

    it('should handle empty files', async () => {
      const filePath = path.join(tempDir, 'empty.txt');
      await fs.writeFile(filePath, '');

      const result = await fileReader.readFileContent(filePath);
      expect(result).toBe('');
    });

    it('should reject files larger than maxFileSize', async () => {
      const smallReader = new FileReader({ maxFileSize: 10 });
      const filePath = path.join(tempDir, 'large.txt');
      await fs.writeFile(filePath, 'This content is longer than 10 bytes');

      await expect(smallReader.readFileContent(filePath)).rejects.toThrow('File too large');
    });

    it('should reject binary files', async () => {
      const filePath = path.join(tempDir, 'binary.bin');
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
      await fs.writeFile(filePath, binaryContent);

      await expect(fileReader.readFileContent(filePath)).rejects.toThrow('File appears to be binary');
    });

    it('should handle non-existent files', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');

      await expect(fileReader.readFileContent(filePath)).rejects.toThrow();
    });
  });

  describe('readFileLines', () => {
    it('should read file line by line', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const filePath = path.join(tempDir, 'multiline.txt');
      await fs.writeFile(filePath, content);

      const lines = [];
      for await (const { line, lineNumber } of fileReader.readFileLines(filePath)) {
        lines.push({ line, lineNumber });
      }

      expect(lines).toHaveLength(3);
      expect(lines[0]).toEqual({ line: 'Line 1', lineNumber: 1 });
      expect(lines[1]).toEqual({ line: 'Line 2', lineNumber: 2 });
      expect(lines[2]).toEqual({ line: 'Line 3', lineNumber: 3 });
    });

    it('should handle files with different line endings', async () => {
      const content = 'Line 1\r\nLine 2\rLine 3\n';
      const filePath = path.join(tempDir, 'mixed-endings.txt');
      await fs.writeFile(filePath, content);

      const lines = [];
      for await (const { line } of fileReader.readFileLines(filePath)) {
        lines.push(line);
      }

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
    });
  });

  describe('getFileMetadata', () => {
    it('should return metadata for text files', async () => {
      const content = 'Hello, World!';
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, content);

      const metadata = await fileReader.getFileMetadata(filePath);

      expect(metadata.size).toBe(content.length);
      expect(metadata.lastModified).toBeInstanceOf(Date);
      expect(metadata.isText).toBe(true);
      expect(metadata.readable).toBe(true);
    });

    it('should return metadata for binary files', async () => {
      const filePath = path.join(tempDir, 'binary.bin');
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await fs.writeFile(filePath, binaryContent);

      const metadata = await fileReader.getFileMetadata(filePath);

      expect(metadata.size).toBe(4);
      expect(metadata.isText).toBe(false);
      expect(metadata.readable).toBe(false);
    });

    it('should handle large files', async () => {
      const smallReader = new FileReader({ maxFileSize: 10 });
      const filePath = path.join(tempDir, 'large.txt');
      await fs.writeFile(filePath, 'This is a large file content');

      const metadata = await smallReader.getFileMetadata(filePath);

      expect(metadata.isText).toBe(true);
      expect(metadata.readable).toBe(false); // Too large
    });
  });

  describe('_isTextFile', () => {
    it('should identify text files correctly', async () => {
      const textFile = path.join(tempDir, 'text.txt');
      await fs.writeFile(textFile, 'This is a text file with normal content.');

      const isText = await fileReader._isTextFile(textFile);
      expect(isText).toBe(true);
    });

    it('should identify binary files correctly', async () => {
      const binaryFile = path.join(tempDir, 'binary.bin');
      const binaryContent = Buffer.alloc(100);
      binaryContent.fill(0); // Fill with null bytes
      await fs.writeFile(binaryFile, binaryContent);

      const isText = await fileReader._isTextFile(binaryFile);
      expect(isText).toBe(false);
    });

    it('should handle empty files', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyFile, '');

      const isText = await fileReader._isTextFile(emptyFile);
      expect(isText).toBe(true); // Empty files are considered text files
    });

    it('should handle mixed content files', async () => {
      const mixedFile = path.join(tempDir, 'mixed.txt');
      const content = 'Normal text content with some special chars: àáâãäå';
      await fs.writeFile(mixedFile, content);

      const isText = await fileReader._isTextFile(mixedFile);
      expect(isText).toBe(true);
    });
  });
});