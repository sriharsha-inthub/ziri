#!/usr/bin/env node

// Test basic CLI functionality
async function testCLI() {
  try {
    console.log('Testing basic CLI imports...');
    
    // Test minimist
    const minimist = (await import('minimist')).default;
    console.log('✅ minimist imported');
    
    // Test basic home functions
    const { resolveHome } = await import('./packages/ziri-js/lib/home.js');
    console.log('✅ home functions imported');
    
    // Test registry functions
    const { getSources } = await import('./packages/ziri-js/lib/registry.js');
    console.log('✅ registry functions imported');
    
    console.log('✅ All basic imports successful!');
    
    // Test CLI help
    console.log('\nTesting CLI help...');
    const { main } = await import('./packages/ziri-js/lib/cli.js');
    
    // Mock argv for help
    const originalArgv = process.argv;
    process.argv = ['node', 'ziri', '--help'];
    
    await main();
    
    process.argv = originalArgv;
    console.log('✅ CLI help test passed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testCLI();