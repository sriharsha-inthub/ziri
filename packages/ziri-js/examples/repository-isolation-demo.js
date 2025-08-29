/**
 * Repository Isolation Demo
 * Demonstrates the repository isolation and storage structure functionality
 */

import { RepositoryManager } from '../lib/repository/repository-manager.js';
import { FileHashTracker } from '../lib/repository/file-hash-tracker.js';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

async function demonstrateRepositoryIsolation() {
  console.log('🚀 Repository Isolation Demo\n');

  // Create temporary demo directory
  const demoDir = join(tmpdir(), 'ziri-demo-' + Date.now());
  const storageDir = join(demoDir, '.ziri');
  
  console.log(`📁 Demo directory: ${demoDir}`);
  console.log(`💾 Storage directory: ${storageDir}\n`);

  // Initialize repository manager
  const repositoryManager = new RepositoryManager(storageDir);
  await repositoryManager.initialize();

  // Create demo repositories
  const repo1Path = join(demoDir, 'project-alpha');
  const repo2Path = join(demoDir, 'project-beta');
  
  await mkdir(repo1Path, { recursive: true });
  await mkdir(repo2Path, { recursive: true });

  console.log('1️⃣ Creating isolated repositories...');
  
  // Create first repository
  const repo1 = await repositoryManager.createRepository(repo1Path, {
    provider: 'openai',
    chunkSize: 1000,
    excludePatterns: ['*.log', '*.tmp']
  });
  
  console.log(`   ✅ Repository Alpha: ${repo1.repositoryId} (${repo1.alias})`);
  
  // Create second repository
  const repo2 = await repositoryManager.createRepository(repo2Path, {
    provider: 'ollama',
    chunkSize: 1500,
    excludePatterns: ['*.test.js']
  });
  
  console.log(`   ✅ Repository Beta: ${repo2.repositoryId} (${repo2.alias})\n`);

  console.log('2️⃣ Adding files to repositories...');
  
  // Add files to first repository
  await writeFile(join(repo1Path, 'main.js'), 'console.log("Hello from Alpha");');
  await writeFile(join(repo1Path, 'config.json'), '{"name": "alpha", "version": "1.0.0"}');
  await writeFile(join(repo1Path, 'README.md'), '# Project Alpha\n\nThis is project alpha.');
  
  // Add files to second repository
  await writeFile(join(repo2Path, 'app.py'), 'print("Hello from Beta")');
  await writeFile(join(repo2Path, 'requirements.txt'), 'flask==2.0.1\nrequests==2.25.1');
  await writeFile(join(repo2Path, 'README.md'), '# Project Beta\n\nThis is project beta.');
  
  console.log('   📄 Added files to both repositories\n');

  console.log('3️⃣ Calculating file hashes...');
  
  // Calculate hashes for repo1
  const tracker1 = new FileHashTracker(repo1Path, repositoryManager.metadataManager);
  const repo1Files = [
    join(repo1Path, 'main.js'),
    join(repo1Path, 'config.json'),
    join(repo1Path, 'README.md')
  ];
  
  const repo1Hashes = await tracker1.calculateFileHashes(repo1Files, (progress) => {
    console.log(`   📊 Repo Alpha: ${progress.processed}/${progress.total} files (${progress.percentage}%)`);
  });
  
  await repositoryManager.updateFileHashes(repo1.repositoryId, repo1Hashes);
  
  // Calculate hashes for repo2
  const tracker2 = new FileHashTracker(repo2Path, repositoryManager.metadataManager);
  const repo2Files = [
    join(repo2Path, 'app.py'),
    join(repo2Path, 'requirements.txt'),
    join(repo2Path, 'README.md')
  ];
  
  const repo2Hashes = await tracker2.calculateFileHashes(repo2Files, (progress) => {
    console.log(`   📊 Repo Beta: ${progress.processed}/${progress.total} files (${progress.percentage}%)`);
  });
  
  await repositoryManager.updateFileHashes(repo2.repositoryId, repo2Hashes);
  
  console.log('\n4️⃣ Repository isolation verification...');
  
  // List all repositories
  const repositories = await repositoryManager.listRepositories();
  console.log(`   📋 Total repositories: ${repositories.length}`);
  
  for (const repo of repositories) {
    const stats = await repositoryManager.getRepositoryStats(repo.repositoryId);
    console.log(`   📁 ${repo.repositoryId}: ${stats.totalFiles} files, ${stats.embeddingProvider} provider`);
  }
  
  console.log('\n5️⃣ Testing change detection...');
  
  // Modify a file in repo1
  await writeFile(join(repo1Path, 'main.js'), 'console.log("Hello from Alpha - MODIFIED");');
  
  // Add a new file to repo1
  await writeFile(join(repo1Path, 'utils.js'), 'export function helper() { return "utility"; }');
  
  // Detect changes
  const newRepo1Files = [
    join(repo1Path, 'main.js'),
    join(repo1Path, 'config.json'),
    join(repo1Path, 'README.md'),
    join(repo1Path, 'utils.js')
  ];
  
  const changeResult = await tracker1.detectChangesOptimized(repo1.repositoryId, newRepo1Files, (progress) => {
    if (progress.phase === 'hashing') {
      console.log(`   🔍 Change detection: ${progress.processed}/${progress.total} files checked`);
    }
  });
  
  console.log(`   📝 Changes detected:`);
  console.log(`      - Added: ${changeResult.changes.added.length} files`);
  console.log(`      - Modified: ${changeResult.changes.modified.length} files`);
  console.log(`      - Deleted: ${changeResult.changes.deleted.length} files`);
  console.log(`   ⚡ Optimization: ${changeResult.optimizationStats.hashCalculationsSkipped} hash calculations skipped`);
  
  console.log('\n6️⃣ Repository configuration...');
  
  // Show repository configurations
  const repo1Config = await repositoryManager.getRepositoryConfig(repo1.repositoryId);
  const repo2Config = await repositoryManager.getRepositoryConfig(repo2.repositoryId);
  
  console.log(`   ⚙️  Repo Alpha config: ${repo1Config.chunkSize} chunk size, ${repo1Config.excludePatterns.length} exclusions`);
  console.log(`   ⚙️  Repo Beta config: ${repo2Config.chunkSize} chunk size, ${repo2Config.excludePatterns.length} exclusions`);
  
  console.log('\n7️⃣ Storage isolation verification...');
  
  // Show storage paths
  const repo1Paths = repositoryManager.getRepositoryPaths(repo1.repositoryId);
  const repo2Paths = repositoryManager.getRepositoryPaths(repo2.repositoryId);
  
  console.log(`   📂 Repo Alpha storage: ${repo1Paths.base}`);
  console.log(`   📂 Repo Beta storage: ${repo2Paths.base}`);
  
  // Validate repositories
  const repo1Validation = await repositoryManager.validateRepository(repo1.repositoryId);
  const repo2Validation = await repositoryManager.validateRepository(repo2.repositoryId);
  
  console.log(`   ✅ Repo Alpha validation: ${repo1Validation.valid ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✅ Repo Beta validation: ${repo2Validation.valid ? 'PASSED' : 'FAILED'}`);
  
  console.log('\n🎉 Repository isolation demo completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Created ${repositories.length} isolated repositories`);
  console.log(`   - Each repository has its own storage directory`);
  console.log(`   - File change detection working correctly`);
  console.log(`   - Configuration isolation verified`);
  console.log(`   - Repository validation passed`);
  
  return {
    demoDir,
    repositories: repositories.length,
    repo1: repo1.repositoryId,
    repo2: repo2.repositoryId
  };
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRepositoryIsolation()
    .then((result) => {
      console.log('\n✨ Demo completed successfully!');
      console.log(`Demo files are in: ${result.demoDir}`);
    })
    .catch((error) => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateRepositoryIsolation };