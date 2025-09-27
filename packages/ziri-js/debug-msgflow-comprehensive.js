import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';

async function debugAllMsgflowExtractions() {
  const analyzer = new MsgflowASTAnalyzer();
  
  // Test case 1: Function extraction with ComputeNode
  console.log('=== Test 1: Function extraction with ComputeNode ===');
  const computeContent = `<?xml version="1.0" encoding="UTF-8"?>
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

  try {
    const ast = await analyzer.parse(computeContent, 'test.msgflow');
    console.log('AST parsed successfully');
    
    console.log('\nExtracting functions...');
    const functions = analyzer.extractFunctions(ast);
    console.log('Functions extracted:', JSON.stringify(functions, null, 2));
    
    console.log('\nAnalyzing relationships...');
    const relationships = analyzer.analyzeRelationships(ast);
    console.log('Relationships extracted:', JSON.stringify(relationships, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test case 2: Class extraction
  console.log('\n\n=== Test 2: Class extraction ===');
  const classContent = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore">
  <eClassifiers name="OrderProcessingFlow" instanceClassName="MessageFlow">
    <eStructuralFeatures name="Input" />
    <eStructuralFeatures name="Process" />
    <eStructuralFeatures name="Output" />
  </eClassifiers>
</ecore:EPackage>`;

  try {
    const ast2 = await analyzer.parse(classContent, 'test.msgflow');
    console.log('AST parsed successfully');
    
    console.log('\nExtracting classes...');
    const classes = analyzer.extractClasses(ast2);
    console.log('Classes extracted:', JSON.stringify(classes, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugAllMsgflowExtractions().catch(console.error);