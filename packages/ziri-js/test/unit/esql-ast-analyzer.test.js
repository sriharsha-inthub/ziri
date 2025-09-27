/**
 * Unit tests for IBM ACE ESQL AST Analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ESQLASTAnalyzer } from '../../lib/metadata/esql-ast-analyzer.js';

describe('ESQLASTAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new ESQLASTAnalyzer();
  });
  
  describe('parse', () => {
    it('should parse valid ESQL content', async () => {
      const content = `
      BROKER SCHEMA com.example
      
      CREATE MODULE SampleModule
        CREATE FUNCTION Transform() RETURNS BOOLEAN
        BEGIN
          DECLARE OutputRoot REFERENCE TO OutputRoot;
          SET OutputRoot = InputRoot;
          RETURN TRUE;
        END;
      END MODULE;
      `;

      const ast = await analyzer.parse(content, 'sample.esql');
      
      expect(ast).to.be.an('object');
      expect(ast.type).to.equal('Program');
      expect(ast.body).to.be.an('array');
      expect(ast.body.length).to.be.greaterThan(0);
    });
    
    it('should handle invalid ESQL gracefully', async () => {
      const content = `
      CREATE MODULE BrokenModule
        CREATE FUNCTION MissingEnd() RETURNS BOOLEAN
        BEGIN
          DECLARE OutputRoot REFERENCE TO OutputRoot;
          SET OutputRoot = InputRoot;
          RETURN TRUE;
        -- Missing END keyword
      END MODULE;
      `;

      const ast = await analyzer.parse(content, 'broken.esql');
      
      // Even with errors, we should get a partial AST
      expect(ast).to.be.an('object');
      expect(ast.type).to.equal('Program');
    });
  });
  
  describe('parseModules', () => {
    it('should extract modules from ESQL content', () => {
      const content = `
      CREATE MODULE FirstModule
        -- Module contents
      END MODULE;
      
      CREATE MODULE SecondModule
        -- Module contents
      END MODULE;
      `;
      
      const modules = analyzer.parseModules(content);
      
      expect(modules).to.be.an('array');
      expect(modules.length).to.equal(2);
      expect(modules[0].name).to.equal('FirstModule');
      expect(modules[1].name).to.equal('SecondModule');
    });
    
    it('should extract module with PATH', () => {
      const content = `
      CREATE MODULE ModuleWithPath PATH com.example.path
        -- Module contents
      END MODULE;
      `;
      
      const modules = analyzer.parseModules(content);
      
      expect(modules).to.be.an('array');
      expect(modules.length).to.equal(1);
      expect(modules[0].name).to.equal('ModuleWithPath');
      expect(modules[0].path).to.equal('com.example.path');
    });
  });
  
  describe('parseFunctions', () => {
    it('should extract functions from ESQL content', () => {
      const content = `
      CREATE FUNCTION SimpleFunction() RETURNS BOOLEAN
      BEGIN
        RETURN TRUE;
      END;
      
      CREATE FUNCTION ComplexFunction(IN param1 INTEGER, OUT param2 CHAR)
      BEGIN
        SET param2 = CAST(param1 AS CHAR);
      END;
      `;
      
      const functions = analyzer.parseFunctions(content);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(2);
      expect(functions[0].name).to.equal('SimpleFunction');
      expect(functions[0].returnType).to.equal('BOOLEAN');
      expect(functions[1].name).to.equal('ComplexFunction');
      expect(functions[1].params.length).to.equal(2);
    });
  });
  
  describe('parseProcedures', () => {
    it('should extract procedures from ESQL content', () => {
      const content = `
      CREATE PROCEDURE SimpleProcedure()
      BEGIN
        DECLARE temp INT 1;
        SET temp = temp + 1;
      END;
      
      CREATE PROCEDURE ProcedureWithParams(IN inputParam CHAR, OUT outputParam INT)
      BEGIN
        SET outputParam = LENGTH(inputParam);
      END PROCEDURE;
      `;
      
      const procedures = analyzer.parseProcedures(content);
      
      expect(procedures).to.be.an('array');
      expect(procedures.length).to.equal(2);
      expect(procedures[0].name).to.equal('SimpleProcedure');
      expect(procedures[1].name).to.equal('ProcedureWithParams');
      expect(procedures[1].params.length).to.equal(2);
      expect(procedures[1].params[0].direction).to.equal('IN');
      expect(procedures[1].params[1].direction).to.equal('OUT');
    });
  });
  
  describe('parseDeclarations', () => {
    it('should extract variable declarations', () => {
      const content = `
      DECLARE var1 INTEGER 1;
      DECLARE var2 CHAR 'test';
      DECLARE refVar REFERENCE TO Root;
      `;
      
      const declarations = analyzer.parseDeclarations(content);
      
      expect(declarations).to.be.an('array');
      expect(declarations.length).to.equal(3);
      expect(declarations[0].name).to.equal('var1');
      expect(declarations[0].dataType).to.equal('INTEGER');
      expect(declarations[1].name).to.equal('var2');
      expect(declarations[1].dataType).to.equal('CHAR');
      expect(declarations[2].name).to.equal('refVar');
      expect(declarations[2].dataType).to.equal('REFERENCE');
    });
  });
  
  describe('extractImports', () => {
    it('should extract BROKER SCHEMA statements', () => {
      const content = `
      BROKER SCHEMA com.example.schema
      
      CREATE MODULE SampleModule
        -- Module contents
      END MODULE;
      `;
      
      analyzer.content = content;
      const ast = { type: 'Program', body: [] };
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(1);
      expect(imports[0].type).to.equal('broker-schema');
      expect(imports[0].module).to.equal('com.example.schema');
    });
    
    it('should extract DECLARE NAMESPACE statements', () => {
      const content = `
      DECLARE NAMESPACE ns1 AS 'http://example.com/ns1';
      DECLARE NAMESPACE ns2 AS 'http://example.com/ns2';
      
      CREATE MODULE SampleModule
        -- Module contents
      END MODULE;
      `;
      
      analyzer.content = content;
      const ast = { type: 'Program', body: [] };
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.be.an('array');
      expect(imports.length).to.equal(2);
      expect(imports[0].type).to.equal('namespace');
      expect(imports[0].name).to.equal('ns1');
      expect(imports[0].module).to.equal('http://example.com/ns1');
      expect(imports[1].name).to.equal('ns2');
    });
  });
  
  describe('extractFunctions', () => {
    it('should extract functions and procedures from AST', () => {
      const ast = {
        body: [
          {
            type: 'ModuleDeclaration',
            name: 'TestModule',
            body: [
              {
                type: 'FunctionDeclaration',
                name: 'Func1',
                params: [{ name: 'param1', type: 'INTEGER' }],
                returnType: 'BOOLEAN',
                body: 'RETURN TRUE;'
              },
              {
                type: 'ProcedureDeclaration',
                name: 'Proc1',
                params: [],
                body: 'SET var = 1;'
              }
            ]
          },
          {
            type: 'FunctionDeclaration',
            name: 'StandaloneFunc',
            params: [],
            returnType: 'INTEGER',
            body: 'RETURN 42;'
          }
        ]
      };
      
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.equal(3);
      
      // Functions should include module functions and standalone functions
      expect(functions[0].name).to.equal('Func1');
      expect(functions[0].className).to.equal('TestModule'); // Should include module name
      expect(functions[1].name).to.equal('Proc1');
      expect(functions[1].className).to.equal('TestModule');
      expect(functions[2].name).to.equal('StandaloneFunc');
      expect(functions[2].className).to.be.null;
    });
  });
  
  describe('extractClasses', () => {
    it('should extract modules as classes from AST', () => {
      const ast = {
        body: [
          {
            type: 'ModuleDeclaration',
            name: 'Module1',
            path: 'com.example.path',
            body: [
              {
                type: 'FunctionDeclaration',
                name: 'Func1',
                params: [],
                returnType: 'BOOLEAN'
              },
              {
                type: 'VariableDeclaration',
                name: 'Var1',
                dataType: 'INTEGER'
              }
            ]
          },
          {
            type: 'ModuleDeclaration',
            name: 'Module2',
            body: []
          }
        ]
      };
      
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.be.an('array');
      expect(classes.length).to.equal(2);
      expect(classes[0].name).to.equal('Module1');
      expect(classes[0].path).to.equal('com.example.path');
      expect(classes[0].methods.length).to.equal(1);
      expect(classes[0].properties.length).to.equal(1);
      expect(classes[1].name).to.equal('Module2');
    });
  });
  
  describe('analyzeRelationships', () => {
    it('should extract module path relationships', () => {
      const ast = {
        body: [
          {
            type: 'ModuleDeclaration',
            name: 'Module1',
            path: 'com.example.path',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      expect(relationships.length).to.equal(1);
      expect(relationships[0].type).to.equal('module-path');
      expect(relationships[0].from).to.equal('Module1');
      expect(relationships[0].to).to.equal('com.example.path');
    });
    
    it('should extract function call relationships', () => {
      const ast = {
        body: [
          {
            type: 'FunctionDeclaration',
            name: 'CallerFunc',
            body: 'CALL TargetFunc(); SET result = ComputeFunc(1, 2);',
            location: { start: {}, end: {} }
          }
        ]
      };
      
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      expect(relationships.length).to.be.at.least(2);
      
      const callRelationship = relationships.find(rel => rel.to === 'TargetFunc');
      expect(callRelationship).to.exist;
      expect(callRelationship.from).to.equal('CallerFunc');
      expect(callRelationship.callType).to.equal('CALL');
      
      const setRelationship = relationships.find(rel => rel.to === 'ComputeFunc');
      expect(setRelationship).to.exist;
      expect(setRelationship.from).to.equal('CallerFunc');
      expect(setRelationship.callType).to.equal('SET');
    });
  });
});
