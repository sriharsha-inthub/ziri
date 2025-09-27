import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';

async function debugMQFunctionExtraction() {
  const analyzer = new MsgflowASTAnalyzer();
  
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" xmlns:ComIbmMQInput.msgnode="ComIbmMQInput.msgnode">
  <eClassifiers name="TestFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="MQInput" lowerBound="1" upperBound="1">
      <eType xsi:type="ComIbmMQInput.msgnode:FCMComposite" queue="TEST.QUEUE" />
    </eStructuralFeatures>
  </eClassifiers>
</ecore:EPackage>`;

  try {
    const ast = await analyzer.parse(content, 'test.msgflow');
    console.log('AST parsed successfully');
    
    console.log('\nExtracting functions...');
    const functions = analyzer.extractFunctions(ast);
    console.log('Functions extracted:', JSON.stringify(functions, null, 2));
    
    // Let's also check what XmlHelpers.getAttrs returns for the eType node
    if (ast.ecore && ast.ecore.eClassifiers && ast.ecore.eClassifiers.eStructuralFeatures) {
      const eStructuralFeatures = ast.ecore.eClassifiers.eStructuralFeatures;
      const eType = eStructuralFeatures.eType;
      console.log('\neType node:', JSON.stringify(eType, null, 2));
      console.log('\nXmlHelpers.getAttrs(eType):', JSON.stringify(XmlHelpers.getAttrs(eType), null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMQFunctionExtraction().catch(console.error);