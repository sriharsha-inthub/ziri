(async () => {
  try {
    console.log('========== START ==========');
    
    // First test basic parser
    console.log('Testing @babel/parser...');
    const { parse } = await import('@babel/parser');
    if (parse) {
      console.log('@babel/parser loaded successfully');
    }
    
    // Test simple parsing
    const jsCode = `
      function greet(name) {
        return "Hello, " + name;
      }
    `;
    
    const ast = parse(jsCode, {
      sourceType: 'module'
    });
    console.log('AST parsed successfully:', ast.type);
    
    // Now test traverse
    console.log('\nTesting @babel/traverse...');
    const traverseModule = await import('@babel/traverse');
    console.log('traverseModule type:', typeof traverseModule);
    console.log('traverseModule has default:', !!traverseModule.default);
    
    const traverse = traverseModule.default || traverseModule;
    console.log('traverse type:', typeof traverse);
    
    // Test traversal
    console.log('\nTesting traversal...');
    const functions = [];
    
    traverse(ast, {
      FunctionDeclaration(path) {
        console.log('Found function:', path.node.id?.name);
        functions.push(path.node.id?.name);
      }
    });
    
    console.log('Found functions:', functions);
    
    // Now test our own module
    console.log('\nTesting AST Code Analyzer...');
    const { ASTCodeAnalyzer } = await import('./lib/metadata/ast-code-analyzer.js');
    
    console.log('Calling analyze...');
    const result = await ASTCodeAnalyzer.analyzeCode(jsCode, 'javascript', 'test.js');
    
    console.log('Analysis result:');
    console.log('- type:', result.type);
    console.log('- functions:', result.functions.length);
    console.log('- classes:', result.classes.length);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  }
})();
