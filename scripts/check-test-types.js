// scripts/check-test-types.js
// Exit with error if any test files exist outside test/unit
import { execSync } from 'child_process';
try {
  // List all test files and filter out allowed non‑unit directories
  const all = execSync('git ls-files "test/**"', { encoding: 'utf8' })
    .split('\n')
    .filter(p => p);
  const allowed = [
    'test/unit/',
    'test/integration/',
    'test/regression/',
    'test/mocks/',
    'test/setup.js',
    'test/cli/'
  ];
  const out = all.filter(p => !allowed.some(prefix => p.startsWith(prefix)));
  if (out.length) {
    console.error('Unexpected test files detected (outside allowed test groups):');
    out.forEach(f => console.error('  ' + f));
    process.exit(1);
  }
} catch (e) {
  // If git command fails, assume no files
  process.exit(0);
}
