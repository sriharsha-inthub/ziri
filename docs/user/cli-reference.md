# Ziri CLI Reference

Ziri is a high-performance AI code context CLI that provides fast indexing and intelligent querying of codebases using various embedding providers.

## Installation

### Node.js (Recommended)
```bash
npm install -g ziri
```

### Python
```bash
pipx install ziri
# or
pip install ziri
```

### Verify Installation
```bash
# Check version
ziri --version

# Show help
ziri --help

# Check system health
ziri doctor
```

## Quick Start

```bash
# Index your repository with enhanced context (default)
ziri index

# Query with rich results
ziri query "authentication logic"

# Chat with AI using your codebase context
ziri chat "how does the user login system work?"

# Check system health
ziri doctor
```

## Version Information

**Current Version**: v0.2.1

Ziri has evolved from a beta release to a stable version with enhanced features and improved reliability. Key improvements in v0.2.1 include:

- Enhanced code analysis for multiple programming languages
- Better error handling and resilience
- Improved performance and memory optimization
- More accurate metadata extraction
- Enhanced documentation and examples

## Commands

### `ziri index [options]`

Index the current repository with enhanced context for fast semantic search and AI chat.

**Enhanced Context (Default):**
- Rich metadata extraction (functions, classes, imports)
- Code snippets stored with vectors for rich query results
- Surrounding context lines for better understanding
- Language detection and syntax information

**Options:**
- `--provider <name>` - Embedding provider (ollama [default], openai, huggingface, cohere)
- `--concurrency <num>` - Concurrent processing threads (default: 5)
- `--batch-size <num>` - Batch size for embeddings (default: 100)
- `--memory-limit <mb>` - Memory limit in MB (default: 512)
- `--force` - Force full re-index (ignore incremental updates)
- `--legacy` - Use legacy indexer (DEPRECATED - will be removed in v2.0)
- `--verbose` - Show detailed progress information
- `--stats` - Display comprehensive statistics
- `--exclude <patterns>` - Comma-separated exclusion patterns

**Examples:**
```bash
# Enhanced context indexing with Ollama (default, recommended)
ziri index

# High-performance indexing with local Ollama
ziri index --provider ollama --concurrency 5 --batch-size 100

# Cloud provider indexing
ziri index --provider openai

# Memory-constrained indexing
ziri index --memory-limit 256 --batch-size 25

# Force full re-index with detailed output
ziri index --force --verbose --stats

# Legacy mode (deprecated)
ziri index --legacy
```

### `ziri query "search terms" [options]`

Query indexed repositories using semantic search with rich results.

**Enhanced Results Include:**
- Actual code snippets (not just file paths)
- Function and class names
- Surrounding context lines
- Language detection and syntax information
- Relevance explanations

**Options:**
- `--scope <scope>` - Query scope: `repo` (current), `all` (all indexed), `set:NAME` (specific set)
- `--k <num>` - Number of results to return (default: 8)

**Examples:**
```bash
# Query current repository with rich results
ziri query "user authentication"

# Query all indexed repositories
ziri query "database connection" --scope all

# Get more results with detailed context
ziri query "error handling" --k 15
```

### `ziri chat "your question" [options]` ⭐ NEW

Chat with AI using your codebase as context. Requires Ollama (default provider).

**How it works:**
1. Retrieves relevant code context using semantic search
2. Formats context for AI understanding
3. Generates contextual responses using Ollama's language models
4. Provides explanations, debugging help, and code insights

**Options:**
- `--k <num>` - Number of context results to retrieve (default: 8)
- `--scope <scope>` - Query scope for context: `repo` (current), `all` (all indexed), `set:NAME` (specific set)
- `--verbose` - Show detailed processing and context information

**Examples:**
```bash
# Ask about your codebase
ziri chat "how does user authentication work?"

# Debug specific issues
ziri chat "why might the login be failing?"

# Understand code patterns
ziri chat "explain the database connection pattern used here"

# Scope to specific repositories
ziri chat "how do the backend services communicate?" --scope set:backend

# Get more context for complex questions
ziri chat "walk me through the entire user registration flow" --k 15 --verbose

# Use fewer but more relevant results
ziri chat "your question" --k 3

# Focus on specific scope when possible
ziri chat "your question" --scope repo --k 3

# Try the Q4 quantized version if available
ollama pull qwen2:1.5b-q4_0


```


**Setup Requirements:**
```bash
# Install Ollama: https://ollama.ai/download
# Pull required models
ollama pull nomic-embed-text   # For embeddings (high quality, default)
ollama pull all-minilm         # Alternative (faster, lower quality)
ollama pull llama3.2           # For chat generation

# Configure Ziri (automatic if Ollama is running)
ziri config provider ollama
```

### `ziri lsp [options]` ⭐ NEW

Start the Language Server Protocol (LSP) server for IDE integration.

**How it works:**
1. Implements the Language Server Protocol standard
2. Integrates with Ziri's semantic search and indexing capabilities
3. Provides real-time code assistance within IDEs
4. Supports hover, definition, and workspace symbol features

**Options:**
- `--stdio` - Use stdio for communication (default for most IDEs)
- `--socket <port>` - Use socket for communication
- `--node-ipc` - Use node-ipc for communication

**Supported LSP Features:**
- **Hover Provider**: Shows code context and explanations on mouseover
- **Definition Provider**: Jump to definition functionality for code elements
- **Workspace Symbol Search**: Search for symbols across the entire codebase

**Examples:**
```bash
# Start LSP server (typically started by IDE)
ziri lsp

# Start with socket communication
ziri lsp --socket 8080

# Start with node-ipc communication
ziri lsp --node-ipc
```

**IDE Integration:**
The LSP server can be integrated with any IDE that supports Language Server Protocol:
- **VS Code**: Install the Ziri extension or configure manually
- **Vim/Neovim**: Use coc.nvim or native LSP client
- **Emacs**: Use lsp-mode
- **Sublime Text**: Use LSP package
- **Atom**: Use atom-ide packages

**Benefits:**
- Seamless integration with popular IDEs
- Real-time code assistance within the development environment
- Broader tool ecosystem compatibility
- Enhanced developer workflow without leaving the IDE

**Requirements:**
- Repository must be indexed with `ziri index` first
- Ziri configuration properly set up
- IDE with LSP client support

### `ziri config <command> [options]`

Manage Ziri configuration.

**Commands:**
- `show` - Display current configuration
- `set <key> <value>` - Set configuration value
- `provider <name> [options]` - Configure embedding provider
- `reset` - Reset configuration to defaults
- `security <subcommand> [options]` - Manage encryption of stored data (new)

**Security Sub‑commands:**
```bash
# Enable encryption (requires a passphrase)
ziri config security enable <passphrase>

# Disable encryption (stores data unencrypted)
ziri config security disable

# Show current encryption status
ziri config security status
```

Enabling encryption stores vectors and chunk metadata using AES‑256‑GCM. The passphrase is never written to disk; it is cached only for the current session. Disabling encryption removes the encryption layer but does **not** automatically re‑encrypt existing data – you must re‑index to apply the new setting.

**Provider Configuration:**
```bash
# Configure Ollama (default, recommended for chat)
ziri config provider ollama --base-url http://localhost:11434

# Configure Ollama with specific models
ziri config provider ollama --embedding-model all-minilm --text-model llama3.2
ziri config provider ollama --embedding-model all-minilm --text-model phi3:mini # Fastest - Very small but decent quality
ziri config provider ollama --embedding-model all-minilm --text-model qwen2:1.5b # Fast and good quality balance 
ziri config provider ollama --text-model gemma2:2b # Slightly larger but still fast

# Configure OpenAI
ziri config provider openai --api-key sk-your-key-here

# Configure Hugging Face
ziri config provider huggingface --api-key hf_your-key-here --model sentence-transformers/all-MiniLM-L6-v2

# Configure Cohere
ziri config provider cohere --api-key your-cohere-key
```

**Model Configuration:**
```bash
# Embedding Models (for indexing and search)
# Default: nomic-embed-text (high quality)
ziri config provider ollama --embedding-model nomic-embed-text   # High quality, recommended (default)
ziri config provider ollama --embedding-model all-minilm         # Faster, lower quality

# Text Generation Models (for chat)
# Default: llama3.2
ziri config provider ollama --text-model llama3.2               # Balanced performance
ziri config provider ollama --text-model llama3.1              # Alternative option
```

**Performance Recommendations:**
- **High quality**: Use `nomic-embed-text` embedding model (~274 MB, recommended default)
- **Fast indexing**: Use `all-minilm` embedding model (~45 MB, 6× faster but lower quality)
- **Chat performance**: Ensure Ollama has GPU acceleration for best results

**General Configuration:**
```bash
# Set default provider (Ollama is default)
ziri config set defaultProvider ollama

# Set performance defaults
ziri config set performance.concurrency 5
ziri config set performance.batchSize 75
ziri config set performance.memoryLimit 1024

# Enhanced context settings (default enabled)
ziri config set indexing.enhancedContext true
ziri config set indexing.includeMetadata true
```

---
### Additional Indexer Flags (Advanced)

The indexer also supports two advanced flags that are not listed in the basic documentation:
- `--parallel` – Enable the parallel file‑system walker for faster repository scans (uses `filesystem/parallel-walk.js`).
- `--walk-concurrency <num>` – Number of parallel walkers when `--parallel` is enabled (default: `4`).

Example of using these flags:
```bash
ziri index --parallel --walk-concurrency 8 --provider ollama --concurrency 6
```

---
### MCP (Model‑Context‑Protocol) support & tool‑call documentation

Ziri implements the **core building blocks** required for a Model‑Context‑Protocol (MCP) integration.  The MCP concept is a lightweight protocol that lets an LLM request *tool calls* (e.g., embed, index, query, chat) and receive structured results.  Ziri does not expose a dedicated HTTP endpoint yet, but the **CLI**, **LSP server**, and **VS Code extension** together provide a fully‑functional MCP‑compatible surface.

#### 1️⃣ Available tool calls (high‑level operations)
| Tool name | Underlying implementation | Typical use‑case |
|-----------|--------------------------|-----------------|
| `embed` | `makeEmbedder` → `embedOpenAI` / `embedOllama` | Convert raw text (or code chunks) into a vector embedding. |
| `index` | `enhancedLegacyIndexCommand` (walk → chunk → embed → `store_repo.saveChunk`) | Build or update the per‑repo vector store with rich metadata. |
| `query` | `queryCommand` (embed query → similarity search → `EnhancedStorage.loadEnhancedChunk`) | Retrieve the *k* most relevant code chunks with full context. |
| `chat` | `chatCommand` (query → context → LLM completion) | Ask natural‑language questions about the codebase; Ziri automatically supplies relevant snippets. |
| `watch` | `watchCommand` (fs events → incremental `index`) | Keep the index up‑to‑date while you develop. |
| `lsp` | `lspCommand` (Language‑Server‑Protocol) | Exposes the above tools over LSP so any IDE can act as an MCP client. |

#### 2️⃣ Call sequence for a typical **query** operation
```
1. ziri query "<text>"
   └─ CLI parses args → selects provider (default Ollama).
2. makeEmbedder() creates an embedder instance.
3. embedBatch([query]) → vector for the query.
4. readIndex() loads the repository index.
5. For each indexed chunk: loadVector() → cosineSim(queryVec, chunkVec).
6. TopK(k) keeps the highest‑scoring IDs.
7. EnhancedStorage.loadEnhancedChunk() loads full metadata (code, language, function name, surrounding lines).
8. createEnhancedQueryResult() builds a rich result object.
9. Result is printed (human‑readable) or emitted as JSON (`--json`).
```

#### 3️⃣ JSON schema for LLM‑driven tool calls (OpenAI‑compatible `function` definitions)
```json
[
  {
    "name": "embed",
    "description": "Generate vector embeddings for a list of texts.",
    "parameters": {
      "type": "object",
      "properties": {
        "texts": { "type": "array", "items": { "type": "string" } },
        "model": { "type": "string", "enum": ["nomic-embed-text","all-minilm","text-embedding-3-small"] }
      },
      "required": ["texts"]
    }
  },
  {
    "name": "index",
    "description": "Index a repository (or a set of repositories) with enhanced context.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "Absolute path to the repository root." },
        "set": { "type": "string", "description": "Optional source‑set name (as defined via `ziri sources`)." },
        "force": { "type": "boolean", "default": false },
        "parallel": { "type": "boolean", "default": false },
        "walkConcurrency": { "type": "integer", "minimum": 1, "default": 4 }
      },
      "required": ["path"]
    }
  },
  {
    "name": "query",
    "description": "Search indexed code for the most relevant chunks.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string" },
        "k": { "type": "integer", "minimum": 1, "default": 8 },
        "scope": { "type": "string", "enum": ["repo","all","set"] },
        "set": { "type": "string" }
      },
      "required": ["query"]
    }
  },
  {
    "name": "chat",
    "description": "Ask a natural‑language question about the codebase; Ziri will retrieve context and generate a response.",
    "parameters": {
      "type": "object",
      "properties": {
        "question": { "type": "string" },
        "k": { "type": "integer", "minimum": 1, "default": 8 },
        "scope": { "type": "string", "enum": ["repo","all","set"] },
        "verbose": { "type": "boolean", "default": false }
      },
      "required": ["question"]
    }
  }
]
```
*These definitions can be passed to the OpenAI `functions` parameter (or any LLM that supports function calling).  The LLM will then invoke the appropriate Ziri CLI command behind the scenes.*

#### 4️⃣ Using the LSP server as an MCP endpoint
The **LSP server** (`ziri lsp`) implements three custom requests that map directly to the tool calls above:
```json
// Request IDs (sent over LSP JSON‑RPC)
"ziri/embed"   → embed(texts, model?)
"ziri/index"   → index(path, options)
"ziri/query"   → query(query, k?, scope?)
"ziri/chat"    → chat(question, k?, scope?, verbose?)
```
Any LSP‑compatible editor (VS Code, Neovim, Emacs, etc.) can call these methods, making the editor itself an MCP client.  The bundled **Ziri VS Code extension** already uses this mechanism under the hood.

#### 5️⃣ Configuring defaults (all are already set in code)
| Setting | Default (see `ConfigManager.getDefaultConfig()`) |
|---------|-----------------------------------------------|
| `defaultProvider` | `ollama` |
| Ollama embedding model | `nomic-embed-text` |
| Ollama text model | `qwen2:1.5b` |
| Concurrency | `5` |
| Batch size | `150` |
| Memory limit (MB) | `1024` |
| Chunk size (tokens) | `750` |
| Chunk overlap (tokens) | `150` |
| Exclusions | Git, `node_modules`, binary extensions, etc. |
| Encryption (optional) | Disabled by default; enable via `ziri config security enable <passphrase>` |

All of these defaults are applied automatically when Ziri is first run; they can be overridden with `ziri config set …` or via environment variables (e.g., `ZIRI_OPENAI_API_KEY`).

#### 6️⃣ Quick MCP demo (CLI)
```bash
# 1️⃣ Index the repo (once)
ziri index

# 2️⃣ Query via MCP‑style JSON (using jq for pretty‑print)
ziri query "authentication" --json | jq

# 3️⃣ Chat with context (MCP‑style)
ziri chat "How does the login flow work?" --verbose
```
The same calls can be made from an LLM by sending the JSON function definitions above; the LLM will receive the rich result objects that contain:
- `score`
- `file` & `lines`
- `language`
- `functionName` / `className`
- `context` (actual code snippet)
- `surroundingLines` (before/after context)
- `metadata.syntaxInfo`
- `relevanceExplanation`

#### 7️⃣ Next steps for a full MCP server
If you need a dedicated HTTP/JSON‑RPC endpoint, you can wrap the existing commands:
```js
import { exec } from 'child_process';

export async function handleMcpRequest(method, params) {
  switch (method) {
    case 'embed':
      return execAsync(`ziri embed "${params.texts.join('\n')}" --model ${params.model||'nomic-embed-text'}`);
    case 'index':
      return execAsync(`ziri index ${params.path} ${params.force?'--force':''}`);
    case 'query':
      return execAsync(`ziri query "${params.query}" --k ${params.k||8} ${params.scope?'--scope '+params.scope:''}`);
    case 'chat':
      return execAsync(`ziri chat "${params.question}" --k ${params.k||8} ${params.verbose?'--verbose':''}`);
    default:
      throw new Error('Unsupported MCP method: '+method);
  }
}
```
Expose `handleMcpRequest` via Express, Fastify, or any server‑less platform to get a **standard MCP endpoint**.

---

### Supported repository language types

Ziri detects the programming language of each file based on its extension.  The detection table below is used by `store_repo.inferLanguage` and by the AST analyzers to enrich chunk metadata.

| Language | Extensions |
|----------|------------|
| JavaScript / TypeScript | `.js`, `.jsx`, `.ts`, `.tsx` |
| Python | `.py` |
| Java | `.java` |
| C / C++ | `.c`, `.cpp`, `.h`, `.hpp` |
| C# | `.cs` |
| PHP | `.php` |
| Ruby | `.rb` |
| Go | `.go` |
| Rust | `.rs` |
| Swift | `.swift` |
| Kotlin | `.kt` |
| Scala | `.scala` |
| Shell / scripting | `.sh`, `.bash`, `.zsh`, `.fish`, `.ps1` |
| SQL | `.sql` |
| HTML / CSS / SCSS / SASS / LESS | `.html`, `.css`, `.scss`, `.sass`, `.less` |
| JSON / YAML / TOML / INI / Config | `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf` |
| Markdown / Text | `.md`, `.txt` |
| XML | `.xml` |
| Other | Any unknown extension falls back to `unknown` |

In addition to generic language detection, Ziri ships **AST analyzers** for several domain‑specific languages.  These analyzers extract richer metadata (functions, classes, imports, docstrings, etc.) when the file type is recognized.

| DSL / Domain | Analyzer file |
|--------------|----------------|
| Mulesoft | `metadata/mulesoft-ast-analyzer.js` |
| Message Flow (msgflow) | `metadata/msgflow-ast-analyzer.js` |
| DataWeave (dwl) | `metadata/dwl-ast-analyzer.js` |
| ESQL | `metadata/esql-ast-analyzer.js` |
| XML | `metadata/xml-ast-analyzer.js` |
| General code (fallback) | `metadata/code-analyzer.js` |

These analyzers are automatically invoked by the indexer when a file’s extension matches one of the supported languages.  If no specific analyzer exists, the generic `code-analyzer` provides basic token‑level information.
