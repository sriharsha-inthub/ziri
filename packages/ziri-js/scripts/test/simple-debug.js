// Simple debug script
console.log('Starting simple debug script');

import { parse } from '@babel/parser';

// Simple JS code to parse
const code = `
  function hello(name) {
    return "Hello, " + name;
  }
`;

try {
  console.log('Attempting to parse code...');
  const ast = parse(code, { 
    sourceType: 'module',
    plugins: []
  });
  console.log('Parsing successful!');
  console.log('AST type:', ast.type);
  console.log('Program body length:', ast.program.body.length);
  
  // Try to load traverse dynamically
  console.log('\nAttempting to import @babel/traverse...');
  import('@babel/traverse').then(traverseModule => {
    console.log('Traverse imported successfully!');
    const traverse = traverseModule.default || traverseModule;
    console.log('Traverse type:', typeof traverse);
    
    try {
      console.log('\nAttempting direct traversal...');
      traverse(ast, {
        FunctionDeclaration(path) {
          console.log('Found function:', path.node.id.name);
        }
      });
      console.log('Traversal successful!');
    } catch (traverseError) {
      console.log('Error during traversal:', traverseError.message);
      console.log(traverseError.stack);
    }
  }).catch(importError => {
    console.log('Error importing traverse:', importError.message);
    console.log(importError.stack);
  });
  
} catch (parseError) {
  console.log('Error during parsing:', parseError.message);
  console.log(parseError.stack);
}
