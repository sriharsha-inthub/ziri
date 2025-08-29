import fs from 'node:fs/promises';
import path from 'node:path';
import { EnhancedStorage } from './storage/enhanced-storage.js';

/**
 * Enhanced repository storage with content preservation
 * Stores both vectors and original chunk content for rich context retrieval
 */

// Global flag to control enhanced storage (can be set via CLI args)
let useEnhancedStorage = true;

/**
 * Set whether to use enhanced storage (for backward compatibility)
 */
export function setEnhancedStorageMode(enabled) {
  useEnhancedStorage = enabled;
}

/**
 * Check if enhanced storage is enabled
 */
export function isEnhancedStorageEnabled() {
  return useEnhancedStorage;
}

export async function ensureRepoStore(repoDir) {
  await fs.mkdir(path.join(repoDir, 'db', 'vecs'), { recursive: true });
  await fs.mkdir(path.join(repoDir, 'db', 'content'), { recursive: true });
  await fs.mkdir(path.join(repoDir, 'blobs'), { recursive: true });
}

export async function readIndex(repoDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(repoDir, 'db', 'index.json'), 'utf-8'));
  } catch {
    return [];
  }
}

export async function writeIndex(repoDir, index) {
  await fs.writeFile(path.join(repoDir, 'db', 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Enhanced saveChunk - stores both vector and content metadata using EnhancedStorage
 */
export async function saveChunk(repoDir, chunkId, vector, chunkData) {
  if (useEnhancedStorage) {
    const enhancedStorage = new EnhancedStorage();
    const enhancedData = await enhancedStorage.storeEnhancedChunk(repoDir, chunkId, vector, chunkData);
    return enhancedData;
  } else {
    // Legacy storage mode
    const vectorPath = path.join(repoDir, 'db', 'vecs', `${chunkId}.bin`);
    const vectorBuf = Buffer.from(new Float32Array(vector).buffer);
    await fs.writeFile(vectorPath, vectorBuf);

    // Save basic chunk content
    const contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
    const contentData = {
      chunkId,
      content: chunkData.content,
      filePath: chunkData.filePath,
      relativePath: chunkData.relativePath,
      startLine: chunkData.startLine,
      endLine: chunkData.endLine,
      size: chunkData.size,
      tokenCount: chunkData.tokenCount,
      language: chunkData.language || inferLanguage(chunkData.filePath),
      type: chunkData.type || 'code'
    };
    await fs.writeFile(contentPath, JSON.stringify(contentData, null, 2), 'utf-8');
    return contentData;
  }
}

/**
 * Load chunk content with enhanced metadata
 */
export async function loadChunk(repoDir, chunkId) {
  const enhancedStorage = new EnhancedStorage();
  
  // Try to load enhanced chunk data
  const enhancedData = await enhancedStorage.loadEnhancedChunk(repoDir, chunkId);
  if (enhancedData) {
    return enhancedData;
  }
  
  // Fallback to basic data if enhanced content not available
  try {
    const contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
    const contentData = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
    return contentData;
  } catch {
    return null;
  }
}

export async function saveVector(repoDir, id, vector) {
  const p = path.join(repoDir, 'db', 'vecs', id + '.bin');
  const buf = Buffer.from(new Float32Array(vector).buffer);
  await fs.writeFile(p, buf);
}

export async function loadVector(repoDir, id) {
  const p = path.join(repoDir, 'db', 'vecs', id + '.bin');
  const buf = await fs.readFile(p);
  const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return Array.from(arr);
}

/**
 * Infer programming language from file extension
 */
export function inferLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.sql': 'sql'
  };
  return langMap[ext] || 'unknown';
}
