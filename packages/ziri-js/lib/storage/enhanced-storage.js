/**
 * Enhanced Storage Implementation
 * Stores rich metadata and content alongside vectors for enhanced context retrieval
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { inferLanguage } from '../store_repo.js';
import { CodeAnalyzer } from '../metadata/code-analyzer.js';
import { EncryptionService } from '../security/encryption.js';
import { SecurityConfig } from '../security/config.js';

export class EnhancedStorage {
  constructor(baseDirectory) {
    this.baseDirectory = baseDirectory;
    this.securityConfig = new SecurityConfig();
    this.encryptionService = null;
  }

  /**
   * Initialize security features
   */
  async initializeSecurity() {
    await this.securityConfig.load();
    if (this.securityConfig.isEncryptionEnabled()) {
      // In a real implementation, we'd get the passphrase from a secure source
      // For now, we'll use a placeholder - in practice this would come from user input
      const config = this.securityConfig.getConfig();
      if (config.encryption.passphrase) {
        this.encryptionService = new EncryptionService(config.encryption.passphrase);
      }
    }
  }

  /**
   * Store enhanced chunk data with rich metadata
   */
  async storeEnhancedChunk(repoDir, chunkId, vector, chunkData) {
    // Store vector as before
    const vectorPath = path.join(repoDir, 'db', 'vecs', `${chunkId}.bin`);
    const vectorBuf = Buffer.from(new Float32Array(vector).buffer);
    await fs.writeFile(vectorPath, vectorBuf);

    // Extract basic metadata from content
    const enhancedData = await this.extractMetadata(chunkData);

    // Store enhanced chunk content
    const contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
    await fs.writeFile(contentPath, JSON.stringify(enhancedData, null, 2), 'utf-8');

    return enhancedData;
  }

  /**
   * Load enhanced chunk data
   */
  async loadEnhancedChunk(repoDir, chunkId) {
    try {
      const contentPath = path.join(repoDir, 'db', 'content', `${chunkId}.json`);
      const contentData = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
      return contentData;
    } catch {
      return null;
    }
  }

  /**
   * Extract metadata from chunk content
   */
  async extractMetadata(chunkData) {
    const language = chunkData.language || inferLanguage(chunkData.filePath);
    const content = chunkData.content;
    
    // Enhanced code structure analysis using CodeAnalyzer
    const analysis = CodeAnalyzer.analyzeCode(content, language, chunkData.filePath);
    
    // Extract surrounding context if available
    const surroundingContext = await this.extractSurroundingContext(
      chunkData.filePath, 
      chunkData.startLine, 
      chunkData.endLine
    );

    return {
      chunkId: chunkData.chunkId,
      content: content,
      filePath: chunkData.filePath,
      relativePath: chunkData.relativePath,
      startLine: chunkData.startLine,
      endLine: chunkData.endLine,
      language: language,
      type: analysis.type,
      functionName: analysis.functionName,
      className: analysis.className,
      imports: analysis.imports,
      functions: analysis.functions,
      classes: analysis.classes,
      comments: analysis.comments,
      docstrings: analysis.docstrings,
      signature: analysis.signature,
      surroundingContext: surroundingContext,
      metadata: {
        fileType: path.extname(chunkData.filePath).toLowerCase(),
        size: content.length,
        tokenCount: Math.ceil(content.length / 4),
        functionCount: analysis.functions.length,
        classCount: analysis.classes.length,
        importCount: analysis.imports.length,
        commentCount: analysis.comments.length + analysis.docstrings.length
      }
    };
  }



  /**
   * Extract surrounding context lines from file
   */
  async extractSurroundingContext(filePath, startLine, endLine, contextLines = 2) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      
      const beforeStart = Math.max(0, startLine - contextLines - 1);
      const afterEnd = Math.min(lines.length, endLine + contextLines);
      
      return {
        before: lines.slice(beforeStart, startLine - 1),
        after: lines.slice(endLine, afterEnd)
      };
    } catch {
      return { before: [], after: [] };
    }
  }

  /**
   * Convert enhanced chunk data to query result format
   */
  convertToQueryResult(chunkData, score, repoAlias) {
    const relevanceExplanation = this.generateRelevanceExplanation(chunkData, score);
    
    return {
      score: score,
      file: chunkData.relativePath,
      repo: repoAlias,
      lines: `${chunkData.startLine}-${chunkData.endLine}`,
      context: chunkData.content,
      language: chunkData.language,
      type: chunkData.type,
      functionName: chunkData.functionName,
      className: chunkData.className,
      functions: chunkData.functions || [],
      classes: chunkData.classes || [],
      imports: chunkData.imports || [],
      comments: chunkData.comments || [],
      docstrings: chunkData.docstrings || [],
      signature: chunkData.signature,
      relevanceExplanation: relevanceExplanation,
      surroundingLines: chunkData.surroundingContext,
      metadata: chunkData.metadata
    };
  }

  /**
   * Generate enhanced relevance explanation
   */
  generateRelevanceExplanation(chunkData, score) {
    const scorePercent = Math.round(score * 100);
    
    let explanation = `${scorePercent}% match`;
    
    // Add context about what was found
    if (chunkData.functionName) {
      explanation += ` in function '${chunkData.functionName}'`;
      if (chunkData.signature) {
        explanation += ` (${chunkData.signature.replace(/\s+/g, ' ').substring(0, 50)}...)`;
      }
    } else if (chunkData.className) {
      explanation += ` in class '${chunkData.className}'`;
    }
    
    // Add type-specific context
    if (chunkData.type === 'import') {
      const importCount = chunkData.imports?.length || 0;
      explanation += ` (${importCount} import${importCount !== 1 ? 's' : ''})`;
    } else if (chunkData.type === 'comment') {
      const hasDocstring = chunkData.docstrings?.length > 0;
      explanation += hasDocstring ? ' (documentation)' : ' (comment)';
    } else if (chunkData.functions?.length > 1) {
      explanation += ` (${chunkData.functions.length} functions)`;
    } else if (chunkData.classes?.length > 1) {
      explanation += ` (${chunkData.classes.length} classes)`;
    }
    
    explanation += ` (${chunkData.language})`;
    
    return explanation;
  }

  /**
   * Batch process enhanced chunks for better performance
   */
  async batchStoreEnhancedChunks(repoDir, chunks) {
    const results = [];
    
    for (const chunk of chunks) {
      const result = await this.storeEnhancedChunk(
        repoDir, 
        chunk.chunkId, 
        chunk.vector, 
        chunk.chunkData
      );
      results.push(result);
    }
    
    return results;
  }

  /**
   * Check if enhanced storage is available for a repository
   */
  async isEnhancedStorageAvailable(repoDir) {
    try {
      const contentDir = path.join(repoDir, 'db', 'content');
      await fs.access(contentDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Migrate legacy storage to enhanced storage
   */
  async migrateLegacyToEnhanced(repoDir, indexArr) {
    console.log('🔄 Migrating to enhanced storage...');
    
    let migrated = 0;
    const total = indexArr.length;
    
    for (const entry of indexArr) {
      try {
        // Check if enhanced data already exists
        const enhancedData = await this.loadEnhancedChunk(repoDir, entry.id);
        if (enhancedData) {
          continue; // Already migrated
        }

        // Load legacy vector and create enhanced data
        const vectorPath = path.join(repoDir, 'db', 'vecs', `${entry.id}.bin`);
        const vectorBuf = await fs.readFile(vectorPath);
        const vector = Array.from(new Float32Array(vectorBuf.buffer, vectorBuf.byteOffset, vectorBuf.byteLength / 4));

        // Create basic enhanced data from legacy entry
        const chunkData = {
          chunkId: entry.id,
          content: '', // Will be extracted from file if possible
          filePath: path.join(process.cwd(), entry.relPath),
          relativePath: entry.relPath,
          startLine: 1,
          endLine: 1,
          language: inferLanguage(entry.relPath)
        };

        await this.storeEnhancedChunk(repoDir, entry.id, vector, chunkData);
        migrated++;
        
        if (migrated % 100 === 0) {
          console.log(`   Migrated ${migrated}/${total} chunks...`);
        }
      } catch (error) {
        console.warn(`   Failed to migrate chunk ${entry.id}:`, error.message);
      }
    }
    
    console.log(`✅ Migration complete: ${migrated}/${total} chunks migrated`);
    return migrated;
  }
}