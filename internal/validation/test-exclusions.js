// Quick test to verify exclusion patterns
const EX = [
  '**/node_modules/**',
  '**/.git/**',
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
  let s = g.replace(/[.+^${}()|[\]\\]/g, '\\$&'); 
  s = s.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.'); 
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
testPaths.forEach(path => {
  const excluded = RX.some(r => r.test(path));
  console.log(`${path}: ${excluded ? 'EXCLUDED' : 'INCLUDED'}`);
});