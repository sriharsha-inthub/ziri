import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveHome } from './home.js';
import { computeRepoId, repoStoreDir } from './repoid.js';
import { readIndex, loadVector, loadChunk } from './store_repo.js';
import { EnhancedStorage } from './storage/enhanced-storage.js';
import { cosineSim, TopK } from './similarity.js';
import { makeEmbedder } from './embedder.js';

/**
 * Enhanced query command with rich context results and scope support
 */
export async function queryCommand({ argv }){
  const q = argv._[1];
  if (!q){ console.error('Provide a query: ziri query "..."'); return; }

  const startTime = Date.now();
  const embedder = makeEmbedder(process.env.ZIRI_EMBEDDER || 'ollama', {});
  const qvec = (await embedder.embedBatch([q]))[0];
  const k = Math.max(1, parseInt(argv.k||'8',10));

  // Handle scope targeting
  let targetRepos = [];
  let scopeDescription = '';

  if (argv.scope) {
    if (argv.scope === 'all') {
      // Query all indexed repositories - for now, just current
      targetRepos = [{ path: process.cwd(), scope: 'all' }];
      scopeDescription = 'all repositories';
    } else if (argv.scope.startsWith('set:')) {
      // Query specific set
      const setName = argv.scope.slice(4);
      console.log(`🎯 Querying set: ${setName}`);

      try {
        // Import getSources dynamically
        const { getSources } = await import('./registry.js');
        const sources = await getSources();
        const targetSet = sources.sets?.[setName];

        if (!targetSet || targetSet.length === 0) {
          console.error(`❌ Set '${setName}' not found or empty`);
          console.log(`Available sets: ${Object.keys(sources.sets || {}).join(', ') || 'none'}`);
          return;
        }

        if (targetSet.length > 1) {
          console.error(`❌ Set '${setName}' contains multiple repositories. Please specify a single repository path.`);
          console.log(`Set contents:`, targetSet);
          return;
        }

        targetRepos = [{ path: targetSet[0], scope: setName }];
        scopeDescription = `set '${setName}'`;

      } catch (error) {
        console.error(`❌ Failed to load set '${setName}':`, error.message);
        return;
      }
    } else if (argv.scope === 'repo') {
      // Query current repository (default behavior)
      targetRepos = [{ path: process.cwd(), scope: 'current' }];
      scopeDescription = 'current repository';
    } else {
      console.error(`❌ Unsupported scope: ${argv.scope}`);
      console.log(`Supported scopes: repo, all, set:NAME`);
      return;
    }
  } else {
    // Default: query current repository
    targetRepos = [{ path: process.cwd(), scope: 'current' }];
    scopeDescription = 'current repository';
  }

  console.log(`🔍 Querying: "${q}"`);
  console.log(`📁 Scope: ${scopeDescription}`);
  console.log(`🧩 Top ${k} results`);

  let allResults = [];
  let totalIndexSize = 0;

  // Query each target repository
  for (const target of targetRepos) {
    try {
      const { repoId, alias } = await computeRepoId(target.path);
      const store = repoStoreDir(resolveHome(), alias, repoId);

      console.log(`   🔍 Searching in: ${alias} (${target.scope})`);

      // Try to read index from legacy location
      let index = [];
      try {
        index = await readIndex(store);
        console.log(`   📊 Found ${index.length} indexed items`);
      } catch (error) {
        console.log(`   ⚠️  No index found for ${alias}: ${error.message}`);
        continue;
      }

      if (index.length === 0) {
        console.log(`   📭 No indexed data found for ${alias}`);
        continue;
      }

      // Search in this repository
      const repoResults = new TopK(k);

      for (const row of index){
        try {
          const v = await loadVector(store, row.id);
          const score = cosineSim(qvec, v);
          repoResults.push({
            id: row.id,
            score,
            relPath: row.relPath,
            store,
            repo: alias,
            scope: target.scope
          });
        } catch (error) {
          console.warn(`   ⚠️  Could not load vector ${row.id}: ${error.message}`);
        }
      }

      // Add results from this repository
      allResults = allResults.concat(repoResults.values());
      totalIndexSize += index.length;

    } catch (error) {
      console.warn(`   ⚠️  Could not query repository ${target.path}: ${error.message}`);
    }
  }

  if (allResults.length === 0) {
    console.log(`\n📭 No results found in ${scopeDescription}`);
    console.log(`   💡 Make sure the repository has been indexed first:`);
    console.log(`      ziri index --verbose`);
    return;
  }

  // Sort all results and take top k
  allResults.sort((a, b) => b.score - a.score);
  const topResults = allResults.slice(0, k);

  // Enrich results with content and metadata using enhanced storage
  const enhancedStorage = new EnhancedStorage();
  const enrichedResults = [];
  
  for (const result of topResults) {
    try {
      // Try to load enhanced chunk data first
      const enhancedChunkData = await enhancedStorage.loadEnhancedChunk(result.store, result.id);
      
      if (enhancedChunkData) {
        // Convert enhanced chunk data to rich query result
        const enhancedResult = createEnhancedQueryResult(enhancedChunkData, result.score, result.repo, q);
        enhancedResult.scope = result.scope;
        enrichedResults.push(enhancedResult);
      } else {
        // Fallback: try to load basic chunk data and enhance it
        const basicChunkData = await loadChunk(result.store, result.id);
        
        if (basicChunkData) {
          // Convert basic chunk to enhanced format on-the-fly
          const enhancedResult = enhancedStorage.convertToQueryResult(basicChunkData, result.score, result.repo);
          enhancedResult.scope = result.scope;
          enrichedResults.push(enhancedResult);
        } else {
          // Last resort: create minimal result for backward compatibility
          enrichedResults.push(createLegacyQueryResult(result));
        }
      }
    } catch (error) {
      // Error loading chunk data - create minimal result
      console.warn(`⚠️  Could not load content for ${result.id}: ${error.message}`);
      enrichedResults.push(createLegacyQueryResult(result));
    }
  }

  const queryTime = Date.now() - startTime;

  // Display summary
  console.log(`\n📊 Query Results:`);
  console.log(`   ⏱️  Query time: ${queryTime}ms`);
  console.log(`   🎯 Results found: ${enrichedResults.length}`);
  console.log(`   📄 Enhanced results: ${enrichedResults.filter(r => r.context && r.context.length > 0).length}`);
  console.log(`   🔄 Legacy results: ${enrichedResults.filter(r => r.metadata?.compatibility === 'legacy').length}`);
  console.log(`   📂 Repositories searched: ${targetRepos.length}`);
  console.log(`   📊 Total indexed items: ${totalIndexSize}`);

  // Display rich results in a user-friendly format
  if (argv.json) {
    // JSON output for programmatic use
    console.log(`\n${JSON.stringify(enrichedResults, null, 2)}`);
  } else {
    // Human-readable output with rich formatting
    displayRichQueryResults(enrichedResults, q);
  }

  if (enrichedResults.some(r => r.context && r.context.length > 0)) {
    console.log(`\n💡 Enhanced results include actual code snippets and surrounding context!`);
    if (!argv.json) {
      console.log(`   Use --json flag for machine-readable output`);
    }
  }

  if (enrichedResults.length === 0) {
    console.log(`\n💡 Tip: Make sure to index the repository first:`);
    console.log(`   ziri index --verbose`);
  }
}

/**
 * Create enhanced query result from enhanced chunk data
 */
export function createEnhancedQueryResult(chunkData, score, repoAlias, originalQuery) {
  // Apply function name ranking boost (Requirement 7.5)
  let adjustedScore = score;
  if (chunkData.functionName && typeof chunkData.functionName === 'string' && originalQuery.toLowerCase().includes(chunkData.functionName.toLowerCase())) {
    adjustedScore = Math.min(1.0, score * 1.2); // 20% boost for function name matches
  }
  if (chunkData.className && typeof chunkData.className === 'string' && originalQuery.toLowerCase().includes(chunkData.className.toLowerCase())) {
    adjustedScore = Math.min(1.0, score * 1.15); // 15% boost for class name matches
  }

  return {
    score: Number(adjustedScore.toFixed(4)),
    file: chunkData.relativePath,
    repo: repoAlias,
    lines: `${chunkData.startLine}-${chunkData.endLine}`,
    context: chunkData.content, // Actual code snippets (Requirements 3.5)
    language: chunkData.language, // Language detection (Requirements 3.5)
    type: chunkData.type,
    functionName: chunkData.functionName,
    className: chunkData.className,
    functions: chunkData.functions || [],
    classes: chunkData.classes || [],
    imports: chunkData.imports || [],
    comments: chunkData.comments || [],
    docstrings: chunkData.docstrings || [],
    signature: chunkData.signature,
    relevanceExplanation: generateAdvancedRelevanceExplanation(chunkData, adjustedScore, originalQuery),
    surroundingLines: chunkData.surroundingContext, // Surrounding context (task requirement)
    metadata: {
      ...chunkData.metadata,
      syntaxInfo: generateSyntaxInfo(chunkData), // Basic syntax information (Requirements 3.6)
      queryMatch: analyzeQueryMatch(chunkData, originalQuery)
    }
  };
}

/**
 * Create legacy query result for backward compatibility
 */
function createLegacyQueryResult(result) {
  return {
    score: Number(result.score.toFixed(4)),
    file: result.relPath,
    repo: result.repo,
    scope: result.scope,
    lines: "1-1", // Default for legacy
    context: "", // No content available
    language: "unknown",
    type: "code",
    relevanceExplanation: `${Math.round(result.score * 100)}% similarity match (legacy mode)`,
    metadata: {
      compatibility: 'legacy',
      syntaxInfo: { hasContent: false }
    }
  };
}

/**
 * Generate advanced relevance explanation with query context
 */
export function generateAdvancedRelevanceExplanation(chunkData, score, originalQuery) {
  const scorePercent = Math.round(score * 100);
  let explanation = `${scorePercent}% match`;
  
  // Analyze what made this result relevant
  const queryLower = originalQuery.toLowerCase();
  const matchReasons = [];
  
  // Check for direct matches
  if (chunkData.functionName && typeof chunkData.functionName === 'string' && queryLower.includes(chunkData.functionName.toLowerCase())) {
    matchReasons.push(`function '${chunkData.functionName}'`);
  }
  if (chunkData.className && typeof chunkData.className === 'string' && queryLower.includes(chunkData.className.toLowerCase())) {
    matchReasons.push(`class '${chunkData.className}'`);
  }
  
  // Check for content matches
  if (chunkData.content && chunkData.content.toLowerCase().includes(queryLower)) {
    matchReasons.push('direct content match');
  }
  
  // Check for import matches
  if (chunkData.imports && chunkData.imports.some(imp => typeof imp === 'string' && queryLower.includes(imp.toLowerCase()))) {
    matchReasons.push('import statement');
  }
  
  // Add context about the code structure
  if (matchReasons.length > 0) {
    explanation += ` - found in ${matchReasons.join(', ')}`;
  } else {
    // Semantic match
    if (chunkData.type === 'function') {
      explanation += ` - semantic match in function`;
      if (chunkData.signature) {
        explanation += ` (${chunkData.signature.substring(0, 30)}...)`;
      }
    } else if (chunkData.type === 'class') {
      explanation += ` - semantic match in class definition`;
    } else if (chunkData.type === 'import') {
      explanation += ` - related imports`;
    } else if (chunkData.type === 'comment') {
      explanation += ` - documentation/comments`;
    } else {
      explanation += ` - semantic similarity`;
    }
  }
  
  // Add language and location context
  explanation += ` (${chunkData.language}, lines ${chunkData.startLine}-${chunkData.endLine})`;
  
  return explanation;
}

/**
 * Generate basic syntax information for the code chunk
 */
export function generateSyntaxInfo(chunkData) {
  const info = {
    hasContent: Boolean(chunkData.content),
    language: chunkData.language,
    lineCount: chunkData.endLine - chunkData.startLine + 1,
    hasFunction: Boolean(chunkData.functionName),
    hasClass: Boolean(chunkData.className),
    hasImports: Boolean(chunkData.imports && chunkData.imports.length > 0),
    hasComments: Boolean(chunkData.comments && chunkData.comments.length > 0),
    hasDocstrings: Boolean(chunkData.docstrings && chunkData.docstrings.length > 0)
  };
  
  // Add syntax-specific information based on language
  if (chunkData.language === 'javascript' || chunkData.language === 'typescript') {
    info.syntaxFeatures = {
      functions: chunkData.functions?.length || 0,
      classes: chunkData.classes?.length || 0,
      exports: chunkData.content ? (chunkData.content.match(/export\s+/g) || []).length : 0,
      async: chunkData.content ? chunkData.content.includes('async ') : false
    };
  } else if (chunkData.language === 'python') {
    info.syntaxFeatures = {
      functions: chunkData.functions?.length || 0,
      classes: chunkData.classes?.length || 0,
      decorators: chunkData.content ? (chunkData.content.match(/@\w+/g) || []).length : 0,
      async: chunkData.content ? chunkData.content.includes('async def') : false
    };
  }
  
  return info;
}

/**
 * Analyze how the query matches the chunk content
 */
export function analyzeQueryMatch(chunkData, originalQuery) {
  const queryLower = originalQuery.toLowerCase();
  const contentLower = chunkData.content ? chunkData.content.toLowerCase() : '';
  
  return {
    directMatch: contentLower.includes(queryLower),
    functionMatch: chunkData.functionName && typeof chunkData.functionName === 'string' && queryLower.includes(chunkData.functionName.toLowerCase()),
    classMatch: chunkData.className && typeof chunkData.className === 'string' && queryLower.includes(chunkData.className.toLowerCase()),
    importMatch: chunkData.imports && chunkData.imports.some(imp => typeof imp === 'string' && queryLower.includes(imp.toLowerCase())),
    commentMatch: chunkData.comments && chunkData.comments.some(comment => 
      typeof comment === 'string' && comment.toLowerCase().includes(queryLower)
    ),
    partialMatches: extractPartialMatches(contentLower, queryLower)
  };
}

/**
 * Extract partial word matches for better relevance understanding
 */
function extractPartialMatches(content, query) {
  const queryWords = query.split(/\s+/).filter(word => word.length > 2);
  const matches = [];
  
  for (const word of queryWords) {
    if (content.includes(word)) {
      matches.push(word);
    }
  }
  
  return matches;
}

/**
 * Display rich query results in human-readable format
 */
function displayRichQueryResults(results, originalQuery) {
  console.log(`\n🔍 Rich Query Results for: "${originalQuery}"`);
  console.log(`${'='.repeat(60)}`);
  
  results.forEach((result, index) => {
    console.log(`\n📄 Result ${index + 1}:`);
    console.log(`   📊 Score: ${result.score} (${Math.round(result.score * 100)}%)`);
    console.log(`   📁 File: ${result.file}`);
    console.log(`   📍 Lines: ${result.lines}`);
    console.log(`   🏷️  Language: ${result.language}`);
    console.log(`   🔖 Type: ${result.type}`);
    
    if (result.functionName) {
      console.log(`   🔧 Function: ${result.functionName}`);
    }
    if (result.className) {
      console.log(`   🏗️  Class: ${result.className}`);
    }
    
    console.log(`   💡 Relevance: ${result.relevanceExplanation}`);
    
    // Display code context if available
    if (result.context && result.context.trim().length > 0) {
      console.log(`\n   📝 Code Context:`);
      
      // Parse line numbers from the lines field
      const [startLine, endLine] = result.lines.split('-').map(n => parseInt(n, 10));
      
      // Show surrounding context (before)
      if (result.surroundingLines?.before && result.surroundingLines.before.length > 0) {
        console.log(`   ${'-'.repeat(40)}`);
        result.surroundingLines.before.forEach((line, i) => {
          const lineNum = startLine ? startLine - result.surroundingLines.before.length + i : '?';
          console.log(`   ${String(lineNum).padStart(4)} | ${line}`);
        });
      }
      
      // Show main content
      console.log(`   ${'-'.repeat(40)}`);
      const contentLines = result.context.split('\n');
      contentLines.forEach((line, i) => {
        const lineNum = startLine ? startLine + i : i + 1;
        console.log(`   ${String(lineNum).padStart(4)} |>${line}`); // > indicates main content
      });
      
      // Show surrounding context (after)
      if (result.surroundingLines?.after && result.surroundingLines.after.length > 0) {
        result.surroundingLines.after.forEach((line, i) => {
          const lineNum = endLine ? endLine + i + 1 : '?';
          console.log(`   ${String(lineNum).padStart(4)} | ${line}`);
        });
      }
      console.log(`   ${'-'.repeat(40)}`);
    }
    
    // Display syntax information
    if (result.metadata?.syntaxInfo) {
      const syntax = result.metadata.syntaxInfo;
      const features = [];
      
      if (syntax.hasFunction) features.push(`${syntax.syntaxFeatures?.functions || 1} function(s)`);
      if (syntax.hasClass) features.push(`${syntax.syntaxFeatures?.classes || 1} class(es)`);
      if (syntax.hasImports) features.push('imports');
      if (syntax.hasComments) features.push('comments');
      if (syntax.hasDocstrings) features.push('documentation');
      
      if (features.length > 0) {
        console.log(`   🔧 Contains: ${features.join(', ')}`);
      }
    }
    
    // Display additional metadata for enhanced results
    if (result.functions && result.functions.length > 0) {
      console.log(`   🔧 Functions: ${result.functions.slice(0, 3).join(', ')}${result.functions.length > 3 ? '...' : ''}`);
    }
    if (result.classes && result.classes.length > 0) {
      console.log(`   🏗️  Classes: ${result.classes.slice(0, 3).join(', ')}${result.classes.length > 3 ? '...' : ''}`);
    }
    if (result.imports && result.imports.length > 0) {
      console.log(`   📦 Imports: ${result.imports.slice(0, 2).join(', ')}${result.imports.length > 2 ? '...' : ''}`);
    }
    
    if (index < results.length - 1) {
      console.log(`\n${'─'.repeat(60)}`);
    }
  });
  
  console.log(`\n${'='.repeat(60)}`);
}

/**
 * Generate human-readable relevance explanation (legacy function, kept for compatibility)
 */
function generateRelevanceExplanation(score, chunkData) {
  const confidence = score > 0.8 ? 'High' : score > 0.6 ? 'Medium' : 'Low';

  let explanation = `${confidence} confidence match`;

  if (chunkData) {
    if (chunkData.type === 'function') {
      explanation += ` on function definition`;
    } else if (chunkData.type === 'class') {
      explanation += ` on class definition`;
    } else if (chunkData.language) {
      explanation += ` in ${chunkData.language} code`;
    }

    if (chunkData.startLine && chunkData.endLine) {
      explanation += ` (lines ${chunkData.startLine}-${chunkData.endLine})`;
    }
  }

  return explanation;
}
