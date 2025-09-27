# Ziri Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Ziri. Most problems can be quickly resolved by following these solutions.

## Quick Diagnostics

Before diving into specific issues, run these commands to get system information:

```bash
# Check overall system health and Ollama status
ziri doctor

# View current configuration
ziri config show

# Check version and installation
ziri --version
ziri where

# Test Ollama connection (default provider)
curl http://localhost:11434/api/tags
```

## Installation Issues

### Error: Cannot find package 'minimist'
This was fixed in {{VERSION}} by bundling runtime dependencies. If you still see this error:

```bash
# Clean reinstall (recommended)
npm uninstall -g ziri
npm install -g ziri

# Alternative: pack and install tarball
cd packages/ziri-js
npm pack
npm install -g ziri-0.1.1.tgz

# Development: link locally
cd packages/ziri-js
npm install
npm link
```

### Error: Command 'ziri' not found
```bash
# Check if installed globally
npm list -g ziri

# Reinstall globally
npm install -g ziri

# Check npm global bin directory
npm config get prefix
# Add to PATH if needed: export PATH=$PATH:$(npm config get prefix)/bin

# Alternative: use npx
npx ziri --version
```

### Permission errors during installation
```bash
# Use npx instead of global install
npx ziri --version

# Or fix npm permissions (Linux/macOS)
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Or use a Node version manager like nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g ziri
```

## Configuration Issues

### Error: "Provider not configured"
```bash
# Configure Ollama (default, recommended)
ziri config provider ollama

# Or configure cloud provider
ziri config provider openai --api-key sk-your-key

# Verify configuration
ziri config show providers
ziri doctor
```

### Error: "Invalid API key"
```bash
# Check current API key
ziri config show providers.openai.apiKey

# Update API key
ziri config provider openai --api-key sk-new-key

# Use environment variable instead
export OPENAI_API_KEY=sk-your-key
# Windows: $env:OPENAI_API_KEY="sk-your-key"

# Test API key
ziri doctor
```

### Error: "Configuration file corrupted"
```bash
# Reset configuration to defaults
ziri config reset

# Backup and recreate
cp ~/.ziri/config.json ~/.ziri/config.json.backup
ziri config reset

# Manually edit if needed
nano ~/.ziri/config.json
```

### Error: "Cannot access storage directory"
```bash
# Check storage permissions
ls -la ~/.ziri/

# Fix permissions (Linux/macOS)
chmod -R 755 ~/.ziri/

# Use alternative storage location
export ZIRI_HOME=/path/to/alternative/storage
ziri doctor
```

## Indexing Issues

### Error: "Indexing too slow"
```bash
# Run benchmark to find optimal settings
ziri benchmark --duration 30

# Try high-performance settings
ziri index --concurrency 6 --batch-size 100 --memory-limit 1024

# Use local provider for faster indexing
ziri config provider ollama
ziri index

# Check system resources
ziri doctor
```

### Error: "Memory limit exceeded"
```bash
# Reduce memory usage
ziri index --memory-limit 256 --batch-size 20 --concurrency 2

# Use streaming mode (automatic in new version)
ziri index --verbose

# Check available memory
free -h  # Linux
vm_stat  # macOS
wmic OS get TotalVisibleMemorySize /value  # Windows
```

### Error: "Rate limit exceeded"
```bash
# Reduce API pressure
ziri index --concurrency 1 --batch-size 10

# Use exponential backoff (automatic)
ziri index --verbose

# Switch to local provider
ziri config provider ollama
ziri index

# Check rate limits
ziri doctor
```

### Error: "Repository too large"
```bash
# Add more exclusion patterns
ziri index --exclude "node_modules,dist,build,.next,coverage,logs"

# Set file size limit
ziri config set exclusions.maxFileSize 1048576  # 1MB

# Use incremental indexing
ziri index  # Will be incremental after first run

# Split into smaller repositories
ziri sources add /path/to/subproject --set subproject
```

### Error: "Indexing fails with network errors"
```bash
# Check internet connection
ping api.openai.com

# Use local provider
ziri config provider ollama

# Increase retry attempts
ziri config set performance.retryAttempts 5
ziri config set performance.retryDelay 2000

# Use verbose mode for debugging
ziri index --verbose
```

## Chat Command Issues

### Error: "Cannot connect to Ollama"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve

# Check if required models are installed
ollama list

# Pull required models
ollama pull nomic-embed-text    # For embeddings
ollama pull llama3.2           # For chat

# Configure Ollama in Ziri
ziri config provider ollama
```

### Error: "Chat command times out"
```bash
# Check Ollama model availability
ollama list | grep llama3.2

# Pull chat model if missing
ollama pull llama3.2

# Test Ollama directly
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello",
  "stream": false
}'

# Use verbose mode for debugging
ziri chat "test question" --verbose
```

### Error: "No context found for chat"
```bash
# Ensure repository is indexed with enhanced context
ziri index --force

# Check if enhanced context is enabled (default)
ziri config show indexing.enhancedContext

# Try with more context results
ziri chat "your question" --k 15

# Check specific scope
ziri chat "your question" --scope repo --verbose
```

### Chat responses are poor quality
```bash
# Ensure you're using a good chat model
ollama pull llama3.2:latest

# Try with more context
ziri chat "your question" --k 12 --verbose

# Re-index with enhanced context (should be default)
ziri index --force

# Check if repository has sufficient code content
ziri query "test" --k 5
```

## Query Issues

### Error: "No results found"
```bash
# Check if repository is indexed with enhanced context
ziri sources list

# Re-index with enhanced context (default)
ziri index --force

# Try broader search terms
ziri query "function method"  # instead of specific function name

# Increase result count
ziri query "search term" --k 20

# Check all repositories
ziri query "search term" --scope all

# Verify enhanced context is working
ziri query "test" --k 3  # Should show code snippets
```

### Error: "Query too slow"
```bash
# Check index health
ziri doctor

# Rebuild index if corrupted
ziri index --force

# Use more specific queries
ziri query "specific function name"  # instead of broad terms

# Check storage performance
df -h ~/.ziri/  # Check disk space
```

## Provider-Specific Issues

### OpenAI Issues

#### Error: "OpenAI API key invalid"
```bash
# Verify API key format (should start with sk-)
echo $OPENAI_API_KEY

# Test API key directly
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Update API key
ziri config provider openai --api-key sk-new-key
```

#### Error: "OpenAI rate limit exceeded"
```bash
# Reduce concurrency and batch size
ziri index --concurrency 2 --batch-size 25

# Check your OpenAI usage
# Visit: https://platform.openai.com/usage

# Use different model with higher limits
ziri config provider openai --model text-embedding-3-small
```

### Ollama Issues (Default Provider)

#### Error: "Cannot connect to Ollama"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve

# Check Ollama models
ollama list

# Pull required models for embeddings and chat
ollama pull nomic-embed-text    # For indexing and queries
ollama pull llama3.2           # For chat functionality

# Configure custom Ollama URL if needed
ziri config provider ollama --base-url http://localhost:11434
```

#### Error: "Ollama model not found"
```bash
# List available models
ollama list

# Pull required models
ollama pull nomic-embed-text    # Essential for embeddings
ollama pull llama3.2           # Essential for chat
ollama pull all-minilm         # Alternative embedding model (faster, lower quality)

# Configure specific models
ziri config provider ollama --model nomic-embed-text

# Test model availability
ollama run llama3.2 "Hello"
```

#### Ollama performance issues
```bash
# Check Ollama system resources
ollama ps

# Monitor Ollama logs
ollama logs

# Restart Ollama service
ollama stop
ollama serve

# Use smaller models if needed
ollama pull llama3.2:8b        # Smaller variant
ollama pull nomic-embed-text   # Recommended embedding model
```

### Hugging Face Issues

#### Error: "Hugging Face API error"
```bash
# Check API key
echo $HUGGINGFACE_API_KEY

# Test API key
curl -H "Authorization: Bearer $HUGGINGFACE_API_KEY" \
     https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2

# Use different model
ziri config provider huggingface --model sentence-transformers/all-mpnet-base-v2
```

### Cohere Issues

#### Error: "Cohere API error"
```bash
# Check API key
echo $COHERE_API_KEY

# Test API key
curl -H "Authorization: Bearer $COHERE_API_KEY" \
     https://api.cohere.ai/v1/embed

# Configure Cohere
ziri config provider cohere --api-key your-cohere-key
```

## Performance Issues

### Slow indexing performance
```bash
# Run comprehensive benchmark
ziri benchmark --providers openai,ollama --duration 60

# Apply optimal settings
ziri config set performance.concurrency 4
ziri config set performance.batchSize 75

# Monitor system resources during indexing
top  # Linux/macOS
taskmgr  # Windows

# Use SSD storage if available
# Move ~/.ziri to SSD location
```

### High memory usage
```bash
# Monitor memory usage
ziri index --verbose --stats

# Reduce memory settings
ziri config set performance.memoryLimit 256
ziri config set performance.batchSize 20

# Use incremental updates
ziri index  # Automatic after first full index

# Close other applications during indexing
```

### Network timeouts
```bash
# Increase timeout settings
ziri config set performance.retryDelay 5000
ziri config set performance.retryAttempts 5

# Use local provider
ziri config provider ollama

# Check network stability
ping -c 10 api.openai.com
```

## Data Issues

### Corrupted index
```bash
# Check index integrity
ziri doctor

# Rebuild index
ziri index --force

# Clear all data and start fresh
rm -rf ~/.ziri/repositories/
ziri index
```

### Missing files in results
```bash
# Check exclusion patterns
ziri config show exclusions

# Reduce exclusions if too aggressive
ziri config set exclusions.patterns "node_modules,.git"

# Check file size limits
ziri config set exclusions.maxFileSize 2097152  # 2MB

# Re-index with verbose output
ziri index --force --verbose
```

### Outdated results
```bash
# Run incremental update
ziri index

# Force full re-index
ziri index --force

# Check file change detection
ziri index --verbose  # Shows which files changed
```

## Advanced Troubleshooting

### Enable debug logging
```bash
# Set debug log level
ziri config set logging.level debug

# Run with verbose output
ziri index --verbose

# Check log files
tail -f ~/.ziri/logs/ziri.log
```

### Performance profiling
```bash
# Run extended benchmark
ziri benchmark --duration 300 --output profile.json

# Analyze results
cat profile.json | jq '.providers[] | {name: .name, avgTime: .avgTime}'

# Test different configurations
ziri benchmark --providers openai --duration 60
ziri config set performance.batchSize 100
ziri benchmark --providers openai --duration 60
```

### Network debugging
```bash
# Test connectivity to all providers
curl -I https://api.openai.com/v1/models
curl -I http://localhost:11434/api/tags
curl -I https://api-inference.huggingface.co/
curl -I https://api.cohere.ai/v1/embed

# Check DNS resolution
nslookup api.openai.com
nslookup api-inference.huggingface.co
```

## Getting Help

If you're still experiencing issues:

1. **Run diagnostics**: `ziri doctor`
2. **Check logs**: `~/.ziri/logs/ziri.log`
3. **Try legacy mode**: `ziri index --legacy`
4. **Reset configuration**: `ziri config reset`
5. **Use verbose output**: `ziri index --verbose`

### Reporting Issues

When reporting issues, please include:

```bash
# System information
ziri --version
ziri doctor
ziri config show

# Error logs
tail -50 ~/.ziri/logs/ziri.log

# System details
uname -a  # Linux/macOS
systeminfo  # Windows
node --version
npm --version
```

### Fallback Options

If all else fails:

```bash
# Use legacy indexer
ziri index --legacy

# Use minimal settings
ziri index --concurrency 1 --batch-size 10 --memory-limit 128

# Use local provider only
ziri config provider ollama
ziri index

# Clean installation
npm uninstall -g ziri
rm -rf ~/.ziri/
npm install -g ziri
```

Most issues can be resolved by following these troubleshooting steps. The new Ziri architecture is designed to be robust and self-healing, with automatic optimization and fallback mechanisms.
