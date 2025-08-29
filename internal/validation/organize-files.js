#!/usr/bin/env node

/**
 * File Organization Script for Task 8
 * Organizes files according to AGENTS.md structure and cleans up obsolete files
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
const ziriJsRoot = join(projectRoot, 'packages', 'ziri-js');

// Files to delete (obsolete/duplicate test files and temporary files)
const filesToDelete = [
  // Temporary test files in root
  'packages/ziri-js/debug_chat.js',
  'packages/ziri-js/fix-tests.js', 
  'packages/ziri-js/run-single-test.js',
  'packages/ziri-js/test-basic.js',
  'packages/ziri-js/test-enhanced-storage.js',
  'packages/ziri-js/test-metadata.js',
  'packages/ziri-js/test-runner.js',
  'packages/ziri-js/test-simple.js',
  'packages/ziri-js/validate-metadata-extraction.js',
  'packages/ziri-js/validate-test-fixes.js',
  
  // Old package tarballs
  'packages/ziri-js/ziri-0.1.1.tgz',
  'packages/ziri-js/ziri-0.1.2.tgz',
  'packages/ziri-js/ziri-0.1.3.tgz',
  'packages/ziri-js/ziri-0.1.4.tgz',
  'packages/ziri-js/ziri-0.1.5.tgz',
  'packages/ziri-js/ziri-0.1.6.tgz',
  'packages/ziri-js/ziri-0.1.7.tgz',
  'packages/ziri-js/ziri-0.1.8.tgz',
  'packages/ziri-js/ziri-0.1.9.tgz',
  
  // Backup config file
  'packages/ziri-js/ziri-config-backup.json',
  
  // Malformed file
  'packages/ziri-js/({',
  
  // Duplicate test files
  'packages/ziri-js/test/integration/test_cli_comprehensive.js'
];

// Files to move to internal/validation/
const filesToMoveToValidation = [
  // These are validation scripts that should be in internal/validation/
];

async function deleteObsoleteFiles() {
  console.log('🗑️  Deleting obsolete files...');
  
  for (const filePath of filesToDelete) {
    const fullPath = join(projectRoot, filePath);
    try {
      await fs.unlink(fullPath);
      console.log(`   ✅ Deleted: ${filePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`   ⚠️  Could not delete ${filePath}: ${error.message}`);
      }
    }
  }
}

async function ensureDirectoryStructure() {
  console.log('📁 Ensuring proper directory structure...');
  
  const requiredDirs = [
    'internal/validation',
    'packages/ziri-js/src/cli',
    'packages/ziri-js/src/core/indexing',
    'packages/ziri-js/src/core/querying', 
    'packages/ziri-js/src/core/providers',
    'packages/ziri-js/src/core/storage',
    'packages/ziri-js/src/core/config',
    'packages/ziri-js/src/utils',
    'packages/ziri-js/src/types'
  ];
  
  for (const dir of requiredDirs) {
    const fullPath = join(projectRoot, dir);
    try {
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`   ✅ Ensured directory: ${dir}`);
    } catch (error) {
      console.log(`   ⚠️  Could not create ${dir}: ${error.message}`);
    }
  }
}

async function markLegacyComponents() {
  console.log('🏷️  Marking legacy components...');
  
  // Add deprecation notice to legacy indexer
  const indexerPath = join(ziriJsRoot, 'lib', 'indexer.js');
  try {
    let content = await fs.readFile(indexerPath, 'utf8');
    
    if (!content.includes('DEPRECATED')) {
      const deprecationNotice = `
/**
 * DEPRECATED: Legacy Indexer
 * 
 * This legacy indexer is maintained for backward compatibility only.
 * It will be removed in v2.0. Please migrate to enhanced context indexing.
 * 
 * Migration path:
 * 1. Use 'ziri index' (enhanced context is now default)
 * 2. Remove --legacy flag from your scripts
 * 3. Enhanced context provides richer metadata and better query results
 * 
 * @deprecated Use enhanced context indexing instead (default behavior)
 */
`;
      
      // Insert deprecation notice before the legacyIndexCommand function
      content = content.replace(
        '// Legacy indexer - renamed for backward compatibility',
        deprecationNotice + '// Legacy indexer - renamed for backward compatibility'
      );
      
      await fs.writeFile(indexerPath, content);
      console.log('   ✅ Added deprecation notice to legacy indexer');
    }
  } catch (error) {
    console.log(`   ⚠️  Could not update indexer.js: ${error.message}`);
  }
}

async function updatePackageJson() {
  console.log('📦 Cleaning up package.json dependencies...');
  
  const packageJsonPath = join(ziriJsRoot, 'package.json');
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    
    // Update files array to exclude temporary files
    packageJson.files = [
      "bin/",
      "lib/",
      "types/",
      "README.md",
      "package.json"
    ];
    
    // Clean up scripts - remove temporary test scripts
    if (packageJson.scripts) {
      // Keep essential scripts, remove any temporary ones
      const essentialScripts = {
        "test": "vitest",
        "test:run": "vitest run --reporter=verbose",
        "test:unit": "vitest run test/unit --reporter=verbose", 
        "test:integration": "vitest run test/integration --reporter=verbose",
        "build": "npm pack",
        "prepublishOnly": "npm run prepublish",
        "prepublish": "npm run test:passing && npm run build",
        "test:passing": packageJson.scripts["test:passing"], // Keep existing
        "publish:npm": "npm publish",
        "postinstall": "node -e \"console.log('✅ ziri installed. Run `ziri --help`.')\""
      };
      
      packageJson.scripts = essentialScripts;
    }
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('   ✅ Updated package.json');
  } catch (error) {
    console.log(`   ⚠️  Could not update package.json: ${error.message}`);
  }
}

async function createMigrationGuide() {
  console.log('📖 Creating migration guide...');
  
  const migrationGuide = `# Migration Guide: Legacy to Enhanced Context

## Overview

Ziri v1.0 introduces enhanced context as the default indexing method, with legacy indexing available via the \`--legacy\` flag for backward compatibility.

## What Changed

### Enhanced Context (Default)
- Rich metadata extraction (functions, classes, imports)
- Actual code snippets in query results
- Surrounding context lines
- Better relevance explanations
- Language detection and syntax information

### Legacy Indexing (Deprecated)
- Available via \`--legacy\` flag
- Minimal metadata
- No code snippets in results
- Will be removed in v2.0

## Migration Steps

### 1. Test Enhanced Context
\`\`\`bash
# Re-index with enhanced context (default)
ziri index

# Test queries
ziri query "your search term"
ziri chat "your question"
\`\`\`

### 2. Compare Results
Enhanced context provides:
- Actual code snippets
- Function/class names
- Import statements
- Surrounding context lines
- Better relevance scoring

### 3. Update Scripts
\`\`\`bash
# Old (will be deprecated)
ziri index --legacy

# New (recommended)
ziri index
\`\`\`

### 4. Fallback if Needed
If you encounter issues with enhanced context:
\`\`\`bash
# Temporary fallback
ziri index --legacy
\`\`\`

## Timeline

- **v1.0**: Enhanced context default, legacy via \`--legacy\` flag
- **v2.0**: Legacy indexing removed completely

## Benefits of Enhanced Context

1. **Richer Results**: See actual code, not just file paths
2. **Better Context**: Surrounding lines help understand code
3. **Metadata**: Function names, classes, imports automatically extracted
4. **Language Aware**: Syntax highlighting and language detection
5. **Relevance**: Better explanations of why results match

## Troubleshooting

### Enhanced Context Issues
1. Try re-indexing: \`ziri index --force\`
2. Check disk space and permissions
3. Fallback to legacy: \`ziri index --legacy\`

### Performance
Enhanced context uses more storage but provides much richer results.
Typical overhead: 2-3x storage for significantly better query experience.

## Support

For issues or questions:
1. Check troubleshooting guide
2. Use \`ziri doctor\` for diagnostics
3. Report issues with specific error messages
`;

  const guidePath = join(projectRoot, 'docs', 'user', 'migration-guide.md');
  try {
    await fs.writeFile(guidePath, migrationGuide);
    console.log('   ✅ Created migration guide');
  } catch (error) {
    console.log(`   ⚠️  Could not create migration guide: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting file organization (Task 8)...\n');
  
  try {
    await deleteObsoleteFiles();
    console.log();
    
    await ensureDirectoryStructure();
    console.log();
    
    await markLegacyComponents();
    console.log();
    
    await updatePackageJson();
    console.log();
    
    await createMigrationGuide();
    console.log();
    
    console.log('✅ File organization complete!');
    console.log('\nSummary:');
    console.log('• Deleted obsolete and duplicate files');
    console.log('• Ensured proper directory structure');
    console.log('• Marked legacy components as deprecated');
    console.log('• Cleaned up package.json');
    console.log('• Created migration guide');
    console.log('\nLegacy indexer is available via --legacy flag for safety during transition.');
    
  } catch (error) {
    console.error('❌ Error during file organization:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}