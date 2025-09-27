import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveHome } from './home.js';
import { computeRepoId, repoStoreDir } from './repoid.js';
import { walkDir } from './filewalk.js';
import { chunkTextWithLines } from './chunker.js';
import { makeEmbedder } from './embedder.js';
import { readIndex, writeIndex, ensureRepoStore, saveChunk, setEnhancedStorageMode } from './store_repo.js';
import { sha256 } from './hash.js';
import { getSources } from './registry.js';
import { parallelWalk } from './filesystem/parallel-walk.js';

// Removed unused new architecture imports

/**
 * Enhanced Legacy Indexer
 * 
 * This is the main indexer that provides enhanced context storage with rich metadata.
 * It's based on the proven legacy architecture but with enhanced storage capabilities.
 */
export async function enhancedLegacyIndexCommand({ argv, configManager }) {
  // Enable enhanced storage for rich context
  setEnhancedStorageMode(true);
  
  // Initialize security features
  await initializeSecurity();
  
  const startTime = Date.now();
  let repoPath = process.cwd();

  // Handle set: targeting
  if (argv._ && argv._[0] && argv._[0].startsWith('set:')) {
    const setName = argv._[0].slice(4); // Remove 'set:' prefix
    console.log(`🎯 Targeting set: ${setName}`);

    // Load sources and find the set
    try {
      const sources = await getSources();
      const targetSet = sources.sets?.[setName];

      if (!targetSet || targetSet.length === 0) {
        console.error(`❌ Set '${setName}' not found or empty`);
        console.log(`Available sets: ${Object.keys(sources.sets || {}).join(', ') || 'none'}`);
        process.exit(1);
      }

      if (targetSet.length > 1) {
        console.error(`❌ Set '${setName}' contains multiple repositories. Please specify a single repository path.`);
        console.log(`Set contents:`, targetSet);
        process.exit(1);
      }

      repoPath = targetSet[0];
      console.log(`📁 Using repository: ${repoPath}`);

      // Change to the target directory
      process.chdir(repoPath);
      console.log(`📂 Changed working directory to: ${repoPath}`);

    } catch (error) {
      console.error(`❌ Failed to load set '${setName}':`, error.message);
      process.exit(1);
    }
  }

  const { repoId, alias } = await computeRepoId(repoPath);
  
  console.log(`🔍 Indexing repository: ${alias}`);
  console.log(`📁 Path: ${repoPath}`);
  console.log(`🆔 Repo ID: ${repoId.slice(0, 8)}...`);
  
  const storeDir = repoStoreDir(resolveHome(), alias, repoId);
  await ensureRepoStore(storeDir);
  const manifestPath = path.join(storeDir, 'manifest.json');
  let manifest = {}; 
  try { 
    manifest = JSON.parse(await fs.readFile(manifestPath,'utf-8')); 
  } catch {}

  // Get embedder configuration
  const config = await configManager?.getConfig() || {};
  const defaultProvider = config.defaultProvider || 'ollama';
  const embedder = makeEmbedder(defaultProvider, config);
  console.log(`🤖 Using embedder: ${embedder.id} (${embedder.model})`);
  
  const indexArr = await readIndex(storeDir);
  let processed=0, skipped=0, upserts=0, totalFiles=0, totalBytes=0, totalChunks=0;
  
  // First pass: count total files for progress
  console.log(`📊 Scanning files...`);
  const filesToProcess = [];
  
  // Use parallel walk if enabled
  const useParallelWalk = argv.parallel || process.env.ZIRI_PARALLEL_WALK === 'true';
  const walkOptions = {
    concurrency: argv.walkConcurrency ? parseInt(argv.walkConcurrency) : 4
  };
  
  const fileWalker = useParallelWalk ? (...args) => parallelWalk(...args) : walkDir;
  const walker = useParallelWalk ? fileWalker(repoPath, walkOptions) : fileWalker(repoPath);
  
  for await (const { full, rel } of walker){
    const stat = await fs.stat(full);
    if (stat.size > 1.5*1024*1024) continue; // Skip large files
    filesToProcess.push({ full, rel, size: stat.size });
    totalFiles++;
  }
  
  console.log(`📈 Found ${totalFiles} files to process`);
  console.log(`⚡ Starting enhanced indexing...`);
  
  const startProcessingTime = Date.now();
  
  for (const { full, rel, size } of filesToProcess){
    const content = await fs.readFile(full, 'utf-8');
    const fileHash = sha256(content);
    
    // Enhanced progress indicator with ETA
    const currentIndex = processed + skipped;
    const progress = Math.round((currentIndex / totalFiles) * 100);
    const progressBar = '█'.repeat(Math.floor(progress / 2.5)) + '░'.repeat(40 - Math.floor(progress / 2.5));
    
    // Calculate ETA
    const elapsed = (Date.now() - startProcessingTime) / 1000;
    const rate = currentIndex / elapsed;
    const remaining = totalFiles - currentIndex;
    const eta = remaining > 0 && rate > 0 ? Math.round(remaining / rate) : 0;
    const etaStr = eta > 0 ? `ETA: ${eta}s` : 'ETA: --';
    
    // Format file name for display
    const displayFile = rel.length > 35 ? '...' + rel.slice(-32) : rel;
    
    process.stdout.write(`\r[${progressBar}] ${progress}% (${currentIndex}/${totalFiles}) | ${etaStr} | ${displayFile.padEnd(35)}`);
    
    if (manifest[rel]?.hash === fileHash){ 
      skipped++; 
      continue; 
    }
    
    // Use enhanced chunking with line numbers
    const chunks = chunkTextWithLines(content);
    totalBytes += size;
    totalChunks += chunks.length;
    
    if (argv.verbose) {
      console.log(`\n📄 ${rel} (${chunks.length} chunks, ${(size/1024).toFixed(1)}KB)`);
    }
    
    const batch=[]; let budget=6144; // Significantly increased batch size for better performance
    const flush = async ()=>{
      if (!batch.length) return;
      
      // Always show embedding progress for performance monitoring
      process.stdout.write(`\n  🔄 Embedding ${batch.length} chunks...`);
      const embeddingStart = Date.now();
      
      const vecs = await embedder.embedBatch(batch.map(b=>b.chunk.content));
      
      const embeddingTime = Date.now() - embeddingStart;
      const rate = batch.length / (embeddingTime / 1000);
      process.stdout.write(` ✅ (${embeddingTime}ms, ${rate.toFixed(1)} chunks/sec)\n`);
      
      for(let i=0;i<batch.length;i++){
        const id = sha256(alias+'|'+rel+'|'+i+'|'+fileHash);
        const chunk = batch[i].chunk;

        // Enhanced chunk data with rich metadata
        const chunkData = {
          content: chunk.content,
          filePath: full,
          relativePath: rel,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language: detectLanguage(rel),
          type: detectCodeType(chunk.content),
          functionName: extractFunctionName(chunk.content),
          className: extractClassName(chunk.content),
          imports: extractImports(chunk.content),
          surroundingContext: getSurroundingContext(content, chunk.startLine, chunk.endLine),
          metadata: {
            fileType: path.extname(rel),
            size: chunk.content.length,
            tokenCount: Math.ceil(chunk.content.length / 4)
          }
        };

        await saveChunk(storeDir, id, vecs[i], chunkData);
        indexArr.push({ id, relPath: rel, meta: { alias, language: chunkData.language, type: chunkData.type } });
      }
      upserts += batch.length; batch.length=0; budget=6144;
      await writeIndex(storeDir, indexArr);
    };
    
    for (let i=0;i<chunks.length;i++){
      const chunk = chunks[i]; 
      const est = Math.ceil(chunk.content.length/4);
      if (est>2048) continue;
      if (est>budget) await flush();
      batch.push({ chunk }); budget -= est;
    }
    await flush();
    manifest[rel] = { hash:fileHash, bytes: size, chunks: chunks.length, mtime: Date.now() };
    processed++;
  }
  
  await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf-8');
  await writeIndex(storeDir, indexArr);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log(`\n\n✅ Enhanced indexing complete!`);
  console.log(`📊 Summary:`);
  console.log(`   📁 Repository: ${alias}`);
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log(`   📄 Files processed: ${processed}`);
  console.log(`   ⏭️  Files skipped: ${skipped} (unchanged)`);
  console.log(`   🧩 Total chunks: ${totalChunks}`);
  console.log(`   📦 Vector embeddings: ${upserts}`);
  console.log(`   💾 Total size: ${(totalBytes/1024/1024).toFixed(2)}MB`);
  console.log(`   🚀 Processing rate: ${(processed/parseFloat(duration)).toFixed(1)} files/sec`);
  console.log(`   ⚡ Embedding rate: ${(upserts/parseFloat(duration)).toFixed(1)} chunks/sec`);
  
  // Performance analysis and recommendations
  const avgTimePerChunk = parseFloat(duration) / upserts;
  if (avgTimePerChunk > 2.0) {
    console.log(`\n⚠️  Performance Analysis:`);
    console.log(`   Average time per chunk: ${avgTimePerChunk.toFixed(2)}s (SLOW)`);
    console.log(`\n💡 Performance Recommendations:`);
    console.log(`   1. Check Ollama GPU acceleration: ollama ps`);
    console.log(`   2. Current model: ${embedder.model} (now defaults to all-minilm for speed)`);
    console.log(`   3. Check system resources (CPU/RAM usage)`);
    console.log(`   4. Consider using OpenAI API for faster embeddings`);
    console.log(`   5. Configure faster model: ziri config provider ollama --embedding-model all-minilm`);
  } else if (avgTimePerChunk > 1.0) {
    console.log(`\n⚠️  Moderate performance: ${avgTimePerChunk.toFixed(2)}s per chunk`);
    console.log(`💡 Consider GPU acceleration or a faster embedding model`);
  } else {
    console.log(`\n🎯 Good performance: ${avgTimePerChunk.toFixed(2)}s per chunk`);
  }
  
  if (argv.stats) {
    console.log(`\n📈 Enhanced Context Stats:`);
    console.log(`   🔍 Language detection: Enabled`);
    console.log(`   🏗️  Code structure analysis: Basic`);
    console.log(`   📝 Metadata extraction: Enhanced`);
    console.log(`   🔗 Surrounding context: Included`);
  }
  
  if (upserts > 0) {
    console.log(`\n🎯 Ready to query with enhanced context! Try:`);
    console.log(`   ziri query "your search terms"`);
    console.log(`   ziri chat "ask about your code"`);
  }
}

/**
 * DEPRECATED: Legacy Indexer (Basic Mode)
 * 
 * This legacy indexer is maintained for backward compatibility only.
 * Use --legacy flag to access this mode.
 * 
 * @deprecated Use enhanced context indexing instead (default behavior)
 */
export async function legacyIndexCommand({ argv }){
  // Disable enhanced storage for legacy mode
  setEnhancedStorageMode(false);
  const startTime = Date.now();

  // Handle set: targeting
  let repoPath = process.cwd();
  if (argv._ && argv._[0] && argv._[0].startsWith('set:')) {
    const setName = argv._[0].slice(4); // Remove 'set:' prefix
    console.log(`🎯 Targeting set: ${setName}`);

    // Load sources and find the set
    try {
      const sources = await getSources();
      const targetSet = sources.sets?.[setName];

      if (!targetSet || targetSet.length === 0) {
        console.error(`❌ Set '${setName}' not found or empty`);
        console.log(`Available sets: ${Object.keys(sources.sets || {}).join(', ') || 'none'}`);
        process.exit(1);
      }

      if (targetSet.length > 1) {
        console.error(`❌ Set '${setName}' contains multiple repositories. Please specify a single repository path.`);
        console.log(`Set contents:`, targetSet);
        process.exit(1);
      }

      repoPath = targetSet[0];
      console.log(`📁 Using repository: ${repoPath}`);

      // Change to the target directory
      process.chdir(repoPath);
      console.log(`📂 Changed working directory to: ${repoPath}`);

    } catch (error) {
      console.error(`❌ Failed to load set '${setName}':`, error.message);
      process.exit(1);
    }
  }
  const { repoId, alias } = await computeRepoId(repoPath);
  
  console.log(`🔍 Indexing repository: ${alias}`);
  console.log(`📁 Path: ${repoPath}`);
  console.log(`🆔 Repo ID: ${repoId.slice(0, 8)}...`);
  
  const storeDir = repoStoreDir(resolveHome(), alias, repoId);
  await ensureRepoStore(storeDir);
  const manifestPath = path.join(storeDir, 'manifest.json');
  let manifest = {}; try { manifest = JSON.parse(await fs.readFile(manifestPath,'utf-8')); } catch {}

  const embedder = makeEmbedder(process.env.ZIRI_EMBEDDER || 'ollama', {});
  console.log(`🤖 Using embedder: ${embedder.id} (${embedder.model})`);
  
  const indexArr = await readIndex(storeDir);
  let processed=0, skipped=0, upserts=0, totalFiles=0, totalBytes=0, totalChunks=0;
  
  // First pass: count total files for progress
  console.log(`📊 Scanning files...`);
  const filesToProcess = [];
  
  // Use parallel walk if enabled
  const useParallelWalk = argv.parallel || process.env.ZIRI_PARALLEL_WALK === 'true';
  const walkOptions = {
    concurrency: argv.walkConcurrency ? parseInt(argv.walkConcurrency) : 4
  };
  
  const fileWalker = useParallelWalk ? (...args) => parallelWalk(...args) : walkDir;
  const walker = useParallelWalk ? fileWalker(repoPath, walkOptions) : fileWalker(repoPath);
  
  for await (const { full, rel } of walker){
    const stat = await fs.stat(full);
    if (stat.size > 1.5*1024*1024) continue; // Skip large files
    filesToProcess.push({ full, rel, size: stat.size });
    totalFiles++;
  }
  
  console.log(`📈 Found ${totalFiles} files to process`);
  console.log(`⚡ Starting indexing...`);
  
  for (const { full, rel, size } of filesToProcess){
    const content = await fs.readFile(full, 'utf-8');
    const fileHash = sha256(content);
    
    // Progress indicator
    const progress = Math.round(((processed + skipped) / totalFiles) * 100);
    const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
    process.stdout.write(`\r[${progressBar}] ${progress}% | Processing: ${rel.slice(-40)}`);
    
    if (manifest[rel]?.hash === fileHash){ 
      skipped++; 
      continue; 
    }
    
    // Use enhanced chunking with line numbers
    const chunks = chunkTextWithLines(content);
    totalBytes += size;
    totalChunks += chunks.length;
    
    console.log(`\n📄 ${rel} (${chunks.length} chunks, ${(size/1024).toFixed(1)}KB)`);
    
    const batch=[]; let budget=2048; // Reduced from 4096 for better reliability
    const flush = async ()=>{
      if (!batch.length) return;
      
      process.stdout.write(`  🔄 Embedding ${batch.length} chunks...`);
      const embeddingStart = Date.now();
      
      const vecs = await embedder.embedBatch(batch.map(b=>b.chunk.content));
      
      const embeddingTime = Date.now() - embeddingStart;
      process.stdout.write(` ✅ (${embeddingTime}ms)\n`);
      
      for(let i=0;i<batch.length;i++){
        const id = sha256(alias+'|'+rel+'|'+i+'|'+fileHash);
        const chunk = batch[i].chunk;

        // Enhanced chunk data with line numbers and metadata
        const chunkData = {
          chunkId: id,
          content: chunk.content,
          filePath: full,
          relativePath: rel,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          size: chunk.content.length,
          tokenCount: Math.ceil(chunk.content.length / 4),
          type: 'code'
        };

        await saveChunk(storeDir, id, vecs[i], chunkData);
        indexArr.push({ id, relPath: rel, meta: { alias } });
      }
      upserts += batch.length; batch.length=0; budget=2048;
      await writeIndex(storeDir, indexArr);
    };
    
    for (let i=0;i<chunks.length;i++){
      const chunk = chunks[i]; 
      const est = Math.ceil(chunk.content.length/4);
      if (est>2048) continue;
      if (est>budget) await flush();
      batch.push({ chunk }); budget -= est;
    }
    await flush();
    manifest[rel] = { hash:fileHash, bytes: size, chunks: chunks.length, mtime: Date.now() };
    processed++;
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf-8');
  await writeIndex(storeDir, indexArr);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log(`\n\n✅ Indexing complete!`);
  console.log(`📊 Summary:`);
  console.log(`   📁 Repository: ${alias}`);
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log(`   📄 Files processed: ${processed}`);
  console.log(`   ⏭️  Files skipped: ${skipped} (unchanged)`);
  console.log(`   🧩 Total chunks: ${totalChunks}`);
  console.log(`   📦 Vector embeddings: ${upserts}`);
  console.log(`   💾 Total size: ${(totalBytes/1024/1024).toFixed(2)}MB`);
  console.log(`   🚀 Processing rate: ${(processed/parseFloat(duration)).toFixed(1)} files/sec`);
  
  if (upserts > 0) {
    console.log(`\n🎯 Ready to query! Try:`);
    console.log(`   ziri query "your search terms"`);
  }
}

// Main indexer command - uses enhanced context indexing
export async function indexCommand({ argv, configManager }) {
  console.log('🚀 Using enhanced context indexer...');
  setEnhancedStorageMode(true);
  return await enhancedLegacyIndexCommand({ argv, configManager });
}

// Removed complex event setup function - not needed for enhanced legacy indexer

// Helper functions for enhanced metadata extraction

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'ini',
    '.conf': 'config',
    '.md': 'markdown',
    '.txt': 'text'
  };
  return languageMap[ext] || 'unknown';
}

function detectCodeType(content) {
  const trimmed = content.trim();
  
  // Function detection
  if (/^(function|def|async\s+function|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\(|var\s+\w+\s*=\s*\()/m.test(trimmed)) {
    return 'function';
  }
  
  // Class detection
  if (/^(class|interface|type\s+\w+\s*=)/m.test(trimmed)) {
    return 'class';
  }
  
  // Import/export detection
  if (/^(import|export|from|require\()/m.test(trimmed)) {
    return 'import';
  }
  
  // Comment detection
  if (/^(\/\/|\/\*|\*|#|<!--)/m.test(trimmed)) {
    return 'comment';
  }
  
  return 'code';
}

function extractFunctionName(content) {
  const patterns = [
    /function\s+(\w+)/,
    /def\s+(\w+)/,
    /const\s+(\w+)\s*=/,
    /let\s+(\w+)\s*=/,
    /var\s+(\w+)\s*=/,
    /(\w+)\s*:\s*function/,
    /(\w+)\s*\(/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function extractClassName(content) {
  const patterns = [
    /class\s+(\w+)/,
    /interface\s+(\w+)/,
    /type\s+(\w+)\s*=/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function extractImports(content) {
  const imports = [];
  const patterns = [
    /import\s+.*?from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g,
    /from\s+['"]([^'"]+)['"]/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }
  
  return imports.length > 0 ? imports : null;
}

function getSurroundingContext(fullContent, startLine, endLine) {
  const lines = fullContent.split('\n');
  const contextLines = 2; // Number of lines before and after
  
  const beforeStart = Math.max(0, startLine - contextLines - 1);
  const afterEnd = Math.min(lines.length, endLine + contextLines);
  
  const before = lines.slice(beforeStart, startLine - 1);
  const after = lines.slice(endLine, afterEnd);
  
  if (before.length === 0 && after.length === 0) {
    return null;
  }
  
  return {
    before: before.length > 0 ? before : null,
    after: after.length > 0 ? after : null
  };
}