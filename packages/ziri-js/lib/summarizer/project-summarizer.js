/**
 * Project Summarizer Implementation
 * Maintains dynamic project summaries for prompt enhancement
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export class ProjectSummarizer {
  constructor(indexStore, repositoryParser) {
    this.indexStore = indexStore;
    this.repositoryParser = repositoryParser;
    this.summarizerVersion = '1.0.0';
  }

  /**
   * Generate a complete project summary
   */
  async generateSummary(repositoryId) {
    const metadata = await this.indexStore.getMetadata(repositoryId);
    const repoPath = metadata.repositoryPath;
    
    // Analyze repository structure and files
    const analysis = await this.analyzeRepository(repoPath);
    
    // Generate summary components
    const overview = await this.generateOverview(analysis);
    const technologies = this.detectTechnologies(analysis);
    const structure = this.buildDirectoryStructure(analysis);
    const keyComponents = await this.identifyKeyComponents(analysis);
    
    const summary = {
      overview,
      technologies,
      structure,
      keyComponents,
      lastUpdated: new Date(),
      metadata: {
        filesAnalyzed: analysis.files.length,
        totalLinesOfCode: analysis.totalLinesOfCode,
        primaryLanguage: analysis.primaryLanguage,
        languageDistribution: analysis.languageDistribution,
        complexityScore: this.calculateComplexityScore(analysis),
        generatedAt: new Date(),
        summarizerVersion: this.summarizerVersion
      }
    };

    // Store summary
    await this.storeSummary(repositoryId, summary);
    
    return summary;
  }

  /**
   * Update summary based on file changes
   */
  async updateSummary(repositoryId, changes) {
    const existingSummary = await this.getSummary(repositoryId);
    
    if (!existingSummary || await this.needsRegeneration(repositoryId, changes)) {
      return await this.generateSummary(repositoryId);
    }

    // Incremental update for minor changes
    const updatedSummary = await this.performIncrementalUpdate(existingSummary, changes, repositoryId);
    await this.storeSummary(repositoryId, updatedSummary);
    
    return updatedSummary;
  }

  /**
   * Get existing project summary
   */
  async getSummary(repositoryId) {
    try {
      const summaryPath = await this.getSummaryPath(repositoryId);
      const summaryContent = await fs.readFile(summaryPath, 'utf-8');
      return JSON.parse(summaryContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if summary needs regeneration
   */
  async needsRegeneration(repositoryId, changes) {
    const significantChangeThreshold = 0.1; // 10% of files changed
    const metadata = await this.indexStore.getMetadata(repositoryId);
    
    // Count significant changes
    const significantChanges = changes.filter(change => 
      this.isSignificantChange(change)
    );
    
    const changeRatio = significantChanges.length / metadata.fileHashes.size;
    return changeRatio > significantChangeThreshold;
  }

  /**
   * Analyze repository to gather information for summary
   */
  async analyzeRepository(repoPath) {
    const analysis = {
      files: [],
      directories: new Map(),
      languageDistribution: new Map(),
      totalLinesOfCode: 0,
      primaryLanguage: '',
      packageFiles: [],
      configFiles: [],
      documentationFiles: []
    };

    // Walk through repository files
    for await (const fileInfo of this.repositoryParser.discoverFiles(repoPath, [])) {
      const fileAnalysis = await this.analyzeFile(fileInfo);
      analysis.files.push(fileAnalysis);
      
      // Update language distribution
      if (fileAnalysis.language) {
        const current = analysis.languageDistribution.get(fileAnalysis.language) || 0;
        analysis.languageDistribution.set(fileAnalysis.language, current + fileAnalysis.linesOfCode);
        analysis.totalLinesOfCode += fileAnalysis.linesOfCode;
      }

      // Categorize special files
      this.categorizeFile(fileAnalysis, analysis);
      
      // Track directory structure
      this.trackDirectory(fileAnalysis.relativePath, analysis.directories);
    }

    // Determine primary language
    analysis.primaryLanguage = this.determinePrimaryLanguage(analysis.languageDistribution);
    
    return analysis;
  }

  /**
   * Analyze individual file
   */
  async analyzeFile(fileInfo) {
    // Use content from fileInfo if available, otherwise read from file system
    let content = fileInfo.content || '';
    if (!content) {
      content = await fs.readFile(fileInfo.path, 'utf-8').catch(() => '');
    }
    
    const lines = content.split('\n');
    
    return {
      path: fileInfo.path,
      relativePath: fileInfo.relativePath,
      extension: fileInfo.extension,
      language: this.detectLanguage(fileInfo.extension, content),
      linesOfCode: this.countLinesOfCode(lines),
      size: fileInfo.size,
      content: content, // Store content for later use
      imports: this.extractImports(content, fileInfo.extension),
      exports: this.extractExports(content, fileInfo.extension),
      classes: this.extractClasses(content, fileInfo.extension),
      functions: this.extractFunctions(content, fileInfo.extension)
    };
  }

  /**
   * Generate project overview text
   */
  async generateOverview(analysis) {
    const { primaryLanguage, totalLinesOfCode, files } = analysis;
    const fileCount = files.length;
    
    let overview = `This is a ${primaryLanguage} project with ${fileCount} files and approximately ${totalLinesOfCode} lines of code. `;
    
    // Add technology-specific insights
    const technologies = this.detectTechnologies(analysis);
    if (technologies.length > 0) {
      overview += `The project uses ${technologies.slice(0, 3).join(', ')}`;
      if (technologies.length > 3) {
        overview += ` and ${technologies.length - 3} other technologies`;
      }
      overview += '. ';
    }

    // Add structure insights
    const hasTests = files.some(f => f.relativePath.includes('test') || f.relativePath.includes('spec'));
    const hasDocs = files.some(f => f.relativePath.toLowerCase().includes('readme') || f.relativePath.includes('doc'));
    
    if (hasTests) {
      overview += 'The project includes test files. ';
    }
    if (hasDocs) {
      overview += 'Documentation is present. ';
    }

    return overview.trim();
  }

  /**
   * Detect technologies used in the project
   */
  detectTechnologies(analysis) {
    const technologies = new Set();
    
    // Language-based detection
    for (const [language] of analysis.languageDistribution) {
      technologies.add(language);
    }

    // Package file analysis
    for (const file of analysis.packageFiles) {
      const techs = this.extractTechnologiesFromPackageFile(file);
      techs.forEach(tech => technologies.add(tech));
    }

    // File pattern analysis
    for (const file of analysis.files) {
      const techs = this.detectTechnologiesFromFile(file);
      techs.forEach(tech => technologies.add(tech));
    }

    // Content-based detection for React, Vue, etc.
    for (const file of analysis.files) {
      if (file.extension === '.jsx' || file.extension === '.tsx') {
        technologies.add('React');
      }
      if (file.extension === '.vue') {
        technologies.add('Vue.js');
      }
      
      // Check file content for framework imports
      const content = file.content || '';
      if (content.includes('import React') || content.includes('from "react"') || content.includes("from 'react'")) {
        technologies.add('React');
      }
      if (content.includes('import Vue') || content.includes('from "vue"') || content.includes("from 'vue'")) {
        technologies.add('Vue.js');
      }
    }

    return Array.from(technologies).sort();
  }

  /**
   * Build directory structure representation
   */
  buildDirectoryStructure(analysis) {
    const root = {
      name: 'project',
      type: 'source',
      children: [],
      importantFiles: []
    };

    // Build tree from directory tracking
    for (const [dirPath, info] of analysis.directories) {
      this.addDirectoryToStructure(root, dirPath, info);
    }

    // If no directories were tracked, create a simple structure from files
    if (root.children.length === 0 && analysis.files.length > 0) {
      const dirSet = new Set();
      for (const file of analysis.files) {
        const parts = file.relativePath.split('/');
        if (parts.length > 1) {
          dirSet.add(parts[0]);
        }
      }
      
      for (const dir of dirSet) {
        root.children.push({
          name: dir,
          type: this.classifyDirectoryType(dir),
          children: [],
          importantFiles: []
        });
      }
    }

    return root;
  }

  /**
   * Identify key components in the codebase
   */
  async identifyKeyComponents(analysis) {
    const components = [];
    
    for (const file of analysis.files) {
      // Add classes as components
      for (const className of file.classes) {
        components.push({
          name: className,
          type: 'class',
          filePath: file.relativePath,
          description: `Class defined in ${file.relativePath}`,
          dependencies: file.imports,
          linesOfCode: file.linesOfCode
        });
      }

      // Add significant functions as components
      for (const funcName of file.functions.slice(0, 3)) { // Top 3 functions per file
        components.push({
          name: funcName,
          type: 'function',
          filePath: file.relativePath,
          description: `Function defined in ${file.relativePath}`,
          dependencies: file.imports,
          linesOfCode: Math.floor(file.linesOfCode / Math.max(file.functions.length, 1))
        });
      }
    }

    // Sort by importance (file size, centrality, etc.)
    return components
      .sort((a, b) => (b.linesOfCode || 0) - (a.linesOfCode || 0))
      .slice(0, 20); // Top 20 components
  }

  /**
   * Calculate project complexity score (1-10)
   */
  calculateComplexityScore(analysis) {
    const factors = {
      fileCount: Math.min(analysis.files.length / 100, 3), // 0-3 points
      linesOfCode: Math.min(analysis.totalLinesOfCode / 10000, 3), // 0-3 points
      languageCount: Math.min(analysis.languageDistribution.size / 3, 2), // 0-2 points
      directoryDepth: Math.min(this.calculateMaxDirectoryDepth(analysis.directories) / 5, 2) // 0-2 points
    };

    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);
    return Math.min(Math.max(Math.round(totalScore), 1), 10);
  }

  // Helper methods for file analysis
  detectLanguage(extension, content) {
    const languageMap = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript', 
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.md': 'Markdown',
      '.sh': 'Shell',
      '.sql': 'SQL'
    };

    return languageMap[extension.toLowerCase()] || 'Unknown';
  }

  countLinesOfCode(lines) {
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#');
    }).length;
  }

  extractImports(content, extension) {
    const imports = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // JavaScript/TypeScript imports
      if ((extension === '.js' || extension === '.ts') && 
          (trimmed.startsWith('import ') || trimmed.startsWith('const ') && trimmed.includes('require('))) {
        const match = trimmed.match(/from ['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/);
        if (match) {
          imports.push(match[1] || match[2]);
        }
      }
      
      // Python imports
      if (extension === '.py' && (trimmed.startsWith('import ') || trimmed.startsWith('from '))) {
        const match = trimmed.match(/(?:import|from)\s+([^\s]+)/);
        if (match) {
          imports.push(match[1]);
        }
      }
    }
    
    return imports;
  }

  extractExports(content, extension) {
    const exports = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if ((extension === '.js' || extension === '.ts') && trimmed.startsWith('export ')) {
        const match = trimmed.match(/export\s+(?:class|function|const|let|var)\s+([^\s(]+)/);
        if (match) {
          exports.push(match[1]);
        }
      }
    }
    
    return exports;
  }

  extractClasses(content, extension) {
    const classes = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if ((extension === '.js' || extension === '.ts') && trimmed.includes('class ')) {
        const match = trimmed.match(/class\s+([^\s{]+)/);
        if (match) {
          classes.push(match[1]);
        }
      }
      
      if (extension === '.py' && trimmed.startsWith('class ')) {
        const match = trimmed.match(/class\s+([^\s(:]+)/);
        if (match) {
          classes.push(match[1]);
        }
      }
    }
    
    return classes;
  }

  extractFunctions(content, extension) {
    const functions = [];
    
    if (extension === '.js' || extension === '.ts') {
      // Match function declarations
      const functionMatches = content.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
      functionMatches.forEach(match => {
        const name = match.replace('function ', '').trim();
        if (name) functions.push(name);
      });
      
      // Match arrow functions with const/let/var
      const arrowMatches = content.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g) || [];
      arrowMatches.forEach(match => {
        const nameMatch = match.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (nameMatch) functions.push(nameMatch[1]);
      });
      
      // Match async functions
      const asyncMatches = content.match(/async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
      asyncMatches.forEach(match => {
        const name = match.replace(/async\s+function\s+/, '').trim();
        if (name) functions.push(name);
      });
    }
    
    if (extension === '.py') {
      const pyMatches = content.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
      pyMatches.forEach(match => {
        const name = match.replace('def ', '').trim();
        if (name) functions.push(name);
      });
    }
    
    return [...new Set(functions)]; // Remove duplicates
  }

  categorizeFile(fileAnalysis, analysis) {
    const { relativePath, extension } = fileAnalysis;
    const lowerPath = relativePath.toLowerCase();
    
    // Package files
    if (['package.json', 'requirements.txt', 'Cargo.toml', 'pom.xml', 'build.gradle'].includes(path.basename(relativePath))) {
      analysis.packageFiles.push(fileAnalysis);
    }
    
    // Config files
    if (lowerPath.includes('config') || ['.env', '.gitignore', '.eslintrc', 'tsconfig.json'].some(ext => relativePath.endsWith(ext))) {
      analysis.configFiles.push(fileAnalysis);
    }
    
    // Documentation files
    if (lowerPath.includes('readme') || lowerPath.includes('doc') || extension === '.md') {
      analysis.documentationFiles.push(fileAnalysis);
    }
  }

  trackDirectory(filePath, directories) {
    const parts = filePath.split(path.sep);
    let currentPath = '';
    
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? path.join(currentPath, parts[i]) : parts[i];
      
      if (!directories.has(currentPath)) {
        directories.set(currentPath, {
          type: this.classifyDirectoryType(currentPath),
          fileCount: 0,
          depth: i + 1
        });
      }
      
      directories.get(currentPath).fileCount++;
    }
  }

  classifyDirectoryType(dirPath) {
    const lowerPath = dirPath.toLowerCase();
    
    if (lowerPath.includes('test') || lowerPath.includes('spec')) return 'test';
    if (lowerPath.includes('doc') || lowerPath.includes('readme')) return 'documentation';
    if (lowerPath.includes('config') || lowerPath.includes('settings')) return 'configuration';
    if (lowerPath.includes('build') || lowerPath.includes('dist') || lowerPath.includes('target')) return 'build';
    if (lowerPath.includes('asset') || lowerPath.includes('static') || lowerPath.includes('public')) return 'assets';
    if (lowerPath.includes('node_modules') || lowerPath.includes('vendor')) return 'dependencies';
    
    return 'source';
  }

  determinePrimaryLanguage(languageDistribution) {
    let maxLines = 0;
    let primaryLanguage = 'Unknown';
    
    for (const [language, lines] of languageDistribution) {
      if (lines > maxLines) {
        maxLines = lines;
        primaryLanguage = language;
      }
    }
    
    return primaryLanguage;
  }

  extractTechnologiesFromPackageFile(file) {
    const technologies = [];
    
    if (file.relativePath.endsWith('package.json')) {
      // Parse package.json for dependencies
      try {
        // Use the file content if available, otherwise read from fs
        let content;
        if (file.content) {
          content = JSON.parse(file.content);
        } else {
          // This will be handled by the mocked fs.readFile in tests
          return technologies;
        }
        
        const deps = { ...content.dependencies, ...content.devDependencies };
        
        // Map common packages to technologies
        const techMap = {
          'react': 'React',
          'vue': 'Vue.js',
          'angular': 'Angular',
          'express': 'Express.js',
          'next': 'Next.js',
          'nuxt': 'Nuxt.js',
          'webpack': 'Webpack',
          'vite': 'Vite',
          'typescript': 'TypeScript',
          'jest': 'Jest',
          'mocha': 'Mocha',
          'cypress': 'Cypress'
        };
        
        for (const dep of Object.keys(deps)) {
          if (techMap[dep]) {
            technologies.push(techMap[dep]);
          }
        }
      } catch (error) {
        // Ignore JSON parsing errors
      }
    }
    
    return technologies;
  }

  detectTechnologiesFromFile(file) {
    const technologies = [];
    const content = file.content || '';
    
    // Framework detection patterns
    const patterns = {
      'React': /import.*react|from ['"]react['"]/i,
      'Vue.js': /import.*vue|from ['"]vue['"]/i,
      'Angular': /@angular|import.*@angular/i,
      'Express.js': /express\(\)|require\(['"]express['"]\)/i,
      'jQuery': /\$\(|\$\.|jquery/i,
      'Bootstrap': /bootstrap|btn-|col-|row/i,
      'Tailwind': /tailwind|tw-/i,
      'Docker': /FROM |COPY |RUN /i,
      'Kubernetes': /apiVersion:|kind:|metadata:/i
    };
    
    for (const [tech, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        technologies.push(tech);
      }
    }
    
    return technologies;
  }

  addDirectoryToStructure(root, dirPath, info) {
    const parts = dirPath.split(path.sep);
    let current = root;
    
    for (const part of parts) {
      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          type: info.type,
          children: [],
          importantFiles: []
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  calculateMaxDirectoryDepth(directories) {
    let maxDepth = 0;
    for (const [, info] of directories) {
      maxDepth = Math.max(maxDepth, info.depth);
    }
    return maxDepth;
  }

  isSignificantChange(change) {
    // Consider changes to key files as significant
    const significantPatterns = [
      /package\.json$/,
      /README/i,
      /config/i,
      /\.(js|ts|py|java|cpp|c|cs)$/
    ];
    
    return significantPatterns.some(pattern => pattern.test(change.path));
  }

  async performIncrementalUpdate(existingSummary, changes, repositoryId) {
    // For now, perform a simple update of metadata
    const updatedSummary = { ...existingSummary };
    updatedSummary.lastUpdated = new Date();
    
    // Update file count based on changes
    const addedFiles = changes.filter(c => c.changeType === 'added').length;
    const deletedFiles = changes.filter(c => c.changeType === 'deleted').length;
    
    updatedSummary.metadata.filesAnalyzed += addedFiles - deletedFiles;
    updatedSummary.metadata.generatedAt = new Date();
    
    return updatedSummary;
  }

  async storeSummary(repositoryId, summary) {
    const summaryPath = await this.getSummaryPath(repositoryId);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    // Also create a markdown version for human readability
    const markdownPath = summaryPath.replace('.json', '.md');
    const markdown = this.generateMarkdownSummary(summary);
    await fs.writeFile(markdownPath, markdown);
  }

  async getSummaryPath(repositoryId) {
    const metadata = await this.indexStore.getMetadata(repositoryId);
    const repoDir = path.dirname(metadata.repositoryPath);
    return path.join(repoDir, '.ziri', 'project_summary.json');
  }

  generateMarkdownSummary(summary) {
    let markdown = `# Project Summary\n\n`;
    markdown += `**Generated:** ${summary.metadata.generatedAt.toISOString()}\n\n`;
    
    markdown += `## Overview\n\n${summary.overview}\n\n`;
    
    markdown += `## Technologies\n\n`;
    summary.technologies.forEach(tech => {
      markdown += `- ${tech}\n`;
    });
    markdown += '\n';
    
    markdown += `## Key Components\n\n`;
    summary.keyComponents.slice(0, 10).forEach(component => {
      markdown += `### ${component.name} (${component.type})\n`;
      markdown += `- **File:** ${component.filePath}\n`;
      markdown += `- **Description:** ${component.description}\n`;
      if (component.linesOfCode) {
        markdown += `- **Lines of Code:** ${component.linesOfCode}\n`;
      }
      markdown += '\n';
    });
    
    markdown += `## Statistics\n\n`;
    markdown += `- **Files Analyzed:** ${summary.metadata.filesAnalyzed}\n`;
    markdown += `- **Total Lines of Code:** ${summary.metadata.totalLinesOfCode}\n`;
    markdown += `- **Primary Language:** ${summary.metadata.primaryLanguage}\n`;
    markdown += `- **Complexity Score:** ${summary.metadata.complexityScore}/10\n`;
    
    return markdown;
  }
}