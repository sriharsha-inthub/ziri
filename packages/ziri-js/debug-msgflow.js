import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';

async function testMsgflowParsing() {
  const analyzer = new MsgflowASTAnalyzer();
  
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

  try {
    console.log('Parsing XML content...');
    const ast = await analyzer.parse(content, 'test.msgflow');
    console.log('AST parsed successfully:', JSON.stringify(ast, null, 2));
    
    console.log('\nChecking AST structure:');
    console.log('ast exists:', !!ast);
    console.log('ast.ecore exists:', !!ast?.ecore);
    console.log('ast.ecore.eClassifiers exists:', !!ast?.ecore?.eClassifiers);
    
  } catch (error) {
    console.error('Error parsing XML:', error);
  }
}

testMsgflowParsing().catch(console.error);