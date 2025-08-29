/**
 * Project Summarizer Tests
 * Tests for summary accuracy and update logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ProjectSummarizer } from '../../lib/summarizer/project-summarizer.js';
import { SummaryAnalyzer } from '../../lib/summarizer/summary-analyzer.js';
import { TechnologyDetector } from '../../lib/summarizer/technology-detector.js';

describe('ProjectSummarizer', () => {
  let summarizer;
  let mockIndexStore;
  let mockRepositoryParser;
  let testRepoPath;
  let testRepositoryId;

  beforeEach(async () => {
    // Create mock dependencies
    mockIndexStore = {
      getMetadata: vi.fn(),
      storeEmbeddings: vi.fn(),
      removeEmbeddings: vi.fn(),
      queryEmbeddings: vi.fn(),
      updateMetadata: vi.fn()
    };

    mockRepositoryParser = {
      discoverFiles: vi.fn(),
      detectChanges: vi.fn(),
      chunkFile: vi.fn()
    };

    // Setup test data
    testRepoPath = '/test/repo';
    testRepositoryId = 'test-repo-123';

    // Create summarizer instance
    summarizer = new ProjectSummarizer(mockIndexStore, mockRepositoryParser);

    // Mock file system operations
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          dependencies: {
            'react': '^18.0.0',
            'express': '^4.18.0'
          },
          devDependencies: {
            'jest': '^29.0.0',
            'typescript': '^4.8.0'
          }
        });
      }
      if (filePath.includes('test.js') || filePath.includes('App.jsx')) {
        return `
          import React from 'react';
          
          function TestComponent() {
            return <div>Hello World</div>;
          }
          
          const arrowFunction = () => {
            console.log('arrow function');
          };
          
          export default TestComponent;
        `;
      }
      if (filePath.includes('summary.json')) {
        // This will be handled by the specific test mock
        throw { code: 'ENOENT' };
      }
      return 'mock file content';
    });

    vi.spyOn(fs, 'writeFile').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateSummary', () => {
    it('should generate a complete project summary', async () => {
      // Setup mocks
      mockIndexStore.getMetadata.mockResolvedValue({
        repositoryPath: testRepoPath,
        fileHashes: new Map([['file1.js', 'hash1'], ['file2.js', 'hash2']]),
        lastIndexed: new Date()
      });

      mockRepositoryParser.discoverFiles.mockImplementation(async function* () {
        yield {
          path: '/test/repo/src/test.js',
          relativePath: 'src/test.js',
          extension: '.js',
          size: 1000,
          lastModified: new Date(),
          content: `
            import React from 'react';
            
            function TestComponent() {
              return <div>Hello World</div>;
            }
            
            export default TestComponent;
          `
        };
        yield {
          path: '/test/repo/package.json',
          relativePath: 'package.json',
          extension: '.json',
          size: 500,
          lastModified: new Date(),
          content: JSON.stringify({
            name: 'test-project',
            dependencies: {
              'react': '^18.0.0',
              'express': '^4.18.0'
            },
            devDependencies: {
              'jest': '^29.0.0',
              'typescript': '^4.8.0'
            }
          })
        };
      });

      // Execute
      const summary = await summarizer.generateSummary(testRepositoryId);

      // Verify
      expect(summary).toBeDefined();
      expect(summary.overview).toContain('JavaScript project');
      expect(summary.technologies).toContain('JavaScript');
      expect(summary.technologies).toContain('React');
      expect(summary.keyComponents).toBeDefined();
      expect(summary.structure).toBeDefined();
      expect(summary.metadata).toBeDefined();
      expect(summary.metadata.filesAnalyzed).toBe(2);
      expect(summary.metadata.primaryLanguage).toBe('JavaScript');
    });

    it('should detect technologies correctly', async () => {
      // Setup mocks with React project
      mockIndexStore.getMetadata.mockResolvedValue({
        repositoryPath: testRepoPath,
        fileHashes: new Map(),
        lastIndexed: new Date()
      });

      mockRepositoryParser.discoverFiles.mockImplementation(async function* () {
        yield {
          path: '/test/repo/src/App.jsx',
          relativePath: 'src/App.jsx',
          extension: '.jsx',
          size: 1000,
          lastModified: new Date(),
          content: `
            import React from 'react';
            
            function App() {
              return <div>Hello World</div>;
            }
            
            export default App;
          `
        };
        yield {
          path: '/test/repo/package.json',
          relativePath: 'package.json',
          extension: '.json',
          size: 500,
          lastModified: new Date(),
          content: JSON.stringify({
            name: 'test-project',
            dependencies: {
              'react': '^18.0.0'
            }
          })
        };
      });

      // Execute
      const summary = await summarizer.generateSummary(testRepositoryId);

      // Verify React detection
      expect(summary.technologies).toContain('React');
      // The JSX extension should be detected as JavaScript or React
      expect(summary.technologies.length).toBeGreaterThan(0);
    });

    it('should build directory structure correctly', async () => {
      // Setup mocks
      mockIndexStore.getMetadata.mockResolvedValue({
        repositoryPath: testRepoPath,
        fileHashes: new Map(),
        lastIndexed: new Date()
      });

      mockRepositoryParser.discoverFiles.mockImplementation(async function* () {
        yield {
          path: '/test/repo/src/components/Button.js',
          relativePath: 'src/components/Button.js',
          extension: '.js',
          size: 500,
          lastModified: new Date()
        };
        yield {
          path: '/test/repo/test/Button.test.js',
          relativePath: 'test/Button.test.js',
          extension: '.js',
          size: 300,
          lastModified: new Date()
        };
      });

      // Execute
      const summary = await summarizer.generateSummary(testRepositoryId);

      // Verify structure
      expect(summary.structure).toBeDefined();
      expect(summary.structure.children).toBeDefined();
      expect(summary.structure.children.length).toBeGreaterThan(0);
    });
  });

  describe('updateSummary', () => {
    it('should perform incremental update for minor changes', async () => {
      // Setup existing summary
      const existingSummary = {
        overview: 'Test project overview',
        technologies: ['JavaScript', 'React'],
        keyComponents: [],
        structure: { name: 'test', type: 'source', children: [] },
        lastUpdated: new Date('2023-01-01'),
        metadata: {
          filesAnalyzed: 10,
          totalLinesOfCode: 1000,
          primaryLanguage: 'JavaScript',
          complexityScore: 5,
          generatedAt: new Date('2023-01-01'),
          summarizerVersion: '1.0.0'
        }
      };

      vi.spyOn(summarizer, 'getSummary').mockResolvedValue(existingSummary);
      vi.spyOn(summarizer, 'needsRegeneration').mockResolvedValue(false);
      vi.spyOn(summarizer, 'storeSummary').mockResolvedValue();

      const changes = [
        { path: 'src/new-file.js', changeType: 'added' },
        { path: 'src/old-file.js', changeType: 'modified' }
      ];

      // Execute
      const updatedSummary = await summarizer.updateSummary(testRepositoryId, changes);

      // Verify
      expect(updatedSummary.lastUpdated).not.toEqual(existingSummary.lastUpdated);
      expect(updatedSummary.metadata.filesAnalyzed).toBe(11); // +1 for added file
    });

    it('should regenerate summary for significant changes', async () => {
      vi.spyOn(summarizer, 'getSummary').mockResolvedValue(null);
      vi.spyOn(summarizer, 'needsRegeneration').mockResolvedValue(true);
      vi.spyOn(summarizer, 'generateSummary').mockResolvedValue({
        overview: 'Regenerated summary',
        technologies: ['JavaScript'],
        keyComponents: [],
        structure: { name: 'test', type: 'source', children: [] },
        lastUpdated: new Date(),
        metadata: {
          filesAnalyzed: 15,
          totalLinesOfCode: 1500,
          primaryLanguage: 'JavaScript',
          complexityScore: 6,
          generatedAt: new Date(),
          summarizerVersion: '1.0.0'
        }
      });

      const changes = [
        { path: 'package.json', changeType: 'modified' },
        { path: 'src/file1.js', changeType: 'modified' },
        { path: 'src/file2.js', changeType: 'modified' }
      ];

      // Execute
      const result = await summarizer.updateSummary(testRepositoryId, changes);

      // Verify
      expect(summarizer.generateSummary).toHaveBeenCalledWith(testRepositoryId);
      expect(result.overview).toBe('Regenerated summary');
    });
  });

  describe('needsRegeneration', () => {
    it('should return true for significant changes', async () => {
      mockIndexStore.getMetadata.mockResolvedValue({
        fileHashes: new Map([
          ['file1.js', 'hash1'],
          ['file2.js', 'hash2'],
          ['file3.js', 'hash3']
        ])
      });

      const changes = [
        { path: 'package.json', changeType: 'modified' },
        { path: 'README.md', changeType: 'modified' }
      ];

      const result = await summarizer.needsRegeneration(testRepositoryId, changes);
      expect(result).toBe(true);
    });

    it('should return false for minor changes', async () => {
      mockIndexStore.getMetadata.mockResolvedValue({
        fileHashes: new Map(Array.from({ length: 100 }, (_, i) => [`file${i}.js`, `hash${i}`]))
      });

      const changes = [
        { path: 'src/minor-file.js', changeType: 'modified' }
      ];

      const result = await summarizer.needsRegeneration(testRepositoryId, changes);
      expect(result).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should return existing summary', async () => {
      const mockSummary = {
        overview: 'Test summary',
        technologies: ['JavaScript'],
        keyComponents: [],
        structure: { name: 'test', type: 'source', children: [] },
        lastUpdated: '2025-08-24T15:42:06.084Z',
        metadata: {
          filesAnalyzed: 5,
          totalLinesOfCode: 500,
          primaryLanguage: 'JavaScript',
          complexityScore: 3,
          generatedAt: '2025-08-24T15:42:06.084Z',
          summarizerVersion: '1.0.0'
        }
      };

      vi.spyOn(summarizer, 'getSummaryPath').mockResolvedValue('/test/summary.json');
      fs.readFile.mockResolvedValue(JSON.stringify(mockSummary));

      const result = await summarizer.getSummary(testRepositoryId);
      expect(result).toEqual(mockSummary);
    });

    it('should return null for non-existent summary', async () => {
      vi.spyOn(summarizer, 'getSummaryPath').mockResolvedValue('/test/summary.json');
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await summarizer.getSummary(testRepositoryId);
      expect(result).toBeNull();
    });
  });

  describe('language detection', () => {
    it('should detect JavaScript correctly', () => {
      const language = summarizer.detectLanguage('.js', 'const x = 1;');
      expect(language).toBe('JavaScript');
    });

    it('should detect TypeScript correctly', () => {
      const language = summarizer.detectLanguage('.ts', 'interface Test {}');
      expect(language).toBe('TypeScript');
    });

    it('should detect Python correctly', () => {
      const language = summarizer.detectLanguage('.py', 'def hello():');
      expect(language).toBe('Python');
    });
  });

  describe('complexity calculation', () => {
    it('should calculate complexity score correctly', () => {
      const analysis = {
        files: Array.from({ length: 50 }, (_, i) => ({ relativePath: `file${i}.js` })),
        totalLinesOfCode: 5000,
        languageDistribution: new Map([['JavaScript', 5000]]),
        directories: new Map([
          ['src', { depth: 1 }],
          ['src/components', { depth: 2 }],
          ['src/utils', { depth: 2 }]
        ])
      };

      const score = summarizer.calculateComplexityScore(analysis);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe('file analysis', () => {
    it('should extract imports correctly', () => {
      const jsContent = `
        import React from 'react';
        import { useState } from 'react';
        const express = require('express');
      `;

      const imports = summarizer.extractImports(jsContent, '.js');
      expect(imports).toContain('react');
      expect(imports).toContain('express');
    });

    it('should extract classes correctly', () => {
      const jsContent = `
        class TestClass {
          constructor() {}
        }
        
        export class AnotherClass {
          method() {}
        }
      `;

      const classes = summarizer.extractClasses(jsContent, '.js');
      expect(classes).toContain('TestClass');
      expect(classes).toContain('AnotherClass');
    });

    it('should extract functions correctly', () => {
      const jsContent = `
        function testFunction() {}
        
        const arrowFunction = () => {};
        
        async function asyncFunction() {}
      `;

      const functions = summarizer.extractFunctions(jsContent, '.js');
      expect(functions).toContain('testFunction');
      expect(functions).toContain('arrowFunction');
      expect(functions).toContain('asyncFunction');
    });
  });

  describe('markdown generation', () => {
    it('should generate readable markdown summary', () => {
      const summary = {
        overview: 'Test project overview',
        technologies: ['JavaScript', 'React', 'Jest'],
        keyComponents: [
          {
            name: 'TestComponent',
            type: 'class',
            filePath: 'src/TestComponent.js',
            description: 'Main test component',
            linesOfCode: 50
          }
        ],
        metadata: {
          filesAnalyzed: 10,
          totalLinesOfCode: 1000,
          primaryLanguage: 'JavaScript',
          complexityScore: 5,
          generatedAt: new Date('2023-01-01T00:00:00Z')
        }
      };

      const markdown = summarizer.generateMarkdownSummary(summary);
      
      expect(markdown).toContain('# Project Summary');
      expect(markdown).toContain('Test project overview');
      expect(markdown).toContain('- JavaScript');
      expect(markdown).toContain('- React');
      expect(markdown).toContain('### TestComponent (class)');
      expect(markdown).toContain('**Files Analyzed:** 10');
    });
  });
});

describe('SummaryAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new SummaryAnalyzer();
  });

  describe('complexity analysis', () => {
    it('should calculate cyclomatic complexity correctly', () => {
      const jsContent = `
        function test() {
          if (condition1) {
            if (condition2) {
              return true;
            } else {
              return false;
            }
          }
          
          while (loop) {
            if (check) break;
          }
          
          return result;
        }
      `;

      const complexity = analyzer.calculateCyclomaticComplexity(jsContent, 'JavaScript');
      expect(complexity).toBeGreaterThan(1);
    });

    it('should calculate nesting depth correctly', () => {
      const content = `
        function test() {
          if (condition) {
            while (loop) {
              if (nested) {
                return true;
              }
            }
          }
        }
      `;

      const depth = analyzer.calculateNestingDepth(content);
      expect(depth).toBeGreaterThanOrEqual(3);
    });

    it('should count functions correctly', () => {
      const jsContent = `
        function regularFunction() {}
        const arrowFunction = () => {};
        async function asyncFunction() {}
        const asyncArrow = async () => {};
      `;

      const count = analyzer.countFunctions(jsContent, 'JavaScript');
      expect(count).toBe(4);
    });

    it('should generate meaningful insights', () => {
      const analysis = {
        complexityScore: 8,
        nestingDepth: 5,
        cyclomaticComplexity: 20,
        functionCount: 60
      };

      const insights = analyzer.generateInsights(analysis);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some(insight => insight.includes('complexity'))).toBe(true);
    });
  });

  describe('architecture pattern detection', () => {
    it('should detect MVC pattern', () => {
      const files = [
        { relativePath: 'models/User.js' },
        { relativePath: 'views/UserView.js' },
        { relativePath: 'controllers/UserController.js' }
      ];

      const isMVC = analyzer.detectMVCPattern(files);
      expect(isMVC).toBe(true);
    });

    it('should detect microservices pattern', () => {
      const files = [
        { relativePath: 'services/user-service.js' },
        { relativePath: 'services/auth-service.js' },
        { relativePath: 'services/payment-service.js' },
        { relativePath: 'services/notification-service.js' }
      ];

      const isMicroservices = analyzer.detectMicroservicesPattern(files);
      expect(isMicroservices).toBe(true);
    });
  });
});

describe('TechnologyDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TechnologyDetector();
  });

  describe('technology detection', () => {
    it('should detect React from JSX files', () => {
      const analysis = {
        files: [
          {
            relativePath: 'src/App.jsx',
            extension: '.jsx',
            content: 'import React from "react";'
          }
        ],
        packageFiles: [],
        languageDistribution: new Map([['JavaScript', 1000]])
      };

      const technologies = detector.detectTechnologies(analysis);
      const reactTech = technologies.find(t => t.name === 'React');
      expect(reactTech).toBeDefined();
      expect(reactTech.confidence).toBeGreaterThan(50);
    });

    it('should detect technologies from package.json', () => {
      const analysis = {
        files: [],
        packageFiles: [
          {
            relativePath: 'package.json',
            content: JSON.stringify({
              dependencies: {
                'express': '^4.18.0',
                'react': '^18.0.0'
              }
            })
          }
        ],
        languageDistribution: new Map()
      };

      const technologies = detector.detectTechnologies(analysis);
      expect(technologies.some(t => t.name === 'Express')).toBe(true);
      expect(technologies.some(t => t.name === 'React')).toBe(true);
    });

    it('should categorize technologies correctly', () => {
      const technologies = [
        { name: 'React', confidence: 90 },
        { name: 'Express', confidence: 85 },
        { name: 'MongoDB', confidence: 80 },
        { name: 'Jest', confidence: 75 }
      ];

      const categories = detector.categorizeTechnologies(technologies);
      expect(categories['Frontend Frameworks']).toBeDefined();
      expect(categories['Frontend Frameworks'].length).toBeGreaterThan(0);
      expect(categories['Frontend Frameworks'][0].name).toBe('React');
    });
  });

  describe('file pattern detection', () => {
    it('should detect Docker from Dockerfile', () => {
      const detectedTechnologies = new Map();
      const files = [{ relativePath: 'Dockerfile' }];

      detector.detectFromFilePatterns(files, detectedTechnologies);
      expect(detectedTechnologies.has('docker')).toBe(true);
    });

    it('should detect TypeScript from tsconfig.json', () => {
      const detectedTechnologies = new Map();
      const files = [{ relativePath: 'tsconfig.json' }];

      detector.detectFromFilePatterns(files, detectedTechnologies);
      expect(detectedTechnologies.has('typescript')).toBe(true);
    });
  });
});