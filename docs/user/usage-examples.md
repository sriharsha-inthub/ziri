# Ziri Usage Examples

This document provides practical examples of using Ziri for various scenarios and use cases.

## Getting Started

### First-Time Setup with Ollama (Recommended)

```bash
# Install Ziri
npm install -g ziri

# Install Ollama (https://ollama.ai/download)
# Pull required models
ollama pull nomic-embed-text && ollama pull llama3.2

# Check system health and Ollama status
ziri doctor

# Index your first repository with enhanced context
cd /path/to/your/project
ziri index

# Try your first query (shows code snippets!)
ziri query "authentication logic"

# Try the new chat feature
ziri chat "how does authentication work in this project?"
```

### Alternative Setup with Cloud Providers

```bash
# Install Ziri
npm install -g ziri

# Configure cloud provider
ziri config provider openai --api-key sk-your-openai-key

# Index and query
cd /path/to/your/project
ziri index
ziri query "authentication logic"
```

## Provider Configuration Examples

### OpenAI Configuration

```bash
# Basic OpenAI setup
ziri config provider openai --api-key sk-your-key

# Advanced OpenAI setup with custom model
ziri config provider openai \
  --api-key sk-your-key \
  --model text-embedding-3-large \
  --base-url https://api.openai.com/v1
```

### Ollama (Local) Configuration - Default Provider

```bash
# Basic Ollama setup (automatic if Ollama is running)
ziri config provider ollama

# Custom Ollama setup
ziri config provider ollama \
  --base-url http://localhost:11434 \
  --model nomic-embed-text

# Verify Ollama models for chat functionality
ollama list
ollama pull llama3.2  # If not already installed
  --model nomic-embed-text

# Remote Ollama instance
ziri config provider ollama \
  --base-url http://your-ollama-server:11434 \
  --model all-minilm
```

### Hugging Face Configuration

```bash
# Hugging Face with API key
ziri config provider huggingface \
  --api-key hf_your-token \
  --model sentence-transformers/all-MiniLM-L6-v2

# Hugging Face with custom endpoint
ziri config provider huggingface \
  --api-key hf_your-token \
  --base-url https://api-inference.huggingface.co \
  --model sentence-transformers/all-mpnet-base-v2
```

### Cohere Configuration

```bash
# Basic Cohere setup
ziri config provider cohere --api-key your-cohere-key

# Cohere with specific model
ziri config provider cohere \
  --api-key your-cohere-key \
  --model embed-english-v3.0
```

## Indexing Scenarios

### Small Project (< 1000 files)

```bash
# Quick indexing with defaults
ziri index

# With progress details
ziri index --verbose
```

### Medium Project (1000-5000 files)

```bash
# Optimized for medium projects
ziri index --concurrency 4 --batch-size 75

# With memory optimization
ziri index --concurrency 3 --batch-size 50 --memory-limit 512
```

### Large Project (5000+ files)

```bash
# High-performance indexing
ziri index --concurrency 6 --batch-size 100 --memory-limit 1024

# Memory-constrained large project
ziri index --concurrency 2 --batch-size 25 --memory-limit 256
```

### Monorepo Indexing

```bash
# Index entire monorepo with enhanced context
ziri index --verbose --stats

# Index with custom exclusions
ziri index --exclude "node_modules,dist,build,.next,coverage"

# Force full re-index with enhanced context
ziri index --force --verbose
```

## AI Chat Examples (NEW)

### Understanding Your Codebase

```bash
# Get architectural overview
ziri chat "what are the main components of this system?"

# Understand data flow
ziri chat "how does data flow through the application?"

# Learn about patterns
ziri chat "what design patterns are used in this codebase?"

# Understand dependencies
ziri chat "what are the key dependencies and how are they used?"
```

### Debugging and Troubleshooting

```bash
# Debug authentication issues
ziri chat "why might user login be failing?"

# Understand error handling
ziri chat "how does this application handle errors?"

# Database connection issues
ziri chat "what could cause database connection problems?"

# Performance bottlenecks
ziri chat "where might performance bottlenecks occur?"
```

### Code Exploration

```bash
# Find specific functionality
ziri chat "how is user registration implemented?"

# Understand API structure
ziri chat "what API endpoints are available and what do they do?"

# Learn about configuration
ziri chat "how is the application configured?"

# Security analysis
ziri chat "what security measures are implemented?"
```

### Development Guidance

```bash
# Adding new features
ziri chat "how would I add a new user role to this system?"

# Testing strategies
ziri chat "what testing approaches are used here?"

# Deployment process
ziri chat "how is this application deployed?"

# Code quality
ziri chat "what code quality standards are followed?"
```

### Scoped Chat Queries

```bash
# Focus on backend services
ziri chat "how do the microservices communicate?" --scope set:backend

# Frontend-specific questions
ziri chat "what state management is used?" --scope set:frontend

# Get more context for complex questions
ziri chat "explain the entire user authentication flow" --k 15 --verbose

# Repository-specific questions
cd /path/to/specific/repo
ziri chat "what is unique about this service?" --scope repo
```

# Force full re-index of monorepo
ziri index --force --concurrency 8 --memory-limit 2048
```

### Incremental Updates

```bash
# After making changes, run incremental update
ziri index  # Automatically detects changes

# Force full re-index if needed
ziri index --force

# Check what would be updated (dry run)
ziri index --verbose  # Shows which files changed
```

## Performance Optimization Examples

### Finding Optimal Settings

```bash
# Run comprehensive benchmark
ziri benchmark --providers openai,ollama --duration 120 --output results.json

# Quick benchmark for current provider
ziri benchmark --duration 30

# Compare all available providers
ziri benchmark --providers openai,ollama,huggingface,cohere --duration 60
```

### Provider-Specific Optimization

```bash
# OpenAI optimized (high throughput)
ziri index --provider openai --concurrency 5 --batch-size 200

# Ollama optimized (local processing)
ziri index --provider ollama --concurrency 8 --batch-size 50

# Hugging Face optimized (rate limit friendly)
ziri index --provider huggingface --concurrency 2 --batch-size 25

# Cohere optimized (balanced)
ziri index --provider cohere --concurrency 3 --batch-size 75
```

### Memory-Constrained Environments

```bash
# Minimal memory usage
ziri index --memory-limit 128 --batch-size 10 --concurrency 1

# Balanced low-memory setup
ziri index --memory-limit 256 --batch-size 25 --concurrency 2

# With checkpointing for reliability
ziri index --memory-limit 256 --batch-size 20 --verbose
```

## Multi-Repository Management

### Team Development Setup

```bash
# Backend repositories
ziri sources add /path/to/api-server --set backend
ziri sources add /path/to/auth-service --set backend
ziri sources add /path/to/data-service --set backend

# Frontend repositories
ziri sources add /path/to/web-app --set frontend
ziri sources add /path/to/mobile-app --set frontend
ziri sources add /path/to/admin-panel --set frontend

# Shared libraries
ziri sources add /path/to/shared-utils --set shared
ziri sources add /path/to/common-types --set shared

# Index all repositories
for repo in /path/to/api-server /path/to/auth-service /path/to/data-service \
           /path/to/web-app /path/to/mobile-app /path/to/admin-panel \
           /path/to/shared-utils /path/to/common-types; do
  cd "$repo" && ziri index
done
```

### Querying Multiple Repositories

```bash
# Query specific repository set
ziri query "authentication middleware" --scope set:backend
ziri query "React components" --scope set:frontend
ziri query "utility functions" --scope set:shared

# Query all repositories
ziri query "error handling patterns" --scope all

# Query current repository only
ziri query "database models" --scope repo
```

## Advanced Query Examples

### Specific Code Patterns

```bash
# Find authentication logic
ziri query "user authentication login logout"

# Find database operations
ziri query "database query insert update delete"

# Find error handling
ziri query "try catch error handling exception"

# Find API endpoints
ziri query "REST API endpoints routes handlers"

# Find configuration
ziri query "configuration settings environment variables"
```

### Architecture and Design Patterns

```bash
# Find design patterns
ziri query "singleton factory observer pattern"

# Find architectural components
ziri query "middleware controller service repository"

# Find security implementations
ziri query "security validation authorization permissions"

# Find testing patterns
ziri query "unit tests integration tests mocking"
```

### Technology-Specific Queries

```bash
# React/Frontend
ziri query "React hooks useState useEffect"
ziri query "component props state management"

# Node.js/Backend
ziri query "Express middleware routing"
ziri query "async await promises"

# Database
ziri query "SQL queries joins transactions"
ziri query "MongoDB aggregation pipeline"

# DevOps
ziri query "Docker containerization deployment"
ziri query "CI/CD pipeline configuration"
```

## Troubleshooting Examples

### Common Issues and Solutions

#### Slow Indexing

```bash
# Diagnose performance
ziri benchmark --duration 30

# Try different settings
ziri index --concurrency 2 --batch-size 25  # Conservative
ziri index --concurrency 6 --batch-size 100 # Aggressive

# Check system resources
ziri doctor
```

#### Memory Issues

```bash
# Reduce memory usage
ziri index --memory-limit 256 --batch-size 20 --concurrency 2

# Use legacy indexer as fallback
ziri index --legacy

# Check memory usage during indexing
ziri index --verbose --stats
```

#### API Rate Limits

```bash
# Reduce API pressure
ziri index --concurrency 1 --batch-size 10

# Switch to local provider
ziri config provider ollama
ziri index

# Use different provider
ziri config provider huggingface --api-key hf_your-key
ziri index --provider huggingface
```

#### Configuration Issues

```bash
# Check current configuration
ziri config show

# Reset configuration
ziri config reset

# Reconfigure provider
ziri config provider openai --api-key sk-new-key

# Check system health
ziri doctor
```

## Automation Examples

### CI/CD Integration

```bash
#!/bin/bash
# ci-index.sh - Index repository in CI/CD pipeline

set -e

# Configure provider from environment
ziri config provider openai --api-key "$OPENAI_API_KEY"

# Index with CI-friendly settings
ziri index --concurrency 2 --batch-size 25 --memory-limit 512

# Verify indexing worked
ziri query "main function" --k 1 > /dev/null

echo "Repository indexed successfully"
```

### Batch Processing Script

```bash
#!/bin/bash
# batch-index.sh - Index multiple repositories

REPOS=(
  "/path/to/repo1"
  "/path/to/repo2"
  "/path/to/repo3"
)

for repo in "${REPOS[@]}"; do
  echo "Indexing $repo..."
  cd "$repo"
  
  if ziri index --concurrency 3 --batch-size 50; then
    echo "✅ Successfully indexed $repo"
  else
    echo "❌ Failed to index $repo"
  fi
done
```

### Monitoring Script

```bash
#!/bin/bash
# monitor-ziri.sh - Monitor Ziri performance

# Run benchmark and save results
ziri benchmark --duration 60 --output "benchmark-$(date +%Y%m%d).json"

# Check system health
ziri doctor > "health-$(date +%Y%m%d).log"

# List all repositories and their status
ziri sources list > "sources-$(date +%Y%m%d).json"

echo "Monitoring data collected"
```

## Best Practices

### Development Workflow

```bash
# 1. Initial setup
ziri config provider ollama  # Use local provider for development
ziri sources add .

# 2. Daily development
ziri index  # Quick incremental updates

# 3. Before commits
ziri query "TODO FIXME" --k 20  # Find remaining work

# 4. Code review preparation
ziri query "new feature implementation" --k 10
```

### Production Deployment

```bash
# 1. Production configuration
ziri config provider openai --api-key "$PROD_OPENAI_KEY"
ziri config set performance.concurrency 4
ziri config set performance.batchSize 100

# 2. Initial production indexing
ziri index --force --verbose --stats

# 3. Scheduled updates (cron job)
0 2 * * * cd /path/to/repo && ziri index --concurrency 2
```

### Team Collaboration

```bash
# Shared configuration file
cat > .ziri-config.json << EOF
{
  "defaultProvider": "ollama",
  "performance": {
    "concurrency": 3,
    "batchSize": 50,
    "memoryLimit": 512
  },
  "exclusions": {
    "patterns": ["node_modules", "dist", "coverage", ".next"]
  }
}
EOF

# Team members can use shared config
ziri config load .ziri-config.json
ziri index
```

These examples should cover most common use cases and provide a solid foundation for using Ziri effectively in various scenarios.