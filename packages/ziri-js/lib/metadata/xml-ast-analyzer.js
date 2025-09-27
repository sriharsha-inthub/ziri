/**
 * XML-based AST Code Analyzer
 * Provides parsing and analysis for XML-based languages like IBM ACE msgflow and Mulesoft XML
 */

import { BaseASTAnalyzer } from './base-ast-analyzer.js';

/**
 * Base class for XML-based AST analyzers
 * Supports common XML parsing and traversal functionality
 */
export class XmlASTAnalyzer extends BaseASTAnalyzer {
  constructor() {
    super();
    this.content = '';
  }

  /**
   * Lazy-load XML parsing library
   */
  async loadXmlParser() {
    try {
      // Use dynamic import for the XML parser to avoid loading it unnecessarily
      const { XMLParser } = await import('fast-xml-parser');
      return XMLParser;
    } catch (error) {
      console.error('Failed to load XML parser:', error.message);
      throw new Error(`XML parser not available: ${error.message}`);
    }
  }

  /**
   * Parse XML content into AST
   */
  async parse(content, filePath) {
    this.content = content;
    
    try {
      const ParserClass = await this.loadXmlParser();
      
      // Parse with position info for accurate node location
      const options = {
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        allowBooleanAttributes: true,
        parseAttributeValue: false, // Keep values as strings to match test expectations
        parseTagValue: true,
        processEntities: true,
        trimValues: true
      };
      
      // Create parser instance and parse the XML content
      const parser = new ParserClass(options);
      const result = parser.parse(content);
      
      // Add file metadata
      result.__file = {
        path: filePath,
        content: content
      };
      
      return result;
    } catch (error) {
      console.error(`XML parsing failed for ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract comments from XML
   */
  extractComments(ast) {
    const comments = [];
    
    // XML parsers typically provide comments separately
    // We need to re-scan the content for comments
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let match;
    
    while ((match = commentRegex.exec(this.content)) !== null) {
      const commentText = match[1].trim();
      const startPos = match.index;
      const endPos = match.index + match[0].length;
      
      // Calculate line and column info
      const beforeComment = this.content.substring(0, startPos);
      const lines = beforeComment.split('\n');
      const startLine = lines.length;
      const startColumn = lines[lines.length - 1].length;
      
      comments.push({
        type: 'xml-comment',
        content: commentText,
        location: {
          start: { line: startLine, column: startColumn },
          end: { line: 0, column: 0 } // Will be calculated by subclasses if needed
        }
      });
    }
    
    return comments;
  }

  /**
   * Base implementation of node traversal
   * Subclasses should override this to handle specific XML formats
   */
  traverseNodes(node, visitor, path = []) {
    if (!node || typeof node !== 'object') return;
    
    // Call visitor for this node
    visitor(node, path);
    
    // Traverse child nodes
    for (const key of Object.keys(node)) {
      // Skip special properties and attributes
      if (key === '__file' || key.startsWith('@_') || key === '#text' || key === '?xml') continue;
      
      const child = node[key];
      
      // Handle arrays of nodes - visit the array as a node, then each element
      if (Array.isArray(child)) {
        // Visit the array itself as a node
        visitor(child, [...path, key]);
        
        // Then visit each element
        for (let i = 0; i < child.length; i++) {
          const childNode = child[i];
          if (childNode && typeof childNode === 'object') {
            this.traverseNodes(childNode, visitor, [...path, key, i.toString()]);
          } else if (childNode !== null && childNode !== undefined) {
            // Visit non-object elements (strings, numbers, etc.)
            visitor(childNode, [...path, key, i.toString()]);
          }
        }
      } 
      // Handle single child nodes
      else if (child && typeof child === 'object') {
        this.traverseNodes(child, visitor, [...path, key]);
      }
      // Handle leaf nodes (strings, numbers, etc.)
      else if (child !== null && child !== undefined) {
        visitor(child, [...path, key]);
      }
    }
  }

  /**
   * Extract node location if available
   */
  getNodeLocation(node) {
    if (!node || !node.__location) return null;
    
    const loc = node.__location;
    
    return {
      start: { 
        line: loc.startLine || 0, 
        column: loc.startColumn || 0 
      },
      end: { 
        line: loc.endLine || 0, 
        column: loc.endColumn || 0 
      }
    };
  }

  /**
   * Get the XML source for a node
   */
  getNodeSource(node, content) {
    const location = this.getNodeLocation(node);
    if (!location || !content) return '';
    
    try {
      const lines = content.split('\n');
      
      const startLine = location.start.line - 1;
      const endLine = location.end.line - 1;
      
      if (startLine < 0 || endLine < 0 || startLine >= lines.length || endLine >= lines.length) {
        return '';
      }
      
      if (startLine === endLine) {
        return lines[startLine].substring(location.start.column, location.end.column);
      }
      
      let result = lines[startLine].substring(location.start.column);
      
      for (let i = startLine + 1; i < endLine; i++) {
        result += '\n' + lines[i];
      }
      
      result += '\n' + lines[endLine].substring(0, location.end.column);
      
      return result;
    } catch (error) {
      console.error('Error extracting node source:', error);
      return '';
    }
  }

  /**
   * Base implementations of required methods
   * These will be overridden by specific XML format analyzers
   */
  extractImports(ast) { return []; }
  extractFunctions(ast) { return []; }
  extractClasses(ast) { return []; }
  extractDocstrings(ast) { return []; }
  buildCallGraph(ast) { return new Map(); }
  trackVariableScopes(ast) { return new Map(); }
  performTypeInference(ast) { return new Map(); }
  analyzeRelationships(ast) { return []; }
}

/**
 * XML attribute helper functions
 */
export const XmlHelpers = {
  /**
   * Get attribute value from a node
   */
  getAttr(node, attrName, defaultValue = null) {
    if (!node) return defaultValue;
    
    const fullName = '@_' + attrName;
    return node[fullName] !== undefined ? node[fullName] : defaultValue;
  },
  
  /**
   * Check if a node has an attribute
   */
  hasAttr(node, attrName) {
    if (!node) return false;
    
    const fullName = '@_' + attrName;
    return node[fullName] !== undefined;
  },
  
  /**
   * Get all attributes from a node as an object
   */
  getAttrs(node) {
    if (!node) return {};
    
    const attrs = {};
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_')) {
        attrs[key.substring(2)] = node[key];
      }
    }
    
    return attrs;
  },
  
  /**
   * Get node text content
   */
  getText(node) {
    if (!node) return '';
    
    if (node['#text']) {
      return node['#text'];
    }
    
    // Text might be directly in the node value for simple nodes
    if (typeof node === 'string') {
      return node;
    }
    
    return '';
  }
};
