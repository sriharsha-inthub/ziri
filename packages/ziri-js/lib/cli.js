import minimist from 'minimist';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { ensureDirs, resolveHome } from './home.js';
import { addSource, removeSource, removeSet, listSources, getSources, SOURCES_PATH } from './registry.js';
import { indexCommand, legacyIndexCommand } from './indexer.js';
import { queryCommand } from './query.js';
import { chatCommand } from './chat.js';
import { watchCommand } from './watch.js';
import { lspCommand } from './lsp/command.js';
import { ConfigManager } from './config/config-manager.js';

async function initializeConfigManager() {
  try {
    console.log('🔧 Initializing configuration system...');
    const configManager = new ConfigManager();
    
    // Load environment configuration on initialization
    await configManager.loadEnvironmentConfig();
    
    return configManager;
  } catch (error) {
    console.warn(`⚠️  Configuration system failed: ${error.message}`);
    // Fallback to basic config manager
    return createFallbackConfigManager();
  }
}

function createFallbackConfigManager() {
  // Use file-based persistence for CLI configuration
  const configPath = join(resolveHome(), 'config', 'ziri-config.json');

  const loadConfig = async () => {
    try {
      const data = await readFile(configPath, 'utf8');
      return JSON.parse(data);
    } catch {
      // Return default config if file doesn't exist
      return {
        providers: {},
        performance: {
          concurrency: 3,
          batchSize: 50,
          memoryLimit: 512
        }
      };
    }
  };

  const saveConfig = async (config) => {
    const configDir = join(resolveHome(), 'config');
    try {
      await access(configDir);
    } catch {
      await mkdir(configDir, { recursive: true });
    }
    await writeFile(configPath, JSON.stringify(config, null, 2));
  };

  return {
    async initialize() {
      const config = await loadConfig();
      console.log(`🔧 Initializing config manager. Existing providers: ${Object.keys(config.providers).join(', ') || 'none'}`);

      // Set up default Ollama configuration
      if (!config.providers.ollama) {
        config.providers.ollama = {
          type: 'ollama',
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          model: 'nomic-embed-text',
          dimensions: 768,
          textModel: 'llama3.2'
        };
      }
      
      // Load additional provider config from environment
      if (process.env.OPENAI_API_KEY) {
        config.providers.openai = {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY,
          model: 'text-embedding-3-small',
          dimensions: 1536
        };
      }

      // Save updated config
      await saveConfig(config);
    },

    async getConfig() {
      const config = await loadConfig();
      return {
        defaultProvider: 'ollama', // Always default to Ollama
        providers: config.providers,
        performance: config.performance
      };
    },

    async setConfig(key, value) {
      const config = await loadConfig();
      if (key.startsWith('performance.')) {
        const perfKey = key.split('.')[1];
        config.performance[perfKey] = value;
      }
      await saveConfig(config);
      return true;
    },

    async configureProvider(name, config) {
      const currentConfig = await loadConfig();
      currentConfig.providers[name] = {
        type: name,
        ...config
      };
      await saveConfig(currentConfig);
      console.log(`✅ Configured provider: ${name}`);
      console.log(`   Current providers: ${Object.keys(currentConfig.providers).join(', ')}`);
      return true;
    },

    async resetConfig() {
      const defaultConfig = {
        providers: {},
        performance: {
          concurrency: 3,
          batchSize: 50,
          memoryLimit: 512
        }
      };
      await saveConfig(defaultConfig);
      return true;
    },

    async getProviderConfigs() {
      const config = await loadConfig();
      return config.providers;
    }
  };
}

async function getVersion() {
  try {
    // Try to read from package.json in the same directory as this module
    const packageJsonPath = new URL('../package.json', import.meta.url);
    const packageData = await readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    return packageJson.version || 'unknown';
  } catch (error) {
    // Fallback to hardcoded version if package.json can't be read
    return '0.1.6';
  }
}

export async function main(){
  const argv = minimist(process.argv.slice(2), {
    // String options
    string: [
      'scope', 'set', 'k', 'provider', 'concurrency', 'batch-size', 'memory-limit',
      'exclude', 'providers', 'duration', 'output', 'api-key', 'base-url', 'model',
      'config', 'key', 'socket'
    ],
    // Boolean options
    boolean: [
      'all', 'help', 'version', 'legacy', 'verbose', 'force', 'benchmark', 'stats',
      'stdio', 'node-ipc'
    ],
    // Aliases
    alias: {
      h: 'help',
      v: 'version',
      p: 'provider',
      c: 'concurrency',
      b: 'batch-size',
      m: 'memory-limit',
      f: 'force',
      s: 'stats',
      k: 'k'
    },
    // Default values
    default: {
      k: '8',
      concurrency: '5',
      'batch-size': '100',
      'memory-limit': '512',
      provider: 'ollama',
      duration: '60'
    }
  });

  // Handle version and help first, regardless of other arguments
  if (argv.version){
    const version = await getVersion();
    console.log(`ziri v${version}`);
    return;
  }
  if (argv.help){ return help(); }

  const cmd = argv._[0];
  if (!cmd){ return help(); }
  await ensureDirs();
  
  // Initialize configuration manager
  const configManager = await initializeConfigManager();
  
  switch (cmd){
    case 'index':
      console.log('🚀 Starting Ziri indexer...');
      if (argv.legacy) {
        await legacyIndexCommand({ argv });
      } else {
        await indexCommand({ argv, configManager });
      }
      break;
    case 'query': await queryCommand({ argv }); break;
    case 'chat': await chatCommand({ argv, configManager }); break;
    case 'watch': await watchCommand({ argv, configManager }); break;
    case 'lsp': await lspCommand({ argv }); break;
    case 'sources': await handleSources(argv); break;
    case 'config': await handleConfig(argv, configManager); break;
    case 'benchmark': await handleBenchmark(argv, configManager); break;
    case 'doctor': await doctor(configManager); break;
    case 'where':
      console.log('Home:', resolveHome());
      console.log('Sources registry:', SOURCES_PATH());
      break;
    case 'repl': 
      const { ZiriRepl } = await import('./repl.js');
      const repl = new ZiriRepl(configManager);
      await repl.start();
      break;
    case 'config-ui': 
      const { configUICommand } = await import('./config-ui/index.js');
      await configUICommand({ argv });
      break;
    default: help();
  }
}

function help(){
  console.log(`
Ziri — AI code context CLI

Usage:
  ziri [command] [options]                Run a command
  ziri --help                             Show this help message
  ziri --version                          Show version information

Commands:
  index [options]                    Index current repository with enhanced context (default)
  query "your question" [options]    Query indexed repositories with rich results
  chat "your question" [options]     Chat with AI using codebase context (Ollama default)
  watch [options]                    Watch repository and auto-reindex on file changes
  lsp [options]                      Start Language Server Protocol server for IDE integration
  repl                              Start interactive REPL mode
  sources <command> [options]        Manage source repositories
  config <command> [options]         Manage configuration
  config-ui [options]                Advanced configuration UI
  benchmark [options]                Run performance benchmarks
  doctor                             Check system health and Ollama status
  where                              Show storage locations

Index Options:
  --provider <name>        Embedding provider (ollama [default], openai, huggingface, cohere)
  --concurrency <num>      Concurrent processing threads (default: 5)
  --batch-size <num>       Batch size for embeddings (default: 100)
  --memory-limit <mb>      Memory limit in MB (default: 512)
  --force                  Force full re-index (ignore incremental updates)
  --legacy                 Use legacy indexer (DEPRECATED - will be removed in v2.0)
  --verbose                Show detailed progress information
  --stats                  Display comprehensive statistics
  --exclude <patterns>     Comma-separated exclusion patterns
  --parallel               Enable parallel file system walk (default: false)
  --walk-concurrency <num> Number of parallel file system walkers (default: 4)

Query Options:
  --scope <scope>          Query scope: repo (current), all (all indexed), set:NAME (specific set)
  --k <num>                Number of results to return (default: 8)

Chat Options (NEW):
  --k <num>                Number of context results to retrieve (default: 8)
  --scope <scope>          Query scope for context: repo (current), all (all indexed), set:NAME (specific set)
  --verbose                Show detailed processing and context information

Watch Options:
  --verbose                Show detailed file change information

LSP Options:
  --stdio                  Use stdio for communication (default for most IDEs)
  --socket <port>          Use socket for communication
  --node-ipc               Use node-ipc for communication

Config Commands:
  ziri config show                        Show current configuration
  ziri config set <key> <value>          Set configuration value
  ziri config provider <name> [options]  Configure embedding provider
  ziri config security <command>         Manage security settings
  ziri config reset                       Reset configuration to defaults

Config UI Options:
  start                    Start web-based configuration UI server
  show                     Show current configuration
  template [name]          Load or list templates
  export [--format]        Export configuration
  set <path> <value>       Set configuration value

Security Commands:
  ziri config security enable <passphrase>  Enable encryption with passphrase
  ziri config security disable              Disable encryption
  ziri config security status               Show encryption status

Provider Configuration (Ollama is default):
  --api-key <key>          API key for cloud providers (OpenAI, Hugging Face, Cohere)
  --base-url <url>         Base URL for Ollama or Hugging Face
  --model <model>          Model name for the provider

Ollama Setup (Recommended):
  # Install Ollama: https://ollama.ai/download
  # Pull models: ollama pull all-minilm && ollama pull llama3.2:3b
  ziri config provider ollama              # Configure Ollama (default)

Cloud Provider Setup:
  ziri config provider openai --api-key sk-your-key-here
  ziri config provider huggingface --api-key hf_your-key-here

General Configuration:
  ziri config set performance.concurrency 5
  ziri config set performance.batchSize 75
  ziri config set performance.memoryLimit 1024

Sources Commands:
  ziri sources add <path> [--set NAME]   Add repository to sources
  ziri sources list                      List all source repositories
  ziri sources remove <path>             Remove repository from sources

Benchmark Options:
  --providers <list>       Comma-separated list of providers to benchmark
  --duration <seconds>     Benchmark duration in seconds (default: 60)
  --output <file>          Save results to JSON file

Examples:
  # Quick start with Ollama (local, free)
  ziri index                                              # Enhanced context indexing
  ziri query "authentication logic"                       # Rich query results
  ziri chat "how does user authentication work?"          # AI chat with context
  ziri watch                                              # Auto-reindex on file changes
  ziri lsp                                                # Start LSP server for IDE integration
  
  # Advanced indexing
  ziri index --provider ollama --concurrency 5 --batch-size 100
  ziri index --force --verbose --stats                    # Full re-index with details
  
  # Querying and chat
  ziri query "database connection" --scope all --k 15     # Search all repos
  ziri chat "debug this login issue" --scope set:backend --verbose
  
  # Configuration
  ziri config provider ollama                             # Use local Ollama
  ziri config provider openai --api-key sk-your-key      # Use OpenAI
  ziri doctor                                             # Check Ollama status
  
  # Multi-repository management
  ziri sources add /path/to/repo --set backend
  ziri benchmark --providers ollama,openai --duration 120

Enhanced Context Features (Default):
  ✓ Rich metadata extraction (functions, classes, imports)
  ✓ Actual code snippets in query results
  ✓ Surrounding context lines for better understanding
  ✓ Language detection and syntax information
  ✓ Better relevance explanations
  ✓ Chat integration with AI for contextual assistance

Legacy Mode (Deprecated):
  Use --legacy flag for backward compatibility (will be removed in v2.0)
`);
}

async function handleSources(argv){
  const sub = argv._[1];
  if (sub==='add'){
    const p = argv._[2]; if (!p) return console.error('Path required');
    await addSource(p, argv.set || 'default'); console.log('Added:', p);
  } else if (sub==='list'){
    console.log(JSON.stringify(await listSources(), null, 2));
  } else if (sub==='remove'){
    const name = argv._[2]; if (!name) return console.error('Name required');
    const sources = await listSources();
    // Check if it's a set name
    if (sources.sets && sources.sets[name]) {
      await removeSet(name);
      console.log('Removed set:', name);
    } else {
      // Assume it's a path and remove from all sets
      await removeSource(name);
      console.log('Removed path:', name);
    }
  } else {
    console.log('Usage: ziri sources add|list|remove');
  }
}

async function handleConfig(argv, configManager) {
  const sub = argv._[1];
  
  if (sub === 'show') {
    const config = await configManager.getConfig();
    console.log('Current Configuration:');
    console.log(JSON.stringify(config, null, 2));
  } else if (sub === 'set') {
    const key = argv._[2];
    const value = argv._[3];
    if (!key || value === undefined) {
      console.error('Usage: ziri config set <key> <value>');
      return;
    }
    
    // Handle nested configuration updates
    const updateObj = {};
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = updateObj;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    } else {
      updateObj[key] = value;
    }
    
    await configManager.updateConfig(updateObj);
    console.log(`Set ${key} = ${value}`);
  } else if (sub === 'provider') {
    const provider = argv._[2];
    if (!provider) {
      console.error('Usage: ziri config provider <name> [options]');
      return;
    }
    
    const providerConfig = {};
    if (argv['api-key']) providerConfig.apiKey = argv['api-key'];
    if (argv['base-url']) providerConfig.baseUrl = argv['base-url'];
    if (argv.model) providerConfig.model = argv.model;
    if (argv['embedding-model']) providerConfig.embeddingModel = argv['embedding-model'];
    if (argv['text-model']) providerConfig.textModel = argv['text-model'];
    
    // Set defaults for Ollama provider
    if (provider === 'ollama') {
      providerConfig.model = providerConfig.embeddingModel || providerConfig.model || 'nomic-embed-text';
      providerConfig.textModel = providerConfig.textModel || 'llama3.2:3b';
      providerConfig.dimensions = 768; // nomic-embed-text dimensions
      providerConfig.baseUrl = providerConfig.baseUrl || 'http://localhost:11434';
    }
    
    await configManager.configureProvider(provider, providerConfig);
    console.log(`Configured provider: ${provider}`);
  } else if (sub === 'security') {
    // Handle security configuration
    await handleSecurityConfig(argv, configManager);
  } else if (sub === 'reset') {
    await configManager.resetConfig();
    console.log('Configuration reset to defaults');
  } else {
    console.log('Usage: ziri config show|set|provider|security|reset');
  }
}

async function handleSecurityConfig(argv, configManager) {
  const securitySub = argv._[2];
  
  if (securitySub === 'enable') {
    const passphrase = argv._[3];
    if (!passphrase) {
      console.error('Usage: ziri config security enable <passphrase>');
      console.log('Note: For production use, provide passphrase via secure input or environment variable');
      return;
    }
    
    try {
      // Import security modules dynamically
      const { SecurityConfig } = await import('./security/config.js');
      const securityConfig = new SecurityConfig();
      await securityConfig.load();
      await securityConfig.enableEncryption(passphrase);
      
      console.log('✅ Encryption enabled successfully');
      console.log('🔒 All future embeddings will be encrypted at rest');
      console.log('⚠️  Existing data remains unencrypted - re-index to encrypt');
    } catch (error) {
      console.error('❌ Failed to enable encryption:', error.message);
    }
  } else if (securitySub === 'disable') {
    try {
      const { SecurityConfig } = await import('./security/config.js');
      const securityConfig = new SecurityConfig();
      await securityConfig.load();
      await securityConfig.disableEncryption();
      
      console.log('✅ Encryption disabled successfully');
      console.log('🔓 Future embeddings will be stored unencrypted');
    } catch (error) {
      console.error('❌ Failed to disable encryption:', error.message);
    }
  } else if (securitySub === 'status') {
    try {
      const { SecurityConfig } = await import('./security/config.js');
      const securityConfig = new SecurityConfig();
      await securityConfig.load();
      
      const isEnabled = securityConfig.isEncryptionEnabled();
      console.log(`Encryption Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`);
      
      if (isEnabled) {
        const config = securityConfig.getConfig();
        console.log(`Algorithm: ${config.encryption.algorithm}`);
        console.log(`Key Derivation: ${config.encryption.keyDerivation.hash} (${config.encryption.keyDerivation.iterations} iterations)`);
      }
    } catch (error) {
      console.error('❌ Failed to check encryption status:', error.message);
    }
  } else {
    console.log('Usage: ziri config security enable|disable|status [passphrase]');
    console.log('Examples:');
    console.log('  ziri config security enable my-secret-passphrase');
    console.log('  ziri config security status');
    console.log('  ziri config security disable');
  }
}