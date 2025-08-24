#!/usr/bin/env node

/**
 * Simple Task 15 Completion Check
 */

import fs from 'node:fs/promises';
import path from 'node:path';

async function getAllTestFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllTestFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.test.js')) {
        files.push(entry.name);
      }
    }
  } catch (error) {
    // Directory might not exist, that's ok
  }
  
  return files;
}

async function checkTask15() {
  console.log('🔍 Checking Task 15 Completion: Integration Tests and Validation\n');
  
  const results = {
    testFiles: 0,
    integrationTests: 0,
    validationTests: 0,
    performanceTests: 0,
    status: 'incomplete'
  };
  
  try {
    // Check test directories
    const testDir = path.join(process.cwd(), 'test');
    const allTestFiles = await getAllTestFiles(testDir);
    
    results.testFiles = allTestFiles.length;
    
    // Count integration tests
    const integrationTests = allTestFiles.filter(f => 
      f.includes('integration') || 
      f.includes('comprehensive') || 
      f.includes('requirements') ||
      f.includes('performance') ||
      f.includes('migration')
    );
    
    results.integrationTests = integrationTests.length;
    
    // Check specific test files in their new locations
    const requiredTests = [
      { file: 'requirements-validation.test.js', locations: ['test/integration/', 'test/'] },
      { file: 'comprehensive-integration.test.js', locations: ['test/integration/', 'test/'] },
      { file: 'performance-regression.test.js', locations: ['test/regression/', 'test/'] }
    ];
    
    let foundTests = 0;
    for (const test of requiredTests) {
      let found = false;
      for (const location of test.locations) {
        const testPath = path.join(process.cwd(), location, test.file);
        const exists = await fs.access(testPath).then(() => true).catch(() => false);
        if (exists) {
          found = true;
          foundTests++;
          console.log(`✅ Found: ${test.file} in ${location}`);
          break;
        }
      }
      if (!found) {
        console.log(`❌ Missing: ${test.file}`);
      }
    }
    
    results.validationTests = foundTests;
    
    // Check validation scripts and docs in their new locations
    const validationFiles = [
      { file: 'validate-task-15.js', locations: ['scripts/', './'] },
      { file: 'run-integration-tests.js', locations: ['scripts/', './'] },
      { file: 'TASK-15-SUMMARY.md', locations: ['docs/', './'] }
    ];
    
    let foundValidation = 0;
    for (const validation of validationFiles) {
      let found = false;
      for (const location of validation.locations) {
        const filePath = path.join(process.cwd(), location, validation.file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        if (exists) {
          found = true;
          foundValidation++;
          console.log(`✅ Found: ${validation.file} in ${location}`);
          break;
        }
      }
      if (!found) {
        console.log(`❌ Missing: ${validation.file}`);
      }
    }
    
    // Determine completion status
    if (foundTests === requiredTests.length && foundValidation === validationFiles.length) {
      results.status = 'complete';
      console.log('\n🎉 Task 15 is COMPLETE!');
      console.log(`📊 Summary:`);
      console.log(`   - Total test files: ${results.testFiles}`);
      console.log(`   - Integration tests: ${results.integrationTests}`);
      console.log(`   - Required tests: ${foundTests}/${requiredTests.length}`);
      console.log(`   - Validation files: ${foundValidation}/${validationFiles.length}`);
    } else {
      results.status = 'incomplete';
      console.log('\n⚠️ Task 15 is INCOMPLETE');
      console.log(`   Missing ${requiredTests.length - foundTests} required tests`);
      console.log(`   Missing ${validationFiles.length - foundValidation} validation files`);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Error checking Task 15:', error.message);
    results.status = 'error';
    return results;
  }
}

// Run check
checkTask15().then(results => {
  process.exit(results.status === 'complete' ? 0 : 1);
}).catch(error => {
  console.error('💥 Check failed:', error.message);
  process.exit(1);
});