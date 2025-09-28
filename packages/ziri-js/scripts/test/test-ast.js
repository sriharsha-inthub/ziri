// AST Test Script for verification
import { loadBabelModules, ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

async function testAST() {
  console.log('=== AST Analyzer Test ===');
  
  const jsCode = `
    // Sample JavaScript code with functions, classes, and imports
    import React from 'react';
    import { useState, useEffect } from 'react';
    
    // A simple function
    function greet(name) {
      console.log("Hello, " + name);
      return "Hello, " + name;
    }
    
    // An arrow function
    const add = (a, b) => a + b;
    
    // A class
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
  `;
  
  try {
    console.log('Running analysis...');
    const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
    
    console.log('\n=== Analysis Results ===');
    console.log('Type:', result.type);
    
    console.log('\nImports:', result.imports.length);
    if (result.imports.length > 0) {
      result.imports.forEach(imp => {
        console.log(`  - ${imp.type} import: ${imp.module}`);
      });
    }
    
    console.log('\nFunctions:', result.functions.length);
    if (result.functions.length > 0) {
      result.functions.forEach(fn => {
        console.log(`  - ${fn.type} function: ${fn.name}`);
      });
    }
    
    console.log('\nClasses:', result.classes.length);
    if (result.classes.length > 0) {
      result.classes.forEach(cls => {
        console.log(`  - class: ${cls.name}`);
        console.log(`    methods: ${cls.methods.length}`);
      });
    }
    
    console.log('\nAdvanced Analysis:');
    console.log(`  - Call Graph: ${result.callGraph.size} entries`);
    console.log(`  - Variable Scopes: ${result.variableScopes.size} entries`);
    console.log(`  - Type Inferences: ${result.typeInferences.size} entries`);
    console.log(`  - Relationships: ${result.relationships.length} entries`);
    
  } catch (error) {
    console.error('Analysis failed:', error);
    console.error(error.stack);
  }
}

testAST().catch(err => console.error('Test failed:', err));
