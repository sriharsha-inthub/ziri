import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  Hover,
  Definition,
  Location,
  SymbolInformation,
  WorkspaceSymbolParams,
  TextDocumentSyncKind
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { queryCommand, createEnhancedQueryResult } from '../query.js';
import { ConfigManager } from '../config/config-manager.js';
import { readIndex, loadChunk, loadVector } from '../store_repo.js';
import { computeRepoId, repoStoreDir } from '../repoid.js';
import { resolveHome } from '../home.js';
import { makeEmbedder } from '../embedder.js';
import { cosineSim, TopK } from '../similarity.js';
import { EnhancedStorage } from '../storage/enhanced-storage.js';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Ziri Language Server Protocol (LSP) Wrapper
 * 
 * This module implements LSP server functionality to enable Ziri integration
 * with any IDE that supports Language Server Protocol.
 */

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

// Global state
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let configManager = null;
let currentRepoPath = process.cwd();
let embedder = null;

/**
 * Initialize the LSP server
 */
connection.onInitialize((params) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      },
      // Tell the client that this server supports hover
      hoverProvider: true,
      // Tell the client that this server supports definition
      definitionProvider: true,
      // Tell the client that this server supports workspace symbols
      workspaceSymbolProvider: true
    }
  };
});

/**
 * Handle initialized event
 */
connection.onInitialized(async () => {
  connection.console.log('Ziri LSP server initialized');
  
  // Initialize configuration manager
  configManager = new ConfigManager();
  
  // Initialize embedder
  try {
    const config = await configManager.getConfig();
    const defaultProvider = config.defaultProvider || 'ollama';
    embedder = makeEmbedder(defaultProvider, config);
    connection.console.log(`Using embedder: ${embedder.id} (${embedder.model})`);
  } catch (error) {
    connection.console.error(`Failed to initialize embedder: ${error.message}`);
    // Fallback to default embedder
    embedder = makeEmbedder('ollama', {});
  }
  
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.registerDidChangeConfiguration(() => {});
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

/**
 * Handle configuration changes
 */
connection.onDidChangeConfiguration((change) => {
  connection.console.log('Configuration changed');
});

/**
 * Handle document open events
 */
documents.onDidOpen((change) => {
  connection.console.log(`Document opened: ${change.document.uri}`);
  // Could trigger real-time indexing here if needed
});

/**
 * Handle document change events with debouncing
 */
const documentChangeTimers = new Map();
const DOCUMENT_CHANGE_DEBOUNCE = 1000; // 1 second debounce

documents.onDidChangeContent((change) => {
  const uri = change.document.uri;
  connection.console.log(`Document changed: ${uri}`);
  
  // Clear existing timer for this document
  if (documentChangeTimers.has(uri)) {
    clearTimeout(documentChangeTimers.get(uri));
  }
  
  // Set new timer with debounce
  const timer = setTimeout(async () => {
    try {
      connection.console.log(`Processing document change for: ${uri}`);
      // Here we could implement real-time indexing of the changed document
      // For now, we'll just log that changes occurred
      await processDocumentChange(uri, change.document);
    } catch (error) {
      connection.console.error(`Error processing document change: ${error.message}`);
    } finally {
      documentChangeTimers.delete(uri);
    }
  }, DOCUMENT_CHANGE_DEBOUNCE);
  
  documentChangeTimers.set(uri, timer);
});

/**
 * Process document changes (placeholder for real-time indexing)
 */
async function processDocumentChange(uri, document) {
  // This is where we would implement real-time indexing of changed documents
  // For now, we'll just log the change
  connection.console.log(`📝 Document ${uri} has ${document.lineCount} lines`);
  
  // In a full implementation, this would:
  // 1. Extract the file path from the URI
  // 2. Parse the document content
  // 3. Generate embeddings for the content
  // 4. Update the index with the new content
  // 5. Notify any dependent queries
}

/**
 * Handle document close events
 */
documents.onDidClose((change) => {
  const uri = change.document.uri;
  connection.console.log(`Document closed: ${uri}`);
  
  // Clear any pending timers for this document
  if (documentChangeTimers.has(uri)) {
    clearTimeout(documentChangeTimers.get(uri));
    documentChangeTimers.delete(uri);
  }
});

/**
 * Handle hover requests
 */
connection.onHover(async (params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const position = params.position;
    const offset = document.offsetAt(position);
    const text = document.getText();
    
    // Get the word at the cursor position
    const word = getWordAtPosition(text, offset);
    if (!word) {
      return null;
    }

    // Query Ziri for context about this word
    const queryResult = await queryZiriForContext(word, currentRepoPath);
    
    if (queryResult && queryResult.results && queryResult.results.length > 0) {
      const firstResult = queryResult.results[0];
      let hoverContent = `**${word}**\n\n`;
      
      if (firstResult.context) {
        const language = firstResult.language || 'text';
        hoverContent += `\`\`\`${language}\n${firstResult.context}\n\`\`\`\n\n`;
      }
      
      if (firstResult.relevanceExplanation) {
        hoverContent += `_${firstResult.relevanceExplanation}_\n\n`;
      }
      
      if (firstResult.file) {
        hoverContent += `📁 File: \`${firstResult.file}\``;
      }

      return {
        contents: {
          kind: 'markdown',
          value: hoverContent
        }
      };
    }
  } catch (error) {
    connection.console.error(`Error in hover provider: ${error.message}`);
  }
  
  return null;
});

/**
 * Handle definition requests (jump to definition)
 */
connection.onDefinition(async (params) => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const position = params.position;
    const offset = document.offsetAt(position);
    const text = document.getText();
    
    // Get the word at the cursor position
    const word = getWordAtPosition(text, offset);
    if (!word) {
      return null;
    }

    // Query Ziri for definition context
    const queryResult = await queryZiriForContext(word, currentRepoPath);
    
    if (queryResult && queryResult.results && queryResult.results.length > 0) {
      const locations = [];
      
      for (const result of queryResult.results) {
        if (result.file) {
          try {
            // Convert file path to URI
            const filePath = path.resolve(currentRepoPath, result.file);
            const uri = `file://${filePath.replace(/\\/g, '/')}`;
            
            const startLine = Math.max(0, (result.lines ? parseInt(result.lines.split('-')[0]) : 1) - 1);
            const endLine = Math.max(0, (result.lines ? parseInt(result.lines.split('-')[1] || result.lines.split('-')[0]) : 1) - 1);
            
            locations.push({
              uri: uri,
              range: {
                start: { line: startLine, character: 0 },
                end: { line: endLine, character: 1000 }
              }
            });
          } catch (error) {
            connection.console.error(`Error processing location: ${error.message}`);
          }
        }
      }
      
      return locations;
    }
  } catch (error) {
    connection.console.error(`Error in definition provider: ${error.message}`);
  }
  
  return null;
});

/**
 * Handle workspace symbol requests
 */
connection.onWorkspaceSymbol(async (params) => {
  try {
    const query = params.query;
    if (!query) {
      return [];
    }

    // Query Ziri for workspace symbols
    const queryResult = await queryZiriForContext(query, currentRepoPath);
    
    if (queryResult && queryResult.results) {
      const symbols = [];
      
      for (const result of queryResult.results.slice(0, 50)) { // Limit to 50 results
        if (result.functionName || result.className) {
          const symbolKind = result.functionName ? 12 : 5; // Function or Class
          const symbolName = result.functionName || result.className;
          
          const filePath = path.resolve(currentRepoPath, result.file);
          const uri = `file://${filePath.replace(/\\/g, '/')}`;
          
          const startLine = Math.max(0, (result.lines ? parseInt(result.lines.split('-')[0]) : 1) - 1);
          const endLine = Math.max(0, (result.lines ? parseInt(result.lines.split('-')[1] || result.lines.split('-')[0]) : 1) - 1);
          
          symbols.push({
            name: symbolName,
            kind: symbolKind,
            location: {
              uri: uri,
              range: {
                start: { line: startLine, character: 0 },
                end: { line: endLine, character: 1000 }
              }
            },
            containerName: result.file
          });
        }
      }
      
      return symbols;
    }
  } catch (error) {
    connection.console.error(`Error in workspace symbol provider: ${error.message}`);
  }
  
  return [];
});

/**
 * Handle completion requests
 */
connection.onCompletion(async (_textDocumentPosition) => {
  // Return empty completion list for now
  return [];
});

/**
 * Handle completion item resolution
 */
connection.onCompletionResolve((item) => {
  return item;
});

/**
 * Helper function to get word at position
 */
function getWordAtPosition(text, offset) {
  const left = text.slice(0, offset).search(/\w+$/);
  const right = text.slice(offset).search(/\W/);
  if (left === -1) return null;
  const word = text.slice(left, offset + (right === -1 ? text.length : right));
  return word || null;
}

/**
 * Query Ziri for context about a term using semantic search
 */
async function queryZiriForContext(term, repoPath) {
  try {
    connection.console.log(`🔍 Querying Ziri for: ${term}`);
    
    if (!embedder) {
      connection.console.error('Embedder not initialized');
      return null;
    }
    
    // Generate embedding for the query term
    const queryVector = (await embedder.embedBatch([term]))[0];
    const k = 10; // Number of results to return
    
    // Compute repo ID and store directory
    const { repoId, alias } = await computeRepoId(repoPath);
    const storeDir = repoStoreDir(resolveHome(), alias, repoId);
    
    // Read index
    const indexArr = await readIndex(storeDir);
    if (!indexArr || indexArr.length === 0) {
      connection.console.log('⚠️  No index found for repository');
      return null;
    }
    
    // Search through indexed chunks using semantic similarity
    const results = new TopK(k);
    
    for (const entry of indexArr) {
      try {
        const vector = await loadVector(storeDir, entry.id);
        const score = cosineSim(queryVector, vector);
        results.push({
          id: entry.id,
          score,
          relPath: entry.relPath,
          store: storeDir,
          repo: alias
        });
      } catch (error) {
        // Continue with other entries if one fails
        continue;
      }
    }
    
    // Get top results
    const topResults = results.values();
    if (topResults.length === 0) {
      return null;
    }
    
    // Enrich results with content and metadata
    const enhancedStorage = new EnhancedStorage();
    const enrichedResults = [];
    
    for (const result of topResults) {
      try {
        // Try to load enhanced chunk data first
        const enhancedChunkData = await enhancedStorage.loadEnhancedChunk(result.store, result.id);
        
        if (enhancedChunkData) {
          // Convert enhanced chunk data to rich query result
          const enhancedResult = createEnhancedQueryResult(enhancedChunkData, result.score, result.repo, term);
          enrichedResults.push(enhancedResult);
        } else {
          // Fallback: try to load basic chunk data and enhance it
          const basicChunkData = await loadChunk(result.store, result.id);
          
          if (basicChunkData) {
            // Convert basic chunk to enhanced format on-the-fly
            const enhancedResult = enhancedStorage.convertToQueryResult(basicChunkData, result.score, result.repo);
            enrichedResults.push(enhancedResult);
          }
        }
      } catch (error) {
        // Continue with other results if one fails
        continue;
      }
    }
    
    return {
      results: enrichedResults
    };
  } catch (error) {
    connection.console.error(`Error querying Ziri: ${error.message}`);
    return null;
  }
}

/**
 * Handle shutdown request
 */
connection.onShutdown(() => {
  connection.console.log('Ziri LSP server shutting down');
});

/**
 * Handle exit request
 */
connection.onExit(() => {
  connection.console.log('Ziri LSP server exiting');
  process.exit(0);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();