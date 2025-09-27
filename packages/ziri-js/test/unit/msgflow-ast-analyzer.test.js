/**
 * Unit tests for IBM ACE Message Flow AST Analyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MsgflowASTAnalyzer } from '../../lib/metadata/msgflow-ast-analyzer.js';
import { XmlHelpers } from '../../lib/metadata/xml-ast-analyzer.js';

describe('MsgflowASTAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new MsgflowASTAnalyzer();
  });
  
  describe('parse', () => {
    it('should parse valid msgflow XML content', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:ComIbmCompute.msgnode="ComIbmCompute.msgnode" xmlns:ComIbmMQInput.msgnode="ComIbmMQInput.msgnode" xmlns:ComIbmMQOutput.msgnode="ComIbmMQOutput.msgnode">
  <eClassifiers name="SampleFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="MQInput" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmMQInput.msgnode:FCMComposite" queue="INPUT.QUEUE" connection="CLIENT" messageDomainProperty="XMLNSC" />
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

      const ast = await analyzer.parse(content, 'test.msgflow');
      
      expect(ast).to.be.an('object');
      expect(ast.ecore).to.be.an('object');
      expect(ast.ecore.eClassifiers).to.exist;
    });
    
    it('should handle invalid XML gracefully', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage>
  <eClassifiers name="BrokenFlow" instanceClassName="MessageFlow">
    <!-- Missing closing tag -->
    <eStructuralFeatures name="MQInput" lowerBound="1" upperBound="1">
  </eClassifiers>
</ecore:EPackage>`;

      try {
        await analyzer.parse(content, 'broken.msgflow');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
  
  describe('extractImports', () => {
    it('should extract message set imports', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="MQInput" messageSetProperty="TEST.MESSAGE.SET" />
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.have.lengthOf(1);
      expect(imports[0].type).to.equal('message-set');
      expect(imports[0].module).to.equal('TEST.MESSAGE.SET');
    });
    
    it('should extract subflow imports', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="SubflowInput" subflowName="CommonSubflow" />
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.have.lengthOf(1);
      expect(imports[0].type).to.equal('subflow');
      expect(imports[0].module).to.equal('CommonSubflow');
    });
  });
  
  describe('extractFunctions', () => {
    it('should extract compute nodes as functions', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:ComIbmCompute.msgnode="ComIbmCompute.msgnode">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="Transform" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmCompute.msgnode:FCMComposite">
        <computeExpression esql="TransformationModule">
          SET OutputRoot = InputRoot;
        </computeExpression>
      </eType>
    </eStructuralFeatures>
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.have.lengthOf(1);
      expect(functions[0].name).to.equal('Transform');
      expect(functions[0].type).to.equal('ComIbmCompute.msgnode:FCMComposite');
      expect(functions[0].nodeProperties.esqlModule).to.equal('TransformationModule');
    });
    
    it('should extract MQ nodes as functions', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:ComIbmMQInput.msgnode="ComIbmMQInput.msgnode">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="MQInput" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmMQInput.msgnode:FCMComposite" queue="TEST.QUEUE" />
    </eStructuralFeatures>
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.have.lengthOf(1);
      expect(functions[0].name).to.equal('MQInput');
      expect(functions[0].type).to.equal('ComIbmMQInput.msgnode:FCMComposite');
      expect(functions[0].nodeProperties['@_queue']).to.equal('TEST.QUEUE');
    });
  });
  
  describe('extractClasses', () => {
    it('should extract message flows as classes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="OrderProcessingFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="Input" />
    <eStructuralFeatures name="Process" />
    <eStructuralFeatures name="Output" />
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.have.lengthOf(1);
      expect(classes[0].name).to.equal('OrderProcessingFlow');
      expect(classes[0].type).to.equal('MessageFlow');
      expect(classes[0].properties).to.have.lengthOf(3);
    });
    
    it('should extract subflows as classes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="ErrorHandlerSubflow" instanceClassName="Subflow">
    <eStructuralFeatures name="LogError" />
    <eStructuralFeatures name="SendNotification" />
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.have.lengthOf(1);
      expect(classes[0].name).to.equal('ErrorHandlerSubflow');
      expect(classes[0].type).to.equal('Subflow');
      expect(classes[0].properties).to.have.lengthOf(2);
    });
  });
  
  describe('analyzeRelationships', () => {
    it('should extract connections between nodes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="Input" />
    <eStructuralFeatures name="Process" />
    <eStructuralFeatures name="Output" />
    <connections sourceNode="Input" targetNode="Process" />
    <connections sourceNode="Process" targetNode="Output" />
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.have.lengthOf(2);
      expect(relationships[0].type).to.equal('connection');
      expect(relationships[0].from).to.equal('Input');
      expect(relationships[0].to).to.equal('Process');
      expect(relationships[1].from).to.equal('Process');
      expect(relationships[1].to).to.equal('Output');
    });
    
    it('should detect ESQL references', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:ComIbmCompute.msgnode="ComIbmCompute.msgnode">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="Transform" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmCompute.msgnode:FCMComposite">
        <computeExpression esql="TransformationModule">
          SET OutputRoot = InputRoot;
        </computeExpression>
      </eType>
    </eStructuralFeatures>
  </eClassifiers>
</ecore:EPackage>`;

      const ast = await analyzer.parse(content, 'test.msgflow');
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.have.lengthOf.at.least(1);
      const esqlRelationship = relationships.find(rel => rel.type === 'esql-reference');
      expect(esqlRelationship).to.exist;
      expect(esqlRelationship.to).to.equal('TransformationModule');
    });
  });
  
  describe('XmlHelpers', () => {
    it('should get attribute values correctly', () => {
      const node = {
        '@_name': 'TestNode',
        '@_queue': 'TEST.QUEUE',
        'child': { '@_type': 'test' }
      };
      
      expect(XmlHelpers.getAttr(node, 'name')).to.equal('TestNode');
      expect(XmlHelpers.getAttr(node, 'queue')).to.equal('TEST.QUEUE');
      expect(XmlHelpers.getAttr(node, 'missing', 'default')).to.equal('default');
    });
    
    it('should check for attribute existence', () => {
      const node = { '@_name': 'TestNode' };
      
      expect(XmlHelpers.hasAttr(node, 'name')).to.be.true;
      expect(XmlHelpers.hasAttr(node, 'missing')).to.be.false;
    });
    
    it('should get all attributes', () => {
      const node = {
        '@_name': 'TestNode',
        '@_type': 'test',
        'child': {}
      };
      
      const attrs = XmlHelpers.getAttrs(node);
      expect(attrs).to.deep.equal({
        name: 'TestNode',
        type: 'test'
      });
    });
  });
});
