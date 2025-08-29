# Ziri Quickstart Guide

Get up and running with Ziri in under 5 minutes! This guide walks you through installation, setup with Ollama (local AI), and your first queries and chat sessions.

## Prerequisites

- Node.js 18+ 
- Ollama installed (recommended - free, local, no API keys needed)
- A code repository to index

## Step 1: Installation

Choose your preferred installation method:

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
# Should show v0.1.1 or later
```

## Step 2: Setup Ollama (Recommended - Free & Local)

Ollama is now the default provider - no API keys needed, everything runs locally!

### Install Ollama
```bash
# Download and install from: https://ollama.ai/download
# Or use package managers:

# macOS
brew install ollama

# Linux (curl)
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download installer from website
```

### Pull Required Models
```bash
# Start Ollama service (if not auto-started)
ollama serve

# Pull models for embeddings and chat (in another terminal)
ollama pull nomic-embed-text    # For indexing and search
ollama pull llama3.2           # For AI chat functionality

# Verify models are installed
ollama list
```

### Configure Ziri (Automatic)
```bash
# Ziri automatically detects Ollama - no configuration needed!
# But you can verify:
ziri config provider ollama

# Check system health
ziri doctor
```

### Alternative: Cloud Providers

If you prefer cloud providers or Ollama doesn't work on your system:

#### OpenAI
```bash
ziri config provider openai --api-key sk-your-openai-key-here
```

#### Hugging Face
```bash
ziri config provider huggingface --api-key hf_your-token-here
```

## Step 3: Verify Your Setup

```bash
# Check system health and configuration
ziri doctor

# Check storage locations
ziri where
```

You should see:
- ✅ Provider configured correctly
- ✅ API key valid (if using cloud provider)
- ✅ Storage directories accessible

## Step 4: Index Your First Repository

Navigate to your code repository and index it with enhanced context:

```bash
# Go to your project directory
cd /path/to/your/project

# Index with enhanced context (default - includes rich metadata)
ziri index --verbose

# For faster indexing on powerful machines
ziri index --concurrency 5 --batch-size 100
```

**What's happening with Enhanced Context?**
- Ziri scans all files in your repository
- Excludes common non-code files (node_modules, .git, etc.)
- Extracts rich metadata (functions, classes, imports)
- Stores actual code snippets alongside vectors
- Captures surrounding context lines
- Detects programming languages
- Generates embeddings for semantic search
- Creates an isolated, enhanced index for this repository

## Step 5: Your First Queries and Chat

Now you can search your codebase and chat with AI about your code:

### Enhanced Queries (Rich Results)
```bash
# Find authentication-related code (shows actual code snippets!)
ziri query "user authentication login"

# Find database operations with context
ziri query "database connection setup"

# Find error handling patterns
ziri query "error handling try catch"

# Get more results with surrounding context
ziri query "API endpoints" --k 15
```

### AI Chat (NEW!)
```bash
# Ask about your codebase
ziri chat "how does user authentication work in this project?"

# Debug issues
ziri chat "why might the login be failing?"

# Understand architecture
ziri chat "what are the main components of this system?"

# Get code explanations
ziri chat "explain the database connection pattern used here"

# Verbose mode for debugging
ziri chat "how does error handling work?" --verbose
```

## Step 6: Advanced Usage (Optional)

### Multi-Repository Setup
```bash
# Add multiple repositories to organized sets
ziri sources add ~/code/backend --set backend
ziri sources add ~/code/frontend --set frontend
ziri sources add ~/code/shared --set shared

# Index each repository
cd ~/code/backend && ziri index
cd ~/code/frontend && ziri index
cd ~/code/shared && ziri index

# Query specific sets
ziri query "API routes" --scope set:backend
ziri query "React components" --scope set:frontend
ziri query "utility functions" --scope all
```

### Performance Optimization
```bash
# Find optimal settings for your system
ziri benchmark --duration 60

# Apply recommended settings
ziri config set performance.concurrency 4
ziri config set performance.batchSize 100
```

## Common First-Time Issues

### "Provider not configured"
```bash
# Make sure you've configured a provider
ziri config provider openai --api-key sk-your-key
# or
ziri config provider ollama
```

### "API key invalid"
```bash
# Check your API key
ziri config show
# Update if needed
ziri config provider openai --api-key sk-new-key
```

### "Indexing too slow"
```bash
# Try local provider for faster indexing
ziri config provider ollama
ziri index

# Or optimize settings
ziri index --concurrency 2 --batch-size 25
```

### "Memory errors"
```bash
# Reduce memory usage
ziri index --memory-limit 256 --batch-size 20 --concurrency 2
```

## Next Steps

Now that you have Ziri set up:

1. **Explore the CLI**: Run `ziri --help` to see all available commands
2. **Read the CLI Reference**: Check out [cli-reference.md](cli-reference.md) for detailed command documentation
3. **See Usage Examples**: Browse [usage-examples.md](usage-examples.md) for practical scenarios
4. **Optimize Performance**: Use `ziri benchmark` to find the best settings for your system
5. **Set up Multiple Providers**: Configure backup providers for different use cases

## Quick Reference

```bash
# Essential commands
ziri doctor                    # Check system health and Ollama status
ziri config show               # View current configuration
ziri index                     # Index with enhanced context (default)
ziri query "search"            # Search with rich results
ziri chat "question"           # AI chat with codebase context
ziri sources list              # List all repositories
ziri benchmark                 # Test performance

# Enhanced context features
ziri index --force             # Full re-index with enhanced context
ziri query "search" --k 10     # More results with code snippets
ziri chat "question" --verbose # Detailed chat processing

# Performance tuning
ziri index --concurrency 5 --batch-size 100 --memory-limit 512
ziri benchmark --providers ollama,openai --duration 60

# Multi-repo management
ziri sources add /path --set name
ziri query "search" --scope set:name
ziri chat "question" --scope set:name
ziri query "search" --scope all

# Ollama management
ollama list                    # Check installed models
ollama pull llama3.2          # Update chat model
ollama serve                   # Start Ollama service
```

You're now ready to use Ziri for intelligent code search, enhanced context, and AI-powered code assistance! 🚀