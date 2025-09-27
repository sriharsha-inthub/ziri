/**
 * Integration tests for AST analyzers
 */

import { describe, it, expect } from 'vitest';
import { ASTCodeAnalyzer } from '../../lib/metadata/ast-code-analyzer.js';

describe('AST Analyzers Integration', () => {
  describe('IBM ACE msgflow', () => {
    it('should analyze msgflow files', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:ComIbmCompute.msgnode="ComIbmCompute.msgnode" xmlns:ComIbmMQInput.msgnode="ComIbmMQInput.msgnode" xmlns:ComIbmMQOutput.msgnode="ComIbmMQOutput.msgnode">
  <eClassifiers name="SampleFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="MQInput" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmMQInput.msgnode:FCMComposite" queue="INPUT.QUEUE" />
    </eStructuralFeatures>
    <eStructuralFeatures name="ComputeNode" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmCompute.msgnode:FCMComposite">
        <computeExpression esql="SampleModule">
          SET OutputRoot = InputRoot;
        </computeExpression>
      </eType>
    </eStructuralFeatures>
    <eStructuralFeatures name="MQOutput" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmMQOutput.msgnode:FCMComposite" queue="OUTPUT.QUEUE" />
    </eStructuralFeatures>
    <connections sourceNode="MQInput" targetNode="ComputeNode" />
    <connections sourceNode="ComputeNode" targetNode="MQOutput" />
  </eClassifiers>
</ecore:EPackage>`;

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'msgflow', 'flow.msgflow');
      
      expect(result.type).to.equal('class');
      expect(result.classes.length).to.be.at.least(1);
      expect(result.functions.length).to.be.at.least(2);
      expect(result.relationships.length).to.be.at.least(2);
    });
  });
  
  describe('IBM ACE ESQL', () => {
    it('should analyze ESQL files', async () => {
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

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'esql', 'module.esql');
      
      expect(result.type).to.equal('class');
      expect(result.classes.length).to.equal(1);
      expect(result.classes[0].name).to.equal('SampleModule');
      expect(result.functions.length).to.equal(1);
      expect(result.functions[0].name).to.equal('Transform');
    });
  });
  
  describe('Mulesoft XML', () => {
    it('should analyze Mulesoft XML files', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http">
  <http:listener-config name="HTTP_Listener_config" />
  <flow name="testFlow">
    <http:listener config-ref="HTTP_Listener_config" path="/api" />
    <logger level="INFO" message="Request received" />
    <set-payload value="#[{'message': 'Hello'}]" />
  </flow>
</mule>`;

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'mulesoft', 'mule-config.xml');
      
      expect(result.type).to.equal('class');
      expect(result.classes.length).to.be.at.least(1);
      expect(result.classes[0].name).to.equal('testFlow');
      expect(result.functions.length).to.be.at.least(2);
    });
  });
  
  describe('DataWeave Language', () => {
    it('should analyze DWL files', async () => {
      const content = `%dw 2.0
import * from dw::core::Strings
var greeting = "Hello"
fun formatGreeting(name) = greeting ++ ", " ++ name ++ "!"
output application/json
---
{
  message: formatGreeting("World")
}`;

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'dwl', 'transform.dwl');
      
      expect(result.type).to.equal('function');
      expect(result.imports.length).to.equal(1);
      expect(result.functions.length).to.be.at.least(1);
      // main expression also counts as a function
      const mainFn = result.functions.find(fn => fn.type === 'main-expression');
      expect(mainFn).to.exist;
    });
  });
  
  describe('Multiple file types detection', () => {
    it('should properly detect msgflow files', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers instanceClassName="MessageFlow">
  </eClassifiers>
</ecore:EPackage>`;

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'xml', 'flow.msgflow');
      expect(result.type).not.to.equal('unknown');
    });
    
    it('should properly detect ESQL files', async () => {
      const content = `CREATE MODULE TestModule BEGIN END MODULE;`;
      const result = await ASTCodeAnalyzer.analyzeCode(content, 'unknown', 'file.esql');
      expect(result.type).not.to.equal('unknown');
    });
    
    it('should properly detect Mulesoft files', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
</mule>`;

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'xml', 'config.xml');
      expect(result.type).not.to.equal('unknown');
    });
    
    it('should properly detect DWL files', async () => {
      const content = `%dw 2.0
output application/json
---
{ "hello": "world" }`;

      const result = await ASTCodeAnalyzer.analyzeCode(content, 'unknown', 'transform.dwl');
      expect(result.type).not.to.equal('unknown');
    });
  });
  
  describe('Error handling', () => {
    it('should gracefully handle malformed msgflow XML', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers instanceClassName="MessageFlow">
    <unclosed>
  </eClassifiers>
</ecore:EPackage>`;

      try {
        const result = await ASTCodeAnalyzer.analyzeCode(content, 'msgflow', 'broken.msgflow');
        // Should fall back to regex-based analysis
        expect(result).to.exist;
      } catch (error) {
        expect.fail('Should not throw an error but fall back to regex-based analysis');
      }
    });
    
    it('should gracefully handle malformed ESQL', async () => {
      const content = `
      CREATE MODULE BrokenModule
        CREATE FUNCTION MissingEnd()
        BEGIN
          -- Missing END keyword
      `;

      try {
        const result = await ASTCodeAnalyzer.analyzeCode(content, 'esql', 'broken.esql');
        // Should either parse partially or fall back to regex-based analysis
        expect(result).to.exist;
      } catch (error) {
        expect.fail('Should not throw an error but fall back to regex-based analysis');
      }
    });
  });
});
