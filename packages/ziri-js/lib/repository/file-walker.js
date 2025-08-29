import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Streaming File Walker with exclusion pattern support
 * Provides memory-efficient file discovery for repositories
 */
export class FileWalker {
  constructor(options = {}) {
    this.defaultExclusions = [
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
      
      // Generated docs (keep source docs)
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
      '**/*.kiro',
      '**/*.windsurf',
      '**/*.cursor',
      '**/*.qoder',
    ];
    
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
  }

  /**
   * Convert glob pattern to regex
   */
  _globToRegex(pattern) {
    // Convert glob pattern to regex step by step
    let regex = pattern;
    
    // First, handle ** patterns by replacing with placeholders
    regex = regex.replace(/\*\*/g, '___GLOBSTAR___');
    
    // Escape regex special characters (but not * and ?)
    regex = regex.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Replace single * with [^/]* (match anything except path separator)
    regex = regex.replace(/\*/g, '[^/]*');
    
    // Replace ? with . (match any single character)
    regex = regex.replace(/\?/g, '.');
    
    // Now handle the globstar patterns
    // **/ at the beginning - matches any depth including root level
    regex = regex.replace(/^___GLOBSTAR___\//g, '(?:.*\\/)?');
    
    // /** at the end - matches any depth
    regex = regex.replace(/\/___GLOBSTAR___$/g, '(?:\\/.*)?');
    
    // /** in the middle - matches any depth between directories
    regex = regex.replace(/\/___GLOBSTAR___\//g, '(?:\\/.*\\/)?');
    
    // Remaining *** (standalone) - matches everything
    regex = regex.replace(/___GLOBSTAR___/g, '.*');
    
    return new RegExp('^' + regex + '$');
  }

  /**
   * Check if a file path should be excluded
   */
  _shouldExclude(relativePath, excludePatterns) {
    const allPatterns = [...this.defaultExclusions, ...excludePatterns];
    const regexes = allPatterns.map(pattern => this._globToRegex(pattern));
    
    return regexes.some(regex => regex.test(relativePath));
  }

  /**
   * Calculate file hash for change detection
   */
  async _calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // If we can't read the file, return a timestamp-based hash
      const stat = await fs.stat(filePath);
      return crypto.createHash('sha256')
        .update(`${filePath}:${stat.mtime.getTime()}:${stat.size}`)
        .digest('hex');
    }
  }

  /**
   * Get MIME type from file extension
   */
  _getMimeType(extension) {
    const mimeTypes = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.jsx': 'application/javascript',
      '.tsx': 'application/typescript',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-chdr',
      '.cs': 'text/x-csharp',
      '.php': 'application/x-httpd-php',
      '.rb': 'application/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.scss': 'text/x-scss',
      '.sass': 'text/x-sass',
      '.less': 'text/x-less',
      '.yml': 'application/x-yaml',
      '.yaml': 'application/x-yaml',
      '.toml': 'application/toml',
      '.ini': 'text/plain',
      '.cfg': 'text/plain',
      '.conf': 'text/plain'
    };
    
    return mimeTypes[extension.toLowerCase()];
  }

  /**
   * Stream files from a directory with exclusion support
   */
  async* discoverFiles(repoPath, excludePatterns = []) {
    const repoAbsPath = path.resolve(repoPath);
    
    const walkDirectory = async function* (currentPath) {
      let entries;
      try {
        entries = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (error) {
        // Skip directories we can't read
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(repoAbsPath, fullPath).replace(/\\/g, '/');
        
        // Check exclusion patterns
        if (this._shouldExclude(relativePath, excludePatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          yield* walkDirectory(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            
            // Skip files that are too large
            if (stat.size > this.maxFileSize) {
              continue;
            }
            
            const extension = path.extname(entry.name);
            const hash = await this._calculateFileHash(fullPath);
            
            yield {
              path: fullPath,
              relativePath,
              hash,
              size: stat.size,
              lastModified: stat.mtime,
              extension,
              mimeType: this._getMimeType(extension)
            };
          } catch (error) {
            // Skip files we can't stat or hash
            continue;
          }
        }
      }
    }.bind(this);
    
    yield* walkDirectory(repoAbsPath);
  }
}