import { DWLASTAnalyzer } from './lib/metadata/dwl-ast-analyzer.js';

const analyzer = new DWLASTAnalyzer();

const content = `%dw 2.0
type StringArray = Array<String>
type NumberMap = { [String]: Number }
`;

console.log('Content:');
console.log(content);

const types = analyzer.parseTypes(content);

console.log('\nParsed types:');
console.log(JSON.stringify(types, null, 2));