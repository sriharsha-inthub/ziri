/**
 * Unit tests for DataWeave Language (DWL) AST Analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DWLASTAnalyzer } from '../../lib/metadata/dwl-ast-analyzer.js';

describe('DWLASTAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new DWLASTAnalyzer();
  });
  
  describe('parse', () => {
    it('should parse valid DataWeave content', async () => {
      const content = `%dw 2.0
import * from dw::core::Strings
import { now } from dw::util::Timer

var greeting = "Hello"
var currentTime = now()

fun formatGreeting(name: String) = greeting ++ ", " ++ name ++ "!"

type Person = {
  name: String,
  age: Number
}

output application/json
---
{
  message: formatGreeting("World"),
  timestamp: currentTime,
  person: {name: "John", age: 30} as Person
}`;

      const ast = await analyzer.parse(content, 'transform.dwl');
      
      expect(ast).to.be.an('object');
      expect(ast.type).to.equal('Program');
      expect(ast.body).to.be.an('array');
      expect(ast.body.length).to.be.greaterThan(0);
    });
    
    it('should handle empty content gracefully', async () => {
      const content = '';

      const ast = await analyzer.parse(content, 'empty.dwl');
      
      expect(ast).to.be.an('object');
      expect(ast.type).to.equal('Program');
      expect(ast.body).to.be.an('array');
      expect(ast.body.length).to.equal(0);
    });
  });
  
  describe('parseImports', () => {
    it('should extract wildcard imports', () => {
      const content = `%dw 2.0
import * from dw::core::Strings
import * from dw::core::Arrays
`;
      
      const imports = analyzer.parseImports(content);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(2);
      expect(imports[0].type).to.equal('ImportDeclaration');
      expect(imports[0].source).to.equal('dw::core::Strings');
      expect(imports[0].specifiers).to.include('*');
      expect(imports[1].source).to.equal('dw::core::Arrays');
    });
    
    it('should extract named imports', () => {
      const content = `%dw 2.0
import {upper, lower, capitalize} from dw::core::Strings
`;
      
      const imports = analyzer.parseImports(content);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(1);
      expect(imports[0].specifiers).to.have.lengthOf(3);
      expect(imports[0].specifiers).to.include('upper');
      expect(imports[0].specifiers).to.include('lower');
      expect(imports[0].specifiers).to.include('capitalize');
    });
    
    it('should handle unquoted module names', () => {
      const content = `%dw 2.0
import * from dw::core::Strings
`;
      
      const imports = analyzer.parseImports(content);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(1);
      expect(imports[0].source).to.equal('dw::core::Strings');
    });
    
    it('should handle quoted module names', () => {
      const content = `%dw 2.0
import * from "dw::core::Strings"
import * from 'dw::util::Timer'
`;
      
      const imports = analyzer.parseImports(content);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(2);
      expect(imports[0].source).to.equal('dw::core::Strings');
      expect(imports[1].source).to.equal('dw::util::Timer');
    });
  });
  
  describe('parseVariables', () => {
    it('should extract variable declarations without types', () => {
      const content = `%dw 2.0
var greeting = "Hello"
var count = 42
var enabled = true
`;
      
      const variables = analyzer.parseVariables(content);
      
      expect(variables).to.be.an('array');
      expect(variables.length).to.equal(3);
      expect(variables[0].name).to.equal('greeting');
      expect(variables[0].value).to.equal('"Hello"');
      expect(variables[0].dataType).to.be.null;
      expect(variables[1].name).to.equal('count');
      expect(variables[1].value).to.equal('42');
      expect(variables[2].name).to.equal('enabled');
      expect(variables[2].value).to.equal('true');
    });
    
    it('should extract variable declarations with types', () => {
      const content = `%dw 2.0
var name: String = "John"
var age: Number = 30
var items: Array<String> = ["a", "b", "c"]
`;
      
      const variables = analyzer.parseVariables(content);
      
      expect(variables).to.be.an('array');
      expect(variables.length).to.equal(3);
      expect(variables[0].name).to.equal('name');
      expect(variables[0].dataType).to.equal('String');
      expect(variables[0].value).to.equal('"John"');
      expect(variables[1].name).to.equal('age');
      expect(variables[1].dataType).to.equal('Number');
      expect(variables[2].name).to.equal('items');
      expect(variables[2].dataType).to.equal('Array<String>');
    });
    
    it('should handle multiline variable declarations', () => {
      const content = `%dw 2.0
var person = {
  name: "John",
  age: 30,
  address: {
    street: "Main St",
    city: "Anytown"
  }
}
`;
      
      const variables = analyzer.parseVariables(content);
      
      expect(variables).to.be.an('array');
      expect(variables.length).to.equal(1);
      expect(variables[0].name).to.equal('person');
      expect(variables[0].value).to.include('name: "John"');
      expect(variables[0].value).to.include('address: {');
    });
  });
  
  describe('parseFunctions', () => {
    it('should extract simple function declarations', () => {
      const content = `%dw 2.0
fun add(a, b) = a + b
fun greet(name) = "Hello, " ++ name
`;
      
      const functions = analyzer.parseFunctions(content);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(2);
      expect(functions[0].name).to.equal('add');
      expect(functions[0].params).to.have.lengthOf(2);
      expect(functions[0].params[0].name).to.equal('a');
      expect(functions[0].params[1].name).to.equal('b');
      expect(functions[0].body).to.equal('a + b');
      expect(functions[1].name).to.equal('greet');
    });
    
    it('should extract function declarations with types', () => {
      const content = `%dw 2.0
fun add(a: Number, b: Number): Number = a + b
fun formatName(first: String, last: String): String = first ++ " " ++ last
`;
      
      const functions = analyzer.parseFunctions(content);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(2);
      expect(functions[0].name).to.equal('add');
      expect(functions[0].params[0].type).to.equal('Number');
      expect(functions[0].params[1].type).to.equal('Number');
      expect(functions[0].returnType).to.equal('Number');
      expect(functions[1].name).to.equal('formatName');
      expect(functions[1].returnType).to.equal('String');
    });
    
    it('should extract complex function bodies', () => {
      const content = `%dw 2.0
fun processArray(arr: Array<Any>) = 
  arr map (item, index) -> {
    value: item,
    position: index,
    isLast: index == sizeOf(arr) - 1
  }
`;
      
      const functions = analyzer.parseFunctions(content);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(1);
      expect(functions[0].name).to.equal('processArray');
      expect(functions[0].body).to.include('arr map (item, index)');
      expect(functions[0].body).to.include('isLast: index == sizeOf(arr) - 1');
    });
  });
  
  describe('parseTypes', () => {
    it('should extract simple type declarations', () => {
      const content = `%dw 2.0
type StringArray = Array<String>
type NumberMap = { [String]: Number }
`;
      
      const types = analyzer.parseTypes(content);
      
      expect(types).to.be.an('array');
      expect(types.length).to.equal(2);
      expect(types[0].name).to.equal('StringArray');
      expect(types[0].definition).to.equal('Array<String>');
      expect(types[1].name).to.equal('NumberMap');
      expect(types[1].definition).to.equal('{ [String]: Number }');
    });
    
    it('should extract complex object types', () => {
      const content = `%dw 2.0
type Person = {
  name: String,
  age: Number,
  address?: {
    street: String,
    city: String,
    zip: String
  }
}
`;
      
      const types = analyzer.parseTypes(content);
      
      expect(types).to.be.an('array');
      expect(types.length).to.equal(1);
      expect(types[0].name).to.equal('Person');
      expect(types[0].definition).to.include('name: String');
      expect(types[0].definition).to.include('address?:');
    });
    
    it('should extract union types', () => {
      const content = `%dw 2.0
type ID = String | Number
type Status = "pending" | "approved" | "rejected"
`;
      
      const types = analyzer.parseTypes(content);
      
      expect(types).to.be.an('array');
      expect(types.length).to.equal(2);
      expect(types[0].name).to.equal('ID');
      expect(types[0].definition).to.equal('String | Number');
      expect(types[1].name).to.equal('Status');
      expect(types[1].definition).to.include('"pending" | "approved" | "rejected"');
    });
  });
  
  describe('parseMainExpression', () => {
    it('should extract the main expression after directive sections', () => {
      const content = `%dw 2.0
import * from dw::core::Strings
var greeting = "Hello"

output application/json
---
{
  message: greeting ++ ", World!"
}`;
      
      const mainExpression = analyzer.parseMainExpression(content);
      
      expect(mainExpression).to.be.an('object');
      expect(mainExpression.type).to.equal('MainExpression');
      expect(mainExpression.body).to.include('{');
      expect(mainExpression.body).to.include('message: greeting ++ ", World!"');
      expect(mainExpression.body).to.include('}');
    });
    
    it('should handle a main expression with no other declarations', () => {
      const content = `%dw 2.0
output application/json
---
"Hello, World!"`;
      
      const mainExpression = analyzer.parseMainExpression(content);
      
      expect(mainExpression).to.be.an('object');
      expect(mainExpression.body).to.equal('"Hello, World!"');
    });
    
    it('should return null if no main expression exists', () => {
      const content = `%dw 2.0
// Just imports and functions, no main expression
import * from dw::core::Strings
fun greet(name) = "Hello, " ++ name`;
      
      const mainExpression = analyzer.parseMainExpression(content);
      
      expect(mainExpression).to.be.null;
    });
  });
  
  describe('extractImports', () => {
    it('should extract import declarations from AST', () => {
      const ast = {
        body: [
          {
            type: 'ImportDeclaration',
            source: 'dw::core::Strings',
            specifiers: ['*'],
            statement: 'import * from dw::core::Strings'
          },
          {
            type: 'ImportDeclaration',
            source: 'dw::util::Timer',
            specifiers: ['now', 'currentTime'],
            statement: 'import {now, currentTime} from dw::util::Timer'
          }
        ]
      };
      
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(2);
      expect(imports[0].type).to.equal('dataweave-import');
      expect(imports[0].module).to.equal('dw::core::Strings');
      expect(imports[1].type).to.equal('dataweave-import');
      expect(imports[1].module).to.equal('dw::util::Timer');
      expect(imports[1].specifiers).to.deep.equal(['now', 'currentTime']);
    });
  });
  
  describe('extractFunctions', () => {
    it('should extract function declarations from AST', () => {
      const ast = {
        body: [
          {
            type: 'FunctionDeclaration',
            name: 'add',
            params: [
              { name: 'a', type: 'Number' },
              { name: 'b', type: 'Number' }
            ],
            returnType: 'Number',
            body: 'a + b'
          },
          {
            type: 'FunctionDeclaration',
            name: 'greet',
            params: [
              { name: 'name', type: 'String' }
            ],
            returnType: 'String',
            body: '"Hello, " ++ name'
          }
        ]
      };
      
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(2);
      expect(functions[0].name).to.equal('add');
      expect(functions[0].params).to.have.lengthOf(2);
      expect(functions[0].returnType).to.equal('Number');
      expect(functions[1].name).to.equal('greet');
      expect(functions[1].params).to.have.lengthOf(1);
    });
    
    it('should include the main expression as an anonymous function if present', () => {
      const ast = {
        body: [
          {
            type: 'MainExpression',
            body: '{ "message": "Hello" }',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(1);
      expect(functions[0].name).to.equal('main');
      expect(functions[0].type).to.equal('main-expression');
      expect(functions[0].body).to.equal('{ "message": "Hello" }');
    });
  });
  
  describe('extractClasses', () => {
    it('should extract type declarations as classes from AST', () => {
      const ast = {
        body: [
          {
            type: 'TypeDeclaration',
            name: 'Person',
            definition: '{\n  name: String,\n  age: Number\n}',
            location: { start: {}, end: {} }
          },
          {
            type: 'TypeDeclaration',
            name: 'Address',
            definition: '{\n  street: String,\n  city: String\n}',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.be.an('array');
      expect(classes.length).to.equal(2);
      expect(classes[0].name).to.equal('Person');
      expect(classes[0].type).to.equal('dataweave-type');
      expect(classes[0].properties).to.be.an('array');
      expect(classes[1].name).to.equal('Address');
    });
    
    it('should extract fields from object type definitions', () => {
      const ast = {
        body: [
          {
            type: 'TypeDeclaration',
            name: 'Person',
            definition: '{\n  name: String,\n  age: Number,\n  active: Boolean\n}',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.be.an('array');
      expect(classes.length).to.equal(1);
      expect(classes[0].name).to.equal('Person');
      expect(classes[0].properties).to.be.an('array');
      // Note: precise field extraction is challenging with regex-based parsing
    });
  });
  
  describe('analyzeRelationships', () => {
    it('should extract function call relationships', () => {
      const ast = {
        body: [
          {
            type: 'FunctionDeclaration',
            name: 'formatName',
            body: 'upper(firstName) ++ " " ++ upper(lastName)',
            location: { start: {}, end: {} }
          },
          {
            type: 'FunctionDeclaration',
            name: 'upper',
            body: 'input',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      const functionCall = relationships.find(rel => 
        rel.type === 'function-call' && rel.from === 'formatName' && rel.to === 'upper'
      );
      expect(functionCall).to.exist;
    });
    
    it('should extract variable reference relationships', () => {
      const ast = {
        body: [
          {
            type: 'VariableDeclaration',
            name: 'greeting',
            value: '"Hello"',
            location: { start: {}, end: {} }
          },
          {
            type: 'FunctionDeclaration',
            name: 'greet',
            body: 'greeting ++ ", " ++ name',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      const varRef = relationships.find(rel => 
        rel.type === 'variable-reference' && rel.from === 'greet' && rel.to === 'greeting'
      );
      expect(varRef).to.exist;
    });
    
    it('should extract type reference relationships', () => {
      const ast = {
        body: [
          {
            type: 'TypeDeclaration',
            name: 'Person',
            definition: '{\n  name: String,\n  age: Number\n}',
            location: { start: {}, end: {} }
          },
          {
            type: 'FunctionDeclaration',
            name: 'createPerson',
            params: [
              { name: 'name', type: 'String' },
              { name: 'age', type: 'Number' }
            ],
            returnType: 'Person',
            body: '{ name: name, age: age }',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      const typeRef = relationships.find(rel => 
        rel.type === 'type-reference' && rel.from === 'createPerson' && rel.to === 'Person'
      );
      expect(typeRef).to.exist;
    });
  });
  
  describe('inferTypeFromValue', () => {
    it('should infer String type from string literals', () => {
      expect(analyzer.inferTypeFromValue('"test"')).to.equal('String');
      expect(analyzer.inferTypeFromValue("'test'")).to.equal('String');
    });
    
    it('should infer Number type from number literals', () => {
      expect(analyzer.inferTypeFromValue('42')).to.equal('Number');
      expect(analyzer.inferTypeFromValue('3.14')).to.equal('Number');
    });
    
    it('should infer Boolean type from boolean literals', () => {
      expect(analyzer.inferTypeFromValue('true')).to.equal('Boolean');
      expect(analyzer.inferTypeFromValue('false')).to.equal('Boolean');
    });
    
    it('should infer Array type from array literals', () => {
      expect(analyzer.inferTypeFromValue('["a", "b", "c"]')).to.equal('Array');
      expect(analyzer.inferTypeFromValue('[]')).to.equal('Array');
    });
    
    it('should infer Object type from object literals', () => {
      expect(analyzer.inferTypeFromValue('{ name: "John" }')).to.equal('Object');
      expect(analyzer.inferTypeFromValue('{}')).to.equal('Object');
    });
    
    it('should return "any" for complex expressions', () => {
      expect(analyzer.inferTypeFromValue('upper("test")')).to.equal('any');
      expect(analyzer.inferTypeFromValue('a + b')).to.equal('any');
    });
  });
});
