import { MsgflowASTAnalyzer } from './lib/metadata/msgflow-ast-analyzer.js';
import { XmlHelpers } from './lib/metadata/xml-ast-analyzer.js';

async function debugMsgflowTraversal() {
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
    
    console.log('\nTraversing nodes to see what gets visited:');
    analyzer.traverseNodes(ast, (node, path) => {
      // Check for MessageSet references
      if (XmlHelpers.hasAttr(node, 'messageSet') || XmlHelpers.hasAttr(node, 'messageSetProperty')) {
        const messageSet = XmlHelpers.getAttr(node, 'messageSet') || XmlHelpers.getAttr(node, 'messageSetProperty');
        console.log(`Found messageSet at path: ${JSON.stringify(path)}`);
        console.log(`  messageSet value: ${messageSet}`);
        console.log(`  node: ${JSON.stringify(node)}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMsgflowTraversal().catch(console.error);