#!/usr/bin/env node

/**
 * Demo: Streaming File Discovery and Processing
 * 
 * This demo showcases the new streaming file discovery and processing capabilities
 * implemented in Task 3 of the Ziri Performance Optimization spec.
 */

import { RepositoryParser } from '../lib/repository/repository-parser.js';
import path from 'node:path';

async function demonstrateStreaming() {
  console.log('🚀 Ziri Streaming File Discovery and Processing Demo\n');
  
  const repositoryParser = new RepositoryParser({
    fileWalker: { maxFileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileReader: { encoding: 'utf8' },
    fileChunker: {
      targetChars: 2000,
      overlapRatio: 0.1,
      respectLineBreaks: true,
      respectWordBoundaries: true
    }
  });

  // Use current directory as demo repository
  const repoPath = process.cwd();
  console.log(`📁 Analyzing repository: ${repoPath}\n`);

  // Step 1: Get repository statistics
  console.log('📊 Gathering repository statistics...');
  const stats = await repositoryParser.getRepositoryStats(repoPath);
  
  console.log(`   Total files: ${stats.fileCount}`);
  console.log(`   Text files: ${stats.textFiles}`);
  console.log(`   Binary files: ${stats.binaryFiles}`);
  console.log(`   Total size: ${(stats.totalSize / 1024).toFixed(1)} KB`);
  console.log(`   Average file size: ${(stats.averageFileSize / 1024).toFixed(1)} KB`);
  
  console.log('\n   File extensions:');
  Object.entries(stats.extensions)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([ext, count]) => {
      console.log(`     ${ext || 'no-extension'}: ${count} files`);
    });

  // Step 2: Stream file discovery
  console.log('\n🔍 Discovering files (streaming)...');
  let fileCount = 0;
  const fileTypes = new Map();
  
  for await (const fileInfo of repositoryParser.discoverFiles(repoPath, ['**/test-temp-*/**'])) {
    fileCount++;
    const ext = fileInfo.extension || 'no-extension';
    fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
    
    if (fileCount <= 5) {
      console.log(`   📄 ${fileInfo.relativePath} (${fileInfo.size} bytes, ${fileInfo.mimeType || 'unknown type'})`);
    } else if (fileCount === 6) {
      console.log(`   ... and ${stats.fileCount - 5} more files`);
    }
  }

  // Step 3: Stream chunk processing
  console.log('\n⚡ Processing files and generating chunks (streaming)...');
  let chunkCount = 0;
  let processedFiles = 0;
  const startTime = Date.now();
  
  for await (const chunk of repositoryParser.streamRepositoryChunks(repoPath, {
    excludePatterns: ['**/test-temp-*/**', '**/node_modules/**'],
    chunkOptions: {
      targetChars: 1500,
      respectLineBreaks: true
    },
    onFileStart: (fileInfo, count) => {
      processedFiles = count;
      if (count <= 3) {
        console.log(`   🔄 Processing: ${fileInfo.relativePath}`);
      }
    },
    onChunk: (chunk, count) => {
      chunkCount = count;
    }
  })) {
    // Show first few chunks as examples
    if (chunkCount <= 2) {
      console.log(`   📝 Chunk ${chunkCount}: ${chunk.size} chars, lines ${chunk.startLine}-${chunk.endLine}`);
      console.log(`      Content preview: "${chunk.content.substring(0, 80).replace(/\n/g, '\\n')}..."`);
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log(`\n✅ Processing completed in ${duration}ms`);
  console.log(`   📁 Processed ${processedFiles} files`);
  console.log(`   📄 Generated ${chunkCount} chunks`);
  console.log(`   ⚡ Throughput: ${(processedFiles / (duration / 1000)).toFixed(1)} files/sec`);
  console.log(`   🧩 Average chunk size: ${chunkCount > 0 ? Math.round(stats.totalSize / chunkCount) : 0} chars`);

  // Step 4: Demonstrate chunking options
  console.log('\n🧩 Demonstrating different chunking strategies...');
  
  const sampleText = `
function calculateFibonacci(n) {
  if (n <= 1) return n;
  
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  
  return b;
}

// Example usage
console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
  console.log(\`F(\${i}) = \${calculateFibonacci(i)}\`);
}
`.trim();

  const strategies = [
    { name: 'Small chunks', targetChars: 100, respectLineBreaks: false },
    { name: 'Line-aware chunks', targetChars: 150, respectLineBreaks: true },
    { name: 'Word-aware chunks', targetChars: 120, respectWordBoundaries: true }
  ];

  for (const strategy of strategies) {
    const chunks = repositoryParser.fileChunker.chunkText(
      sampleText, 
      'demo.js', 
      'demo.js', 
      strategy
    );
    
    console.log(`\n   ${strategy.name}: ${chunks.length} chunks`);
    chunks.forEach((chunk, i) => {
      console.log(`     Chunk ${i + 1}: ${chunk.size} chars, lines ${chunk.startLine}-${chunk.endLine}`);
    });
  }

  console.log('\n🎉 Demo completed! The streaming architecture provides:');
  console.log('   • Memory-efficient file discovery');
  console.log('   • Configurable text chunking with overlap');
  console.log('   • Support for exclusion patterns');
  console.log('   • Real-time progress monitoring');
  console.log('   • Streaming processing for large repositories');
}

// Run the demo
demonstrateStreaming().catch(console.error);