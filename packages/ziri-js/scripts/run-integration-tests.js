#!/usr/bin/env node

/**
 * Integration Test Runner for Task 15
 * 
 * This script runs all integration tests and provides comprehensive reporting
 * for Task 15: Create integration tests and validation
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IntegrationTestRunner {
  constructor() {
    this.results = {
      suites: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      errors: []
    };
  }

  async runAllTests() {
    console.log('🚀 Running Integration Tests for Task 15\n');
    
    const startTime = Date.now();
    
    try {
      await this.checkTestEnvironment();
      await this.runTestSuites();
      await this.generateReport();
      
      this.results.summary.duration = Date.now() - startTime;
      
      console.log('\n🎉 Integration test run complete!');
      console.log(this.formatSummary());
      
      return this.results;
    } catch (error) {
      console.error('\n💥 Integration test run failed:', error.message);
      this.results.errors.push(error.message);
      throw error;
    }
  }

  async checkTestEnvironment() {
    console.log('🔍 Checking test environment...\n');
    
    // Check if vitest is available
    try {
      execSync('npx vitest --version', { stdio: 'pipe' });
      console.log('  ✅ Vitest is available');
    } catch (error) {
      throw new Error('Vitest is not available. Please install it with: npm install -D vitest');
    }
    
    // Check if test files exist
    const testDir = path.join(__dirname, 'test');
    const testFiles = await fs.readdir(testDir);
    const integrationTests = testFiles.filter(f => 
      f.includes('integration') || 
      f.includes('comprehensive') || 
      f.includes('requirements') ||
      f.includes('performance') ||
      f.includes('migration')
    );
    
    console.log(`  📁 Found ${integrationTests.length} integration test files`);
    
    if (integrationTests.length === 0) {
      throw new Error('No integration test files found');
    }
    
    // Check if lib directory exists
    const libDir = path.join(__dirname, 'lib');
    const libExists = await fs.access(libDir).then(() => true).catch(() => false);
    
    if (!libExists) {
      console.log('  ⚠️ Warning: lib directory not found. Some tests may fail.');
    } else {
      console.log('  ✅ Library directory exists');
    }
    
    console.log('');
  }

  async runTestSuites() {
    console.log('🧪 Running test suites...\n');
    
    const testSuites = [
      {
        name: 'Requirements Validation',
        file: 'requirements-validation.test.js',
        timeout: 600000, // 10 minutes
        priority: 1
      },
      {
        name: 'Comprehensive Integration',
        file: 'comprehensive-integration.test.js',
        timeout: 900000, // 15 minutes
        priority: 2
      },
      {
        name: 'Performance Regression',
        file: 'performance-regression.test.js',
        timeout: 1200000, // 20 minutes
        priority: 3
      },
      {
        name: 'Provider Migration',
        file: 'provider-migration.test.js',
        timeout: 600000, // 10 minutes
        priority: 4
      },
      {
        name: 'Memory Integration',
        file: 'memory-integration.test.js',
        timeout: 600000, // 10 minutes
        priority: 5
      }
    ];
    
    // Sort by priority
    testSuites.sort((a, b) => a.priority - b.priority);
    
    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }
  }

  async runTestSuite(suite) {
    console.log(`📋 Running ${suite.name}...`);
    
    const testPath = path.join(__dirname, 'test', suite.file);
    const testExists = await fs.access(testPath).then(() => true).catch(() => false);
    
    if (!testExists) {
      console.log(`  ❌ Test file not found: ${suite.file}`);
      this.results.suites[suite.name] = {
        status: 'not_found',
        error: 'Test file not found',
        duration: 0
      };
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // Run the test suite with vitest
      const result = await this.executeVitest(suite.file, suite.timeout);
      
      const duration = Date.now() - startTime;
      
      this.results.suites[suite.name] = {
        status: result.success ? 'passed' : 'failed',
        tests: result.tests,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration,
        output: result.output,
        error: result.error
      };
      
      // Update summary
      this.results.summary.total += result.tests;
      this.results.summary.passed += result.passed;
      this.results.summary.failed += result.failed;
      this.results.summary.skipped += result.skipped;
      
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${suite.name}: ${result.passed}/${result.tests} passed (${Math.round(duration / 1000)}s)`);
      
      if (!result.success && result.error) {
        console.log(`    Error: ${result.error}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.suites[suite.name] = {
        status: 'error',
        error: error.message,
        duration
      };
      
      console.log(`  💥 ${suite.name}: ${error.message}`);
      this.results.errors.push(`${suite.name}: ${error.message}`);
    }
    
    console.log('');
  }

  async executeVitest(testFile, timeout = 300000) {
    return new Promise((resolve, reject) => {
      const vitestArgs = [
        'vitest',
        'run',
        `test/${testFile}`,
        '--reporter=verbose',
        '--no-coverage'
      ];
      
      const child = spawn('npx', vitestArgs, {
        cwd: __dirname,
        stdio: 'pipe'
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);
      
      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Parse vitest output
        const result = this.parseVitestOutput(output + errorOutput);
        result.success = code === 0;
        result.output = output;
        result.error = code !== 0 ? errorOutput : null;
        
        resolve(result);
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  parseVitestOutput(output) {
    const result = {
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    
    // Parse test results from vitest output
    const testMatch = output.match(/Test Files\s+(\d+)\s+passed/);
    const passedMatch = output.match(/Tests\s+(\d+)\s+passed/);
    const failedMatch = output.match(/(\d+)\s+failed/);
    const skippedMatch = output.match(/(\d+)\s+skipped/);
    
    if (passedMatch) {
      result.passed = parseInt(passedMatch[1], 10);
      result.tests += result.passed;
    }
    
    if (failedMatch) {
      result.failed = parseInt(failedMatch[1], 10);
      result.tests += result.failed;
    }
    
    if (skippedMatch) {
      result.skipped = parseInt(skippedMatch[1], 10);
      result.tests += result.skipped;
    }
    
    // If no specific matches, try to extract from summary
    if (result.tests === 0) {
      const summaryMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+total/);
      if (summaryMatch) {
        result.passed = parseInt(summaryMatch[1], 10);
        result.tests = parseInt(summaryMatch[2], 10);
        result.failed = result.tests - result.passed;
      }
    }
    
    return result;
  }

  async generateReport() {
    console.log('📄 Generating test report...\n');
    
    const report = this.generateMarkdownReport();
    const reportPath = path.join(__dirname, 'INTEGRATION-TEST-REPORT.md');
    
    await fs.writeFile(reportPath, report);
    console.log(`  📝 Report saved to: ${reportPath}`);
  }

  generateMarkdownReport() {
    const timestamp = new Date().toISOString();
    const duration = Math.round(this.results.summary.duration / 1000);
    
    return `# Integration Test Report

**Generated:** ${timestamp}  
**Duration:** ${duration} seconds  
**Task:** Task 15 - Create integration tests and validation

## Summary

- **Total Tests:** ${this.results.summary.total}
- **Passed:** ${this.results.summary.passed} ✅
- **Failed:** ${this.results.summary.failed} ❌
- **Skipped:** ${this.results.summary.skipped} ⏭️
- **Success Rate:** ${this.results.summary.total > 0 ? Math.round((this.results.summary.passed / this.results.summary.total) * 100) : 0}%

## Test Suites

| Suite | Status | Tests | Passed | Failed | Duration |
|-------|--------|-------|--------|--------|----------|
${Object.entries(this.results.suites).map(([name, data]) => {
  const status = data.status === 'passed' ? '✅' : data.status === 'failed' ? '❌' : '⚠️';
  const duration = Math.round((data.duration || 0) / 1000);
  return `| ${name} | ${status} | ${data.tests || 0} | ${data.passed || 0} | ${data.failed || 0} | ${duration}s |`;
}).join('\n')}

## Detailed Results

${Object.entries(this.results.suites).map(([name, data]) => `
### ${name}

- **Status:** ${data.status}
- **Tests:** ${data.tests || 0}
- **Passed:** ${data.passed || 0}
- **Failed:** ${data.failed || 0}
- **Duration:** ${Math.round((data.duration || 0) / 1000)}s

${data.error ? `**Error:** ${data.error}` : ''}
`).join('\n')}

## Errors

${this.results.errors.length > 0 ? 
  this.results.errors.map(error => `- ❌ ${error}`).join('\n') : 
  '✅ No errors detected'
}

## Task 15 Completion Status

${this.getCompletionStatus()}

## Recommendations

${this.getRecommendations()}
`;
  }

  getCompletionStatus() {
    const totalSuites = Object.keys(this.results.suites).length;
    const passedSuites = Object.values(this.results.suites).filter(s => s.status === 'passed').length;
    const successRate = this.results.summary.total > 0 ? (this.results.summary.passed / this.results.summary.total) * 100 : 0;
    
    if (passedSuites === totalSuites && successRate >= 90) {
      return '✅ **COMPLETE** - All integration tests are passing. Task 15 is ready for completion.';
    } else if (successRate >= 70) {
      return '⚠️ **PARTIAL** - Most tests are passing but some issues need attention.';
    } else {
      return '❌ **INCOMPLETE** - Significant test failures. Task 15 needs more work.';
    }
  }

  getRecommendations() {
    const recommendations = [];
    
    if (this.results.summary.failed > 0) {
      recommendations.push('- Fix failing tests to improve overall success rate');
    }
    
    if (this.results.errors.length > 0) {
      recommendations.push('- Address test execution errors');
    }
    
    const errorSuites = Object.values(this.results.suites).filter(s => s.status === 'error').length;
    if (errorSuites > 0) {
      recommendations.push('- Investigate test suites that failed to execute');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- All tests are passing! Consider adding more edge case tests');
      recommendations.push('- Review test coverage to ensure all requirements are validated');
    }
    
    return recommendations.join('\n');
  }

  formatSummary() {
    const successRate = this.results.summary.total > 0 ? 
      Math.round((this.results.summary.passed / this.results.summary.total) * 100) : 0;
    
    return `
📊 Test Summary:
   Total: ${this.results.summary.total}
   Passed: ${this.results.summary.passed} ✅
   Failed: ${this.results.summary.failed} ❌
   Success Rate: ${successRate}%
   Duration: ${Math.round(this.results.summary.duration / 1000)}s
`;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new IntegrationTestRunner();
  
  try {
    await runner.runAllTests();
    
    // Exit with appropriate code
    const successRate = runner.results.summary.total > 0 ? 
      (runner.results.summary.passed / runner.results.summary.total) * 100 : 0;
    
    process.exit(successRate >= 90 ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Test run failed:', error.message);
    process.exit(1);
  }
}

export { IntegrationTestRunner };