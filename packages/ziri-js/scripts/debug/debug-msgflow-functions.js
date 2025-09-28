import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';
import { XmlHelpers } from './lib/metadata/xml-ast-analyzer.js';

async function debugMsgflowFunctions() {
  const analyzer = new MsgflowASTAnalyzer();
  
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

  try {
    console.log('Parsing XML content...');
    const ast = await analyzer.parse(content, 'test.msgflow');
    console.log('AST parsed successfully');
    
    console.log('\nTraversing nodes to see what gets visited:');
    analyzer.traverseNodes(ast, (node, path) => {
      const nodeName = path[path.length - 1];
      const nodeType = typeof nodeName === 'string' ? nodeName : null;
      
      console.log(`Node at path: ${JSON.stringify(path)}`);
      console.log(`  nodeName: ${nodeName}`);
      console.log(`  nodeType: ${nodeType}`);
      
      if (nodeType && analyzer.nodeTypes.has(nodeType)) {
        console.log(`  *** MATCHED NODE TYPE: ${nodeType}`);
        const name = XmlHelpers.getAttr(node, 'name') || 
                     XmlHelpers.getAttr(node, 'id') || 
                     `anonymous_${nodeType}`;
        console.log(`  node name: ${name}`);
      }
      
      // Check for computeExpression
      if (nodeType === 'computeExpression') {
        console.log(`  *** FOUND COMPUTE EXPRESSION`);
        console.log(`  esql attr: ${XmlHelpers.getAttr(node, 'esql')}`);
        console.log(`  text content: ${XmlHelpers.getText(node)}`);
      }
    });
    
    console.log('\nExtracting functions...');
    const functions = analyzer.extractFunctions(ast);
    console.log('Functions extracted:', JSON.stringify(functions, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMsgflowFunctions().catch(console.error);