// Test basic imports
try {
  console.log('Testing imports...');
  
  // Test basic Node.js functionality
  console.log('✅ Node.js working');
  
  // Test minimist import
  const minimist = await import('minimist');
  console.log('✅ minimist imported');
  
  // Test our CLI import
  const cli = await import('./packages/ziri-js/lib/cli.js');
  console.log('✅ CLI module imported');
  
  console.log('All imports successful!');
} catch (error) {
  console.error('❌ Import failed:', error.message);
  console.error(error.stack);
}