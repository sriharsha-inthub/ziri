/**
 * Base AST analyzer class with common functionality
 */

export class BaseASTAnalyzer {
  parse(content, filePath) {
    throw new Error('Parse method must be implemented by subclasses');
  }

  extractImports(ast) {
    return [];
  }

  extractFunctions(ast) {
    return [];
  }

  extractClasses(ast) {
    return [];
  }

  extractComments(ast) {
    return [];
  }

  extractDocstrings(ast) {
    return [];
  }

  buildCallGraph(ast) {
    return new Map();
  }

  trackVariableScopes(ast) {
    return new Map();
  }

  performTypeInference(ast) {
    return new Map();
  }

  analyzeRelationships(ast) {
    return [];
  }

  // Helper method to get node location
  getNodeLocation(node) {
    if (!node.loc) return null;
    return {
      start: { line: node.loc.start.line, column: node.loc.start.column },
      end: { line: node.loc.end.line, column: node.loc.end.column }
    };
  }

  // Helper method to extract source code from node
  getNodeSource(node, content) {
    if (!node.loc || !content) return '';
    const lines = content.split('\n');
    const startLine = node.loc.start.line - 1;
    const endLine = node.loc.end.line - 1;
    
    // Check bounds
    if (startLine >= lines.length || endLine >= lines.length || startLine < 0 || endLine < 0) {
      return '';
    }
    
    if (startLine === endLine) {
      const line = lines[startLine];
      if (node.loc.start.column >= line.length || node.loc.end.column > line.length) {
        return '';
      }
      return line.substring(node.loc.start.column, node.loc.end.column);
    }
    
    let source = lines[startLine].substring(node.loc.start.column);
    for (let i = startLine + 1; i < endLine; i++) {
      source += '\n' + lines[i];
    }
    if (endLine < lines.length) {
      const endLineContent = lines[endLine];
      if (node.loc.end.column <= endLineContent.length) {
        source += '\n' + endLineContent.substring(0, node.loc.end.column);
      }
    }
    
    return source;
  }
}