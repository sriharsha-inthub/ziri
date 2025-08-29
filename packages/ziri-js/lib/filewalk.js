import fs from 'node:fs/promises';
import path from 'node:path';

const EX = [
  // Build/dependency directories
  '**/node_modules/**',
  'node_modules/**',
  '**/dist/**',
  'dist/**',
  '**/build/**',
  'build/**',
  '**/.next/**',
  '.next/**',
  '**/out/**',
  'out/**',
  
  // Version control
  '**/.git/**',
  '.git/**',
  '**/.svn/**',
  '.svn/**',
  
  // Cache/temp directories
  '**/.cache/**',
  '.cache/**',
  '**/tmp/**',
  'tmp/**',
  '**/temp/**',
  'temp/**',
  '**/coverage/**',
  'coverage/**',
  
  // Generated docs (keep source docs)
  '**/docs/build/**',
  '**/docs/dist/**',
  '**/docs/.docusaurus/**',
  '**/docs/node_modules/**',
  
  // Lock files and binaries
  '**/*.lock',
  '**/*.min.*',
  '**/*.bin',
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  
  // Media files
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.svg',
  '**/*.ico',
  '**/*.mp4',
  '**/*.mov',
  '**/*.avi',
  '**/*.webm',
  
  // Archive files
  '**/*.zip',
  '**/*.gz',
  '**/*.tar',
  '**/*.rar',
  '**/*.7z',
  '**/*.bz2',
  
  // OS files
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/*.tmp',
  
  // IDE files
  '**/.vscode/**',
  '**/.idea/**',
  '**/*.swp',
  '**/*.swo'
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

export async function* walkDir(root){
  async function *walk(cur){
    const es = await fs.readdir(cur, {withFileTypes: true});
    for (const e of es){
      const full = path.join(cur, e.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      
      // Check if this path should be excluded
      if (RX.some(r => r.test(rel))) {
        continue;
      }
      
      if (e.isDirectory()) {
        yield* walk(full);
      } else if (e.isFile()) {
        yield { full, rel };
      }
    }
  } 
  yield* walk(root);
}