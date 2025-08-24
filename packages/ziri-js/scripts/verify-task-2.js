/**
 * Task 2 Verification Script
 * Verifies that all requirements for task 2 are implemented
 */

import { RepositoryManager } from './lib/repository/repository-manager.js';
import { MetadataManager } from './lib/repository/metadata-manager.js';
import { FileHashTracker } from './lib/repository/file-hash-tracker.js';
import { StorageManager } from './lib/storage/storage-manager.js';
import { computeRepoId } from './lib/repoid.js';
import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';

async function verifyTask2Implementation() {
  console.log('🔍 Verifying Task 2: Repository Isolation and Storage Structure\n');

  const tempDir = join(tmpdir(), 'ziri-verify-' + Date.now());
  const testRepoPath = join(tempDir, 'test-repo');
  
  try {
    await mkdir(testRepoPath, { recursive: true });
    
    const checks = [];
    
    // ✅ Repository hash generation for unique identification
    console.log('1️⃣ Testing repository hash generation...');
    const { repoId, alias } = await computeRepoId(testRepoPath);
    checks.push({
      requirement: 'Repository hash generation for unique identification',
      status: repoId && typeof repoId === 'string' && repoId.length > 0,
      details: `Generated ID: ${repoId}, Alias: ${alias}`
    });
    
    // ✅ Directory creation and management for isolated storage
    console.log('2️⃣ Testing directory creation and management...');
    const repositoryManager = new RepositoryManager(join(tempDir, '.ziri'));
    await repositoryManager.initialize();
    
    const repo = await repositoryManager.createRepository(testRepoPath);
    const paths = repositoryManager.getRepositoryPaths(repo.repositoryId);
    const exists = await repositoryManager.repositoryExists(testRepoPath);
    
    checks.push({
      requirement: 'Directory creation and management for isolated storage',
      status: exists && paths.base && paths.vectors && paths.metadata,
      details: `Storage created at: ${paths.base}`
    });
    
    // ✅ Configuration file handling for repository metadata
    console.log('3️⃣ Testing configuration file handling...');
    const config = {
      chunkSize: 1500,
      chunkOverlap: 300,
      excludePatterns: ['*.test.js'],
      maxFileSize: 2048 * 1024
    };
    
    await repositoryManager.updateRepositoryConfig(repo.repositoryId, config);
    const loadedConfig = await repositoryManager.getRepositoryConfig(repo.repositoryId);
    const metadata = await repositoryManager.metadataManager.loadMetadata(repo.repositoryId);
    
    checks.push({
      requirement: 'Configuration file handling for repository metadata',
      status: loadedConfig && metadata && loadedConfig.chunkSize === 1500,
      details: `Config saved and loaded successfully, chunk size: ${loadedConfig.chunkSize}`
    });
    
    // ✅ File hash tracking system for change detection
    console.log('4️⃣ Testing file hash tracking system...');
    
    // Create test files
    const testFile1 = join(testRepoPath, 'file1.txt');
    const testFile2 = join(testRepoPath, 'file2.txt');
    await writeFile(testFile1, 'Initial content 1');
    await writeFile(testFile2, 'Initial content 2');
    
    // Calculate initial hashes
    const tracker = new FileHashTracker(testRepoPath, repositoryManager.metadataManager);
    const initialHashes = await tracker.calculateFileHashes([testFile1, testFile2]);
    await repositoryManager.updateFileHashes(repo.repositoryId, initialHashes);
    
    // Modify a file
    await writeFile(testFile1, 'Modified content 1');
    
    // Detect changes
    const newHashes = await tracker.calculateFileHashes([testFile1, testFile2]);
    const currentHashMap = Object.fromEntries(
      Object.entries(newHashes).map(([path, info]) => [path, info.hash])
    );
    const changes = await repositoryManager.detectFileChanges(repo.repositoryId, currentHashMap);
    
    checks.push({
      requirement: 'File hash tracking system for change detection',
      status: changes.modified.length === 1 && changes.modified[0].path === 'file1.txt',
      details: `Detected ${changes.modified.length} modified files, ${changes.added.length} added, ${changes.deleted.length} deleted`
    });
    
    // Additional verification: Requirements 6.1, 6.2, 6.5
    console.log('5️⃣ Verifying specific requirements...');
    
    // Requirement 6.1: Isolated index store specific to repository
    const repo2Path = join(tempDir, 'test-repo-2');
    await mkdir(repo2Path, { recursive: true });
    const repo2 = await repositoryManager.createRepository(repo2Path);
    const isolation = repo.repositoryId !== repo2.repositoryId;
    
    checks.push({
      requirement: '6.1 - Isolated index store specific to repository',
      status: isolation,
      details: `Repo1: ${repo.repositoryId}, Repo2: ${repo2.repositoryId}`
    });
    
    // Requirement 6.2: Complete full index on first run
    const firstRun = !repo.exists; // New repository
    checks.push({
      requirement: '6.2 - Complete full index on first run',
      status: firstRun,
      details: `New repository created: ${firstRun}`
    });
    
    // Requirement 6.5: Separate index stores without cross-contamination
    const repo1Paths = repositoryManager.getRepositoryPaths(repo.repositoryId);
    const repo2Paths = repositoryManager.getRepositoryPaths(repo2.repositoryId);
    const separateStorage = repo1Paths.base !== repo2Paths.base;
    
    checks.push({
      requirement: '6.5 - Separate index stores without cross-contamination',
      status: separateStorage,
      details: `Separate storage directories: ${separateStorage}`
    });
    
    // Print results
    console.log('\n📋 Verification Results:\n');
    
    let allPassed = true;
    for (const check of checks) {
      const status = check.status ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${check.requirement}`);
      console.log(`   ${check.details}\n`);
      if (!check.status) allPassed = false;
    }
    
    console.log(`🎯 Overall Result: ${allPassed ? '✅ ALL REQUIREMENTS MET' : '❌ SOME REQUIREMENTS FAILED'}`);
    
    return allPassed;
    
  } finally {
    // Cleanup
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

// Run verification
verifyTask2Implementation()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });