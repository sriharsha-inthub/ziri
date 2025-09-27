#!/usr/bin/env node

/**
 * Project Structure Validator
 * 
 * Validates that the Ziri project maintains its organizational standards:
 * - Root directory cleanliness
 * - Documentation organization
 * - File naming conventions
 * - Audience separation
 */

const fs = require('fs');
const path = require('path');

class ProjectStructureValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.rootPath = process.cwd();
  }

  validate() {
    console.log('🔍 Validating Ziri project structure...\n');

    this.validateRootDirectory();
    this.validateDocumentationStructure();
    this.validateInternalStructure();
    this.validateNamingConventions();
    this.validateIndexFiles();

    this.reportResults();
    return this.errors.length === 0;
  }

  validateRootDirectory() {
    console.log('📁 Checking root directory cleanliness...');

    const allowedRootFiles = [
      'README.md',
      'AGENTS.md', 
      'PROJECT-RULES.md',
      'LICENSE',
      'package.json',
      '.gitignore',
      '.gitattributes'
    ];

    const allowedRootDirs = [
      'docs',
      'internal', 
      'packages',
      '.kiro',
      '.git',
      'node_modules'
    ];

    const rootItems = fs.readdirSync(this.rootPath);

    rootItems.forEach(item => {
      const itemPath = path.join(this.rootPath, item);
      const isDirectory = fs.statSync(itemPath).isDirectory();

      if (isDirectory) {
        if (!allowedRootDirs.includes(item)) {
          this.errors.push(`❌ Unauthorized directory in root: ${item}`);
        }
      } else {
        if (!allowedRootFiles.includes(item)) {
          this.errors.push(`❌ Unauthorized file in root: ${item}`);
        }
      }
    });

    // Check for required files
    if (!fs.existsSync(path.join(this.rootPath, 'README.md'))) {
      this.errors.push('❌ Missing required file: README.md');
    }

    if (!fs.existsSync(path.join(this.rootPath, 'AGENTS.md'))) {
      this.warnings.push('⚠️  Missing recommended file: AGENTS.md');
    }

    console.log('✅ Root directory validation complete\n');
  }

  validateDocumentationStructure() {
    console.log('📚 Checking documentation structure...');

    const requiredDocsDirs = ['user', 'deployment', 'developer'];
    const docsPath = path.join(this.rootPath, 'docs');

    if (!fs.existsSync(docsPath)) {
      this.errors.push('❌ Missing docs directory');
      return;
    }

    // Check required subdirectories
    requiredDocsDirs.forEach(dir => {
      const dirPath = path.join(docsPath, dir);
      if (!fs.existsSync(dirPath)) {
        this.errors.push(`❌ Missing required docs subdirectory: docs/${dir}/`);
      }
    });

    // Check for old-style documentation files in docs root
    const docsItems = fs.readdirSync(docsPath);
    docsItems.forEach(item => {
      const itemPath = path.join(docsPath, item);
      if (fs.statSync(itemPath).isFile()) {
        if (item.endsWith('.md') && item !== 'README.md') {
          this.errors.push(`❌ Documentation file in wrong location: docs/${item} (should be in subdirectory)`);
        }
      }
    });

    // Check for uppercase documentation files (old convention)
    this.checkForUppercaseFiles(docsPath);

    console.log('✅ Documentation structure validation complete\n');
  }

  validateInternalStructure() {
    console.log('🔒 Checking internal documentation structure...');

    const requiredInternalDirs = ['tasks', 'specs', 'validation'];
    const internalPath = path.join(this.rootPath, 'internal');

    if (!fs.existsSync(internalPath)) {
      this.errors.push('❌ Missing internal directory');
      return;
    }

    requiredInternalDirs.forEach(dir => {
      const dirPath = path.join(internalPath, dir);
      if (!fs.existsSync(dirPath)) {
        this.errors.push(`❌ Missing required internal subdirectory: internal/${dir}/`);
      }
    });

    // Check task naming convention
    const tasksPath = path.join(internalPath, 'tasks');
    if (fs.existsSync(tasksPath)) {
      const taskFiles = fs.readdirSync(tasksPath).filter(f => f.endsWith('.md'));
      taskFiles.forEach(file => {
        if (file.startsWith('TASK-') && !file.match(/^TASK-\d+-SUMMARY\.md$/)) {
          this.warnings.push(`⚠️  Task file doesn't follow naming convention: ${file}`);
        }
      });
    }

    console.log('✅ Internal structure validation complete\n');
  }

  validateNamingConventions() {
    console.log('📝 Checking naming conventions...');

    // Check for old uppercase documentation files
    this.checkDirectoryNaming(path.join(this.rootPath, 'docs'), 'docs');
    this.checkDirectoryNaming(path.join(this.rootPath, 'internal'), 'internal');

    console.log('✅ Naming conventions validation complete\n');
  }

  validateIndexFiles() {
    console.log('📋 Checking for required index files...');

    const requiredIndexes = [
      'docs/user/README.md',
      'docs/deployment/README.md', 
      'docs/developer/README.md',
      'internal/README.md'
    ];

    requiredIndexes.forEach(indexPath => {
      const fullPath = path.join(this.rootPath, indexPath);
      if (!fs.existsSync(fullPath)) {
        this.errors.push(`❌ Missing required index file: ${indexPath}`);
      } else {
        // Check if index file has content
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.trim().length < 50) {
          this.warnings.push(`⚠️  Index file seems empty or too short: ${indexPath}`);
        }
      }
    });

    console.log('✅ Index files validation complete\n');
  }

  checkForUppercaseFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && item.endsWith('.md')) {
        // Check for old uppercase naming convention (but allow README.md)
        if (item.match(/^[A-Z][A-Z-]+\.md$/) && item !== 'README.md') {
          this.errors.push(`❌ File uses old uppercase convention: ${path.relative(this.rootPath, itemPath)}`);
        }
      } else if (stat.isDirectory()) {
        this.checkForUppercaseFiles(itemPath);
      }
    });
  }

  checkDirectoryNaming(dirPath, relativePath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && item.endsWith('.md')) {
        // Check for kebab-case naming (allow README.md and TASK-N-SUMMARY.md format)
        const isReadme = item === 'README.md';
        const isTaskSummary = item.match(/^TASK-\d+-SUMMARY\.md$/);
        const isOrganizationDoc = item.match(/^(ORGANIZATION|PROJECT)-[A-Z-]+\.md$/);
        
        if (!isReadme && !isTaskSummary && !isOrganizationDoc && !item.match(/^[a-z][a-z0-9-]*\.md$/)) {
          this.warnings.push(`⚠️  File should use kebab-case: ${relativePath}/${item}`);
        }
      } else if (stat.isDirectory()) {
        this.checkDirectoryNaming(itemPath, `${relativePath}/${item}`);
      }
    });
  }

  reportResults() {
    console.log('📊 Validation Results');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 Perfect! Project structure follows all standards.');
      return;
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (must be fixed):');
      this.errors.forEach(error => console.log(`   ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (should be addressed):');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    console.log('\n📋 Summary:');
    console.log(`   Errors: ${this.errors.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      console.log('\n🔧 To fix errors, refer to AGENTS.md');
      console.log('   Key rules:');
      console.log('   - Keep root directory clean (only README.md + essential dirs)');
      console.log('   - Put user docs in docs/user/, deployment docs in docs/deployment/');
      console.log('   - Put internal docs in internal/');
      console.log('   - Use kebab-case for file names');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProjectStructureValidator();
  const isValid = validator.validate();
  process.exit(isValid ? 0 : 1);
}

module.exports = ProjectStructureValidator;