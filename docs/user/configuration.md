# Ziri Configuration Guide

This comprehensive guide covers all configuration options available in Ziri, from basic setup to advanced performance tuning.

## Configuration Overview

Ziri uses a hierarchical configuration system that allows flexible customization:

1. **Command-line arguments** (highest priority)
2. **Environment variables**
3. **Configuration files**
4. **Default values** (lowest priority)

## Configuration File Location

- **Primary**: `~/.ziri/config.json`
- **Backup**: `~/.ziri/config.json.backup`
- **Logs**: `~/.ziri/logs/`

## Basic Configuration

### First-Time Setup

```bash
# Check current configuration
ziri config show

# Configure your first provider
ziri config provider openai --api-key sk-your-key

# Set basic performance preferences
ziri config set performance.concurrency 3
ziri config set performance.batchSize 50

# Verify setup
ziri doctor
```

## Provider Configuration

### OpenAI Configuration

```bash
# Basic setup
ziri config provider openai --api-key sk-your-key

# Advanced setup with custom model
ziri config provider openai \
  --api-key sk-your-key \
  --model text-embedding-3-large \
  --base-url https://api.openai.com/v1

# Configuration file equivalent
{
  "providers": {
    "openai": {
      "type": "openai",
      "apiKey": "sk-your-key",
      "model": "text-embedding-3-small",
      "dimensions": 1536,
      "baseUrl": "https://api.openai.com/v1",
      "maxTokens": 8191,
      "rateLimit": {
        "requestsPerMinute": 3000,
        "tokensPerMinute": 1000000
      }
    }
  }
}
```

**OpenAI Models:**
- `text-embedding-3-small` (1536 dimensions, fastest, cheapest)
- `text-embedding-3-large` (3072 dimensions, highest quality)
- `text-embedding-ada-002` (1536 dimensions, legacy)

### Ollama Configuration

```bash
# Basic setup (assumes Ollama running on localhost:11434)
ziri config provider ollama

# Custom Ollama instance
ziri config provider ollama \
  --base-url http://your-server:11434 \
  --model nomic-embed-text

# Configuration file equivalent
{
  "providers": {
    "ollama": {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "nomic-embed-text",
      "dimensions": 768,
      "maxTokens": 2048
    }
  }
}
```

**Popular Ollama Models:**
- `nomic-embed-text` (768 dimensions, recommended)
- `all-minilm` (384 dimensions, fast)
- `mxbai-embed-large` (1024 dimensions, high quality)

### Hugging Face Configuration

```bash
# Basic setup
ziri config provider huggingface --api-key hf_your-token

# With custom model
ziri config provider huggingface \
  --api-key hf_your-token \
  --model sentence-transformers/all-mpnet-base-v2

# Configuration file equivalent
{
  "providers": {
    "huggingface": {
      "type": "huggingface",
      "apiKey": "hf_your-token",
      "model": "sentence-transformers/all-MiniLM-L6-v2",
      "dimensions": 384,
      "baseUrl": "https://api-inference.huggingface.co",
      "maxTokens": 512
    }
  }
}
```

**Popular Hugging Face Models:**
- `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, fast)
- `sentence-transformers/all-mpnet-base-v2` (768 dimensions, balanced)
- `sentence-transformers/all-MiniLM-L12-v2` (384 dimensions, good quality)

### Cohere Configuration

```bash
# Basic setup
ziri config provider cohere --api-key your-cohere-key

# With specific model
ziri config provider cohere \
  --api-key your-cohere-key \
  --model embed-english-v3.0

# Configuration file equivalent
{
  "providers": {
    "cohere": {
      "type": "cohere",
      "apiKey": "your-cohere-key",
      "model": "embed-english-v3.0",
      "dimensions": 1024,
      "maxTokens": 512
    }
  }
}
```

**Cohere Models:**
- `embed-english-v3.0` (1024 dimensions, latest)
- `embed-english-light-v3.0` (384 dimensions, faster)
- `embed-multilingual-v3.0` (1024 dimensions, multilingual)

## Performance Configuration

### Basic Performance Settings

```bash
# Set concurrency (number of parallel requests)
ziri config set performance.concurrency 4

# Set batch size (items per request)
ziri config set performance.batchSize 75

# Set memory limit (MB)
ziri config set performance.memoryLimit 512

# Enable adaptive batching
ziri config set performance.adaptiveBatching true
```

### Advanced Performance Settings

```bash
# Retry configuration
ziri config set performance.retryAttempts 3
ziri config set performance.retryDelay 1000

# Timeout settings
ziri config set performance.requestTimeout 30000
ziri config set performance.connectionTimeout 10000

# Streaming settings
ziri config set performance.streamingEnabled true
ziri config set performance.chunkSize 1000
```

### Performance Profiles

#### High-Performance Profile (Powerful machine, fast API)
```bash
ziri config set performance.concurrency 8
ziri config set performance.batchSize 200
ziri config set performance.memoryLimit 2048
ziri config set performance.adaptiveBatching true
```

#### Balanced Profile (Standard setup)
```bash
ziri config set performance.concurrency 4
ziri config set performance.batchSize 75
ziri config set performance.memoryLimit 512
ziri config set performance.adaptiveBatching true
```

#### Conservative Profile (Limited resources)
```bash
ziri config set performance.concurrency 2
ziri config set performance.batchSize 25
ziri config set performance.memoryLimit 256
ziri config set performance.adaptiveBatching false
```

#### Memory-Constrained Profile (Very limited RAM)
```bash
ziri config set performance.concurrency 1
ziri config set performance.batchSize 10
ziri config set performance.memoryLimit 128
ziri config set performance.streamingEnabled true
```

## Exclusion Configuration

### File Pattern Exclusions

```bash
# Set exclusion patterns
ziri config set exclusions.patterns "node_modules,.git,dist,build,.next,coverage"

# Add to existing patterns
ziri config add exclusions.patterns "logs,tmp,cache"

# Remove specific pattern
ziri config remove exclusions.patterns "coverage"
```

### File Extension Exclusions

```bash
# Set excluded extensions
ziri config set exclusions.extensions ".bin,.exe,.dll,.so,.dylib,.zip,.tar,.gz"

# Add image and media files
ziri config add exclusions.extensions ".jpg,.png,.gif,.mp4,.avi,.mov"

# Add compiled files
ziri config add exclusions.extensions ".class,.pyc,.o,.obj"
```

### File Size Limits

```bash
# Set maximum file size (bytes)
ziri config set exclusions.maxFileSize 1048576  # 1MB

# Set minimum file size (bytes)
ziri config set exclusions.minFileSize 10  # 10 bytes

# Disable file size limits
ziri config set exclusions.maxFileSize 0
```

### Advanced Exclusion Patterns

```json
{
  "exclusions": {
    "patterns": [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
      "*.log",
      "*.tmp",
      "test/**/*.spec.js",
      "docs/generated/**",
      "**/vendor/**"
    ],
    "extensions": [
      ".bin", ".exe", ".dll", ".so", ".dylib",
      ".zip", ".tar", ".gz", ".rar", ".7z",
      ".jpg", ".png", ".gif", ".bmp", ".ico",
      ".mp3", ".mp4", ".avi", ".mov", ".wmv",
      ".pdf", ".doc", ".docx", ".xls", ".xlsx"
    ],
    "maxFileSize": 1048576,
    "minFileSize": 10,
    "excludeHidden": true,
    "excludeBinary": true
  }
}
```

## Storage Configuration

### Storage Locations

```bash
# Set custom storage directory
export ZIRI_HOME=/path/to/custom/storage
ziri config set storage.baseDir "/path/to/custom/storage"

# Set repository storage location
ziri config set storage.repositoriesDir "repositories"

# Set logs directory
ziri config set storage.logsDir "logs"
```

### Storage Options

```bash
# Enable compression
ziri config set storage.compression true

# Set backup count
ziri config set storage.backupCount 3

# Enable automatic cleanup
ziri config set storage.autoCleanup true
ziri config set storage.maxAge 2592000  # 30 days in seconds
```

### Storage Structure

```
~/.ziri/
├── config.json              # Main configuration
├── config.json.backup       # Configuration backup
├── repositories/             # Repository indexes
│   ├── {repo-hash-1}/
│   │   ├── vectors.db        # Vector embeddings
│   │   ├── metadata.json     # Index metadata
│   │   ├── file-hashes.json  # Change detection
│   │   └── project_summary.md
│   └── {repo-hash-2}/
│       ├── vectors.db
│       ├── metadata.json
│       ├── file-hashes.json
│       └── project_summary.md
├── logs/                     # Application logs
│   ├── ziri.log
│   ├── ziri.log.1
│   └── ziri.log.2
└── cache/                    # Temporary cache
    ├── providers/
    └── benchmarks/
```

## Logging Configuration

### Log Levels

```bash
# Set log level
ziri config set logging.level info

# Available levels: debug, info, warn, error, silent
ziri config set logging.level debug  # Most verbose
ziri config set logging.level error  # Least verbose
```

### Log File Settings

```bash
# Set log file location
ziri config set logging.file "~/.ziri/logs/ziri.log"

# Set maximum log file size (bytes)
ziri config set logging.maxSize 10485760  # 10MB

# Set number of log files to keep
ziri config set logging.maxFiles 5

# Enable console logging
ziri config set logging.console true
```

### Log Format Configuration

```json
{
  "logging": {
    "level": "info",
    "file": "~/.ziri/logs/ziri.log",
    "console": true,
    "maxSize": 10485760,
    "maxFiles": 5,
    "format": {
      "timestamp": true,
      "level": true,
      "component": true,
      "colors": true
    }
  }
}
```

## Environment Variables

### Provider Configuration
```bash
# API Keys
export OPENAI_API_KEY="sk-your-key"
export HUGGINGFACE_API_KEY="hf_your-token"
export COHERE_API_KEY="your-cohere-key"

# Legacy support
export ZIRI_EMBEDDER="openai"
export ZIRI_OPENAI_API_KEY="sk-your-key"
```

### Performance Settings
```bash
# Performance tuning
export ZIRI_CONCURRENCY=4
export ZIRI_BATCH_SIZE=75
export ZIRI_MEMORY_LIMIT=512

# Provider selection
export ZIRI_DEFAULT_PROVIDER="ollama"
```

### Storage and Logging
```bash
# Storage location
export ZIRI_HOME="/custom/path"

# Logging
export ZIRI_LOG_LEVEL="debug"
export ZIRI_LOG_FILE="/custom/log/path.log"
```

## Configuration Management

### Backup and Restore

```bash
# Create configuration backup
cp ~/.ziri/config.json ~/.ziri/config-backup-$(date +%Y%m%d).json

# Restore from backup
cp ~/.ziri/config-backup-20240101.json ~/.ziri/config.json

# Export configuration
ziri config export > ziri-config-export.json

# Import configuration
ziri config import ziri-config-export.json
```

### Configuration Validation

```bash
# Validate entire configuration
ziri config validate

# Validate specific provider
ziri config validate provider openai

# Validate performance settings
ziri config validate performance

# Fix common issues automatically
ziri config fix
```

### Configuration Templates

#### Development Template
```json
{
  "defaultProvider": "ollama",
  "providers": {
    "ollama": {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "nomic-embed-text"
    }
  },
  "performance": {
    "concurrency": 2,
    "batchSize": 25,
    "memoryLimit": 256
  },
  "exclusions": {
    "patterns": ["node_modules", ".git", "dist", "coverage"]
  },
  "logging": {
    "level": "debug"
  }
}
```

#### Production Template
```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "type": "openai",
      "apiKey": "sk-your-key",
      "model": "text-embedding-3-small"
    }
  },
  "performance": {
    "concurrency": 4,
    "batchSize": 100,
    "memoryLimit": 1024,
    "adaptiveBatching": true
  },
  "exclusions": {
    "patterns": ["node_modules", ".git", "dist", "build", "logs"],
    "maxFileSize": 1048576
  },
  "logging": {
    "level": "info",
    "maxFiles": 10
  }
}
```

## Advanced Configuration

### Custom Provider Configuration

```json
{
  "providers": {
    "custom-openai": {
      "type": "openai",
      "apiKey": "sk-your-key",
      "baseUrl": "https://your-proxy.com/v1",
      "model": "text-embedding-3-small",
      "headers": {
        "Custom-Header": "value"
      },
      "timeout": 30000
    }
  }
}
```

### Performance Monitoring

```bash
# Enable performance monitoring
ziri config set monitoring.enabled true
ziri config set monitoring.metricsFile "~/.ziri/metrics.json"
ziri config set monitoring.interval 1000

# Set performance thresholds
ziri config set monitoring.thresholds.memoryUsage 80
ziri config set monitoring.thresholds.responseTime 5000
```

### Experimental Features

```bash
# Enable experimental features
ziri config set experimental.enabled true
ziri config set experimental.features "adaptive-chunking,smart-batching"

# Advanced chunking
ziri config set experimental.chunking.strategy "semantic"
ziri config set experimental.chunking.overlap 0.1
```

## Configuration Best Practices

### Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for sensitive data**
3. **Regularly rotate API keys**
4. **Use least-privilege API keys when possible**

```bash
# Good: Use environment variables
export OPENAI_API_KEY="sk-your-key"
ziri config provider openai

# Bad: Store in configuration file
ziri config provider openai --api-key sk-your-key
```

### Performance Best Practices

1. **Run benchmarks to find optimal settings**
2. **Start with conservative settings and increase gradually**
3. **Monitor memory usage during indexing**
4. **Use local providers for development**

```bash
# Find optimal settings
ziri benchmark --duration 60
ziri config apply-benchmark-results

# Monitor performance
ziri index --verbose --stats
```

### Maintenance Best Practices

1. **Regularly backup configuration**
2. **Keep logs for troubleshooting**
3. **Update providers and models periodically**
4. **Clean up old indexes and logs**

```bash
# Regular maintenance script
#!/bin/bash
# Backup configuration
cp ~/.ziri/config.json ~/.ziri/config-backup-$(date +%Y%m%d).json

# Clean old logs
find ~/.ziri/logs -name "*.log.*" -mtime +30 -delete

# Update configuration
ziri config validate
ziri config fix
```

This configuration guide provides comprehensive coverage of all Ziri configuration options. Use it as a reference to optimize Ziri for your specific use case and environment.