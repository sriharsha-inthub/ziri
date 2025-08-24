#!/usr/bin/env node

// Simple test to verify CLI integration works
import { main } from './packages/ziri-js/lib/cli.js';

// Mock process.argv for testing
const originalArgv = process.argv;
process.argv = ['node', 'ziri', '--help'];

try {
  await main();
  console.log('\n✅ CLI integration test passed');
} catch (error) {
  console.error('❌ CLI integration test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
} finally {
  process.argv = originalArgv;
}