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
# Setup Ollama (recommended - local, free)
# Download from: https://ollama.ai/download
ollama pull all-minilm && ollama pull llama3.2

# Index your current repository with enhanced context
ziri index

# Query your codebase with rich results
ziri query "authentication logic"

# Chat with AI using your codebase context
ziri chat "how does the authentication system work?"

# Check system health and Ollama status
ziri doctor
```

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
ollama pull all-minilm         # For embeddings (fast, default)
ollama pull llama3.2           # For chat generation

# Configure Ziri (automatic if Ollama is running)
ziri config provider ollama
```

### `ziri config <command> [options]`

Manage Ziri configuration.

**Commands:**
- `show` - Display current configuration
- `set <key> <value>` - Set configuration value
- `provider <name> [options]` - Configure embedding provider
- `reset` - Reset configuration to defaults

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

Ziri supports configurable models for both embedding and text generation:

```bash
# Embedding Models (for indexing and search)
# Default: all-minilm (fast, good quality)
ziri config provider ollama --embedding-model all-minilm          # Fast, recommended
ziri config provider ollama --embedding-model nomic-embed-text   # Slower, higher quality

# Text Generation Models (for chat)
# Default: llama3.2
ziri config provider ollama --text-model llama3.2               # Balanced performance
ziri config provider ollama --text-model llama3.1              # Alternative option

# Pull required models first:
ollama pull all-minilm        # Fast embedding model (default)
ollama pull nomic-embed-text  # High-quality embedding model
ollama pull llama3.2          # Chat model (default)
```

**Performance Recommendations:**
- **Fast indexing**: Use `all-minilm` embedding model (~25MB, 5-10x faster)
- **High quality**: Use `nomic-embed-text` embedding model (~311MB, slower but more accurate)
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

### `ziri sources <command> [options]`

Manage source repositories.

**Commands:**
- `add <path> [--set NAME]` - Add repository to sources
- `list` - List all source repositories
- `remove <path>` - Remove repository from sources

**Examples:**
```bash
# Add current directory to default set
ziri sources add .

# Add repository to specific set
ziri sources add /path/to/repo --set backend

# List all sources
ziri sources list

# Remove repository
ziri sources remove /path/to/repo
```

### `ziri benchmark [options]`

Run performance benchmarks to optimize settings.

**Options:**
- `--providers <list>` - Comma-separated list of providers to benchmark
- `--duration <seconds>` - Benchmark duration in seconds (default: 60)
- `--output <file>` - Save results to JSON file

**Examples:**
```bash
# Benchmark default providers
ziri benchmark

# Compare specific providers
ziri benchmark --providers openai,ollama,huggingface --duration 120

# Save results for analysis
ziri benchmark --output benchmark-results.json
```

### `ziri doctor`

Check system health and configuration.

Displays:
- Source repository status
- Provider configuration and API key status
- Performance settings
- Storage locations
- Optimization recommendations

### `ziri where`

Show Ziri storage locations and paths.

For complete configuration details, see the [Configuration Guide](configuration.md).

For troubleshooting help, see the [Troubleshooting Guide](troubleshooting.md).

For practical examples, see the [Usage Examples](usage-examples.md).
