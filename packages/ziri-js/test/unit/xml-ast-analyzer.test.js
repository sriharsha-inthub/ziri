/**
 * Unit tests for XML AST Analyzer base class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { XmlASTAnalyzer, XmlHelpers } from '../../lib/metadata/xml-ast-analyzer.js';

describe('XmlASTAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new XmlASTAnalyzer();
  });
  
  describe('parse', () => {
    it('should parse valid XML content', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <element id="1" name="Test">
    <child>Value</child>
    <child>Another Value</child>
  </element>
</root>`;

      const ast = await analyzer.parse(content, 'test.xml');
      
      expect(ast).to.be.an('object');
      expect(ast.root).to.exist;
      expect(ast.root.element).to.exist;
      expect(ast.root.element['@_id']).to.equal('1');
      expect(ast.root.element['@_name']).to.equal('Test');
      expect(ast.root.element.child).to.exist;
    });
    
    it('should handle invalid XML gracefully', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <element>
    <child>Unclosed tag
  </element>
</root>`;

      try {
        await analyzer.parse(content, 'broken.xml');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
  
  describe('extractComments', () => {
    it('should extract XML comments', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<!-- This is a comment -->
<root>
  <!-- Another comment -->
  <element>Value</element>
  <!-- Multi-line
       comment -->
</root>`;

      analyzer.content = content;
      const comments = analyzer.extractComments();
      
      expect(comments).to.be.an('array');
      expect(comments.length).to.equal(3);
      expect(comments[0].content).to.equal('This is a comment');
      expect(comments[1].content).to.equal('Another comment');
      expect(comments[2].content).to.equal('Multi-line\n       comment');
    });
    
    it('should handle XML with no comments', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <element>Value</element>
</root>`;

      analyzer.content = content;
      const comments = analyzer.extractComments();
      
      expect(comments).to.be.an('array');
      expect(comments.length).to.equal(0);
    });
  });
  
  describe('traverseNodes', () => {
    it('should traverse all XML nodes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <parent>
    <child id="1">First</child>
    <child id="2">Second</child>
  </parent>
  <sibling>Value</sibling>
</root>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const visited = [];
      
      analyzer.traverseNodes(ast, (node, path) => {
        if (path.length > 0) {
          visited.push(path.join('/'));
        }
      });
      
      expect(visited).to.include('root');
      expect(visited).to.include('root/parent');
      expect(visited).to.include('root/parent/child');
      expect(visited).to.include('root/sibling');
    });
    
    it('should handle arrays of nodes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <items>
    <item>One</item>
    <item>Two</item>
    <item>Three</item>
  </items>
</root>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const visited = [];
      
      analyzer.traverseNodes(ast, (node, path) => {
        if (Array.isArray(node)) {
          visited.push(`Array at ${path.join('/')}`);
        } else if (typeof node === 'object' && path.length > 0) {
          visited.push(path.join('/'));
        } else if (path.length > 0) {
          visited.push(path.join('/'));
        }
      });
      
      expect(visited).to.include('root');
      expect(visited).to.include('root/items');
      expect(visited).to.include('root/items/item/0');
      expect(visited).to.include('root/items/item/1');
      expect(visited).to.include('root/items/item/2');
    });
  });
  
  describe('getNodeLocation', () => {
    it('should return null for nodes without location information', () => {
      const node = { value: 'test' };
      const location = analyzer.getNodeLocation(node);
      expect(location).to.be.null;
    });
    
    it('should return location information for nodes with location data', () => {
      const node = { 
        value: 'test',
        __location: {
          startLine: 10,
          startColumn: 5,
          endLine: 10,
          endColumn: 15
        }
      };
      
      const location = analyzer.getNodeLocation(node);
      
      expect(location).to.exist;
      expect(location.start).to.exist;
      expect(location.start.line).to.equal(10);
      expect(location.start.column).to.equal(5);
      expect(location.end).to.exist;
      expect(location.end.line).to.equal(10);
      expect(location.end.column).to.equal(15);
    });
  });
  
  describe('getNodeSource', () => {
    it('should extract source code from content using location', () => {
      const content = `line1
line2
line3
line4`;

      const node = {
        __location: {
          startLine: 2,
          startColumn: 0,
          endLine: 3,
          endColumn: 5
        }
      };
      
      const source = analyzer.getNodeSource(node, content);
      expect(source).to.equal('line2\nline3');
    });
    
    it('should handle single-line nodes', () => {
      const content = `line1
line2 with some text
line3`;

      const node = {
        __location: {
          startLine: 2,
          startColumn: 0,
          endLine: 2,
          endColumn: 5
        }
      };
      
      const source = analyzer.getNodeSource(node, content);
      expect(source).to.equal('line2');
    });
    
    it('should return empty string for invalid locations', () => {
      const content = 'line1\nline2\nline3';
      const node = {
        __location: {
          startLine: 10, // Beyond content
          startColumn: 0,
          endLine: 11,
          endColumn: 5
        }
      };
      
      const source = analyzer.getNodeSource(node, content);
      expect(source).to.equal('');
    });
    
    it('should return empty string for missing content or location', () => {
      const node = {
        __location: {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          endColumn: 5
        }
      };
      
      expect(analyzer.getNodeSource(node, null)).to.equal('');
      expect(analyzer.getNodeSource(null, 'content')).to.equal('');
    });
  });
  
  describe('XmlHelpers', () => {
    it('should get attribute value by name', () => {
      const node = {
        '@_id': '123',
        '@_name': 'test',
        '@_enabled': 'true'
      };
      
      expect(XmlHelpers.getAttr(node, 'id')).to.equal('123');
      expect(XmlHelpers.getAttr(node, 'name')).to.equal('test');
      expect(XmlHelpers.getAttr(node, 'enabled')).to.equal('true');
    });
    
    it('should return default value for missing attributes', () => {
      const node = { '@_id': '123' };
      
      expect(XmlHelpers.getAttr(node, 'missing')).to.be.null;
      expect(XmlHelpers.getAttr(node, 'missing', 'default')).to.equal('default');
    });
    
    it('should check if node has attribute', () => {
      const node = {
        '@_id': '123',
        'value': 'test'
      };
      
      expect(XmlHelpers.hasAttr(node, 'id')).to.be.true;
      expect(XmlHelpers.hasAttr(node, 'value')).to.be.false; // Not an attribute
      expect(XmlHelpers.hasAttr(node, 'missing')).to.be.false;
    });
    
    it('should get all attributes as object', () => {
      const node = {
        '@_id': '123',
        '@_name': 'test',
        'value': 'not an attribute',
        '@_enabled': 'true'
      };
      
      const attrs = XmlHelpers.getAttrs(node);
      
      expect(attrs).to.deep.equal({
        id: '123',
        name: 'test',
        enabled: 'true'
      });
      
      expect(attrs.value).to.be.undefined; // Not an attribute
    });
    
    it('should get text content from node', () => {
      const nodeWithText = {
        '#text': 'Text content'
      };
      
      const stringNode = 'Direct text';
      
      const emptyNode = {
        '@_id': '123'
      };
      
      expect(XmlHelpers.getText(nodeWithText)).to.equal('Text content');
      expect(XmlHelpers.getText(stringNode)).to.equal('Direct text');
      expect(XmlHelpers.getText(emptyNode)).to.equal('');
      expect(XmlHelpers.getText(null)).to.equal('');
    });
  });
  
  describe('Base interface methods', () => {
    it('should have default implementations for all required methods', () => {
      expect(analyzer.extractImports).to.be.a('function');
      expect(analyzer.extractFunctions).to.be.a('function');
      expect(analyzer.extractClasses).to.be.a('function');
      expect(analyzer.extractDocstrings).to.be.a('function');
      expect(analyzer.buildCallGraph).to.be.a('function');
      expect(analyzer.trackVariableScopes).to.be.a('function');
      expect(analyzer.performTypeInference).to.be.a('function');
      expect(analyzer.analyzeRelationships).to.be.a('function');
    });
    
    it('should return empty arrays/maps by default', () => {
      expect(analyzer.extractImports({})).to.be.an('array').that.is.empty;
      expect(analyzer.extractFunctions({})).to.be.an('array').that.is.empty;
      expect(analyzer.extractClasses({})).to.be.an('array').that.is.empty;
      expect(analyzer.extractDocstrings({})).to.be.an('array').that.is.empty;
      expect(analyzer.analyzeRelationships({})).to.be.an('array').that.is.empty;
      
      expect(analyzer.buildCallGraph({})).to.be.a('map').that.is.empty;
      expect(analyzer.trackVariableScopes({})).to.be.a('map').that.is.empty;
      expect(analyzer.performTypeInference({})).to.be.a('map').that.is.empty;
    });
  });
});
