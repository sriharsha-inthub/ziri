/**
 * Vector Storage and Retrieval Demo
 * Demonstrates FAISS-based vector storage with repository isolation
 */

import { IndexStore } from '../lib/storage/index-store.js';
import { join } from 'path';
import { tmpdir } from 'os';

async function runVectorStorageDemo() {
  console.log('🚀 Vector Storage and Retrieval Demo\n');

  // Create temporary directory for demo
  const demoDir = join(tmpdir(), `ziri-vector-demo-${Date.now()}`);
  console.log(`📁 Using demo directory: ${demoDir}\n`);

  // Initialize IndexStore
  const indexStore = new IndexStore(demoDir);
  await indexStore.initialize();

  // Create repositories
  console.log('📦 Creating repositories...');
  const repo1Id = await indexStore.createRepository('/demo/project1');
  const repo2Id = await indexStore.createRepository('/demo/project2');
  console.log(`   Repository 1 ID: ${repo1Id}`);
  console.log(`   Repository 2 ID: ${repo2Id}\n`);

  // Create sample embeddings for different types of code
  const codeEmbeddings = [
    {
      chunkId: 'js-function-1',
      content: 'function calculateSum(a, b) { return a + b; }',
      filePath: '/demo/project1/math.js',
      startLine: 1,
      endLine: 3,
      fileHash: 'hash-js-1',
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // Simulated JS function embedding
      provider: 'openai',
      modelVersion: 'text-embedding-3-small'
    },
    {
      chunkId: 'js-class-1',
      content: 'class Calculator { constructor() { this.result = 0; } }',
      filePath: '/demo/project1/calculator.js',
      startLine: 1,
      endLine: 5,
      fileHash: 'hash-js-2',
      embedding: [0.2, 0.3, 0.4, 0.5, 0.6], // Simulated JS class embedding
      provider: 'openai',
      modelVersion: 'text-embedding-3-small'
    },
    {
      chunkId: 'py-function-1',
      content: 'def multiply(x, y): return x * y',
      filePath: '/demo/project1/operations.py',
      startLine: 10,
      endLine: 12,
      fileHash: 'hash-py-1',
      embedding: [0.8, 0.7, 0.6, 0.5, 0.4], // Simulated Python function embedding
      provider: 'openai',
      modelVersion: 'text-embedding-3-small'
    }
  ];

  const htmlEmbeddings = [
    {
      chunkId: 'html-component-1',
      content: '<div class="button" onclick="handleClick()">Click me</div>',
      filePath: '/demo/project2/button.html',
      startLine: 5,
      endLine: 7,
      fileHash: 'hash-html-1',
      embedding: [0.9, 0.1, 0.2, 0.3, 0.4], // Simulated HTML embedding
      provider: 'openai',
      modelVersion: 'text-embedding-3-small'
    }
  ];

  // Store embeddings in different repositories
  console.log('💾 Storing embeddings...');
  await indexStore.storeEmbeddings(repo1Id, codeEmbeddings);
  await indexStore.storeEmbeddings(repo2Id, htmlEmbeddings);
  console.log(`   Stored ${codeEmbeddings.length} embeddings in repository 1`);
  console.log(`   Stored ${htmlEmbeddings.length} embeddings in repository 2\n`);

  // Query for similar code
  console.log('🔍 Searching for similar code...\n');

  // Search for JavaScript-like code
  const jsQuery = [0.15, 0.25, 0.35, 0.45, 0.55]; // Similar to JS embeddings
  console.log('   Query: JavaScript-like code');
  const jsResults = await indexStore.queryEmbeddings(repo1Id, jsQuery, 3);
  
  console.log(`   Found ${jsResults.length} results:`);
  for (const result of jsResults) {
    console.log(`     📄 ${result.filePath}:${result.startLine}-${result.endLine}`);
    console.log(`        Score: ${result.score.toFixed(3)}`);
    console.log(`        Content: ${result.content.substring(0, 50)}...`);
    console.log(`        Provider: ${result.metadata.provider}\n`);
  }

  // Search for Python-like code
  const pyQuery = [0.75, 0.65, 0.55, 0.45, 0.35]; // Similar to Python embeddings
  console.log('   Query: Python-like code');
  const pyResults = await indexStore.queryEmbeddings(repo1Id, pyQuery, 3);
  
  console.log(`   Found ${pyResults.length} results:`);
  for (const result of pyResults) {
    console.log(`     📄 ${result.filePath}:${result.startLine}-${result.endLine}`);
    console.log(`        Score: ${result.score.toFixed(3)}`);
    console.log(`        Content: ${result.content}`);
    console.log(`        Provider: ${result.metadata.provider}\n`);
  }

  // Demonstrate repository isolation
  console.log('🔒 Testing repository isolation...');
  const repo1Stats = await indexStore.getStorageStats(repo1Id);
  const repo2Stats = await indexStore.getStorageStats(repo2Id);
  
  console.log(`   Repository 1: ${repo1Stats.totalChunks} chunks, ${repo1Stats.totalFiles} files`);
  console.log(`   Repository 2: ${repo2Stats.totalChunks} chunks, ${repo2Stats.totalFiles} files\n`);

  // Search in wrong repository (should return no results)
  const htmlQuery = [0.85, 0.15, 0.25, 0.35, 0.45]; // Similar to HTML embeddings
  const wrongRepoResults = await indexStore.queryEmbeddings(repo1Id, htmlQuery, 3);
  console.log(`   HTML query in code repository: ${wrongRepoResults.length} results (expected: low similarity)\n`);

  // Demonstrate batch operations
  console.log('📦 Testing batch operations...');
  const moreBatches = [
    [
      {
        chunkId: 'batch-1-chunk-1',
        content: 'const API_URL = "https://api.example.com";',
        filePath: '/demo/project1/config.js',
        startLine: 1,
        endLine: 1,
        fileHash: 'hash-config-1',
        embedding: [0.3, 0.4, 0.5, 0.6, 0.7],
        provider: 'openai',
        modelVersion: 'text-embedding-3-small'
      }
    ],
    [
      {
        chunkId: 'batch-2-chunk-1',
        content: 'export default function App() { return <div>Hello</div>; }',
        filePath: '/demo/project1/app.jsx',
        startLine: 1,
        endLine: 3,
        fileHash: 'hash-react-1',
        embedding: [0.4, 0.5, 0.6, 0.7, 0.8],
        provider: 'openai',
        modelVersion: 'text-embedding-3-small'
      }
    ]
  ];

  await indexStore.batchStoreEmbeddings(repo1Id, moreBatches);
  console.log(`   Added ${moreBatches.flat().length} more embeddings via batch operation\n`);

  // Test removal
  console.log('🗑️  Testing embedding removal...');
  const beforeRemoval = await indexStore.getStorageStats(repo1Id);
  console.log(`   Before removal: ${beforeRemoval.totalChunks} chunks`);

  await indexStore.removeEmbeddings(repo1Id, ['js-function-1']);
  
  const afterRemoval = await indexStore.getStorageStats(repo1Id);
  console.log(`   After removal: ${afterRemoval.totalChunks} chunks\n`);

  // Validate index integrity
  console.log('✅ Validating index integrity...');
  const validation = await indexStore.validateIndex(repo1Id);
  console.log(`   Index valid: ${validation.valid}`);
  if (validation.issues.length > 0) {
    console.log(`   Issues found: ${validation.issues.join(', ')}`);
  }
  console.log(`   Vector count: ${validation.stats.vectorCount}`);
  console.log(`   Record count: ${validation.stats.recordCount}\n`);

  // Get index statistics
  console.log('📊 Index Statistics:');
  const indexStats = await indexStore.getIndexStats(repo1Id);
  console.log(`   Total vectors: ${indexStats.totalVectors}`);
  console.log(`   Dimensions: ${indexStats.dimensions}`);
  console.log(`   Index type: ${indexStats.indexType}`);
  console.log(`   Memory usage: ${(indexStats.memoryUsage / 1024).toFixed(2)} KB\n`);

  // Final storage statistics
  console.log('📈 Final Storage Statistics:');
  const finalStats = await indexStore.getStorageStats(repo1Id);
  console.log(`   Total chunks: ${finalStats.totalChunks}`);
  console.log(`   Storage size: ${(finalStats.storageSize / 1024).toFixed(2)} KB`);
  console.log(`   Provider distribution:`);
  for (const [provider, count] of finalStats.providerStats) {
    console.log(`     ${provider}: ${count} chunks`);
  }

  console.log('\n✨ Vector storage demo completed successfully!');
  console.log(`📁 Demo files stored in: ${demoDir}`);
}

// Run the demo
runVectorStorageDemo().catch(console.error);