import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';

async function testMsgflowImports() {
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
    console.log('AST parsed successfully');
    
    console.log('\nChecking AST structure:');
    console.log('ast exists:', !!ast);
    console.log('ast.ecore exists:', !!ast?.ecore);
    console.log('ast.ecore.eClassifiers exists:', !!ast?.ecore?.eClassifiers);
    
    console.log('\nExtracting imports...');
    const imports = analyzer.extractImports(ast);
    console.log('Imports extracted:', JSON.stringify(imports, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testMsgflowImports().catch(console.error);