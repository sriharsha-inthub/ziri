/**
 * Unit tests for Mulesoft XML AST Analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MulesoftASTAnalyzer } from '../../lib/metadata/mulesoft-ast-analyzer.js';
import { XmlHelpers } from '../../lib/metadata/xml-ast-analyzer.js';

describe('MulesoftASTAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new MulesoftASTAnalyzer();
  });
  
  describe('parse', () => {
    it('should parse valid Mulesoft XML content', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd">
        
  <http:listener-config name="HTTP_Listener_config" doc:name="HTTP Listener config">
    <http:listener-connection host="0.0.0.0" port="8081" />
  </http:listener-config>

  <flow name="testFlow" doc:name="testFlow">
    <http:listener config-ref="HTTP_Listener_config" path="/test" doc:name="Listener" />
    <logger level="INFO" message="Request received" doc:name="Logger" />
    <set-payload value="#[output application/json --- {message: 'Hello world'}]" doc:name="Set Payload" />
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      
      expect(ast).to.be.an('object');
      expect(ast.mule).to.exist;
    });
    
    it('should handle invalid XML gracefully', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="brokenFlow">
    <!-- Missing closing tag -->
    <logger level="INFO" message="Test">
  </flow>
</mule>`;

      try {
        await analyzer.parse(content, 'broken.xml');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
  
  describe('isMulesoftXml', () => {
    it('should detect Mulesoft XML by namespace', () => {
      const ast = {
        mule: {},
        '@_xmlns:mule': 'http://www.mulesoft.org/schema/mule/core'
      };
      
      expect(analyzer.isMulesoftXml(ast)).to.be.true;
    });
    
    it('should return false for non-Mulesoft XML', () => {
      const ast = {
        root: {},
        '@_xmlns': 'http://other-namespace'
      };
      
      expect(analyzer.isMulesoftXml(ast)).to.be.false;
    });
  });
  
  describe('extractImports', () => {
    it('should extract config references', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http">
  <http:request-config name="HTTP_Request_config" />
  <flow name="testFlow">
    <http:request config-ref="HTTP_Request_config" path="/api" method="GET" />
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.be.an('array');
      const configRef = imports.find(imp => imp.type === 'config-reference');
      expect(configRef).to.exist;
      expect(configRef.module).to.equal('HTTP_Request_config');
    });
    
    it('should extract flow references', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="mainFlow">
    <flow-ref name="subFlow" />
  </flow>
  <sub-flow name="subFlow">
    <logger level="INFO" message="In subflow" />
  </sub-flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.be.an('array');
      const flowRef = imports.find(imp => imp.type === 'flow-reference');
      expect(flowRef).to.exist;
      expect(flowRef.module).to.equal('subFlow');
    });
    
    it('should extract DataWeave imports from transforms', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
  <flow name="transformFlow">
    <ee:transform>
      <ee:message>
        <ee:set-payload><![CDATA[%dw 2.0
import * from dw::core::Strings
output application/json
---
{
  upper: upper("hello")
}]]></ee:set-payload>
      </ee:message>
    </ee:transform>
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const imports = analyzer.extractImports(ast);
      
      expect(imports).to.be.an('array');
      const dwImport = imports.find(imp => imp.type === 'dataweave-import');
      expect(dwImport).to.exist;
      expect(dwImport.module).to.equal('dw::core::Strings');
    });
  });
  
  describe('extractFunctions', () => {
    it('should extract processors as functions', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http">
  <flow name="testFlow">
    <http:listener path="/api" doc:name="API Listener" />
    <logger level="INFO" message="Request received" doc:name="Log Request" />
    <set-payload value="#[{'message': 'Hello'}]" doc:name="Set Response" />
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.be.an('array');
      expect(functions.length).to.be.at.least(3);
      
      const httpListener = functions.find(fn => fn.type === 'http:listener');
      expect(httpListener).to.exist;
      expect(httpListener.name).to.equal('API Listener');
      
      const logger = functions.find(fn => fn.type === 'logger');
      expect(logger).to.exist;
      expect(logger.processorProperties).to.include({ 'level': 'INFO' });
      
      const setPayload = functions.find(fn => fn.type === 'set-payload');
      expect(setPayload).to.exist;
    });
    
    it('should extract DataWeave transformations with code', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
  <flow name="transformFlow">
    <ee:transform doc:name="Transform Message">
      <ee:message>
        <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
  "transformed": true
}]]></ee:set-payload>
      </ee:message>
    </ee:transform>
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const functions = analyzer.extractFunctions(ast);
      
      expect(functions).to.be.an('array');
      const transform = functions.find(fn => fn.type === 'ee:transform');
      expect(transform).to.exist;
      expect(transform.dataWeave).to.include('%dw 2.0');
      expect(transform.dataWeave).to.include('output application/json');
    });
  });
  
  describe('extractClasses', () => {
    it('should extract flows as classes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="mainFlow">
    <logger level="INFO" message="Step 1" doc:name="Logger 1" />
    <logger level="INFO" message="Step 2" doc:name="Logger 2" />
    <logger level="INFO" message="Step 3" doc:name="Logger 3" />
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.be.an('array');
      expect(classes.length).to.be.at.least(1);
      expect(classes[0].name).to.equal('mainFlow');
      expect(classes[0].type).to.equal('flow');
      expect(classes[0].methods.length).to.equal(3);
    });
    
    it('should extract configurations as classes', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http">
  <http:listener-config name="HTTP_Listener_config" doc:name="HTTP Listener config">
    <http:listener-connection host="0.0.0.0" port="8081" />
  </http:listener-config>
  
  <http:request-config name="HTTP_Request_config" doc:name="HTTP Request config">
    <http:request-connection host="api.example.com" />
  </http:request-config>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const classes = analyzer.extractClasses(ast);
      
      expect(classes).to.be.an('array');
      expect(classes.length).to.be.at.least(2);
      
      const listenerConfig = classes.find(cls => cls.name === 'HTTP_Listener_config');
      expect(listenerConfig).to.exist;
      expect(listenerConfig.type).to.equal('configuration');
      
      const requestConfig = classes.find(cls => cls.name === 'HTTP_Request_config');
      expect(requestConfig).to.exist;
      expect(requestConfig.properties.length).to.be.greaterThan(0);
    });
  });
  
  describe('analyzeRelationships', () => {
    it('should extract flow references', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="mainFlow">
    <flow-ref name="subFlow1" />
    <flow-ref name="subFlow2" />
  </flow>
  <sub-flow name="subFlow1" />
  <sub-flow name="subFlow2" />
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      expect(relationships.length).to.be.at.least(2);
      
      const ref1 = relationships.find(rel => rel.to === 'subFlow1');
      expect(ref1).to.exist;
      expect(ref1.type).to.equal('flow-reference');
      expect(ref1.from).to.equal('mainFlow');
      
      const ref2 = relationships.find(rel => rel.to === 'subFlow2');
      expect(ref2).to.exist;
    });
    
    it('should extract config references', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http">
  <http:listener-config name="HTTP_Listener_config" />
  <flow name="apiFlow">
    <http:listener config-ref="HTTP_Listener_config" path="/api" />
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      const configRef = relationships.find(rel => rel.type === 'config-reference');
      expect(configRef).to.exist;
      expect(configRef.from).to.equal('apiFlow');
      expect(configRef.to).to.equal('HTTP_Listener_config');
    });
    
    it('should extract DataWeave relationships', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
  <flow name="transformFlow">
    <ee:transform>
      <ee:message>
        <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ "hello": "world" }]]></ee:set-payload>
      </ee:message>
    </ee:transform>
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      const relationships = analyzer.analyzeRelationships(ast);
      
      expect(relationships).to.be.an('array');
      const dwRel = relationships.find(rel => rel.type === 'dataweave');
      expect(dwRel).to.exist;
      expect(dwRel.from).to.equal('transformFlow');
    });
  });
  
  describe('extractDataWeaveCode', () => {
    it('should extract DataWeave code from transform components', () => {
      const transformNode = {
        'ee:message': {
          'ee:set-payload': '%dw 2.0\noutput application/json\n---\n{"hello": "world"}'
        }
      };
      
      const code = analyzer.extractDataWeaveCode(transformNode);
      expect(code).to.include('%dw 2.0');
      expect(code).to.include('output application/json');
      expect(code).to.include('{"hello": "world"}');
    });
    
    it('should extract DataWeave code from variables', () => {
      const transformNode = {
        'ee:variables': {
          'ee:set-variable': [
            {
              '@_name': 'var1',
              '#text': '%dw 2.0\n---\n"value1"'
            },
            {
              '@_name': 'var2',
              '#text': '%dw 2.0\n---\n"value2"'
            }
          ]
        }
      };
      
      const code = analyzer.extractDataWeaveCode(transformNode);
      expect(code).to.include('value1');
      expect(code).to.include('value2');
    });
  });
  
  describe('findParentFlow', () => {
    it('should find parent flow from path', async () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="parentFlow">
    <logger level="INFO" message="Test" />
  </flow>
</mule>`;

      const ast = await analyzer.parse(content, 'test.xml');
      
      // Simulate a path that would come from traverseNodes
      const path = ['mule', 'flow', 'logger'];
      
      const parentFlow = analyzer.findParentFlow(path, ast);
      expect(parentFlow).to.equal('parentFlow');
    });
    
    it('should return null when no parent flow exists', () => {
      const ast = {
        root: {
          element: {}
        }
      };
      
      const path = ['root', 'element'];
      
      const parentFlow = analyzer.findParentFlow(path, ast);
      expect(parentFlow).to.be.null;
    });
  });
});
