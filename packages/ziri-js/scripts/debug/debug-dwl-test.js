import { DWLASTAnalyzer } from './lib/metadata/dwl-ast-analyzer.js';

async function debugTest() {
  const analyzer = new DWLASTAnalyzer();
  
  const content = `%dw 2.0
type Person = {
  name: String,
  age: Number,
  address?: {
    street: String,
    city: String,
    zip: String
  }
}
`;
  
  console.log('Content lines:');
  content.split('\n').forEach((line, i) => console.log(`${i+1}: ${JSON.stringify(line)}`));
  
  const types = analyzer.parseTypes(content);
  console.log('Types:', JSON.stringify(types, null, 2));
}

debugTest().catch(console.error);