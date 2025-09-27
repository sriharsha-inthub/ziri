import fs from 'node:fs/promises';
import path from 'node:path';
import { EnhancedStorage } from './storage/enhanced-storage.js';
import { EncryptionService } from './security/encryption.js';
import { SecurityConfig } from './security/config.js';

/**
 * Enhanced repository storage with content preservation
 * Stores both vectors and original chunk content for rich context retrieval
 */

// Global flag to control enhanced storage (can be set via CLI args)
let useEnhancedStorage = true;
let encryptionService = null;
let securityConfig = null;

/**
 * Initialize security features
 */
export async function initializeSecurity() {
  securityConfig = new SecurityConfig();
  await securityConfig.load();
  
  if (securityConfig.isEncryptionEnabled()) {
    const config = securityConfig.getConfig();
    if (config.encryption.passphrase) {
      encryptionService = new EncryptionService(config.encryption.passphrase);
      console.log('🔒 Encryption enabled for storage');
    }
  }
}

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

/**
 * Check if encryption is enabled
 */
export function isEncryptionEnabled() {
  return encryptionService !== null;
}

export async function ensureRepoStore(repoDir) {
  await fs.mkdir(path.join(repoDir, 'db', 'vecs'), { recursive: true });
  await fs.mkdir(path.join(repoDir, 'db', 'content'), { recursive: true });
  await fs.mkdir(path.join(repoDir, 'blobs'), { recursive: true });
}

export async function readIndex(repoDir) {
  try {
    const indexPath = path.join(repoDir, 'db', 'index.json');
    let data;
    
    if (isEncryptionEnabled() && encryptionService) {
      // Try to read encrypted index first
      try {
        const encryptedData = await fs.readFile(indexPath + '.enc', 'utf-8');
        data = encryptionService.decryptFromJson(encryptedData);
      } catch {
        // Fallback to unencrypted if encrypted version doesn't exist
        data = await fs.readFile(indexPath, 'utf-8');
      }
    } else {
      data = await fs.readFile(indexPath, 'utf-8');
    }
    
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function writeIndex(repoDir, index) {
  const indexPath = path.join(repoDir, 'db', 'index.json');
  
  if (isEncryptionEnabled() && encryptionService) {
    // Write encrypted version
    const encryptedData = encryptionService.encryptToJson(index);
    await fs.writeFile(indexPath + '.enc', encryptedData, 'utf-8');
    // Also write unencrypted version for compatibility
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  } else {
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
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
    // Legacy storage mode with encryption support
    let vectorPath = path.join(repoDir, 'db', 'vecs', `${chunkId}.bin`);
    let contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
    
    if (isEncryptionEnabled() && encryptionService) {
      // Encrypt vector data
      const vectorBuf = Buffer.from(new Float32Array(vector).buffer);
      const encryptedVector = encryptionService.encrypt(vectorBuf);
      await fs.writeFile(vectorPath + '.enc', JSON.stringify({
        data: encryptedVector.data.toString('base64'),
        iv: encryptedVector.iv.toString('base64'),
        algorithm: encryptedVector.algorithm,
        timestamp: encryptedVector.timestamp
      }), 'utf-8');
      
      // Encrypt content data
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
      
      const encryptedContent = encryptionService.encryptToJson(contentData);
      await fs.writeFile(contentPath + '.enc', encryptedContent, 'utf-8');
      
      // Also save unencrypted versions for compatibility
      const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
      await fs.writeFile(vectorPath, vectorBuffer);
      await fs.writeFile(contentPath, JSON.stringify(contentData, null, 2), 'utf-8');
    } else {
      // Legacy storage without encryption
      const vectorBuf = Buffer.from(new Float32Array(vector).buffer);
      await fs.writeFile(vectorPath, vectorBuf);

      // Save basic chunk content
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
    }
    
    return chunkData;
  }
}

/**
 * Load chunk content with enhanced metadata and decryption support
 */
export async function loadChunk(repoDir, chunkId) {
  const enhancedStorage = new EnhancedStorage();
  
  // Try to load enhanced chunk data
  const enhancedData = await enhancedStorage.loadEnhancedChunk(repoDir, chunkId);
  if (enhancedData) {
    return enhancedData;
  }
  
  // Fallback to basic data with decryption support
  try {
    const contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
    let contentData;
    
    if (isEncryptionEnabled() && encryptionService) {
      // Try to load encrypted content first
      try {
        const encryptedData = await fs.readFile(contentPath + '.enc', 'utf-8');
        contentData = encryptionService.decryptFromJson(encryptedData);
      } catch {
        // Fallback to unencrypted if encrypted version doesn't exist
        contentData = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
      }
    } else {
      contentData = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
    }
    
    return contentData;
  } catch {
    return null;
  }
}

export async function saveVector(repoDir, id, vector) {
  const p = path.join(repoDir, 'db', 'vecs', id + '.bin');
  
  if (isEncryptionEnabled() && encryptionService) {
    // Encrypt vector data
    const vectorBuf = Buffer.from(new Float32Array(vector).buffer);
    const encryptedVector = encryptionService.encrypt(vectorBuf);
    await fs.writeFile(p + '.enc', JSON.stringify({
      data: encryptedVector.data.toString('base64'),
      iv: encryptedVector.iv.toString('base64'),
      algorithm: encryptedVector.algorithm,
      timestamp: encryptedVector.timestamp
    }), 'utf-8');
    
    // Also save unencrypted version for compatibility
    const buf = Buffer.from(new Float32Array(vector).buffer);
    await fs.writeFile(p, buf);
  } else {
    const buf = Buffer.from(new Float32Array(vector).buffer);
    await fs.writeFile(p, buf);
  }
}

export async function loadVector(repoDir, id) {
  const p = path.join(repoDir, 'db', 'vecs', id + '.bin');
  
  if (isEncryptionEnabled() && encryptionService) {
    // Try to load encrypted vector first
    try {
      const encryptedData = await fs.readFile(p + '.enc', 'utf-8');
      const encryptedVector = JSON.parse(encryptedData);
      encryptedVector.data = Buffer.from(encryptedVector.data, 'base64');
      encryptedVector.iv = Buffer.from(encryptedVector.iv, 'base64');
      const decrypted = encryptionService.decrypt(encryptedVector);
      const arr = new Float32Array(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength / 4);
      return Array.from(arr);
    } catch {
      // Fallback to unencrypted if encrypted version doesn't exist
      const buf = await fs.readFile(p);
      const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      return Array.from(arr);
    }
  } else {
    const buf = await fs.readFile(p);
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return Array.from(arr);
  }
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

/**
 * Remove a chunk's files (vector and content) from the repository
 */
export async function removeChunk(repoDir, chunkId) {
  try {
    // Remove vector file
    const vectorPath = path.join(repoDir, 'db', 'vecs', `${chunkId}.bin`);
    await fs.unlink(vectorPath).catch(() => {}); // Ignore if file doesn't exist
    
    // Remove content file
    const contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
    await fs.unlink(contentPath).catch(() => {}); // Ignore if file doesn't exist
    
    // Remove encrypted files if they exist
    await fs.unlink(vectorPath + '.enc').catch(() => {});
    await fs.unlink(contentPath + '.enc').catch(() => {});
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to remove chunk ${chunkId}:`, error.message);
    return false;
  }
}
