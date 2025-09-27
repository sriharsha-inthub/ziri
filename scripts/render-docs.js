// scripts/render-docs.js
// Render documentation placeholders with the current package version (range form)
const fs = require('fs');
const path = require('path');

// Simple recursive file collector (no external deps)
function collectMarkdown(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip typical ignored folders
      if (['node_modules', 'dist', 'dist-docs', '.git'].includes(entry.name)) continue;
      collectMarkdown(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1️⃣ Load root package.json version
const rootPkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const version = rootPkg.version; // e.g. "0.2.0"
// Convert to range like "0.2.x"
const versionRange = version.replace(/\.\d+$/,' .x').replace(/\s+/g,'');

// 2️⃣ Define placeholders to replace
const placeholders = [
  {search: /\{\{VERSION\}\}/g, replace: version},
  {search: /\{\{VERSION_RANGE\}\}/g, replace: versionRange},
];

// 3️⃣ Find all markdown files in the repo (excluding node_modules, dist, etc.)
const files = collectMarkdown(path.resolve(__dirname, '..'));

let changed = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  placeholders.forEach(p => {
    content = content.replace(p.search, p.replace);
  });
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    console.log(`✔ rendered ${path.relative(process.cwd(), file)}`);
  }
});

console.log(`Done. Updated ${changed} file(s) with version ${version} (range ${versionRange}).`);
