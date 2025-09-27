# AST Analyzer

## Overview

The AST (Abstract Syntax Tree) Analyzer is a powerful component of the Ziri project that provides accurate code structure analysis through true AST parsing. Unlike simple regex-based analyzers, the AST analyzer understands the semantic structure of code, enabling advanced analysis features.

## Features

### Code Structure Analysis

- **Function Extraction**: Identifies functions, methods, and arrow functions with their signatures and parameters.
- **Class Extraction**: Detects classes, inheritance relationships, methods, and properties.
- **Import Analysis**: Extracts ES6 imports and CommonJS requires with detailed metadata.
- **Comment Detection**: Extracts regular comments and JSDoc documentation.

### Advanced Analysis

- **Call Graph Building**: Maps relationships between functions to understand call dependencies.
- **Type Inference**: Attempts to determine variable and function return types.
- **Variable Scope Tracking**: Tracks variables and their scopes throughout the code.
- **Code Relationships**: Identifies relationships like inheritance and method implementations.

### Performance Optimization

- **Caching**: Implements a performance optimizer to cache parsed ASTs.
- **Incremental Parsing**: Supports incremental updates for files that have minimal changes.
- **Parallel Processing**: Can process multiple files concurrently for better performance.

### Error Handling

- **Robust Fallback**: Falls back to regex-based analysis when AST parsing fails.
- **Comprehensive Logging**: Provides detailed diagnostics for troubleshooting.
- **Graceful Error Recovery**: Handles syntax errors and invalid code without crashing.

## Language Support

Currently, the analyzer supports:

- **JavaScript/TypeScript** (full support)
- **IBM ACE msgflow XML** (full support)
- **IBM ACE ESQL** (full support)
- **Mulesoft XML** (full support)
- **DataWeave Language (DWL)** (full support)
- **Python** (planned)
- **Java** (planned)
- **C++** (planned)
- **Flutter/Dart** (planned)
- **YAML/CloudFormation** (planned)

## Usage

```javascript
import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

// Example code to analyze
const jsCode = `
  function greet(name) {
    return "Hello, " + name;
  }
`;

// Analyze the code
const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'example.js');

// Access analysis results
console.log(`Found ${result.functions.length} functions`);
console.log(`Function name: ${result.functions[0].name}`);
```

## Integration with Ziri

The AST Analyzer integrates with the Ziri code context system to provide rich semantic information about codebases. This enables more intelligent code understanding, search, and retrieval capabilities.

## Future Enhancements

1. **Python AST Analyzer**: Implement Python-specific AST parsing.
2. **Java AST Analyzer**: Add support for Java language constructs.
3. **C++ AST Analyzer**: Extend support to C++ codebases.
4. **Flutter/Dart AST Analyzer**: Complete the Dart language analyzer implementation.
5. **YAML/CloudFormation AST Analyzer**: Add support for infrastructure as code files.
6. **Enhanced Type Inference**: Improve type detection accuracy.
7. **Performance Optimization**: Further optimize parsing and analysis for large codebases.

## Related Documentation

- [Enterprise Integration Analyzers](./enterprise-integration-analyzers.md) - Documentation for IBM ACE and Mulesoft analyzers.
