/**
 * Change Detection System Demo
 * Demonstrates the comprehensive change detection capabilities
 */

import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { ChangeDetector } from '../lib/repository/change-detector.js';
import { MetadataManager } from '../lib/repository/metadata-manager.js';
import { StorageManager } from '../lib/storage/storage-manager.js';

async function demonstrateChangeDetection() {
  console.log('🔍 Change Detection System Demo\n');

  // Setup
  const demoDir = join(process.cwd(), 'demo-change-detection');
  const storageDir = join(demoDir, '.ziri');
  
  try {
    await mkdir(demoDir, { recursive: true });
    
    const storageManager = new StorageManager(storageDir);
    const metadataManager = new MetadataManager(storageManager);
    const changeDetector = new ChangeDetector(demoDir, metadataManager);
    
    const repositoryId = 'demo-repo';
    await storageManager.createRepositoryStorage(repositoryId);
    await metadataManager.initializeRepository(repositoryId, demoDir);

    console.log('📁 Created demo repository structure');

    // Step 1: Create initial files
    console.log('\n📝 Step 1: Creating initial files...');
    const files = [
      { name: 'app.js', content: 'console.log("Hello, World!");' },
      { name: 'config.json', content: '{"version": "1.0.0"}' },
      { name: 'README.md', content: '# Demo Project\n\nThis is a demo.' }
    ];

    for (const file of files) {
      await writeFile(join(demoDir, file.name), file.content);
    }

    // Initial indexing
    const filePaths = files.map(f => join(demoDir, f.name));
    const initialChanges = await changeDetector.detectChanges(repositoryId, filePaths, {
      onProgress: (progress) => {
        if (progress.phase === 'hashing') {
          console.log(`   Hashing: ${progress.currentFile} (${progress.percentage}%)`);
        }
      }
    });

    console.log(`✅ Initial indexing complete:`);
    console.log(`   - Added: ${initialChanges.added.length} files`);
    console.log(`   - Hash calculations: ${initialChanges.stats.hashCalculationsPerformed}`);

    // Step 2: Modify a file
    console.log('\n📝 Step 2: Modifying app.js...');
    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure different timestamp
    await writeFile(join(demoDir, 'app.js'), 'console.log("Hello, Updated World!");');

    const modifyChanges = await changeDetector.detectChanges(repositoryId, filePaths, {
      onProgress: (progress) => {
        if (progress.phase === 'quick_check') {
          console.log(`   Quick check: ${progress.quickCheckSkipped} skipped, ${progress.hashCalculationRequired} need hashing`);
        }
      }
    });

    console.log(`✅ Change detection with optimization:`);
    console.log(`   - Modified: ${modifyChanges.modified.length} files`);
    console.log(`   - Unchanged: ${modifyChanges.unchanged.length} files`);
    console.log(`   - Hash calculations skipped: ${modifyChanges.stats.hashCalculationsSkipped}`);
    console.log(`   - Hash calculations performed: ${modifyChanges.stats.hashCalculationsPerformed}`);

    // Step 3: Add and delete files
    console.log('\n📝 Step 3: Adding new file and simulating deletion...');
    await writeFile(join(demoDir, 'new-feature.js'), 'export function newFeature() {}');
    
    // Simulate deletion by not including config.json in the file list
    const updatedFilePaths = [
      join(demoDir, 'app.js'),
      join(demoDir, 'README.md'),
      join(demoDir, 'new-feature.js')
    ];

    const mixedChanges = await changeDetector.detectChanges(repositoryId, updatedFilePaths);

    console.log(`✅ Mixed changes detected:`);
    console.log(`   - Added: ${mixedChanges.added.length} files`);
    console.log(`   - Modified: ${mixedChanges.modified.length} files`);
    console.log(`   - Deleted: ${mixedChanges.deleted.length} files`);
    console.log(`   - Unchanged: ${mixedChanges.unchanged.length} files`);

    if (mixedChanges.added.length > 0) {
      console.log(`     Added file: ${mixedChanges.added[0].path}`);
    }
    if (mixedChanges.deleted.length > 0) {
      console.log(`     Deleted file: ${mixedChanges.deleted[0].path}`);
    }

    // Step 4: Cleanup deleted files
    console.log('\n🧹 Step 4: Cleaning up deleted files...');
    const cleanupResult = await changeDetector.cleanupDeletedFiles(repositoryId, mixedChanges.deleted);
    console.log(`✅ Cleanup complete: ${cleanupResult.cleaned} files cleaned`);

    // Step 5: Validation
    console.log('\n🔍 Step 5: Validating change detection accuracy...');
    const validation = await changeDetector.validateChangeDetection(repositoryId, 3);
    console.log(`✅ Validation result: ${validation.valid ? 'PASSED' : 'FAILED'}`);
    console.log(`   - Sample size: ${validation.sampleSize}/${validation.totalFiles} files`);
    if (validation.errors.length > 0) {
      console.log(`   - Errors: ${validation.errors.length}`);
    }

    // Step 6: Statistics
    console.log('\n📊 Step 6: Change detection statistics...');
    const stats = await changeDetector.getChangeDetectionStats(repositoryId);
    console.log(`✅ Statistics:`);
    console.log(`   - Tracked files: ${stats.trackedFiles}`);
    console.log(`   - Last indexed: ${stats.lastIndexed?.toISOString()}`);
    console.log(`   - Cache size: ${stats.cacheSize}`);
    console.log(`   - Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);

    console.log('\n🎉 Change detection demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    // Cleanup
    try {
      await rm(demoDir, { recursive: true, force: true });
      console.log('\n🧹 Demo files cleaned up');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateChangeDetection().catch(console.error);
}

export { demonstrateChangeDetection };