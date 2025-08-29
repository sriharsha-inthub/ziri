#!/usr/bin/env node

/**
 * Test Organization Script
 * 
 * This script organizes test files into proper categories:
 * - unit: Tests for individual components
 * - integration: Tests for component interactions  
 * - regression: Performance and regression tests
 * - e2e: End-to-end workflow tests
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const testCategories = {
  unit: [
    'file-chunker.test.js',
    'file-reader.test.js',
    'file-walker.test.js',
    'change-detector.test.js',
    'config-management.test.js',
    'embedding-providers.test.js',
    'error-handling.test.js',
    'index-store.test.js',
    'progress-monitoring.test.js',
    'project-summarizer.test.js',
    'repository-parser.test.js'
  ],
  integration: [
    'comprehensive-integration.test.js',
    'requirements-validation.test.js',
    'integration.test.js',
    'memory-integration.test.js',
    'provider-migration.test.js',
    'repository-isolation.test.js',
    'embedding-pipeline.test.js'
  ],
  regression: [
    'performance-regression.test.js',
    'performance-optimization.test.js',
    'memory-optimization.test.js',
    'provider-benchmark.test.js'
  ]
};

async function organizeTests() {
  console.log('🗂️ Organizing test files...\n');
  
  const testDir = path.join(process.cwd(), 'test');
  const scriptsDir = path.join(process.cwd(), 'scripts');
  
  try {
    // Create directories if they don't exist
    await fs.mkdir(path.join(testDir, 'unit'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'integration'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'regression'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'e2e'), { recursive: true });
    await fs.mkdir(scriptsDir, { recursive: true });
    
    // Move test files to appropriate categories
    for (const [category, files] of Object.entries(testCategories)) {
      console.log(`📁 Moving ${category} tests...`);
      
      for (const file of files) {
        const sourcePath = path.join(testDir, file);
        const targetPath = path.join(testDir, category, file);
        
        try {
          // Check if source file exists
          await fs.access(sourcePath);
          
          // Read the file content
          const content = await fs.readFile(sourcePath, 'utf-8');
          
          // Update import paths (add one more level up)
          const updatedContent = content.replace(
            /from ['"]\.\.\/lib\//g,
            "from '../../lib/"
          ).replace(
            /from ['"]\.\.\/examples\//g,
            "from '../../examples/"
          ).replace(
            /from ['"]\.\.\/scripts\//g,
            "from '../../scripts/"
          );
          
          // Write to new location
          await fs.writeFile(targetPath, updatedContent);
          
          // Remove original file
          await fs.unlink(sourcePath);
          
          console.log(`  ✅ Moved ${file} to ${category}/`);
        } catch (error) {
          if (error.code === 'ENOENT') {
            console.log(`  ⚠️ File not found: ${file}`);
          } else {
            console.log(`  ❌ Error moving ${file}: ${error.message}`);
          }
        }
      }
    }
    
    // Move scripts to scripts directory
    console.log('\n📁 Moving scripts...');
    const scriptFiles = [
      'validate-task-15.js',
      'run-integration-tests.js', 
      'check-task-15.js',
      'verify-task-2.js',
      'test-exclusions.js'
    ];
    
    for (const file of scriptFiles) {
      const sourcePath = path.join(process.cwd(), file);
      const targetPath = path.join(scriptsDir, file);
      
      try {
        await fs.access(sourcePath);
        
        // Read and update import paths if needed
        const content = await fs.readFile(sourcePath, 'utf-8');
        const updatedContent = content.replace(
          /from ['"]\.\/lib\//g,
          "from '../lib/"
        ).replace(
          /from ['"]\.\/test\//g,
          "from '../test/"
        ).replace(
          /path\.join\(__dirname, 'test'/g,
          "path.join(__dirname, '../test'"
        ).replace(
          /path\.join\(__dirname, 'lib'/g,
          "path.join(__dirname, '../lib'"
        );
        
        await fs.writeFile(targetPath, updatedContent);
        await fs.unlink(sourcePath);
        
        console.log(`  ✅ Moved ${file} to scripts/`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`  ⚠️ File not found: ${file}`);
        } else {
          console.log(`  ❌ Error moving ${file}: ${error.message}`);
        }
      }
    }
    
    console.log('\n🎉 Test organization complete!');
    console.log('\nNew structure:');
    console.log('📁 test/');
    console.log('  📁 unit/ - Individual component tests');
    console.log('  📁 integration/ - Component interaction tests');
    console.log('  📁 regression/ - Performance and regression tests');
    console.log('  📁 e2e/ - End-to-end workflow tests');
    console.log('📁 scripts/ - Test and validation scripts');
    
  } catch (error) {
    console.error('❌ Error organizing tests:', error.message);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  organizeTests().catch(error => {
    console.error('💥 Organization failed:', error.message);
    process.exit(1);
  });
}

export { organizeTests };