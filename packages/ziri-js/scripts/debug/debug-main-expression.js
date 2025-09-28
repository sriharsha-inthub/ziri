import { DWLASTAnalyzer } from './lib/metadata/dwl-ast-analyzer.js';

const analyzer = new DWLASTAnalyzer();

// Test case 1: Main expression after directive sections
const content1 = `%dw 2.0
import * from dw::core::Strings
var greeting = "Hello"

output application/json
---
{
  message: greeting ++ ", World!"
}`;

console.log('Content 1:');
console.log(content1);

const mainExpression1 = analyzer.parseMainExpression(content1);

console.log('\nParsed main expression 1:');
console.log(JSON.stringify(mainExpression1, null, 2));

// Test case 2: Main expression with no other declarations
const content2 = `%dw 2.0
output application/json
---
"Hello, World!"`;

console.log('\n\nContent 2:');
console.log(content2);

const mainExpression2 = analyzer.parseMainExpression(content2);

console.log('\nParsed main expression 2:');
console.log(JSON.stringify(mainExpression2, null, 2));

// Test case 3: No main expression
const content3 = `%dw 2.0
// Just imports and functions, no main expression
import * from dw::core::Strings
fun greet(name) = "Hello, " ++ name`;

console.log('\n\nContent 3:');
console.log(content3);

const mainExpression3 = analyzer.parseMainExpression(content3);

console.log('\nParsed main expression 3:');
console.log(JSON.stringify(mainExpression3, null, 2));