/**
 * Test suite for AST-based Code Analyzer
 * Validates the advanced AST parsing capabilities and performance optimizations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ASTCodeAnalyzer } from '../lib/metadata/ast-code-analyzer.js';
import { ASTPerformanceOptimizer, astPerformanceOptimizer, parallelASTParser } from '../lib/metadata/ast-performance-optimizer.js';
import { CodeAnalyzer } from '../lib/metadata/code-analyzer.js';

describe('AST Code Analyzer', () => {
  let analyzer;
  let performanceOptimizer;

  beforeEach(() => {
    analyzer = new ASTCodeAnalyzer();
    performanceOptimizer = new ASTPerformanceOptimizer();
  });

  afterEach(() => {
    performanceOptimizer.clearCache();
  });

  describe('JavaScript AST Analysis', () => {
    it('should analyze simple JavaScript function', async () => {
      const jsCode = `
        function greet(name) {
          return "Hello, " + name + "!";
        }
        
        const result = greet("World");
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.type).toBe('function');
      expect(result.functionName).toBe('greet');
      
      // Look for the main function declaration
      const mainFunction = result.functions.find(f => f.type === 'declaration' && f.name === 'greet');
      expect(mainFunction).toBeDefined();
      expect(mainFunction.params).toHaveLength(1);
      expect(mainFunction.params[0].name).toBe('name');
    });

    it('should analyze arrow functions', async () => {
      const jsCode = `
        const add = (a, b) => {
          return a + b;
        };
        
        const multiply = (x, y) => x * y;
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('add');
      expect(result.functions[0].type).toBe('arrow');
      expect(result.functions[1].name).toBe('multiply');
      expect(result.functions[1].type).toBe('arrow');
    });

    it('should analyze ES6 imports', async () => {
      const jsCode = `
        import { useState, useEffect } from 'react';
        import axios from 'axios';
        import * as utils from './utils.js';
        
        function Component() {
          const [state, setState] = useState(null);
          return state;
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.imports).toHaveLength(3);
      expect(result.imports[0].type).toBe('es6');
      expect(result.imports[0].module).toBe('react');
      expect(result.imports[1].module).toBe('axios');
      expect(result.imports[2].module).toBe('./utils.js');
    });

    it('should analyze CommonJS requires', async () => {
      const jsCode = `
        const fs = require('fs');
        const path = require('path');
        const { promisify } = require('util');
        
        function readFile(filePath) {
          return fs.readFileSync(filePath);
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.imports).toHaveLength(3);
      expect(result.imports[0].type).toBe('commonjs');
      expect(result.imports[0].module).toBe('fs');
    });

    it('should analyze class definitions', async () => {
      const jsCode = `
        class Person {
          constructor(name, age) {
            this.name = name;
            this.age = age;
          }
          
          greet() {
            return "Hello, I'm " + this.name;
          }
          
          static getSpecies() {
            return "Homo sapiens";
          }
        }
        
        class Student extends Person {
          constructor(name, age, grade) {
            super(name, age);
            this.grade = grade;
          }
          
          study() {
            return "Studying...";
          }
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.classes).toHaveLength(2);
      expect(result.classes[0].name).toBe('Person');
      expect(result.classes[1].name).toBe('Student');
      expect(result.classes[1].extends).toBe('Person');
      
      expect(result.classes[0].methods).toHaveLength(2);
      expect(result.classes[0].methods[0].name).toBe('greet');
      expect(result.classes[0].methods[1].name).toBe('getSpecies');
      expect(result.classes[0].methods[1].type).toBe('static');
    });

    it('should extract call graph information', async () => {
      const jsCode = `
        function helper() {
          return "help";
        }
        
        function main() {
          const result = helper();
          console.log(result);
          return result;
        }
        
        main();
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.callGraph).toBeDefined();
      expect(result.callGraph.size).toBeGreaterThan(0);
      
      const mainCalls = result.callGraph.get('main');
      expect(mainCalls).toBeDefined();
      expect(mainCalls.some(call => call.name === 'helper')).toBe(true);
      expect(mainCalls.some(call => call.name === 'console.log')).toBe(true);
    });

    it('should perform type inference', async () => {
      const jsCode = `
        const message = "Hello World";
        const count = 42;
        const isActive = true;
        const items = [1, 2, 3];
        const config = { key: "value" };
        
        function getData() {
          return { data: "test" };
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.typeInferences).toBeDefined();
      expect(result.typeInferences.get('message')).toBe('string');
      expect(result.typeInferences.get('count')).toBe('number');
      expect(result.typeInferences.get('isActive')).toBe('boolean');
      expect(result.typeInferences.get('items')).toBe('array');
      expect(result.typeInferences.get('config')).toBe('object');
    });

    it('should track variable scopes', async () => {
      const jsCode = `
        const globalVar = "global";
        
        function outer() {
          const outerVar = "outer";
          
          function inner() {
            const innerVar = "inner";
            return globalVar + outerVar + innerVar;
          }
          
          return inner();
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.variableScopes).toBeDefined();
      expect(result.variableScopes.has('global')).toBe(true);
      expect(result.variableScopes.has('outer')).toBe(true);
      expect(result.variableScopes.has('inner')).toBe(true);
    });

    it('should analyze code relationships', async () => {
      const jsCode = `
        class Animal {
          speak() {
            return "Some sound";
          }
        }
        
        class Dog extends Animal {
          speak() {
            return "Woof!";
          }
          
          bark() {
            return this.speak();
          }
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
      
      expect(result.relationships).toBeDefined();
      
      const inheritance = result.relationships.filter(r => r.type === 'inheritance');
      expect(inheritance).toHaveLength(1);
      expect(inheritance[0].from).toBe('Dog');
      expect(inheritance[0].to).toBe('Animal');
      
      const methods = result.relationships.filter(r => r.type === 'method');
      expect(methods.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript AST Analysis', () => {
    it('should analyze TypeScript interfaces and types', async () => {
      const tsCode = `
        interface User {
          id: number;
          name: string;
          email?: string;
        }
        
        type UserRole = 'admin' | 'user' | 'guest';
        
        class UserService {
          private users: User[] = [];
          
          addUser(user: User): void {
            this.users.push(user);
          }
        }
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(tsCode, 'typescript', 'test.ts');
      
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserService');
      expect(result.classes[0].methods).toHaveLength(1);
      expect(result.classes[0].methods[0].name).toBe('addUser');
    });
  });

  describe('Performance Optimization', () => {
    it('should cache AST results', async () => {
      const jsCode = `
        function test() {
          return "test";
        }
      `;

      // First parse - should be a cache miss
      const result1 = await performanceOptimizer.getCachedAST(
        jsCode, 
        'test.js', 
        'javascript', 
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        }
      );

      const stats1 = performanceOptimizer.getStats();
      expect(stats1.cacheMisses).toBe(1);
      expect(stats1.cacheHits).toBe(0);

      // Second parse with same content - should be a cache hit
      const result2 = await performanceOptimizer.getCachedAST(
        jsCode, 
        'test.js', 
        'javascript', 
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        }
      );

      const stats2 = performanceOptimizer.getStats();
      expect(stats2.cacheMisses).toBe(1);
      expect(stats2.cacheHits).toBe(1);
    });

    it('should detect file changes', async () => {
      const originalCode = `
        function original() {
          return "original";
        }
      `;

      const modifiedCode = `
        function modified() {
          return "modified";
        }
      `;

      // Parse original code
      await performanceOptimizer.getCachedAST(
        originalCode, 
        'test.js', 
        'javascript', 
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        }
      );

      const stats1 = performanceOptimizer.getStats();
      expect(stats1.cacheMisses).toBe(1);

      // Parse modified code - should be a cache miss
      await performanceOptimizer.getCachedAST(
        modifiedCode, 
        'test.js', 
        'javascript', 
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        }
      );

      const stats2 = performanceOptimizer.getStats();
      expect(stats2.cacheMisses).toBe(2);
    });

    it('should handle incremental parsing', async () => {
      const oldCode = `
        function test() {
          console.log("test");
        }
      `;

      const newCode = `
        function test() {
          console.log("test");
          // Added comment
          return "result";
        }
      `;

      const result = await performanceOptimizer.incrementalParse(
        newCode, 
        'test.js', 
        'javascript', 
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        },
        oldCode
      );

      expect(result).toBeDefined();
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('test');
    });
  });

  describe('Parallel Parsing', () => {
    it('should parse multiple files in parallel', async () => {
      const files = [
        {
          filePath: 'file1.js',
          content: 'function test1() { return "1"; }',
          language: 'javascript'
        },
        {
          filePath: 'file2.js',
          content: 'function test2() { return "2"; }',
          language: 'javascript'
        },
        {
          filePath: 'file3.js',
          content: 'function test3() { return "3"; }',
          language: 'javascript'
        }
      ];

      const results = await parallelASTParser.parseFiles(
        files,
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        }
      );

      expect(results.size).toBe(3);
      expect(results.get('file1.js').ast).toBeDefined();
      expect(results.get('file2.js').ast).toBeDefined();
      expect(results.get('file3.js').ast).toBeDefined();
      expect(results.get('file1.js').error).toBeNull();
      expect(results.get('file2.js').error).toBeNull();
      expect(results.get('file3.js').error).toBeNull();
    });
  });

  describe('Fallback to Regex Analyzer', () => {
    it('should fallback to regex analyzer for unsupported languages', async () => {
      const pythonCode = `
        def greet(name):
            return f"Hello, {name}!"
        
        result = greet("World")
      `;

      // Mock the regex analyzer
      const mockRegexAnalyzer = {
        analyze: (content, language, filePath) => ({
          type: 'function',
          functionName: 'greet',
          functions: [{ name: 'greet', type: 'function' }],
          classes: [],
          imports: []
        })
      };

      // Temporarily replace the fallback analyzer
      const originalGetFallbackAnalyzer = analyzer.getFallbackAnalyzer;
      analyzer.getFallbackAnalyzer = async () => mockRegexAnalyzer;

      try {
        const result = await analyzer.analyze(pythonCode, 'python', 'test.py');
        
        expect(result.type).toBe('function');
        expect(result.functionName).toBe('greet');
        expect(result.functions).toHaveLength(1);
        expect(result.functions[0].name).toBe('greet');
      } finally {
        // Restore original method
        analyzer.getFallbackAnalyzer = originalGetFallbackAnalyzer;
      }
    });

    it('should fallback to regex analyzer on AST parsing errors', async () => {
      const malformedJS = `
        function broken(
          // Missing closing parenthesis and body
      `;

      // Mock the regex analyzer
      const mockRegexAnalyzer = {
        analyze: (content, language, filePath) => ({
          type: 'code',
          functionName: null,
          functions: [],
          classes: [],
          imports: []
        })
      };

      // Temporarily replace the fallback analyzer
      const originalGetFallbackAnalyzer = analyzer.getFallbackAnalyzer;
      analyzer.getFallbackAnalyzer = async () => mockRegexAnalyzer;

      try {
        const result = await analyzer.analyze(malformedJS, 'javascript', 'test.js');
        
        expect(result.type).toBe('code');
        expect(result.functions).toHaveLength(0);
      } finally {
        // Restore original method
        analyzer.getFallbackAnalyzer = originalGetFallbackAnalyzer;
      }
    });
  });

  describe('Performance Statistics', () => {
    it('should provide accurate performance statistics', async () => {
      const jsCode = `
        function perfTest() {
          return "performance";
        }
      `;

      // Parse multiple times to generate statistics
      for (let i = 0; i < 3; i++) {
        await performanceOptimizer.getCachedAST(
          jsCode, 
          `test${i}.js`, 
          'javascript', 
          async (content, filePath, language) => {
            const analyzer = new ASTCodeAnalyzer();
            return await analyzer.analyze(content, language, filePath);
          }
        );
      }

      const stats = performanceOptimizer.getStats();
      
      expect(stats.parseCount).toBe(3);
      expect(stats.cacheMisses).toBe(3);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cachedFiles).toBe(3);
      expect(typeof stats.totalCacheSize).toBe('string');
      expect(typeof stats.hitRate).toBe('string');
    });

    it('should validate cache integrity', async () => {
      const jsCode = `
        function validateTest() {
          return "validate";
        }
      `;

      await performanceOptimizer.getCachedAST(
        jsCode, 
        'validate.js', 
        'javascript', 
        async (content, filePath, language) => {
          const analyzer = new ASTCodeAnalyzer();
          return await analyzer.analyze(content, language, filePath);
        }
      );

      const validationResult = performanceOptimizer.validateCache();
      
      expect(validationResult.validatedFiles).toBe(1);
      expect(validationResult.removedInvalidFiles).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      const result = await ASTCodeAnalyzer.analyzeCode('', 'javascript', 'empty.js');
      
      expect(result.type).toBe('code');
      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
    });

    it('should handle comments-only files', async () => {
      const commentCode = `
        // This is a comment
        /* Multi-line comment */
        /**
         * JSDoc comment
         */
      `;

      const result = await ASTCodeAnalyzer.analyzeCode(commentCode, 'javascript', 'comments.js');
      
      expect(result.type).toBe('comment');
      expect(result.comments.length).toBeGreaterThan(0);
      expect(result.docstrings.length).toBeGreaterThan(0);
    });

    it('should handle syntax errors gracefully', async () => {
      const syntaxError = `
        function broken(
          // This will cause a syntax error
      `;

      // Mock the regex analyzer for fallback
      const mockRegexAnalyzer = {
        analyze: (content, language, filePath) => ({
          type: 'code',
          functionName: null,
          functions: [],
          classes: [],
          imports: []
        })
      };

      const originalGetFallbackAnalyzer = analyzer.getFallbackAnalyzer;
      analyzer.getFallbackAnalyzer = async () => mockRegexAnalyzer;

      try {
        const result = await analyzer.analyze(syntaxError, 'javascript', 'broken.js');
        
        expect(result.type).toBe('code');
        expect(result.functions).toHaveLength(0);
      } finally {
        analyzer.getFallbackAnalyzer = originalGetFallbackAnalyzer;
      }
    });
  });
});
