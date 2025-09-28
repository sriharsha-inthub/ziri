import { ESQLASTAnalyzer } from './lib/metadata/esql-ast-analyzer.js';

function debugESQLRelationships() {
  const analyzer = new ESQLASTAnalyzer();
  
  const ast = {
    body: [
      {
        type: 'FunctionDeclaration',
        name: 'CallerFunc',
        body: 'CALL TargetFunc(); SET result = ComputeFunc(1, 2);',
        location: { start: {}, end: {} }
      }
    ]
  };
  
  console.log('Analyzing relationships...');
  const relationships = analyzer.analyzeRelationships(ast);
  console.log('Relationships found:', JSON.stringify(relationships, null, 2));
  
  // Let's also test the regex directly
  const body = 'CALL TargetFunc(); SET result = ComputeFunc(1, 2);';
  console.log('\nTesting regex on body:', body);
  const callRegex = /\b(CALL|SET)\s+([A-Za-z0-9_.]+)\s*\(/g;
  let match;
  while ((match = callRegex.exec(body)) !== null) {
    console.log('Match found:', match);
  }
}

debugESQLRelationships();