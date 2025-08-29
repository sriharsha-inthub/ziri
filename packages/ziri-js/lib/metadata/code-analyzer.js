/**
 * Enhanced Code Analysis for Metadata Extraction
 * Provides detailed code structure analysis for multiple programming languages
 */

export class CodeAnalyzer {
  /**
   * Analyze code structure and extract metadata
   */
  static analyzeCode(content, language, filePath) {
    const analyzer = new CodeAnalyzer();
    return analyzer.analyze(content, language, filePath);
  }

  analyze(content, language, filePath) {
    const result = {
      type: 'code',
      functionName: null,
      className: null,
      imports: [],
      functions: [],
      classes: [],
      comments: [],
      docstrings: [],
      signature: null
    };

    // Get language-specific analyzer
    const languageAnalyzer = this.getLanguageAnalyzer(language);
    if (!languageAnalyzer) {
      return result;
    }

    // Extract imports
    result.imports = languageAnalyzer.extractImports(content);
    
    // Extract functions with signatures
    result.functions = languageAnalyzer.extractFunctions(content);
    
    // Extract classes
    result.classes = languageAnalyzer.extractClasses(content);
    
    // Extract comments and docstrings
    result.comments = languageAnalyzer.extractComments(content);
    result.docstrings = languageAnalyzer.extractDocstrings(content);

    // Determine primary type and names
    if (result.functions.length > 0) {
      result.type = 'function';
      result.functionName = result.functions[0].name;
      result.signature = result.functions[0].signature;
    } else if (result.classes.length > 0) {
      result.type = 'class';
      result.className = result.classes[0].name;
    } else if (result.imports.length > 0) {
      result.type = 'import';
    } else if (result.comments.length > 0 || result.docstrings.length > 0) {
      result.type = 'comment';
    }

    return result;
  }

  getLanguageAnalyzer(language) {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return new JavaScriptAnalyzer();
      case 'python':
        return new PythonAnalyzer();
      case 'java':
        return new JavaAnalyzer();
      case 'cpp':
      case 'c':
        return new CppAnalyzer();
      default:
        return new GenericAnalyzer();
    }
  }
}

/**
 * Base analyzer class with common functionality
 */
class BaseAnalyzer {
  extractImports(content) {
    return [];
  }

  extractFunctions(content) {
    return [];
  }

  extractClasses(content) {
    return [];
  }

  extractComments(content) {
    return [];
  }

  extractDocstrings(content) {
    return [];
  }

  // Helper method to extract text between patterns
  extractBetween(content, startPattern, endPattern) {
    const matches = [];
    let startIndex = 0;
    
    while (true) {
      const start = content.indexOf(startPattern, startIndex);
      if (start === -1) break;
      
      const end = content.indexOf(endPattern, start + startPattern.length);
      if (end === -1) break;
      
      matches.push(content.substring(start, end + endPattern.length));
      startIndex = end + endPattern.length;
    }
    
    return matches;
  }
}

/**
 * JavaScript/TypeScript specific analyzer
 */
class JavaScriptAnalyzer extends BaseAnalyzer {
  extractImports(content) {
    const imports = [];
    
    // ES6 imports
    const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push({
        type: 'es6',
        module: match[1],
        statement: match[0].trim()
      });
    }
    
    // CommonJS requires
    const requireRegex = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push({
        type: 'commonjs',
        module: match[1],
        statement: match[0].trim()
      });
    }
    
    return imports;
  }

  extractFunctions(content) {
    const functions = [];
    
    // Function declarations
    const funcDeclRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = funcDeclRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].trim(),
        signature: match[0],
        type: 'declaration',
        async: match[0].includes('async')
      });
    }
    
    // Arrow functions and function expressions
    const arrowFuncRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
    while ((match = arrowFuncRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].trim(),
        signature: match[0],
        type: 'arrow',
        async: match[0].includes('async')
      });
    }
    
    // Method definitions in classes
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g;
    while ((match = methodRegex.exec(content)) !== null) {
      // Skip if it's a function declaration (already captured)
      if (!content.substring(0, match.index).includes('function ' + match[1])) {
        functions.push({
          name: match[1],
          params: match[2].trim(),
          signature: match[0],
          type: 'method',
          async: match[0].includes('async')
        });
      }
    }
    
    return functions;
  }

  extractClasses(content) {
    const classes = [];
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        extends: match[2] || null,
        signature: match[0]
      });
    }
    
    return classes;
  }

  extractComments(content) {
    const comments = [];
    
    // Single line comments
    const singleLineRegex = /\/\/.*$/gm;
    let match;
    while ((match = singleLineRegex.exec(content)) !== null) {
      comments.push({
        type: 'single',
        content: match[0].trim()
      });
    }
    
    // Multi-line comments
    const multiLineRegex = /\/\*[\s\S]*?\*\//g;
    while ((match = multiLineRegex.exec(content)) !== null) {
      comments.push({
        type: 'multi',
        content: match[0].trim()
      });
    }
    
    return comments;
  }

  extractDocstrings(content) {
    // JSDoc comments
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const docstrings = [];
    
    let match;
    while ((match = jsdocRegex.exec(content)) !== null) {
      docstrings.push({
        type: 'jsdoc',
        content: match[0].trim()
      });
    }
    
    return docstrings;
  }
}

/**
 * Python specific analyzer
 */
class PythonAnalyzer extends BaseAnalyzer {
  extractImports(content) {
    const imports = [];
    
    // Standard imports
    const importRegex = /^import\s+([^\s#]+)(?:\s+as\s+(\w+))?/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        type: 'import',
        module: match[1],
        alias: match[2] || null,
        statement: match[0].trim()
      });
    }
    
    // From imports
    const fromImportRegex = /^from\s+([^\s#]+)\s+import\s+([^#\n]+)/gm;
    while ((match = fromImportRegex.exec(content)) !== null) {
      imports.push({
        type: 'from',
        module: match[1],
        items: match[2].trim(),
        statement: match[0].trim()
      });
    }
    
    return imports;
  }

  extractFunctions(content) {
    const functions = [];
    
    // Function definitions with decorators support
    const funcRegex = /(?:@\w+(?:\([^)]*\))?\s*\n\s*)*def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].trim(),
        returnType: match[3] ? match[3].trim() : null,
        signature: match[0],
        type: 'function'
      });
    }
    
    return functions;
  }

  extractClasses(content) {
    const classes = [];
    
    // Class definitions
    const classRegex = /class\s+(\w+)(?:\(([^)]*)\))?:/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        bases: match[2] ? match[2].trim() : null,
        signature: match[0]
      });
    }
    
    return classes;
  }

  extractComments(content) {
    const comments = [];
    
    // Single line comments
    const commentRegex = /#.*$/gm;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
      comments.push({
        type: 'single',
        content: match[0].trim()
      });
    }
    
    return comments;
  }

  extractDocstrings(content) {
    const docstrings = [];
    
    // Triple quoted docstrings
    const docstringRegex = /"""[\s\S]*?"""|'''[\s\S]*?'''/g;
    let match;
    while ((match = docstringRegex.exec(content)) !== null) {
      docstrings.push({
        type: 'docstring',
        content: match[0].trim()
      });
    }
    
    return docstrings;
  }
}

/**
 * Java specific analyzer
 */
class JavaAnalyzer extends BaseAnalyzer {
  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:static\s+)?([^;]+);/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        type: 'import',
        module: match[1].trim(),
        static: match[0].includes('static'),
        statement: match[0].trim()
      });
    }
    
    return imports;
  }

  extractFunctions(content) {
    const functions = [];
    
    // Method definitions
    const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[^{]+)?\s*\{/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      functions.push({
        name: match[2],
        returnType: match[1],
        params: match[3].trim(),
        signature: match[0],
        type: 'method'
      });
    }
    
    return functions;
  }

  extractClasses(content) {
    const classes = [];
    
    // Class definitions
    const classRegex = /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        extends: match[2] || null,
        implements: match[3] ? match[3].trim() : null,
        signature: match[0]
      });
    }
    
    return classes;
  }

  extractComments(content) {
    const comments = [];
    
    // Single line comments
    const singleLineRegex = /\/\/.*$/gm;
    let match;
    while ((match = singleLineRegex.exec(content)) !== null) {
      comments.push({
        type: 'single',
        content: match[0].trim()
      });
    }
    
    // Multi-line comments
    const multiLineRegex = /\/\*[\s\S]*?\*\//g;
    while ((match = multiLineRegex.exec(content)) !== null) {
      comments.push({
        type: 'multi',
        content: match[0].trim()
      });
    }
    
    return comments;
  }

  extractDocstrings(content) {
    // Javadoc comments
    const javadocRegex = /\/\*\*[\s\S]*?\*\//g;
    const docstrings = [];
    
    let match;
    while ((match = javadocRegex.exec(content)) !== null) {
      docstrings.push({
        type: 'javadoc',
        content: match[0].trim()
      });
    }
    
    return docstrings;
  }
}

/**
 * C/C++ specific analyzer
 */
class CppAnalyzer extends BaseAnalyzer {
  extractImports(content) {
    const imports = [];
    
    // Include statements
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    let match;
    while ((match = includeRegex.exec(content)) !== null) {
      imports.push({
        type: 'include',
        module: match[1],
        statement: match[0].trim()
      });
    }
    
    return imports;
  }

  extractFunctions(content) {
    const functions = [];
    
    // Function definitions (simplified)
    const funcRegex = /(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      // Skip common keywords
      if (!['if', 'for', 'while', 'switch'].includes(match[2])) {
        functions.push({
          name: match[2],
          returnType: match[1],
          params: match[3].trim(),
          signature: match[0],
          type: 'function'
        });
      }
    }
    
    return functions;
  }

  extractClasses(content) {
    const classes = [];
    
    // Class definitions
    const classRegex = /class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?\s*\{/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        base: match[2] || null,
        signature: match[0]
      });
    }
    
    return classes;
  }

  extractComments(content) {
    const comments = [];
    
    // Single line comments
    const singleLineRegex = /\/\/.*$/gm;
    let match;
    while ((match = singleLineRegex.exec(content)) !== null) {
      comments.push({
        type: 'single',
        content: match[0].trim()
      });
    }
    
    // Multi-line comments
    const multiLineRegex = /\/\*[\s\S]*?\*\//g;
    while ((match = multiLineRegex.exec(content)) !== null) {
      comments.push({
        type: 'multi',
        content: match[0].trim()
      });
    }
    
    return comments;
  }

  extractDocstrings(content) {
    // Doxygen comments
    const doxygenRegex = /\/\*\*[\s\S]*?\*\/|\/\/\/.*$/gm;
    const docstrings = [];
    
    let match;
    while ((match = doxygenRegex.exec(content)) !== null) {
      docstrings.push({
        type: 'doxygen',
        content: match[0].trim()
      });
    }
    
    return docstrings;
  }
}

/**
 * Generic analyzer for unknown languages
 */
class GenericAnalyzer extends BaseAnalyzer {
  extractComments(content) {
    const comments = [];
    
    // Try common comment patterns
    const patterns = [
      /\/\/.*$/gm,     // C-style single line
      /\/\*[\s\S]*?\*\//g,  // C-style multi-line
      /#.*$/gm,        // Shell/Python style
      /--.*$/gm        // SQL style
    ];
    
    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        comments.push({
          type: index < 2 ? 'c-style' : index === 2 ? 'hash' : 'dash',
          content: match[0].trim()
        });
      }
    });
    
    return comments;
  }
}