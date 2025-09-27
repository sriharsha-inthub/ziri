import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

async function test() {
  const jsCode = `
    function greet(name) {
      return 'Hello, ' + name + '!';
    }
  `;
  
  const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
  console.log('Functions:', JSON.stringify(result.functions, null, 2));
  console.log('CallGraph size:', result.callGraph.size);
  console.log('TypeInferences size:', result.typeInferences.size);
  console.log('VariableScopes size:', result.variableScopes.size);
  console.log('Relationships length:', result.relationships.length);
  console.log('First function params:', result.functions[0]?.params);
}

test().catch(console.error);
