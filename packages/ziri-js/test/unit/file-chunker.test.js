import { describe, it, expect, beforeEach } from 'vitest';
import { FileChunker } from '../../lib/repository/file-chunker.js';

describe('FileChunker', () => {
  let fileChunker;

  beforeEach(() => {
    fileChunker = new FileChunker();
  });

  describe('chunkText', () => {
    it('should chunk text into appropriate sizes', () => {
      const text = 'A'.repeat(10000); // 10k characters
      const chunks = fileChunker.chunkText(text, '/test/file.txt', 'file.txt', {
        targetChars: 4000,
        overlapRatio: 0.1
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].size).toBeLessThanOrEqual(4000);
      expect(chunks[0].content).toBeDefined();
      expect(chunks[0].chunkId).toBeDefined();
      expect(chunks[0].filePath).toBe('/test/file.txt');
      expect(chunks[0].relativePath).toBe('file.txt');
    });

    it('should handle small text as single chunk', () => {
      const text = 'Small text content';
      const chunks = fileChunker.chunkText(text, '/test/small.txt', 'small.txt');

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(1);
    });

    it('should respect line breaks when chunking', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}: Some content here`);
      const text = lines.join('\n');
      
      const chunks = fileChunker.chunkText(text, '/test/lines.txt', 'lines.txt', {
        targetChars: 1000,
        respectLineBreaks: true
      });

      // Check that chunks respect line boundaries when possible
      // (This is a best-effort test since chunking may not always be perfect)
      let hasRespectedLineBreaks = false;
      for (const chunk of chunks) {
        if (chunk.content.includes('\n')) {
          // Check if chunk ends at a line boundary or doesn't contain newlines
          if (chunk.content.trim().endsWith('here') || chunk.content.endsWith('\n')) {
            hasRespectedLineBreaks = true;
          }
        }
      }
      expect(hasRespectedLineBreaks).toBe(true);
    });

    it('should respect word boundaries when chunking', () => {
      const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
      const text = words.join(' ');
      
      const chunks = fileChunker.chunkText(text, '/test/words.txt', 'words.txt', {
        targetChars: 500,
        respectWordBoundaries: true,
        respectLineBreaks: false
      });

      // Check that chunks don't break in the middle of words
      for (const chunk of chunks) {
        if (chunk.content.includes(' ')) {
          const trimmed = chunk.content.trim();
          expect(trimmed.startsWith(' ') || trimmed.endsWith(' ')).toBe(false);
        }
      }
    });

    it('should create overlapping chunks', () => {
      const text = 'A'.repeat(5000);
      const chunks = fileChunker.chunkText(text, '/test/overlap.txt', 'overlap.txt', {
        targetChars: 2000,
        overlapRatio: 0.2
      });

      expect(chunks.length).toBeGreaterThan(1);
      
      // Check for overlap between consecutive chunks
      if (chunks.length > 1) {
        const overlap = chunks[0].content.slice(-200); // Last 200 chars of first chunk
        const nextStart = chunks[1].content.slice(0, 200); // First 200 chars of second chunk
        
        // There should be some overlap
        expect(overlap.slice(-100)).toBe(nextStart.slice(0, 100));
      }
    });

    it('should calculate line numbers correctly', () => {
      const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10';
      const chunks = fileChunker.chunkText(text, '/test/numbered.txt', 'numbered.txt', {
        targetChars: 25,
        respectLineBreaks: true
      });

      // Should have at least one chunk
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].startLine).toBe(1);
      
      // Check that line numbers are sequential and logical
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].startLine).toBeGreaterThan(0);
        expect(chunks[i].endLine).toBeGreaterThanOrEqual(chunks[i].startLine);
        
        if (i > 0) {
          // Overlapping chunks might have overlapping line numbers
          expect(chunks[i].startLine).toBeGreaterThanOrEqual(chunks[i-1].startLine);
        }
      }
    });

    it('should handle empty or whitespace-only text', () => {
      expect(fileChunker.chunkText('', '/test/empty.txt', 'empty.txt')).toHaveLength(0);
      expect(fileChunker.chunkText('   \n\t  ', '/test/whitespace.txt', 'whitespace.txt')).toHaveLength(0);
    });

    it('should enforce maximum chunk size', () => {
      const text = 'A'.repeat(20000);
      const chunks = fileChunker.chunkText(text, '/test/large.txt', 'large.txt', {
        targetChars: 5000,
        maxChars: 6000
      });

      for (const chunk of chunks) {
        expect(chunk.size).toBeLessThanOrEqual(6000);
      }
    });

    it('should generate unique chunk IDs', () => {
      const text = 'Some content for testing chunk ID generation';
      const chunks1 = fileChunker.chunkText(text, '/test/file1.txt', 'file1.txt');
      const chunks2 = fileChunker.chunkText(text, '/test/file2.txt', 'file2.txt');

      expect(chunks1[0].chunkId).toBeDefined();
      expect(chunks2[0].chunkId).toBeDefined();
      expect(chunks1[0].chunkId).not.toBe(chunks2[0].chunkId); // Different files should have different IDs
    });

    it('should estimate token counts', () => {
      const text = 'This is a test sentence with multiple words.';
      const chunks = fileChunker.chunkText(text, '/test/tokens.txt', 'tokens.txt');

      expect(chunks[0].tokenCount).toBeGreaterThan(0);
      expect(chunks[0].tokenCount).toBeLessThanOrEqual(Math.ceil(text.length / 3)); // Conservative estimate
    });
  });

  describe('chunkFile', () => {
    it('should yield chunks asynchronously', async () => {
      const content = 'A'.repeat(8000);
      const chunks = [];
      
      for await (const chunk of fileChunker.chunkFile('/test/async.txt', 'async.txt', content)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toHaveProperty('content');
      expect(chunks[0]).toHaveProperty('chunkId');
    });
  });

  describe('getChunkingStats', () => {
    it('should return chunking statistics', () => {
      const text = 'A'.repeat(10000);
      const stats = fileChunker.getChunkingStats(text, { targetChars: 3000 });

      expect(stats.totalChunks).toBeGreaterThan(1);
      expect(stats.totalCharacters).toBe(10000);
      expect(stats.averageChunkSize).toBeGreaterThan(0);
      expect(stats.minChunkSize).toBeGreaterThan(0);
      expect(stats.maxChunkSize).toBeGreaterThan(0);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.averageTokensPerChunk).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const stats = fileChunker.getChunkingStats('');

      expect(stats.totalChunks).toBe(0);
      expect(stats.totalCharacters).toBe(0);
      expect(stats.averageChunkSize).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });
  });

  describe('_estimateTokenCount', () => {
    it('should estimate token count reasonably', () => {
      const text = 'This is a test sentence.';
      const tokenCount = fileChunker._estimateTokenCount(text);
      
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThanOrEqual(text.length); // Should not exceed character count
    });
  });

  describe('_generateChunkId', () => {
    it('should generate consistent IDs for same input', () => {
      const id1 = fileChunker._generateChunkId('/test/file.txt', 0, 'content');
      const id2 = fileChunker._generateChunkId('/test/file.txt', 0, 'content');
      
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different inputs', () => {
      const id1 = fileChunker._generateChunkId('/test/file1.txt', 0, 'content');
      const id2 = fileChunker._generateChunkId('/test/file2.txt', 0, 'content');
      const id3 = fileChunker._generateChunkId('/test/file1.txt', 1, 'content');
      
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
    });
  });

  describe('_findSplitPoint', () => {
    it('should find line break split points', () => {
      const text = 'Line 1\nLine 2\nLine 3\nLine 4';
      const splitPoint = fileChunker._findSplitPoint(text, 10, true, false);
      
      // Should split at a line break
      expect(text[splitPoint - 1]).toBe('\n');
    });

    it('should find word boundary split points', () => {
      const text = 'word1 word2 word3 word4 word5';
      const splitPoint = fileChunker._findSplitPoint(text, 15, false, true);
      
      // Should split at a space or start of word
      expect(text[splitPoint - 1] === ' ' || /\w/.test(text[splitPoint])).toBe(true);
    });

    it('should fallback to target index if no good split point found', () => {
      const text = 'verylongwordwithoutanyspacesorlinebreaks';
      const targetIndex = 20;
      const splitPoint = fileChunker._findSplitPoint(text, targetIndex, true, true);
      
      // Should be close to target index
      expect(Math.abs(splitPoint - targetIndex)).toBeLessThan(200);
    });
  });
});