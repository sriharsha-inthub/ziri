import chokidar from 'chokidar';
import path from 'node:path';
import { walkDir } from './filewalk.js';
import { computeRepoId, repoStoreDir } from './repoid.js';
import { resolveHome } from './home.js';
import { readIndex, writeIndex, ensureRepoStore, saveChunk, removeChunk } from './store_repo.js';
import { sha256 } from './hash.js';
import { makeEmbedder } from './embedder.js';
import { chunkTextWithLines } from './chunker.js';
import fs from 'node:fs/promises';

/**
 * Watch mode for automatic re-indexing
 * 
 * This module implements file system watching using chokidar to automatically
 * re-index files as they change during development.
 */

class WatchMode {
  constructor(configManager) {
    this.configManager = configManager;
    this.watcher = null;
    this.isProcessing = false;
    this.pendingChanges = new Set();
    this.debounceTimer = null;
    this.debounceDelay = 100; // ms
    this.repoPath = process.cwd();
    this.embedder = null;
    this.storeDir = null;
    this.manifestPath = null;
    this.manifest = {};
  }

  /**
   * Initialize watch mode
   */
  async initialize() {
    const { repoId, alias } = await computeRepoId(this.repoPath);
    this.storeDir = repoStoreDir(resolveHome(), alias, repoId);
    this.manifestPath = path.join(this.storeDir, 'manifest.json');
    
    // Load existing manifest
    try {
      this.manifest = JSON.parse(await fs.readFile(this.manifestPath, 'utf-8'));
    } catch {
      this.manifest = {};
    }

    // Initialize embedder
    const config = await this.configManager?.getConfig() || {};
    const defaultProvider = config.defaultProvider || 'ollama';
    this.embedder = makeEmbedder(defaultProvider, config);
    
    console.log(`🔍 Watch mode initialized for: ${alias}`);
    console.log(`📁 Path: ${this.repoPath}`);
    console.log(`🆔 Repo ID: ${repoId.slice(0, 8)}...`);
    console.log(`🤖 Using embedder: ${this.embedder.id} (${this.embedder.model})`);
  }

  /**
   * Start watching the repository
   */
  async start() {
    await this.initialize();
    
    // Create watcher with appropriate options
    this.watcher = chokidar.watch(this.repoPath, {
      ignored: this.getIgnorePatterns(),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileChange('add', filePath))
      .on('change', (filePath) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
      .on('error', (error) => {
        console.error('❌ Watcher error:', error.message);
      })
      .on('ready', () => {
        console.log('✅ Watch mode started. Monitoring for file changes...');
        console.log('💡 Press Ctrl+C to stop watching');
      });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping watch mode...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Stopping watch mode...');
      await this.stop();
      process.exit(0);
    });
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Get ignore patterns for file watching
   */
  getIgnorePatterns() {
    return [
      // Build/dependency directories
      '**/node_modules/**',
      'node_modules/**',
      '**/dist/**',
      'dist/**',
      '**/build/**',
      'build/**',
      '**/.next/**',
      '.next/**',
      '**/out/**',
      'out/**',
      
      // Version control
      '**/.git/**',
      '.git/**',
      '**/.svn/**',
      '.svn/**',
      
      // Cache/temp directories
      '**/.cache/**',
      '.cache/**',
      '**/tmp/**',
      'tmp/**',
      '**/temp/**',
      'temp/**',
      '**/coverage/**',
      'coverage/**',
      
      // Generated docs
      '**/docs/build/**',
      '**/docs/dist/**',
      '**/docs/.docusaurus/**',
      '**/docs/node_modules/**',
      
      // Lock files and binaries
      '**/*.lock',
      '**/*.min.*',
      '**/*.bin',
      '**/*.exe',
      '**/*.dll',
      '**/*.so',
      '**/*.dylib',
      
      // Media files
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.gif',
      '**/*.svg',
      '**/*.ico',
      '**/*.mp4',
      '**/*.mov',
      '**/*.avi',
      '**/*.webm',
      
      // Archive files
      '**/*.zip',
      '**/*.gz',
      '**/*.tar',
      '**/*.rar',
      '**/*.7z',
      '**/*.bz2',
      
      // OS files
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.tmp',
      
      // IDE files
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.swp',
      '**/*.swo'
    ];
  }

  /**
   * Handle file change events with debouncing
   */
  handleFileChange(event, filePath) {
    try {
      const relativePath = path.relative(this.repoPath, filePath).replace(/\\/g, '/');
      
      // Validate file path
      if (!relativePath || relativePath.startsWith('..')) {
        console.warn(`⚠️  Skipping invalid path: ${filePath}`);
        return;
      }
      
      // Add to pending changes
      this.pendingChanges.add({ event, filePath, relativePath });
      
      // Clear existing timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      // Set new timer
      this.debounceTimer = setTimeout(() => {
        this.processPendingChanges();
      }, this.debounceDelay);
    } catch (error) {
      console.error(`❌ Error handling file change for ${filePath}:`, error.message);
    }
  }

  /**
   * Process all pending file changes
   */
  async processPendingChanges() {
    if (this.isProcessing || this.pendingChanges.size === 0) {
      return;
    }

    this.isProcessing = true;
    const processingStartTime = Date.now();
    
    try {
      const changes = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      
      console.log(`\n🔄 Processing ${changes.length} file change(s)...`);
      
      let processedCount = 0;
      let errorCount = 0;
      
      for (const change of changes) {
        try {
          await this.processFileChange(change.event, change.filePath, change.relativePath);
          processedCount++;
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing ${change.event} for ${change.relativePath}:`, error.message);
          
          // Continue processing other changes even if one fails
          continue;
        }
      }
      
      const processingTime = Date.now() - processingStartTime;
      console.log(`✅ File processing complete (${processedCount} successful, ${errorCount} failed, ${processingTime}ms)`);
    } catch (error) {
      console.error('❌ Critical error processing file changes:', error.message);
    } finally {
      this.isProcessing = false;
      
      // Check if there are more pending changes
      if (this.pendingChanges.size > 0) {
        console.log('🔄 More changes detected during processing, scheduling another batch...');
        this.debounceTimer = setTimeout(() => {
          this.processPendingChanges();
        }, this.debounceDelay);
      }
    }
  }

  /**
   * Process a single file change
   */
  async processFileChange(event, filePath, relativePath) {
    try {
      // Validate file exists for add/change events
      if (event === 'add' || event === 'change') {
        try {
          await fs.access(filePath);
        } catch {
          console.log(`⏭️  File no longer exists: ${relativePath}`);
          return;
        }
      }
      
      switch (event) {
        case 'add':
          console.log(`🆕 Added: ${relativePath}`);
          await this.indexFile(filePath, relativePath);
          break;
        case 'change':
          console.log(`✏️  Modified: ${relativePath}`);
          await this.indexFile(filePath, relativePath);
          break;
        case 'unlink':
          console.log(`🗑️  Deleted: ${relativePath}`);
          await this.removeFile(relativePath);
          break;
        default:
          console.warn(`⚠️  Unknown event type: ${event} for ${relativePath}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${event} for ${relativePath}:`, error.message);
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Index a single file
   */
  async indexFile(filePath, relativePath) {
    try {
      // Check file size
      const stat = await fs.stat(filePath);
      if (stat.size > 1.5 * 1024 * 1024) {
        console.log(`⏭️  Skipped large file: ${relativePath} (${(stat.size/1024/1024).toFixed(1)}MB)`);
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const fileHash = sha256(content);
      
      // Check if file has changed
      if (this.manifest[relativePath]?.hash === fileHash) {
        console.log(`⏭️  No changes detected: ${relativePath}`);
        return;
      }

      console.log(`📄 Processing: ${relativePath} (${(stat.size/1024).toFixed(1)}KB)`);
      
      // Remove existing chunks for this file
      await this.removeFileChunks(relativePath);
      
      // Chunk the file content
      const chunks = chunkTextWithLines(content);
      
      if (chunks.length === 0) {
        console.log(`⏭️  No content to index: ${relativePath}`);
        // Still update manifest to avoid reprocessing
        this.manifest[relativePath] = {
          hash: fileHash,
          bytes: stat.size,
          chunks: 0,
          mtime: Date.now()
        };
        await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest), 'utf-8');
        return;
      }

      // Process chunks in batches
      const batch = [];
      let budget = 6144; // Same as indexer.js
      const indexArr = await readIndex(this.storeDir);
      let processedChunks = 0;
      
      const flush = async () => {
        if (!batch.length) return;
        
        try {
          console.log(`  🔄 Embedding ${batch.length} chunks...`);
          const embeddingStart = Date.now();
          const vecs = await this.embedder.embedBatch(batch.map(b => b.chunk.content));
          const embeddingTime = Date.now() - embeddingStart;
          
          for (let i = 0; i < batch.length; i++) {
            const chunk = batch[i].chunk;
            const id = sha256(path.basename(this.repoPath) + '|' + relativePath + '|' + i + '|' + fileHash);
            
            // Enhanced chunk data with rich metadata
            const chunkData = {
              content: chunk.content,
              filePath: filePath,
              relativePath: relativePath,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              language: this.detectLanguage(relativePath),
              type: this.detectCodeType(chunk.content),
              functionName: this.extractFunctionName(chunk.content),
              className: this.extractClassName(chunk.content),
              imports: this.extractImports(chunk.content),
              surroundingContext: this.getSurroundingContext(content, chunk.startLine, chunk.endLine),
              metadata: {
                fileType: path.extname(relativePath),
                size: chunk.content.length,
                tokenCount: Math.ceil(chunk.content.length / 4)
              }
            };

            await saveChunk(this.storeDir, id, vecs[i], chunkData);
            indexArr.push({ 
              id, 
              relPath: relativePath, 
              meta: { 
                alias: path.basename(this.repoPath), 
                language: chunkData.language, 
                type: chunkData.type 
              } 
            });
          }
          
          processedChunks += batch.length;
          console.log(`  ✅ Embedded ${batch.length} chunks (${embeddingTime}ms)`);
          batch.length = 0;
          budget = 6144;
        } catch (error) {
          console.error(`  ❌ Failed to embed batch:`, error.message);
          throw error;
        }
      };

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const est = Math.ceil(chunk.content.length / 4);
        if (est > 2048) {
          console.log(`  ⏭️  Skipped large chunk (${est} tokens): ${relativePath} [${chunk.startLine}-${chunk.endLine}]`);
          continue;
        }
        if (est > budget) await flush();
        batch.push({ chunk });
        budget -= est;
      }
      await flush();

      // Update manifest
      this.manifest[relativePath] = {
        hash: fileHash,
        bytes: stat.size,
        chunks: processedChunks,
        mtime: Date.now()
      };
      
      await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest), 'utf-8');
      await writeIndex(this.storeDir, indexArr);
      
      console.log(`✅ Indexed: ${relativePath} (${processedChunks} chunks)`);
    } catch (error) {
      console.error(`❌ Failed to index ${relativePath}:`, error.message);
      if (error.code === 'ENOENT') {
        console.log(`  ℹ️  File may have been deleted during processing`);
      } else if (error.code === 'EACCES') {
        console.log(`  ℹ️  Permission denied accessing file`);
      }
      throw error;
    }
  }

  /**
   * Remove a file from the index
   */
  async removeFile(relativePath) {
    try {
      console.log(`🗑️  Removing: ${relativePath}`);
      
      // Remove file chunks
      const chunksRemoved = await this.removeFileChunks(relativePath);
      
      // Remove from manifest
      delete this.manifest[relativePath];
      await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest), 'utf-8');
      
      console.log(`✅ Removed: ${relativePath} (${chunksRemoved} chunks)`);
    } catch (error) {
      console.error(`❌ Failed to remove ${relativePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove all chunks for a specific file
   */
  async removeFileChunks(relativePath) {
    try {
      const indexArr = await readIndex(this.storeDir);
      const chunksToRemove = indexArr.filter(item => item.relPath === relativePath);
      let removedCount = 0;
      
      for (const chunk of chunksToRemove) {
        try {
          await removeChunk(this.storeDir, chunk.id);
          removedCount++;
        } catch (error) {
          console.warn(`  ⚠️  Failed to remove chunk ${chunk.id}:`, error.message);
          // Continue removing other chunks
        }
      }
      
      // Update index array
      const newIndexArr = indexArr.filter(item => item.relPath !== relativePath);
      await writeIndex(this.storeDir, newIndexArr);
      
      return removedCount;
    } catch (error) {
      console.error(`❌ Failed to remove chunks for ${relativePath}:`, error.message);
      throw error;
    }
  }

  // Helper functions (copied from indexer.js for consistency)
  
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sh': 'bash',
      '.bash': 'bash',
      '.zsh': 'zsh',
      '.fish': 'fish',
      '.ps1': 'powershell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'config',
      '.md': 'markdown',
      '.txt': 'text'
    };
    return languageMap[ext] || 'unknown';
  }

  detectCodeType(content) {
    const trimmed = content.trim();
    
    if (/^(function|def|async\s+function|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\(|var\s+\w+\s*=\s*\()/m.test(trimmed)) {
      return 'function';
    }
    
    if (/^(class|interface|type\s+\w+\s*=)/m.test(trimmed)) {
      return 'class';
    }
    
    if (/^(import|export|from|require\()/m.test(trimmed)) {
      return 'import';
    }
    
    if (/^(\/\/|\/\*|\*|#|<!--)/m.test(trimmed)) {
      return 'comment';
    }
    
    return 'code';
  }

  extractFunctionName(content) {
    const patterns = [
      /function\s+(\w+)/,
      /def\s+(\w+)/,
      /const\s+(\w+)\s*=/,
      /let\s+(\w+)\s*=/,
      /var\s+(\w+)\s*=/,
      /(\w+)\s*:\s*function/,
      /(\w+)\s*\(/
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  extractClassName(content) {
    const patterns = [
      /class\s+(\w+)/,
      /interface\s+(\w+)/,
      /type\s+(\w+)\s*=/
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  extractImports(content) {
    const imports = [];
    const patterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
      /from\s+['"]([^'"]+)['"]/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }
    
    return imports.length > 0 ? imports : null;
  }

  getSurroundingContext(fullContent, startLine, endLine) {
    const lines = fullContent.split('\n');
    const contextLines = 2;
    
    const beforeStart = Math.max(0, startLine - contextLines - 1);
    const afterEnd = Math.min(lines.length, endLine + contextLines);
    
    const before = lines.slice(beforeStart, startLine - 1);
    const after = lines.slice(endLine, afterEnd);
    
    if (before.length === 0 && after.length === 0) {
      return null;
    }
    
    return {
      before: before.length > 0 ? before : null,
      after: after.length > 0 ? after : null
    };
  }
}

export { WatchMode };

export async function watchCommand({ argv, configManager }) {
  const watchMode = new WatchMode(configManager);
  
  try {
    await watchMode.start();
    
    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Watch mode failed:', error.message);
    process.exit(1);
  }
}