/**
 * Mulesoft XML AST Analyzer
 * Provides AST parsing and analysis for Mulesoft XML configuration files
 */

import { BaseASTAnalyzer } from './base-ast-analyzer.js';
import { XmlASTAnalyzer, XmlHelpers } from './xml-ast-analyzer.js';

/**
 * Mulesoft XML specific AST analyzer
 */
export class MulesoftASTAnalyzer extends XmlASTAnalyzer {
  constructor() {
    super();
    this.processorTypes = new Set([
      'flow', 'sub-flow', 'http:listener', 'http:request', 'db:select', 'db:insert',
      'db:update', 'db:delete', 'validation:validate', 'ee:transform', 'vm:publish',
      'vm:consume', 'jms:publish', 'jms:consume', 'file:read', 'file:write', 'batch:job',
      'scripting:execute', 'until-successful', 'foreach', 'choice', 'when', 'otherwise',
      'error-handler', 'on-error-continue', 'on-error-propagate', 'try', 'raise-error',
      'logger', 'set-payload'
    ]);
    
    // Mule namespace detection
    this.muleNamespaces = new Set([
      'http://www.mulesoft.org/schema/mule/core',
      'http://www.mulesoft.org/schema/mule/http',
      'http://www.mulesoft.org/schema/mule/db',
      'http://www.mulesoft.org/schema/mule/ee/core',
      'http://www.mulesoft.org/schema/mule/validation'
    ]);
  }

  /**
   * Check if the XML document is a Mulesoft configuration
   */
  isMulesoftXml(ast) {
    if (!ast || !ast.mule) return false;
    
    // Check for Mule namespace in the mule element
    for (const key in ast.mule) {
      // Check default namespace
      if (key === '@_xmlns' && this.muleNamespaces.has(ast.mule[key])) {
        return true;
      }
      // Check prefixed namespaces
      if (key.startsWith('@_xmlns:') && this.muleNamespaces.has(ast.mule[key])) {
        return true;
      }
    }
    
    // Check for Mule namespace at root level (for test cases)
    for (const key in ast) {
      // Check prefixed namespaces at root level
      if (key.startsWith('@_xmlns:') && this.muleNamespaces.has(ast[key])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract import/reference statements from Mulesoft XML
   * These include references to external modules, configs, and DataWeave imports
   */
  extractImports(ast) {
    const imports = [];
    
    if (!this.isMulesoftXml(ast)) {
      return imports;
    }
    
    try {
      // Extract imports from various sources
      this.traverseNodes(ast, (node, path) => {
        // Check for spring bean imports
        if (path.includes('spring:bean') || path.includes('spring:import')) {
          const resource = XmlHelpers.getAttr(node, 'resource');
          if (resource) {
            imports.push({
              type: 'spring-import',
              module: resource,
              statement: this.getNodeSource(node, this.content),
              location: this.getNodeLocation(node)
            });
          }
        }
        
        // Check for config references
        if (XmlHelpers.hasAttr(node, 'config-ref')) {
          const configRef = XmlHelpers.getAttr(node, 'config-ref');
          imports.push({
            type: 'config-reference',
            module: configRef,
            statement: this.getNodeSource(node, this.content),
            location: this.getNodeLocation(node)
          });
        }
        
        // Check for DataWeave imports
        if (path.includes('ee:transform') || path.includes('dw:transform-message')) {
          this.extractDataWeaveImports(node, imports);
        }
        
        // Check for flow references
        if (path.includes('flow-ref')) {
          const flowName = XmlHelpers.getAttr(node, 'name');
          if (flowName) {
            imports.push({
              type: 'flow-reference',
              module: flowName,
              statement: this.getNodeSource(node, this.content),
              location: this.getNodeLocation(node)
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error extracting Mulesoft XML imports:', error);
    }
    
    return imports;
  }

  /**
   * Extract DataWeave imports from a transform component
   */
  extractDataWeaveImports(node, imports) {
    // Check for DataWeave code in CDATA sections or directly in text
    if (node['ee:message'] && node['ee:message']['ee:set-payload']) {
      const payload = node['ee:message']['ee:set-payload'];
      this.extractImportsFromDataWeave(payload, imports);
    }
    
    if (node['ee:variables']) {
      const variables = node['ee:variables']['ee:set-variable'];
      if (Array.isArray(variables)) {
        for (const variable of variables) {
          this.extractImportsFromDataWeave(variable, imports);
        }
      } else if (variables) {
        this.extractImportsFromDataWeave(variables, imports);
      }
    }
    
    // Look for dw:transform-message format as well
    if (node['dw:script']) {
      this.extractImportsFromDataWeave(node['dw:script'], imports);
    }
  }

  /**
   * Extract imports from DataWeave code
   */
  extractImportsFromDataWeave(node, imports) {
    if (!node) return;
    
    let dwCode = '';
    
    // Get DataWeave code from node
    if (node['#text']) {
      dwCode = node['#text'];
    } else if (typeof node === 'string') {
      dwCode = node;
    } else if (node['@_resource']) {
      // Resource reference
      imports.push({
        type: 'dataweave-resource',
        module: node['@_resource'],
        statement: this.getNodeSource(node, this.content),
        location: this.getNodeLocation(node)
      });
      return;
    }
    
    // Extract imports from DataWeave code
    const importRegex = /import\s+(?:\*\s+from|{[^}]*}\s+from)?\s+([^;\n]+)/g;
    let match;
    
    while ((match = importRegex.exec(dwCode)) !== null) {
      const moduleName = match[1].trim().replace(/["']/g, '');
      
      imports.push({
        type: 'dataweave-import',
        module: moduleName,
        statement: match[0],
        location: null // Can't determine precise location within the CDATA
      });
    }
  }

  /**
   * Extract "functions" from Mulesoft XML
   * In Mulesoft XML, processors like transformations, HTTP endpoints, etc. are considered "functions"
   */
  extractFunctions(ast) {
    const functions = [];
    
    if (!this.isMulesoftXml(ast)) {
      return functions;
    }
    
    try {
      this.traverseNodes(ast, (node, path) => {
        // Check if this node is a processor
        const lastPathSegment = path[path.length - 1];
        const nodeType = typeof lastPathSegment === 'string' ? lastPathSegment : null;
        
        if (!nodeType) return;
        
        // Check if it's a processor or component we're interested in
        const isProcessor = this.processorTypes.has(nodeType) || 
                          (nodeType.includes(':') && !nodeType.startsWith('@_'));
                          
        if (!isProcessor) return;
        
        // Get processor name
        let name = XmlHelpers.getAttr(node, 'name') || 
                  XmlHelpers.getAttr(node, 'doc:name') ||
                  XmlHelpers.getAttr(node, 'doc:id');
                  
        // If no name found, use the node type as name
        if (!name) {
          name = nodeType;
        }
        
        // Check if it's a DataWeave transform
        let dataWeaveCode = null;
        
        if (nodeType === 'ee:transform' || nodeType === 'dw:transform-message') {
          dataWeaveCode = this.extractDataWeaveCode(node);
        }
        
        // Build function info
        functions.push({
          name: name,
          type: nodeType,
          signature: this.getNodeSource(node, this.content),
          location: this.getNodeLocation(node),
          dataWeave: dataWeaveCode,
          // Add processor-specific properties
          processorProperties: XmlHelpers.getAttrs(node)
        });
      });
      
    } catch (error) {
      console.error('Error extracting Mulesoft XML functions:', error);
    }
    
    return functions;
  }

  /**
   * Extract DataWeave code from a transform component
   */
  extractDataWeaveCode(node) {
    let code = '';
    
    // Check for DataWeave code in ee:set-payload
    if (node['ee:message'] && node['ee:message']['ee:set-payload']) {
      const payload = node['ee:message']['ee:set-payload'];
      code += this.getDataWeaveText(payload);
    }
    
    // Check for DataWeave code in ee:set-variable
    if (node['ee:variables']) {
      const variables = node['ee:variables']['ee:set-variable'];
      if (Array.isArray(variables)) {
        for (const variable of variables) {
          code += '\n' + this.getDataWeaveText(variable);
        }
      } else if (variables) {
        code += '\n' + this.getDataWeaveText(variables);
      }
    }
    
    // Check for dw:transform-message format
    if (node['dw:script']) {
      code += '\n' + this.getDataWeaveText(node['dw:script']);
    }
    
    return code.trim();
  }

  /**
   * Get DataWeave text from a node
   */
  getDataWeaveText(node) {
    if (!node) return '';
    
    if (node['#text']) {
      return node['#text'];
    }
    
    if (typeof node === 'string') {
      return node;
    }
    
    return '';
  }

  /**
   * Extract "classes" from Mulesoft XML
   * In Mulesoft XML, flows and configurations are considered "classes"
   */
  extractClasses(ast) {
    const classes = [];
    
    if (!this.isMulesoftXml(ast)) {
      return classes;
    }
    
    try {
      // Extract flows and subflows
      this.traverseNodes(ast, (node, path) => {
        const lastPathSegment = path[path.length - 1];
        const nodeType = typeof lastPathSegment === 'string' ? lastPathSegment : null;
        
        // Check for flow and sub-flow nodes
        if (nodeType === 'flow' || nodeType === 'sub-flow') {
          const name = XmlHelpers.getAttr(node, 'name') || 'anonymous_flow';
          
          // Extract child processors as methods
          const methods = [];
          const properties = [];
          
          this.traverseNodes(node, (childNode, childPath) => {
            const childSegment = childPath[childPath.length - 1];
            
            // Skip if this is the root node of the traversal
            if (childPath.length === 0) {
              return;
            }
            
            // Skip if this is an array (we'll process its elements separately)
            if (Array.isArray(childNode)) {
              return;
            }
            
            // Get the actual node type (the element name)
            let nodeType = null;
            if (childPath.length >= 2) {
              // For array elements, the node type is the second-to-last segment
              nodeType = childPath[childPath.length - 2];
            } else {
              // For direct children, the node type is the last segment
              nodeType = childSegment;
            }
            
            // Skip if nodeType is not a string or is an attribute
            if (typeof nodeType !== 'string' || nodeType.startsWith('@_')) {
              return;
            }
            
            // Check if it's a processor
            const isProcessor = this.processorTypes.has(nodeType) || 
                              (nodeType.includes(':') && !nodeType.startsWith('@_'));
                              
            if (isProcessor) {
              const methodName = XmlHelpers.getAttr(childNode, 'name') || 
                               XmlHelpers.getAttr(childNode, 'doc:name') || 
                               nodeType;
              
              methods.push({
                name: methodName,
                type: nodeType,
                kind: 'processor',
                location: this.getNodeLocation(childNode)
              });
            }
            
            // Add properties from attributes
            const attrs = XmlHelpers.getAttrs(childNode);
            for (const [key, value] of Object.entries(attrs)) {
              properties.push({
                name: key,
                value: value,
                type: 'attribute',
                location: this.getNodeLocation(childNode)
              });
            }
          });
          
          // Add the class
          classes.push({
            name: name,
            type: nodeType,
            signature: this.getNodeSource(node, this.content),
            location: this.getNodeLocation(node),
            methods: methods,
            properties: properties
          });
        }
        
        // Check for configuration elements
        if (nodeType && nodeType.endsWith('-config')) {
          const name = XmlHelpers.getAttr(node, 'name') || 'anonymous_config';
          
          // Configuration properties
          const properties = [];
          const attrs = XmlHelpers.getAttrs(node);
          
          for (const [key, value] of Object.entries(attrs)) {
            properties.push({
              name: key,
              value: value,
              type: 'config',
              location: this.getNodeLocation(node)
            });
          }
          
          // Add the configuration class
          classes.push({
            name: name,
            type: 'configuration',
            signature: this.getNodeSource(node, this.content),
            location: this.getNodeLocation(node),
            methods: [],
            properties: properties
          });
        }
      });
      
    } catch (error) {
      console.error('Error extracting Mulesoft XML classes:', error);
    }
    
    return classes;
  }

  /**
   * Extract relationships from Mulesoft XML
   * These include flow references and configuration references
   */
  analyzeRelationships(ast) {
    const relationships = [];
    
    if (!this.isMulesoftXml(ast)) {
      return relationships;
    }
    
    try {
      // Create a mapping of flow names first
      const flowNames = new Set();
      
      this.traverseNodes(ast, (node, path) => {
        if (path.length === 0) return;
        
        // Get the actual node type (the element name)
        let nodeType = null;
        if (path.length >= 2) {
          // For array elements, the node type is the second-to-last segment
          nodeType = path[path.length - 2];
        } else {
          // For direct children, the node type is the last segment
          nodeType = path[path.length - 1];
        }
        
        // Skip if nodeType is not a string or is an attribute
        if (typeof nodeType !== 'string' || nodeType.startsWith('@_')) {
          return;
        }
        
        // Check for flow and sub-flow nodes
        if ((nodeType === 'flow' || nodeType === 'sub-flow') && 
            XmlHelpers.hasAttr(node, 'name')) {
          flowNames.add(XmlHelpers.getAttr(node, 'name'));
        }
      });
      
      // Now extract relationships
      this.traverseNodes(ast, (node, path) => {
        // Flow references
        if (path.includes('flow-ref') && XmlHelpers.hasAttr(node, 'name')) {
          const flowName = XmlHelpers.getAttr(node, 'name');
          
          // Find the parent flow
          const parentFlow = this.findParentFlow(path, ast);
          
          if (parentFlow && flowNames.has(flowName)) {
            relationships.push({
              type: 'flow-reference',
              from: parentFlow,
              to: flowName,
              location: this.getNodeLocation(node)
            });
          }
        }
        
        // Config references
        if (XmlHelpers.hasAttr(node, 'config-ref')) {
          const configRef = XmlHelpers.getAttr(node, 'config-ref');
          
          // Find the parent flow
          const parentFlow = this.findParentFlow(path, ast);
          
          if (parentFlow) {
            relationships.push({
              type: 'config-reference',
              from: parentFlow,
              to: configRef,
              location: this.getNodeLocation(node)
            });
          }
        }
        
        // DataWeave transformations
        if ((path.includes('ee:transform') || path.includes('dw:transform-message')) && 
            this.extractDataWeaveCode(node)) {
          
          // Find the parent flow
          const parentFlow = this.findParentFlow(path, ast);
          
          if (parentFlow) {
            relationships.push({
              type: 'dataweave',
              from: parentFlow,
              to: 'dataweave-transformation',
              location: this.getNodeLocation(node)
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error analyzing Mulesoft XML relationships:', error);
    }
    
    return relationships;
  }

  /**
   * Find the parent flow for a given path
   */
  findParentFlow(path, ast) {
    for (let i = 0; i < path.length; i++) {
      const segment = path[i];
      
      if (segment === 'flow' || segment === 'sub-flow') {
        // Navigate to the flow node
        let currentNode = ast;
        for (let j = 0; j <= i; j++) {
          if (!currentNode) break;
          currentNode = currentNode[path[j]];
        }
        
        // If found and has name, return it
        if (currentNode && XmlHelpers.hasAttr(currentNode, 'name')) {
          return XmlHelpers.getAttr(currentNode, 'name');
        }
      }
    }
    
    return null;
  }

  /**
   * Extract documentation strings from Mulesoft XML
   * These can be in comments or documentation attributes
   */
  extractDocstrings(ast) {
    const docstrings = [];
    
    if (!this.isMulesoftXml(ast)) {
      return docstrings;
    }
    
    // Start with regular comments
    const comments = this.extractComments(ast);
    
    // Convert relevant comments to docstrings
    for (const comment of comments) {
      if (comment.content.includes('@Description') || 
          comment.content.includes('@Summary') ||
          comment.content.includes('@Author') ||
          comment.content.includes('Mule configuration')) {
        
        docstrings.push({
          type: 'mulesoft-doc',
          content: comment.content,
          location: comment.location
        });
      }
    }
    
    // Extract doc:name and doc:description attributes
    this.traverseNodes(ast, (node) => {
      const desc = XmlHelpers.getAttr(node, 'doc:description');
      const name = XmlHelpers.getAttr(node, 'doc:name');
      
      if (desc || name) {
        let content = '';
        if (name) content += `Name: ${name}\n`;
        if (desc) content += `Description: ${desc}`;
        
        docstrings.push({
          type: 'mulesoft-doc',
          content: content.trim(),
          location: this.getNodeLocation(node)
        });
      }
    });
    
    return docstrings;
  }
}
