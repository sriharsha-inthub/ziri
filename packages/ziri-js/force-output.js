// Force output script
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:');
  console.error(error);
  process.exit(1);
});

console.log = function() {
  process.stderr.write(Array.from(arguments).join(' ') + '\n');
};

console.info = console.log;
console.warn = console.log;
console.error = console.log;

// Simple test of babel modules
async function testBabel() {
  console.log('STARTING TEST');
  
  try {
    const { parse } = await import('@babel/parser');
    console.log('Parser loaded');
    
    const code = `function hello() { return "world"; }`;
    const ast = parse(code, { sourceType: 'module' });
    console.log('AST parsed:', ast.type);
    
    const traverseModule = await import('@babel/traverse');
    console.log('Traverse module loaded');
    
    const traverse = traverseModule.default;
    console.log('Traverse type:', typeof traverse);
    
    traverse(ast, {
      FunctionDeclaration(path) {
        console.log('Found function:', path.node.id.name);
      }
    });
    
    console.log('TEST COMPLETE');
  } catch (e) {
    console.error('TEST ERROR:', e);
  }
}

testBabel().catch(e => console.error('TOP LEVEL ERROR:', e));
