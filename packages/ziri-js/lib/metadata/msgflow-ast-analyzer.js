/**
 * IBM ACE Message Flow AST Analyzer
 * Provides AST parsing and analysis for IBM ACE message flow XML files (.msgflow)
 */

import { BaseASTAnalyzer } from './base-ast-analyzer.js';
import { XmlASTAnalyzer, XmlHelpers } from './xml-ast-analyzer.js';

/**
 * IBM ACE message flow specific AST analyzer
 */
export class MsgflowASTAnalyzer extends XmlASTAnalyzer {
  constructor() {
    super();
    this.nodeTypes = new Set([
      'ComputeNode', 'DatabaseNode', 'FilterNode', 'FileInputNode', 'FileOutputNode',
      'HttpInputNode', 'HttpRequestNode', 'MQInputNode', 'MQOutputNode', 'RouteNode', 
      'SOAPInputNode', 'SOAPRequestNode', 'TimeoutControlNode', 'TryCatchNode'
    ]);
  }

  /**
   * Parse XML content into AST with proper handling of namespace prefixes
   */
  async parse(content, filePath) {
    // First parse with the parent class
    const result = await super.parse(content, filePath);
    
    // Handle namespace prefix in the root element name
    // The parser creates properties like "ecore:EPackage" instead of just "ecore"
    if (result && !result.ecore) {
      // Look for properties that start with "ecore:"
      for (const key of Object.keys(result)) {
        if (key.startsWith('ecore:')) {
          // Instead of duplicating, we'll just reference the existing node
          result.ecore = result[key];
          // Remove the duplicate key to avoid double traversal
          delete result[key];
          break;
        }
      }
    }
    
    return result;
  }

  /**
   * Extract import/reference statements from msgflow
   * These include references to shared libraries, message sets, and subflows
   */
  extractImports(ast) {
    const imports = [];
    
    // No AST or no root ecore element
    if (!ast || !ast.ecore || !ast.ecore.eClassifiers) {
      return imports;
    }
    
    try {
      // Extract message set imports
      this.traverseNodes(ast, (node, path) => {
        // Check for MessageSet references
        if (XmlHelpers.hasAttr(node, 'messageSet') || XmlHelpers.hasAttr(node, 'messageSetProperty')) {
          const messageSet = XmlHelpers.getAttr(node, 'messageSet') || XmlHelpers.getAttr(node, 'messageSetProperty');
          
          if (messageSet) {
            imports.push({
              type: 'message-set',
              module: messageSet,
              statement: this.getNodeSource(node, this.content),
              location: this.getNodeLocation(node)
            });
          }
        }
        
        // Check for SubflowInputNode which represents subflow imports
        if (path.includes('SubflowInputNode') || XmlHelpers.hasAttr(node, 'subflowName')) {
          const subflowName = XmlHelpers.getAttr(node, 'subflowName');
          
          if (subflowName) {
            imports.push({
              type: 'subflow',
              module: subflowName,
              statement: this.getNodeSource(node, this.content),
              location: this.getNodeLocation(node)
            });
          }
        }
        
        // Check for shared library references
        if (XmlHelpers.hasAttr(node, 'sharedLibrary')) {
          const library = XmlHelpers.getAttr(node, 'sharedLibrary');
          
          if (library) {
            imports.push({
              type: 'shared-library',
              module: library,
              statement: this.getNodeSource(node, this.content),
              location: this.getNodeLocation(node)
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error extracting msgflow imports:', error);
    }
    
    return imports;
  }

  /**
   * Extract "functions" from msgflow
   * In msgflow, nodes with processing logic (e.g., ComputeNode) are considered "functions"
   */
  extractFunctions(ast) {
    const functions = [];
    
    // No AST or no root element
    if (!ast || !ast.ecore || !ast.ecore.eClassifiers) {
      return functions;
    }
    
    try {
      // In msgflow XML, processing nodes are represented as eStructuralFeatures
      // with an eType child that has the actual node type in its xsi:type attribute
      this.traverseNodes(ast, (node, path) => {
        // Look for eStructuralFeatures nodes which represent processing nodes
        const nodeName = path[path.length - 1];
        const nodeType = typeof nodeName === 'string' ? nodeName : null;
        
        // Skip if not an eStructuralFeatures node
        if (nodeType !== 'eStructuralFeatures') {
          return;
        }
        
        // Get the node name from the eStructuralFeatures element
        const name = XmlHelpers.getAttr(node, 'name') || 
                     XmlHelpers.getAttr(node, 'id') || 
                     'anonymous_node';
        
        // Look for the eType child which contains the actual node type
        const eType = node.eType;
        if (!eType) {
          return;
        }
        
        // Get the actual node type from the xsi:type attribute
        const actualNodeType = XmlHelpers.getAttr(eType, 'xsi:type');
        if (!actualNodeType) {
          return;
        }
        
        // Check if this is a node type we're interested in
        // We'll check if the xsi:type contains any of our known node type identifiers
        let isInterestingNodeType = false;
        for (const knownType of this.nodeTypes) {
          if (actualNodeType.includes(knownType.replace('Node', ''))) {
            isInterestingNodeType = true;
            break;
          }
        }
        
        // Skip if not a node type we're interested in
        if (!isInterestingNodeType) {
          return;
        }
        
        // Extract ESQL references for compute nodes
        let esqlModule = null;
        let esqlStatement = null;
        
        if (actualNodeType.includes('Compute')) {
          const computeExpression = eType.computeExpression;
          
          if (computeExpression) {
            // Check if this is an ESQL compute expression
            if (XmlHelpers.hasAttr(computeExpression, 'esql')) {
              esqlModule = XmlHelpers.getAttr(computeExpression, 'esql');
              esqlStatement = XmlHelpers.getText(computeExpression);
            }
          }
        }
        
        // Build function info
        functions.push({
          name: name,
          type: actualNodeType, // Use the full xsi:type as the type
          signature: this.getNodeSource(node, this.content),
          location: this.getNodeLocation(node),
          // Add node-specific properties
          nodeProperties: {
            ...XmlHelpers.getAttrs(node),  // Get attributes from eStructuralFeatures
            ...XmlHelpers.getAttrs(eType), // Also get attributes from eType (without @_)
            // Include raw attributes with @_ prefix to match test expectations
            ...this.getRawAttributes(eType),
            esqlModule,
            esqlStatement
          }
        });
      });
      
    } catch (error) {
      console.error('Error extracting msgflow functions:', error);
    }
    
    return functions;
  }

  /**
   * Extract "classes" from msgflow
   * In msgflow, flow definitions and subflows are considered "classes"
   */
  extractClasses(ast) {
    const classes = [];
    
    // No AST or no root element
    if (!ast || !ast.ecore || !ast.ecore.eClassifiers) {
      return classes;
    }
    
    try {
      // Extract message flow and subflow definitions
      if (ast.ecore.eClassifiers) {
        const classifiers = ast.ecore.eClassifiers;
        
        // Handle array of classifiers
        if (Array.isArray(classifiers)) {
          for (const classifier of classifiers) {
            this.extractClassFromClassifier(classifier, classes);
          }
        } 
        // Handle single classifier
        else {
          this.extractClassFromClassifier(classifiers, classes);
        }
      }
      
    } catch (error) {
      console.error('Error extracting msgflow classes:', error);
    }
    
    return classes;
  }

  /**
   * Extract class from a classifier element
   */
  extractClassFromClassifier(classifier, classes) {
    // Only process MessageFlow or Subflow classifiers
    const instanceClassName = XmlHelpers.getAttr(classifier, 'instanceClassName');
    
    if (!instanceClassName || 
        !(instanceClassName.includes('MessageFlow') || 
          instanceClassName.includes('Subflow'))) {
      return;
    }
    
    const name = XmlHelpers.getAttr(classifier, 'name') || 'anonymous_flow';
    const type = instanceClassName.includes('Subflow') ? 'Subflow' : 'MessageFlow';
    
    // Extract methods (nodes with processing)
    const methods = [];
    const properties = [];
    
    // Look for eStructuralFeatures directly in the classifier
    if (classifier.eStructuralFeatures) {
      const features = classifier.eStructuralFeatures;
      
      // Handle array of features
      if (Array.isArray(features)) {
        for (const feature of features) {
          const propertyName = XmlHelpers.getAttr(feature, 'name');
          if (propertyName) {
            properties.push({
              name: propertyName,
              type: 'property',
              location: this.getNodeLocation(feature)
            });
          }
        }
      }
      // Handle single feature
      else {
        const propertyName = XmlHelpers.getAttr(features, 'name');
        if (propertyName) {
          properties.push({
            name: propertyName,
            type: 'property',
            location: this.getNodeLocation(features)
          });
        }
      }
    }
    
    // Add the class
    classes.push({
      name: name,
      type: type,
      signature: this.getNodeSource(classifier, this.content),
      location: this.getNodeLocation(classifier),
      methods: methods,
      properties: properties
    });
  }

  /**
   * Extract relationships from the message flow
   * These include connections between nodes
   */
  analyzeRelationships(ast) {
    const relationships = [];
    
    // No AST or no root element
    if (!ast || !ast.ecore || !ast.ecore.eClassifiers) {
      return relationships;
    }
    
    try {
      // Extract connections between nodes
      this.traverseNodes(ast, (node, path) => {
        // Look for connections
        if (path.includes('connections') || path.includes('connection')) {
          // Source and target are typically attributes or child elements
          const sourceNode = XmlHelpers.getAttr(node, 'sourceNode') || 
                            XmlHelpers.getAttr(node, 'source') ||
                            XmlHelpers.getAttr(node, 'sourceTerminal');
                            
          const targetNode = XmlHelpers.getAttr(node, 'targetNode') || 
                            XmlHelpers.getAttr(node, 'target') ||
                            XmlHelpers.getAttr(node, 'targetTerminal');
          
          if (sourceNode && targetNode) {
            relationships.push({
              type: 'connection',
              from: sourceNode,
              to: targetNode,
              connectionType: XmlHelpers.getAttr(node, 'type') || 'default',
              location: this.getNodeLocation(node)
            });
          }
        }
        
        // Look for ESQL module references in compute nodes
        // The path should include 'computeExpression' and the node should have 'esql' attribute
        if (path[path.length - 1] === 'computeExpression' && 
            XmlHelpers.hasAttr(node, 'esql')) {
          
          const esqlModule = XmlHelpers.getAttr(node, 'esql');
          // Find the parent eStructuralFeatures node to get the node name
          const nodeName = this.findNodeNameForComputeExpression(path, ast);
          
          if (esqlModule && nodeName) {
            relationships.push({
              type: 'esql-reference',
              from: nodeName,
              to: esqlModule,
              location: this.getNodeLocation(node)
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error analyzing msgflow relationships:', error);
    }
    
    return relationships;
  }

  /**
   * Find node name for compute expression by traversing back up the path
   */
  findNodeNameForComputeExpression(path, ast) {
    // Look for the eStructuralFeatures node that contains this computeExpression
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i] === 'eStructuralFeatures') {
        // Found the eStructuralFeatures node, now get its name attribute
        let currentNode = ast;
        for (let j = 0; j <= i; j++) {
          if (!currentNode) break;
          currentNode = currentNode[path[j]];
        }
        
        if (currentNode && XmlHelpers.hasAttr(currentNode, 'name')) {
          return XmlHelpers.getAttr(currentNode, 'name');
        }
      }
    }
    
    return null;
  }

  /**
   * Extract documentation strings from msgflow
   * These can be in comments or documentation attributes
   */
  extractDocstrings(ast) {
    const docstrings = [];
    
    // No AST or no root element
    if (!ast || !ast.ecore || !ast.ecore.eClassifiers) {
      return docstrings;
    }
    
    // Start with regular comments
    const comments = this.extractComments(ast);
    
    // Convert relevant comments to docstrings
    for (const comment of comments) {
      if (comment.content.includes('@description') || 
          comment.content.includes('@summary') ||
          comment.content.includes('@author')) {
        
        docstrings.push({
          type: 'msgflow-doc',
          content: comment.content,
          location: comment.location
        });
      }
    }
    
    // Extract documentation attributes
    this.traverseNodes(ast, (node) => {
      // Check for description or documentation attributes
      const desc = XmlHelpers.getAttr(node, 'documentation') || 
                  XmlHelpers.getAttr(node, 'description');
      
      if (desc) {
        docstrings.push({
          type: 'msgflow-doc',
          content: desc,
          location: this.getNodeLocation(node)
        });
      }
    });
    
    return docstrings;
  }

  /**
   * Get raw attributes with @_ prefix preserved
   */
  getRawAttributes(node) {
    if (!node) return {};
    
    const attrs = {};
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_')) {
        attrs[key] = node[key];
      }
    }
    
    return attrs;
  }
}
