import { MulesoftASTAnalyzer } from './lib/metadata/mulesoft-ast-analyzer.js';

async function debugTest() {
  const analyzer = new MulesoftASTAnalyzer();
  
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
  console.log('AST structure:', JSON.stringify(ast, null, 2));
  console.log('isMulesoftXml result:', analyzer.isMulesoftXml(ast));
  
  // Let's check what the analyzeRelationships method returns
  const relationships = analyzer.analyzeRelationships(ast);
  console.log('Relationships count:', relationships.length);
  console.log('Relationships:', JSON.stringify(relationships, null, 2));
}

debugTest().catch(console.error);