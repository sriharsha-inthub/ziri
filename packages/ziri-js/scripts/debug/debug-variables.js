import { DWLASTAnalyzer } from './lib/metadata/dwl-ast-analyzer.js';

const analyzer = new DWLASTAnalyzer();

const content = `%dw 2.0
var person = {
  name: "John",
  age: 30,
  address: {
    street: "Main St",
    city: "Anytown"
  }
}
`;

console.log('Content:');
console.log(content);

const variables = analyzer.parseVariables(content);

console.log('\nParsed variables:');
console.log(JSON.stringify(variables, null, 2));