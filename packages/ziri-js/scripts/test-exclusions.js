// Quick test to verify exclusion patterns
const EX = [
  '**/node_modules/**',
  '**/.git/**',
  '.git/**',  // Also match .git at root
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.cache/**',
  '**/coverage/**',
  '**/tmp/**',
  '**/temp/**',
  '**/*.lock',
  '**/*.min.*',
  '**/*.bin',
  '**/*.exe',
  '**/*.dll',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.mp4',
  '**/*.zip',
  '**/*.gz',
  '**/*.tar',
  '**/*.rar',
  '**/*.7z',
  '**/.DS_Store',
  '**/Thumbs.db'
];

function toRx(g){ 
  // First replace ** with a placeholder to avoid conflicts
  let s = g.replace(/\*\*/g, '__DOUBLESTAR__');
  // Replace single * with placeholder
  s = s.replace(/\*/g, '__SINGLESTAR__');
  // Escape special regex characters
  s = s.replace(/[.+^${}()|[\]\\]/g, '\\$&'); 
  // Convert glob patterns to regex
  s = s.replace(/__DOUBLESTAR__/g, '.*').replace(/__SINGLESTAR__/g, '[^/]*').replace(/\?/g, '.'); 
  return new RegExp('^' + s + '$'); 
}

const RX = EX.map(toRx);

// Test cases
const testPaths = [
  '.git/config',
  '.git/hooks/commit-msg.sample',
  'src/main.js',
  'node_modules/react/index.js',
  'dist/bundle.js',
  'package.json'
];

console.log('Testing exclusion patterns:');
console.log('Generated regexes:');
RX.forEach((r, i) => console.log(`${EX[i]} -> ${r}`));
console.log('\nTesting paths:');
testPaths.forEach(path => {
  const excluded = RX.some(r => r.test(path));
  console.log(`${path}: ${excluded ? 'EXCLUDED' : 'INCLUDED'}`);
  
  // Debug: test specific patterns
  if (path.includes('.git')) {
    const gitRegex = RX[1]; // **/.git/**
    console.log(`  .git regex test: ${gitRegex.test(path)} (${gitRegex})`);
  }
});