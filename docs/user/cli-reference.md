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
ziri --version
ziri --help
```

## Quick Start

```bash
# Configure provider
ziri config provider openai --api-key sk-your-key

# Index your current repository
ziri index

# Query your codebase
ziri query "authentication logic"

# Check system health
ziri doctor
```

## Commands

### `ziri index [options]`

Index the current repository for fast semantic search.

**Options:**
- `--provider <name>` - Embedding provider (openai, ollama, huggingface, cohere)
- `--concurrency <num>` - Concurrent processing threads (default: 3)
- `--batch-size <num>` - Batch size for embeddings (default: 50)
- `--memory-limit <mb>` - Memory limit in MB (default: 512)
- `--force` - Force full re-index (ignore incremental updates)
- `--legacy` - Use legacy indexer for compatibility
- `--verbose` - Show detailed progress information
- `--stats` - Display comprehensive statistics
- `--exclude <patterns>` - Comma-separated exclusion patterns

**Examples:**
```bash
# Basic indexing with OpenAI
ziri index --provider openai

# High-performance indexing with local Ollama
ziri index --provider ollama --concurrency 5 --batch-size 100

# Memory-constrained indexing
ziri index --memory-limit 256 --batch-size 25

# Force full re-index with detailed output
ziri index --force --verbose --stats
```

### `ziri query "search terms" [options]`

Query indexed repositories using semantic search.

**Options:**
- `--scope <scope>` - Query scope: `repo` (current), `all` (all indexed), `set:NAME` (specific set)
- `--k <num>` - Number of results to return (default: 8)

**Examples:**
```bash
# Query current repository
ziri query "user authentication"

# Query all indexed repositories
ziri query "database connection" --scope all

# Get more results
ziri query "error handling" --k 15
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
# Configure OpenAI
ziri config provider openai --api-key sk-your-key-here

# Configure Ollama (local)
ziri config provider ollama --base-url http://localhost:11434

# Configure Hugging Face
ziri config provider huggingface --api-key hf_your-key-here --model sentence-transformers/all-MiniLM-L6-v2
```

**General Configuration:**
```bash
# Set default provider
ziri config set defaultProvider ollama

# Set performance defaults
ziri config set performance.concurrency 5
ziri config set performance.batchSize 75
ziri config set performance.memoryLimit 1024
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