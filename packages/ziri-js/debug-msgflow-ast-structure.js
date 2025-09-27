import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';

async function debugMsgflowASTStructure() {
  const analyzer = new MsgflowASTAnalyzer();
  
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="MQInput" messageSetProperty="TEST.MESSAGE.SET" />
  </eClassifiers>
</ecore:EPackage>`;

  try {
    console.log('Parsing XML content...');
    const ast = await analyzer.parse(content, 'test.msgflow');
    console.log('Full AST structure:');
    console.log(JSON.stringify(ast, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMsgflowASTStructure().catch(console.error);