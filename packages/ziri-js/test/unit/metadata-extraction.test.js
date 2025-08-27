/**
 * Tests for enhanced metadata extraction system
 */

import { describe, it, expect } from 'vitest';
import { CodeAnalyzer } from '../../lib/metadata/code-analyzer.js';

describe('Metadata Extraction System', () => {
  describe('JavaScript/TypeScript Analysis', () => {
    it('should extract function declarations', () => {
      const code = `
        function calculateSum(a, b) {
          return a + b;
        }
        
        async function fetchData(url) {
          const response = await fetch(url);
          return response.json();
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
      
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('calculateSum');
      expect(result.functions[0].params).toBe('a, b');
      expect(result.functions[0].type).toBe('declaration');
      expect(result.functions[0].async).toBe(false);
      
      expect(result.functions[1].name).toBe('fetchData');
      expect(result.functions[1].async).toBe(true);
      expect(result.type).toBe('function');
      expect(result.functionName).toBe('calculateSum');
    });

    it('should extract arrow functions', () => {
      const code = `
        const multiply = (x, y) => x * y;
        const processAsync = async (data) => {
          return await transform(data);
        };
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
      
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('multiply');
      expect(result.functions[0].type).toBe('arrow');
      expect(result.functions[1].name).toBe('processAsync');
      expect(result.functions[1].async).toBe(true);
    });

    it('should extract class definitions', () => {
      const code = `
        class UserManager extends BaseManager {
          constructor(config) {
            super(config);
          }
          
          async getUser(id) {
            return await this.fetch(\`/users/\${id}\`);
          }
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
      
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserManager');
      expect(result.classes[0].extends).toBe('BaseManager');
      expect(result.type).toBe('class');
      expect(result.className).toBe('UserManager');
    });

    it('should extract ES6 imports', () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as utils from './utils';
        import { config } from '../config.js';
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
      
      expect(result.imports).toHaveLength(4);
      expect(result.imports[0].type).toBe('es6');
      expect(result.imports[0].module).toBe('react');
      expect(result.imports[1].module).toBe('react');
      expect(result.imports[2].module).toBe('./utils');
      expect(result.type).toBe('import');
    });

    it('should extract CommonJS requires', () => {
      const code = `
        const fs = require('fs');
        const { join } = require('path');
        let config = require('./config.json');
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
      
      expect(result.imports).toHaveLength(3);
      expect(result.imports[0].type).toBe('commonjs');
      expect(result.imports[0].module).toBe('fs');
      expect(result.imports[1].module).toBe('path');
    });

    it('should extract JSDoc comments', () => {
      const code = `
        /**
         * Calculates the sum of two numbers
         * @param {number} a - First number
         * @param {number} b - Second number
         * @returns {number} The sum
         */
        function add(a, b) {
          return a + b;
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
      
      expect(result.docstrings).toHaveLength(1);
      expect(result.docstrings[0].type).toBe('jsdoc');
      expect(result.docstrings[0].content).toContain('Calculates the sum');
    });
  });

  describe('Python Analysis', () => {
    it('should extract function definitions', () => {
      const code = `
        def calculate_sum(a, b):
            """Calculate the sum of two numbers."""
            return a + b
            
        async def fetch_data(url: str) -> dict:
            response = await client.get(url)
            return response.json()
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'python', 'test.py');
      
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('calculate_sum');
      expect(result.functions[0].params).toBe('a, b');
      expect(result.functions[1].name).toBe('fetch_data');
      expect(result.functions[1].returnType).toBe('dict');
    });

    it('should extract class definitions', () => {
      const code = `
        class UserManager(BaseManager):
            def __init__(self, config):
                super().__init__(config)
                
            def get_user(self, user_id):
                return self.fetch(f"/users/{user_id}")
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'python', 'test.py');
      
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserManager');
      expect(result.classes[0].bases).toBe('BaseManager');
    });

    it('should extract Python imports', () => {
      const code = `
        import os
        import json as js
        from pathlib import Path
        from typing import List, Dict
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'python', 'test.py');
      
      expect(result.imports).toHaveLength(4);
      expect(result.imports[0].type).toBe('import');
      expect(result.imports[0].module).toBe('os');
      expect(result.imports[1].alias).toBe('js');
      expect(result.imports[2].type).toBe('from');
      expect(result.imports[2].module).toBe('pathlib');
    });

    it('should extract docstrings', () => {
      const code = `
        def process_data(data):
            """
            Process the input data and return results.
            
            Args:
                data: Input data to process
                
            Returns:
                Processed results
            """
            return transform(data)
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'python', 'test.py');
      
      expect(result.docstrings).toHaveLength(1);
      expect(result.docstrings[0].type).toBe('docstring');
      expect(result.docstrings[0].content).toContain('Process the input data');
    });
  });

  describe('Java Analysis', () => {
    it('should extract method definitions', () => {
      const code = `
        public class Calculator {
            public static int add(int a, int b) {
                return a + b;
            }
            
            private String formatResult(int result) throws Exception {
                return String.valueOf(result);
            }
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'java', 'Calculator.java');
      
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('add');
      expect(result.functions[0].returnType).toBe('int');
      expect(result.functions[1].name).toBe('formatResult');
      expect(result.functions[1].returnType).toBe('String');
    });

    it('should extract class definitions', () => {
      const code = `
        public class UserService extends BaseService implements UserInterface {
            // class content
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'java', 'UserService.java');
      
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserService');
      expect(result.classes[0].extends).toBe('BaseService');
      expect(result.classes[0].implements).toBe('UserInterface');
    });

    it('should extract imports', () => {
      const code = `
        import java.util.List;
        import static java.lang.Math.PI;
        import com.example.UserService;
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'java', 'Test.java');
      
      expect(result.imports).toHaveLength(3);
      expect(result.imports[0].module).toBe('java.util.List');
      expect(result.imports[1].static).toBe(true);
      expect(result.imports[2].module).toBe('com.example.UserService');
    });
  });

  describe('Generic Language Support', () => {
    it('should handle unknown languages gracefully', () => {
      const code = `
        // Some unknown language code
        function_like_thing() {
          return "something";
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'unknown', 'test.unknown');
      
      expect(result.type).toBe('code');
      expect(result.comments.length).toBeGreaterThan(0);
    });

    it('should extract comments from various formats', () => {
      const code = `
        // C-style single line comment
        /* C-style multi-line comment */
        # Shell/Python style comment
        -- SQL style comment
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'unknown', 'test.txt');
      
      expect(result.comments.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const result = CodeAnalyzer.analyzeCode('', 'javascript', 'empty.js');
      
      expect(result.type).toBe('code');
      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
    });

    it('should handle malformed code gracefully', () => {
      const code = `
        function incomplete(
        class MissingBrace {
        import from
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'malformed.js');
      
      // Should not throw and should return some results
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it('should prioritize function over class when both exist', () => {
      const code = `
        class MyClass {
          myMethod() {
            return 'test';
          }
        }
        
        function myFunction() {
          return 'function';
        }
      `;
      
      const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'mixed.js');
      
      // Should prioritize function as primary type
      expect(result.type).toBe('function');
      expect(result.functionName).toBeDefined();
      expect(result.classes).toHaveLength(1);
      expect(result.functions.length).toBeGreaterThan(0);
    });
  });
});