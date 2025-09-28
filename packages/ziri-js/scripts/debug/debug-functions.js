import { DWLASTAnalyzer } from './lib/metadata/dwl-ast-analyzer.js';

const analyzer = new DWLASTAnalyzer();

const content = `%dw 2.0
fun processArray(arr: Array<Any>) = 
  arr map (item, index) -> {
    value: item,
    position: index,
    isLast: index == sizeOf(arr) - 1
  }
`;

console.log('Content:');
console.log(content);

const functions = analyzer.parseFunctions(content);

console.log('\nParsed functions:');
console.log(JSON.stringify(functions, null, 2));