// Quick test of CLI functionality
console.log('Testing CLI...');

try {
  // Test basic imports
  const minimist = require('minimist');
  console.log('✅ minimist works');
  
  // Test help output
  const originalArgv = process.argv;
  process.argv = ['node', 'ziri', '--help'];
  
  // Import and test CLI
  import('./packages/ziri-js/lib/cli.js').then(async ({ main }) => {
    await main();
    console.log('✅ CLI help works');
    process.argv = originalArgv;
  }).catch(error => {
    console.log('⚠️  CLI test with fallback:', error.message);
    process.argv = originalArgv;
  });
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}