/**
 * IBM ACE ESQL AST Analyzer
 * Provides AST parsing and analysis for Extended SQL (ESQL) files used in IBM App Connect Enterprise
 */

import { BaseASTAnalyzer } from './base-ast-analyzer.js';

/**
 * ESQL specific AST analyzer
 * IBM's Extended SQL is used for message transformation in IBM ACE/IIB
 */
export class ESQLASTAnalyzer extends BaseASTAnalyzer {
  constructor() {
    super();
    this.content = '';
    
    // Initialize ESQL keywords and structure patterns
    this.keywords = new Set([
      'CREATE', 'MODULE', 'PATH', 'DECLARE', 'FUNCTION', 'PROCEDURE', 
      'BEGIN', 'END', 'SET', 'CALL', 'IF', 'THEN', 'ELSE', 'ELSEIF',
      'WHILE', 'DO', 'RETURN', 'CASE', 'WHEN', 'DEFAULT', 'PROPAGATE',
      'THROW', 'CREATE', 'DELETE', 'VALUES', 'PASSTHRU', 'FOR'
    ]);
  }

  /**
   * Parse ESQL content into AST
   */
  parse(content, filePath) {
    this.content = content;
    
    // Since there's no formal ESQL parser library available, we'll build a simplified AST
    // that captures the essential structure for our analysis purposes
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
      
      // Extract module declarations
      const modules = this.parseModules(content);
      ast.body = ast.body.concat(modules);
      
      // Extract standalone declarations outside modules
      const declarations = this.parseTopLevelDeclarations(content);
      ast.body = ast.body.concat(declarations);
      
    } catch (error) {
      console.error('Error parsing ESQL:', error);
    }
    
    return ast;
  }

  /**
   * Parse module declarations from ESQL content
   */
  parseModules(content) {
    const modules = [];
    const moduleRegex = /CREATE\s+(?:COMPUTE\s+)?MODULE\s+([A-Za-z0-9_]+)(?:\s+PATH\s+([A-Za-z0-9_.']+))?\s*;?([\s\S]*?)(?:END\s+MODULE\s*;|$)/gi;
    
    let match;
    while ((match = moduleRegex.exec(content)) !== null) {
      const moduleName = match[1];
      const modulePath = match[2] || null;
      const moduleBody = match[3] || '';
      const start = match.index;
      const end = match.index + match[0].length;
      
      // Create module node
      const moduleNode = {
        type: 'ModuleDeclaration',
        name: moduleName,
        path: modulePath,
        body: [],
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      };
      
      // Parse module body for functions, procedures, and declarations
      moduleNode.body = moduleNode.body.concat(this.parseFunctions(moduleBody, moduleName));
      moduleNode.body = moduleNode.body.concat(this.parseProcedures(moduleBody, moduleName));
      moduleNode.body = moduleNode.body.concat(this.parseDeclarations(moduleBody));
      
      modules.push(moduleNode);
    }
    
    return modules;
  }

  /**
   * Parse top-level declarations outside of modules
   */
  parseTopLevelDeclarations(content) {
    // Remove module sections to avoid duplicate parsing
    const contentWithoutModules = content.replace(/CREATE\s+(?:COMPUTE\s+)?MODULE\s+[A-Za-z0-9_]+(?:\s+PATH\s+[A-Za-z0-9_.']+)?\s*;?[\s\S]*?(?:END\s+MODULE\s*;|$)/gi, '');
    
    // Parse declarations outside modules
    const declarations = [];
    declarations.push(...this.parseFunctions(contentWithoutModules));
    declarations.push(...this.parseProcedures(contentWithoutModules));
    declarations.push(...this.parseDeclarations(contentWithoutModules));
    
    return declarations;
  }

  /**
   * Parse function declarations
   */
  parseFunctions(content, moduleName = null) {
    const functions = [];
    // Match function declarations
    const functionRegex = /CREATE\s+FUNCTION\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)(?:\s+RETURNS\s+([A-Za-z0-9_]+))?\s*(?:BEGIN|LANGUAGE)?([\s\S]*?)(?:END(?:\s+FUNCTION)?|LANGUAGE\s+[A-Za-z0-9_]+|;)/gi;
    
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const params = match[2] || '';
      const returnType = match[3] || 'UNKNOWN';
      const functionBody = match[4] || '';
      const start = match.index;
      const end = match.index + match[0].length;
      
      // Parse parameters
      const parameters = this.parseParameters(params);
      
      functions.push({
        type: 'FunctionDeclaration',
        name: functionName,
        moduleName: moduleName,
        params: parameters,
        returnType: returnType,
        body: functionBody.trim(),
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return functions;
  }

  /**
   * Parse procedure declarations
   */
  parseProcedures(content, moduleName = null) {
    const procedures = [];
    // Match procedure declarations
    const procedureRegex = /CREATE\s+PROCEDURE\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)(?:\s+RETURNS\s+([A-Za-z0-9_]+))?\s*BEGIN([\s\S]*?)END(?:\s+PROCEDURE)?/gi;
    
    let match;
    while ((match = procedureRegex.exec(content)) !== null) {
      const procedureName = match[1];
      const params = match[2] || '';
      const returnType = match[3] || null;
      const procedureBody = match[4] || '';
      const start = match.index;
      const end = match.index + match[0].length;
      
      // Parse parameters
      const parameters = this.parseParameters(params);
      
      procedures.push({
        type: 'ProcedureDeclaration',
        name: procedureName,
        moduleName: moduleName,
        params: parameters,
        returnType: returnType,
        body: procedureBody.trim(),
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return procedures;
  }

  /**
   * Parse variable declarations
   */
  parseDeclarations(content) {
    const declarations = [];
    // Match variable declarations
    const declareRegex = /DECLARE\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(?:\s+([^;]+))?;/gi;
    
    let match;
    while ((match = declareRegex.exec(content)) !== null) {
      const varName = match[1];
      const varType = match[2];
      const varInitializer = match[3] || null;
      const start = match.index;
      const end = match.index + match[0].length;
      
      declarations.push({
        type: 'VariableDeclaration',
        name: varName,
        dataType: varType,
        initializer: varInitializer,
        location: this.calculateLocation(content, start, end),
        range: [start, end]
      });
    }
    
    return declarations;
  }

  /**
   * Parse parameters string into structured array
   */
  parseParameters(paramsStr) {
    const params = [];
    if (!paramsStr || paramsStr.trim() === '') {
      return params;
    }
    
    // Split by commas, but not within parentheses or quotes
    const paramParts = this.splitParameters(paramsStr);
    
    for (const param of paramParts) {
      const parts = param.trim().split(/\s+/);
      if (parts.length >= 2) {
        // Find the direction (IN, OUT, INOUT) and parameter name
        let direction = 'IN'; // default
        let nameIndex = 0;
        
        // Check first part for direction
        if (parts[0].toUpperCase() === 'IN' || parts[0].toUpperCase() === 'OUT' || parts[0].toUpperCase() === 'INOUT') {
          direction = parts[0].toUpperCase();
          nameIndex = 1;
        }
        
        // Check second part for direction if first part is not a direction
        if (nameIndex === 0 && parts.length >= 3 && 
            (parts[1].toUpperCase() === 'IN' || parts[1].toUpperCase() === 'OUT' || parts[1].toUpperCase() === 'INOUT')) {
          direction = parts[1].toUpperCase();
          nameIndex = 2;
        }
        
        const name = parts[nameIndex];
        const type = parts[parts.length - 1];
        
        params.push({
          name: name,
          type: type,
          direction: direction
        });
      }
    }
    
    return params;
  }

  /**
   * Split parameter string respecting parentheses and quotes
   */
  splitParameters(paramsStr) {
    const result = [];
    let current = '';
    let parenthesesDepth = 0;
    let inQuotes = false;
    
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];
      
      if (char === '(' && !inQuotes) {
        parenthesesDepth++;
        current += char;
      } else if (char === ')' && !inQuotes) {
        parenthesesDepth--;
        current += char;
      } else if ((char === "'" || char === '"') && (i === 0 || paramsStr[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && parenthesesDepth === 0 && !inQuotes) {
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
   * Extract imports from ESQL content
   * In ESQL, these are typically BROKER SCHEMA or DECLARE NAMESPACE statements
   */
  extractImports(ast) {
    const imports = [];
    const content = this.content;
    
    // Match BROKER SCHEMA statements
    const schemaRegex = /BROKER\s+SCHEMA\s+([A-Za-z0-9_.]+)/gi;
    let match;
    while ((match = schemaRegex.exec(content)) !== null) {
      const schemaName = match[1];
      const start = match.index;
      const end = match.index + match[0].length;
      
      imports.push({
        type: 'broker-schema',
        module: schemaName,
        statement: match[0],
        location: this.calculateLocation(content, start, end)
      });
    }
    
    // Match DECLARE NAMESPACE statements
    const namespaceRegex = /DECLARE\s+NAMESPACE\s+([A-Za-z0-9_]+)\s+AS\s+['"]([^'"]+)['"]/gi;
    while ((match = namespaceRegex.exec(content)) !== null) {
      const namespaceName = match[1];
      const namespaceUri = match[2];
      const start = match.index;
      const end = match.index + match[0].length;
      
      imports.push({
        type: 'namespace',
        module: namespaceUri,
        name: namespaceName,
        statement: match[0],
        location: this.calculateLocation(content, start, end)
      });
    }
    
    // Match ESQL module references
    const moduleReferenceRegex = /([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)/g;
    while ((match = moduleReferenceRegex.exec(content)) !== null) {
      const moduleName = match[1];
      // Skip common namespace prefixes that aren't module references
      if (['SOAP', 'HTTP', 'XMLNS', 'XML', 'OutputRoot', 'InputRoot'].includes(moduleName)) {
        continue;
      }
      
      const start = match.index;
      const end = match.index + match[0].length;
      
      imports.push({
        type: 'module-reference',
        module: moduleName,
        function: match[2],
        statement: match[0],
        location: this.calculateLocation(content, start, end)
      });
    }
    
    return imports;
  }

  /**
   * Extract functions from ESQL AST
   */
  extractFunctions(ast) {
    const functions = [];
    
    // Process both standalone functions and module functions
    const processFunctionNode = (node, moduleName = null) => {
      if (node.type === 'FunctionDeclaration' || node.type === 'ProcedureDeclaration') {
        functions.push({
          name: node.name,
          type: node.type === 'FunctionDeclaration' ? 'function' : 'procedure',
          params: node.params.map(param => ({
            name: param.name,
            type: param.type,
            direction: param.direction
          })),
          returnType: node.returnType || 'void',
          signature: this.getNodeSource(node),
          async: false,
          generator: false,
          className: moduleName, // In ESQL, module is equivalent to class
          location: node.location,
          body: node.body
        });
      }
    };
    
    // Process top-level functions
    if (ast.body) {
      for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration' || node.type === 'ProcedureDeclaration') {
          processFunctionNode(node);
        } else if (node.type === 'ModuleDeclaration' && node.body) {
          // Process functions inside modules
          for (const childNode of node.body) {
            processFunctionNode(childNode, node.name);
          }
        }
      }
    }
    
    return functions;
  }

  /**
   * Extract classes from ESQL AST
   * In ESQL, modules are equivalent to classes
   */
  extractClasses(ast) {
    const classes = [];
    
    // Process modules as classes
    if (ast.body) {
      for (const node of ast.body) {
        if (node.type === 'ModuleDeclaration') {
          // Extract methods (functions and procedures)
          const methods = [];
          for (const childNode of node.body || []) {
            if (childNode.type === 'FunctionDeclaration' || childNode.type === 'ProcedureDeclaration') {
              methods.push({
                name: childNode.name,
                type: childNode.type === 'FunctionDeclaration' ? 'function' : 'procedure',
                kind: childNode.type === 'FunctionDeclaration' ? 'function' : 'procedure',
                location: childNode.location
              });
            }
          }
          
          // Extract properties (variable declarations)
          const properties = [];
          for (const childNode of node.body || []) {
            if (childNode.type === 'VariableDeclaration') {
              properties.push({
                name: childNode.name,
                type: childNode.dataType,
                location: childNode.location
              });
            }
          }
          
          classes.push({
            name: node.name,
            signature: this.getNodeSource(node),
            location: node.location,
            methods: methods,
            properties: properties,
            path: node.path
          });
        }
      }
    }
    
    return classes;
  }

  /**
   * Extract comments from ESQL content
   */
  extractComments(content) {
    const comments = [];
    
    // Match single-line comments
    const singleLineRegex = /--([^\n]*)/g;
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
   * Extract docstrings from ESQL content
   * In ESQL, docstrings are typically multi-line comments with specific formatting
   */
  extractDocstrings(ast) {
    const docstrings = [];
    const comments = ast.comments || [];
    
    for (const comment of comments) {
      // Only multi-line comments can be docstrings
      if (comment.type === 'multi') {
        const content = comment.content;
        
        // Check for structured comment patterns
        if (content.includes('@author') || 
            content.includes('@param') || 
            content.includes('@return') ||
            content.includes('@description')) {
          docstrings.push({
            type: 'esql-doc',
            content: content,
            location: comment.location
          });
        }
      }
    }
    
    return docstrings;
  }

  /**
   * Analyze relationships between ESQL elements
   */
  analyzeRelationships(ast) {
    const relationships = [];
    
    // Process module relationships
    if (ast.body) {
      for (const node of ast.body) {
        if (node.type === 'ModuleDeclaration') {
          // Module may have a path relationship
          if (node.path) {
            relationships.push({
              type: 'module-path',
              from: node.name,
              to: node.path,
              location: node.location
            });
          }
          
          // Process function calls within the module
          this.extractFunctionCalls(node, relationships);
        } else if (node.type === 'FunctionDeclaration' || node.type === 'ProcedureDeclaration') {
          // Process top-level function calls
          this.extractFunctionCalls(node, relationships);
        }
      }
    }
    
    return relationships;
  }

  /**
   * Extract function calls from a node
   */
  extractFunctionCalls(node, relationships) {
    // In a more robust implementation, we'd parse the body properly
    // For now, we'll use regex to extract calls
    const body = node.body || '';
    if (typeof body !== 'string') return;
    
    // Match CALL statements: CALL FunctionName(...)
    const callRegex = /\bCALL\s+([A-Za-z0-9_.]+)\s*\(/g;
    let match;
    while ((match = callRegex.exec(body)) !== null) {
      const callee = match[1];
      
      relationships.push({
        type: 'function-call',
        from: node.name,
        to: callee,
        callType: 'CALL',
        location: this.calculateLocation(body, match.index, match.index + match[0].length)
      });
    }
    
    // Match SET statements with function calls: SET var = FunctionName(...)
    const setRegex = /\bSET\s+[A-Za-z0-9_.]+\s*=\s*([A-Za-z0-9_.]+)\s*\(/g;
    while ((match = setRegex.exec(body)) !== null) {
      const callee = match[1];
      
      relationships.push({
        type: 'function-call',
        from: node.name,
        to: callee,
        callType: 'SET',
        location: this.calculateLocation(body, match.index, match.index + match[0].length)
      });
    }
  }

  /**
   * Calculate location from content and start/end positions
   */
  calculateLocation(content, start, end) {
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
}
