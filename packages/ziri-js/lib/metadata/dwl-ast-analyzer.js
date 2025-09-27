/**
 * Mulesoft DataWeave Language (DWL) AST Analyzer
 * Provides parsing and analysis for DataWeave transformation language used in Mulesoft
 */

import { BaseASTAnalyzer } from './base-ast-analyzer.js';

/**
 * DataWeave Language specific AST analyzer
 */
export class DWLASTAnalyzer extends BaseASTAnalyzer {
  constructor() {
    super();
    this.content = '';
    
    // Initialize DataWeave keywords
    this.keywords = new Set([
      'import', 'var', 'fun', 'if', 'else', 'using', 'do', 'ns', 'type',
      'case', 'match', 'default', 'not', 'and', 'or', 'as', 'is', 'true', 'false',
      'null', 'typeof', 'write', 'output', 'input', 'application', 'json', 'xml', 
      'csv', 'java', 'avro', 'binary'
    ]);
  }

  /**
   * Parse DataWeave content into AST
   */
  parse(content, filePath) {
    this.content = content;
    
    // Since there's no standard DWL parser available in JavaScript,
    // we'll build a simplified AST that captures essential structure
    const ast = {
      type: 'Program',
      body: [],
      comments: [],
      sourceType: 'module',
      filePath: filePath
    };
    
    try {
      // Extract comments
      ast.comments = this.extractComments(content);
      
      // Extract imports
      const imports = this.parseImports(content);
      ast.body = ast.body.concat(imports);
      
      // Extract variable declarations
      const variables = this.parseVariables(content);
      ast.body = ast.body.concat(variables);
      
      // Extract function declarations
      const functions = this.parseFunctions(content);
      ast.body = ast.body.concat(functions);
      
      // Extract type declarations
      const types = this.parseTypes(content);
      ast.body = ast.body.concat(types);
      
      // Extract main expression (anonymous output)
      const mainExpression = this.parseMainExpression(content);
      if (mainExpression) {
        ast.body.push(mainExpression);
      }
      
    } catch (error) {
      console.error('Error parsing DataWeave:', error);
    }
    
    return ast;
  }

  /**
   * Parse import statements
   */
  parseImports(content) {
    const imports = [];
    // Match import statements: import * from module, import {a, b} from module
    // Updated to handle module names with colons like dw::core::Strings
    const importRegex = /import\s+(?:\*|(?:\{([^}]*)\}))\s+from\s+(?:["']([^"']+)["']|([a-zA-Z0-9_:]+))/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const specifiers = match[1] ? match[1].split(',').map(s => s.trim()) : ['*'];
      const moduleName = match[2] || match[3];
      const start = match.index;
      const end = match.index + match[0].length;
      
      imports.push({
        type: 'ImportDeclaration',
        source: moduleName,
        specifiers: specifiers,
        statement: match[0],
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return imports;
  }

  /**
   * Parse variable declarations
   */
  parseVariables(content) {
    const variables = [];
    // Match variable declarations: var name = value, var name: Type = value
    // Updated to handle multiline definitions by capturing everything until the next declaration or end
    const varRegex = /var\s+([a-zA-Z0-9_]+)(?:\s*:\s*([a-zA-Z0-9_<>|]+))?\s*=\s*([^;]*?)(?=var\s+|fun\s+|type\s+|output\s+|\z|$)/gs;
    
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[1];
      const varType = match[2] || null;
      let varValue = match[3].trim();
      
      // Remove any trailing semicolon
      varValue = varValue.replace(/;\s*$/, '');
      
      const start = match.index;
      const end = match.index + match[0].length;
      
      variables.push({
        type: 'VariableDeclaration',
        name: varName,
        dataType: varType,
        value: varValue,
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return variables;
  }

  /**
   * Parse function declarations
   */
  parseFunctions(content) {
    const functions = [];
    // Match function declarations: fun name(param: Type) = body, fun name(param: Type): ReturnType = body
    // Updated to handle multiline definitions
    const funRegex = /fun\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*:\s*([a-zA-Z0-9_<>|]+))?\s*=\s*([\s\S]*?)(?=\n(?:fun\s+|var\s+|type\s+|output\s+|\z|$))/g;
    
    let match;
    while ((match = funRegex.exec(content)) !== null) {
      const funName = match[1];
      const params = match[2];
      const returnType = match[3] || null;
      let body = match[4].trim();
      
      // Remove any trailing semicolon
      body = body.replace(/;\s*$/, '');
      
      const start = match.index;
      const end = match.index + match[0].length;
      
      // Parse parameters
      const parameters = this.parseParameters(params);
      
      functions.push({
        type: 'FunctionDeclaration',
        name: funName,
        params: parameters,
        returnType: returnType,
        body: body,
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return functions;
  }

  /**
   * Parse type declarations
   */
  parseTypes(content) {
    const types = [];
    
    // Match type declarations in order: type Name = definition
    // This regex handles both single-line and multi-line type definitions
    const typeRegex = /type\s+([a-zA-Z0-9_]+)\s*=\s*([^\n;]+(?:\n[^\n;]+)*?)\s*(?=type\s+|\z|$)/g;
    
    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[1];
      let typeDefinition = match[2].trim();
      
      // If the definition spans multiple lines, we need to be more careful about where it ends
      // Let's find the actual end by looking at what comes after
      const matchEnd = match.index + match[0].length;
      const afterMatch = content.substring(matchEnd);
      
      // The actual end might be different from what the regex captured
      // Let's look for the next type declaration or end of content
      const nextTypeMatch = afterMatch.match(/type\s+[a-zA-Z0-9_]+\s*=/);
      if (nextTypeMatch) {
        // Include everything up to the next type declaration
        const actualDefinition = content.substring(match.index + `type ${typeName} = `.length, matchEnd + nextTypeMatch.index).trim();
        // Remove any trailing semicolon
        typeDefinition = actualDefinition.replace(/;\s*$/, '');
      }
      
      const start = match.index;
      const end = matchEnd;
      
      types.push({
        type: 'TypeDeclaration',
        name: typeName,
        definition: typeDefinition,
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return types;
  }

  /**
   * Parse main expression (transformation body)
   */
  parseMainExpression(content) {
    // Look for the main expression separator ---
    const separatorIndex = content.indexOf('\n---\n');
    if (separatorIndex === -1) {
      // Try with single newlines
      const singleLineSeparatorIndex = content.indexOf('\n---');
      if (singleLineSeparatorIndex === -1) {
        return null;
      }
      
      // Extract content after the separator
      const mainContent = content.substring(singleLineSeparatorIndex + 5).trim();
      if (mainContent.length > 0) {
        const start = singleLineSeparatorIndex + 5;
        const end = content.length;
        
        return {
          type: 'MainExpression',
          body: mainContent,
          location: this.calculateLocation(content, start, end),
          range: [start, end]
        };
      }
      return null;
    }
    
    // Extract content after the separator
    const mainContent = content.substring(separatorIndex + 5).trim();
    if (mainContent.length > 0) {
      const start = separatorIndex + 5;
      const end = content.length;
      
      return {
        type: 'MainExpression',
        body: mainContent,
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      };
    }
    
    return null;
  }

  /**
   * Parse parameters string into structured array
   */
  parseParameters(paramsStr) {
    const params = [];
    if (!paramsStr || paramsStr.trim() === '') {
      return params;
    }
    
    // Split by commas, handling nested structures
    const paramParts = this.splitParameters(paramsStr);
    
    for (const param of paramParts) {
      const parts = param.split(':');
      if (parts.length >= 1) {
        const name = parts[0].trim();
        const type = parts.length > 1 ? parts[1].trim() : null;
        
        params.push({
          name: name,
          type: type
        });
      }
    }
    
    return params;
  }

  /**
   * Split parameter string respecting braces and quotes
   */
  splitParameters(paramsStr) {
    const result = [];
    let current = '';
    let braceDepth = 0;
    let inQuotes = false;
    let quoteChar = '"';
    
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];
      
      if ((char === '"' || char === "'") && (i === 0 || paramsStr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
        current += char;
      } else if ((char === '{' || char === '[' || char === '(') && !inQuotes) {
        braceDepth++;
        current += char;
      } else if ((char === '}' || char === ']' || char === ')') && !inQuotes) {
        braceDepth--;
        current += char;
      } else if (char === ',' && braceDepth === 0 && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim() !== '') {
      result.push(current.trim());
    }
    
    return result;
  }

  /**
   * Extract imports from AST
   */
  extractImports(ast) {
    const imports = [];
    
    if (ast && ast.body) {
      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') {
          imports.push({
            type: 'dataweave-import',
            module: node.source,
            specifiers: node.specifiers,
            statement: node.statement,
            location: node.location
          });
        }
      }
    }
    
    return imports;
  }

  /**
   * Extract functions from AST
   */
  extractFunctions(ast) {
    const functions = [];
    
    if (ast && ast.body) {
      for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration') {
          functions.push({
            name: node.name,
            type: 'function',
            params: node.params.map(param => ({
              name: param.name,
              type: param.type
            })),
            returnType: node.returnType,
            signature: this.getNodeSource(node),
            async: false,
            generator: false,
            location: node.location,
            body: node.body
          });
        }
      }
    }
    
    // Add main expression as an anonymous function if present
    const mainExprNode = ast && ast.body && ast.body.find(node => node.type === 'MainExpression');
    if (mainExprNode) {
      functions.push({
        name: 'main',
        type: 'main-expression',
        params: [],
        returnType: null,
        signature: this.getNodeSource(mainExprNode),
        async: false,
        generator: false,
        location: mainExprNode.location,
        body: mainExprNode.body
      });
    }
    
    return functions;
  }

  /**
   * Extract "classes" from DataWeave AST
   * In DataWeave, type definitions and object literals serve similar purposes to classes
   */
  extractClasses(ast) {
    const classes = [];
    
    if (ast && ast.body) {
      for (const node of ast.body) {
        if (node.type === 'TypeDeclaration') {
          // Extract properties from type definition if it's an object type
          const properties = [];
          const methods = [];
          
          // Check if it's an object type with fields
          const objMatch = node.definition.match(/\{\s*(.*)\s*\}/s);
          if (objMatch) {
            const fieldsStr = objMatch[1];
            const fields = this.splitParameters(fieldsStr);
            
            for (const field of fields) {
              const parts = field.split(':');
              if (parts.length >= 1) {
                const name = parts[0].trim();
                const type = parts.length > 1 ? parts[1].trim() : null;
                
                properties.push({
                  name: name,
                  type: type,
                  location: null // Cannot determine precise location within the definition
                });
              }
            }
          }
          
          classes.push({
            name: node.name,
            type: 'dataweave-type',
            signature: this.getNodeSource(node),
            location: node.location,
            methods: methods,
            properties: properties
          });
        }
      }
    }
    
    return classes;
  }

  /**
   * Extract comments from DataWeave content
   */
  extractComments(content) {
    const comments = [];
    
    // Match single-line comments
    const singleLineRegex = /\/\/([^\n]*)/g;
    let match;
    while ((match = singleLineRegex.exec(content)) !== null) {
      const commentText = match[1].trim();
      const start = match.index;
      const end = match.index + match[0].length;
      
      comments.push({
        type: 'single',
        content: commentText,
        location: this.calculateLocation(content, start, end)
      });
    }
    
    // Match multi-line comments
    const multiLineRegex = /\/\*([\s\S]*?)\*\//g;
    while ((match = multiLineRegex.exec(content)) !== null) {
      const commentText = match[1].trim();
      const start = match.index;
      const end = match.index + match[0].length;
      
      comments.push({
        type: 'multi',
        content: commentText,
        location: this.calculateLocation(content, start, end)
      });
    }
    
    return comments;
  }

  /**
   * Extract docstrings from DataWeave content
   * In DataWeave, docstrings are typically multi-line comments
   * with special formatting (similar to JavaDoc/JSDoc)
   */
  extractDocstrings(ast) {
    const docstrings = [];
    const comments = Array.isArray(ast.comments) ? ast.comments : [];
    
    for (const comment of comments) {
      // Only multi-line comments can be docstrings
      if (comment.type === 'multi') {
        const content = comment.content;
        
        // Check for structured comment patterns
        if (content.includes('@since') || 
            content.includes('@param') || 
            content.includes('@return') ||
            content.includes('@description') ||
            content.includes('@throws')) {
          docstrings.push({
            type: 'dataweave-doc',
            content: content,
            location: comment.location
          });
        }
      }
    }
    
    return docstrings;
  }

  /**
   * Analyze relationships between DataWeave elements
   */
  analyzeRelationships(ast) {
    const relationships = [];
    
    if (ast && ast.body) {
      // Create a map of declared functions and variables for reference checking
      const declaredEntities = new Map();
      
      // Collect all declared entities
      for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration') {
          declaredEntities.set(node.name, { type: 'function', node });
        } else if (node.type === 'VariableDeclaration') {
          declaredEntities.set(node.name, { type: 'variable', node });
        } else if (node.type === 'TypeDeclaration') {
          declaredEntities.set(node.name, { type: 'type', node });
        }
      }
      
      // Check for function calls and variable references
      for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration' || node.type === 'MainExpression') {
          const body = node.body || '';
          const name = node.name || 'main';
          
          // Check for function calls: someFunction(args)
          const functionCallRegex = /\b([a-zA-Z0-9_]+)\s*\(/g;
          let match;
          while ((match = functionCallRegex.exec(body)) !== null) {
            const calledFunction = match[1];
            
            // Skip built-in functions and common methods
            if (this.keywords.has(calledFunction) || 
                ['map', 'filter', 'reduce', 'mapObject', 'find', 'forEach', 'groupBy'].includes(calledFunction)) {
              continue;
            }
            
            if (declaredEntities.has(calledFunction) && declaredEntities.get(calledFunction).type === 'function') {
              relationships.push({
                type: 'function-call',
                from: name,
                to: calledFunction,
                location: this.calculateLocation(body, match.index, match.index + match[0].length)
              });
            }
          }
          
          // Check for variable references
          for (const [entityName, entityInfo] of declaredEntities.entries()) {
            if (entityInfo.type === 'variable') {
              // Use word boundary to avoid partial matches
              const varRegex = new RegExp('\\b' + entityName + '\\b', 'g');
              while ((match = varRegex.exec(body)) !== null) {
                relationships.push({
                  type: 'variable-reference',
                  from: name,
                  to: entityName,
                  location: this.calculateLocation(body, match.index, match.index + entityName.length)
                });
              }
            }
          }
        }
      }
      
      // Check for type references
      for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration' || node.type === 'VariableDeclaration') {
          // Check params and return type for type references
          const types = [];
          
          // Add return type if present
          if (node.returnType) {
            types.push(node.returnType);
          }
          
          // Add parameter types
          if (node.params) {
            for (const param of node.params) {
              if (param.type) {
                types.push(param.type);
              }
            }
          }
          
          // Add variable type
          if (node.dataType) {
            types.push(node.dataType);
          }
          
          // Check all collected types against declared types
          for (const type of types) {
            // Extract simple type name (remove generics, unions, etc.)
            const typeNameMatch = type.match(/^([a-zA-Z0-9_]+)/);
            if (typeNameMatch && declaredEntities.has(typeNameMatch[1]) && 
                declaredEntities.get(typeNameMatch[1]).type === 'type') {
              relationships.push({
                type: 'type-reference',
                from: node.name,
                to: typeNameMatch[1],
                location: node.location
              });
            }
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * Calculate location from content and start/end positions
   */
  calculateLocation(content, start, end) {
    if (typeof content !== 'string') {
      console.error('Invalid content provided to calculateLocation:', content);
      return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    }
    
    try {
      // Find the line and column information for start and end
      const upToStart = content.substring(0, start);
      const startLines = upToStart.split('\n');
      const startLine = startLines.length;
      const startColumn = startLines[startLines.length - 1].length;
      
      const upToEnd = content.substring(0, end);
      const endLines = upToEnd.split('\n');
      const endLine = endLines.length;
      const endColumn = endLines[endLines.length - 1].length;
      
      return {
        start: { line: startLine, column: startColumn },
        end: { line: endLine, column: endColumn }
      };
    } catch (error) {
      console.error('Error calculating location:', error);
      return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
    }
  }

  /**
   * Get source code for a node
   */
  getNodeSource(node) {
    if (!node || !node.range) return '';
    
    try {
      return this.content.substring(node.range[0], node.range[1]);
    } catch (error) {
      console.error('Error extracting node source:', error);
      return '';
    }
  }

  /**
   * Build call graph (advanced analysis feature)
   */
  buildCallGraph(ast) {
    const callGraph = new Map();
    const relationships = this.analyzeRelationships(ast);
    
    for (const relationship of relationships) {
      if (relationship.type === 'function-call') {
        const from = relationship.from;
        const to = relationship.to;
        
        if (!callGraph.has(from)) {
          callGraph.set(from, []);
        }
        
        callGraph.get(from).push(to);
      }
    }
    
    return callGraph;
  }

  /**
   * Track variable scopes (advanced analysis feature)
   */
  trackVariableScopes(ast) {
    const scopes = new Map();
    scopes.set('global', { variables: [], parent: null });
    
    if (ast && ast.body) {
      // Add variables to global scope
      for (const node of ast.body) {
        if (node.type === 'VariableDeclaration') {
          scopes.get('global').variables.push({
            name: node.name,
            type: node.dataType || 'any',
            initializer: node.value
          });
        }
      }
      
      // Create function scopes
      for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration') {
          const functionName = node.name;
          const variables = [];
          
          // Add parameters as variables
          if (node.params) {
            for (const param of node.params) {
              variables.push({
                name: param.name,
                type: param.type || 'any',
                initializer: null,
                isParameter: true
              });
            }
          }
          
          scopes.set(functionName, {
            variables: variables,
            parent: 'global'
          });
        }
      }
      
      // Add main expression scope if present
      const mainExprNode = ast.body.find(node => node.type === 'MainExpression');
      if (mainExprNode) {
        scopes.set('main', {
          variables: [],
          parent: 'global'
        });
      }
    }
    
    return scopes;
  }

  /**
   * Perform type inference (advanced analysis feature)
   */
  performTypeInference(ast) {
    const typeInferences = new Map();
    
    if (ast && ast.body) {
      // Add explicit types from declarations
      for (const node of ast.body) {
        if (node.type === 'VariableDeclaration') {
          typeInferences.set(node.name, node.dataType || this.inferTypeFromValue(node.value));
        } else if (node.type === 'FunctionDeclaration') {
          typeInferences.set(node.name, {
            type: 'function',
            returnType: node.returnType || this.inferReturnTypeFromBody(node.body),
            paramTypes: node.params.map(param => param.type || 'any')
          });
        } else if (node.type === 'TypeDeclaration') {
          typeInferences.set(node.name, {
            type: 'type',
            definition: node.definition
          });
        }
      }
    }
    
    return typeInferences;
  }

  /**
   * Helper method to infer type from a value expression
   */
  inferTypeFromValue(valueExpr) {
    if (!valueExpr || typeof valueExpr !== 'string') return 'any';
    
    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(valueExpr.trim())) {
      return valueExpr.includes('.') ? 'Number' : 'Number';
    }
    
    // String literal
    if (/^["'].*["']$/.test(valueExpr.trim())) {
      return 'String';
    }
    
    // Boolean literal
    if (/^(true|false)$/.test(valueExpr.trim())) {
      return 'Boolean';
    }
    
    // Array literal
    if (/^\[.*\]$/.test(valueExpr.trim())) {
      return 'Array';
    }
    
    // Object literal
    if (/^\{.*\}$/.test(valueExpr.trim())) {
      return 'Object';
    }
    
    // Function call
    if (/[a-zA-Z0-9_]+\s*\(.*\)/.test(valueExpr.trim())) {
      return 'any'; // We'd need more context to infer function return types
    }
    
    return 'any';
  }

  /**
   * Helper method to infer return type from function body
   */
  inferReturnTypeFromBody(body) {
    if (!body || typeof body !== 'string') return 'any';
    
    // For DataWeave, the last expression is the return value
    // This is a very simplified inference
    const trimmedBody = body.trim();
    
    return this.inferTypeFromValue(trimmedBody);
  }
}
