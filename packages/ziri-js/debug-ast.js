/**
 * AST Code Analyzer Debug Script
 * 
 * This script demonstrates the fixed AST analyzer functionality with proper context binding
 * and Babel module loading. It analyzes different types of JavaScript code structures.
 */
import { loadBabelModules } from './lib/metadata/ast-code-analyzer.js';
import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

console.log('AST Analyzer Debug Script Starting...');

async function debug() {
  // Sample code with various JavaScript features
  const jsCode = `
    // Import statements
    import React from 'react';
    import { useState, useEffect } from 'react';
    
    /**
     * A greeting function with JSDoc
     * @param {string} name - The name to greet
     * @returns {string} The greeting message
     */
    function greet(name) {
      console.log("Hello, " + name);
      return "Hello, " + name;
    }
    
    // Arrow function
    const add = (a, b) => a + b;
    
    // Class with methods
    class Person {
      constructor(name, age) {
        this.name = name;
        this.age = age;
      }
      
      greet() {
        return "Hi, I'm " + this.name;
      }
      
      static getType() {
        return "Human";
      }
    }
    
    // Subclass demonstrating inheritance
    class Employee extends Person {
      constructor(name, age, role) {
        super(name, age);
        this.role = role;
      }
      
      work() {
        return \`\${this.name} is working as \${this.role}\`;
      }
    }
  `;

  console.log('=========== TESTING AST ANALYZER ===========');
  
  try {
    // Load and verify Babel modules
    console.log('\n1. VERIFYING BABEL MODULES');
    const { traverse, generate } = await loadBabelModules();
    console.log(`Traverse function available: ${typeof traverse === 'function' ? 'Yes ✓' : 'No ✗'}`);
    console.log(`Generate function available: ${typeof generate === 'function' ? 'Yes ✓' : 'No ✗'}`);
    
    // Analyze code using the fixed AST analyzer
    console.log('\n2. ANALYZING CODE');
    console.log('Code length:', jsCode.length, 'characters');
    
    console.log('\n3. RUNNING FULL ANALYSIS');
    const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
    
    // Display analysis results
    console.log('\n=========== ANALYSIS RESULTS ===========');
    console.log(`Result type: ${result.type}`);
    
    // Show imports
    console.log(`\nImports (${result.imports.length}):`);
    result.imports.forEach((imp, i) => {
      console.log(`  [${i+1}] ${imp.type} import from '${imp.module}'`);
    });
    
    // Show functions
    console.log(`\nFunctions (${result.functions.length}):`);
    result.functions.forEach((fn, i) => {
      console.log(`  [${i+1}] ${fn.type} function: ${fn.name}${fn.className ? ` (in ${fn.className})` : ''}`);
      if (fn.params && fn.params.length) {
        console.log(`      params: ${fn.params.map(p => p.name).join(', ')}`);
      }
    });
    
    // Show classes
    console.log(`\nClasses (${result.classes.length}):`);
    result.classes.forEach((cls, i) => {
      console.log(`  [${i+1}] class: ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}`);
      console.log(`      methods: ${cls.methods.length} (${cls.methods.map(m => m.name).join(', ')})`);
    });
    
    // Show comments
    console.log(`\nComments: ${result.comments.length}`);
    console.log(`JSDoc comments: ${result.docstrings.length}`);
    
    // Show advanced analysis results
    console.log('\nAdvanced Analysis:');
    console.log(`  - Call Graph: ${result.callGraph.size} entries`);
    console.log(`  - Variable Scopes: ${result.variableScopes.size} scopes`);
    console.log(`  - Type Inferences: ${result.typeInferences.size} types`);
    console.log(`  - Relationships: ${result.relationships.length} relationships`);
    
    // Show relationship details if any
    if (result.relationships.length > 0) {
      console.log('\nRelationship Details:');
      result.relationships.forEach((rel, i) => {
        if (rel.type === 'inheritance') {
          console.log(`  [${i+1}] ${rel.from} extends ${rel.to}`);
        } else if (rel.type === 'method') {
          console.log(`  [${i+1}] ${rel.class}.${rel.method}()`);
        }
      });
    }
    
    console.log('\n=========== DEBUG COMPLETE ===========');
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  }
}

debug().catch(console.error);
