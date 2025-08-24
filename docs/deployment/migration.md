# Ziri Migration Guide

This guide helps you migrate from the legacy Ziri indexer to the new high-performance architecture while maintaining backward compatibility.

## Overview

The new Ziri architecture provides significant improvements:

- **10x faster indexing** through concurrent processing and intelligent batching
- **Incremental updates** - only re-index changed files
- **Memory optimization** - handle large repositories without crashes
- **Multiple embedding providers** - easy switching between OpenAI, Ollama, Hugging Face, and Cohere
- **Automatic performance tuning** - adaptive optimization based on your system and provider
- **Better progress reporting** - detailed statistics and real-time feedback

## Backward Compatibility

✅ **Fully backward compatible** - existing indexes continue to work
✅ **Same query interface** - no changes to query commands
✅ **Legacy mode available** - fallback option if needed

## Migration Steps

### Step 1: Update Ziri

```bash
# Update to the latest version
npm update -g ziri

# Verify installation
ziri --version  # Should show v0.1.1 or later
```

### Step 2: Check System Health

```bash
# Run health check to see current status
ziri doctor
```

This will show:
- Current configuration
- Provider status
- Storage locations
- Recommendations for optimization

### Step 3: Configure New Features (Optional)

The new Ziri works with your existing configuration, but you can take advantage of new features:

```bash
# Configure additional providers
ziri config provider ollama  # Local embeddings
ziri config provider huggingface --api-key hf_your-key

# Set performance preferences
ziri config set performance.concurrency 4
ziri config set performance.batchSize 75
ziri config set performance.memoryLimit 512
```

### Step 4: Re-index for Optimal Performance

While not required, re-indexing will enable incremental updates and performance optimizations:

```bash
# Re-index current repository (will be faster next time)
ziri index --force --verbose

# Or use legacy indexer if you encounter issues
ziri index --legacy
```

## Configuration Migration

### Environment Variables

Your existing environment variables continue to work:

| Legacy Variable | Status | New Alternative |
|----------------|--------|-----------------|
| `ZIRI_EMBEDDER` | ✅ Supported | `ziri config set defaultProvider <name>` |
| `ZIRI_OPENAI_API_KEY` | ✅ Supported | `ziri config provider openai --api-key <key>` |
| `OPENAI_API_KEY` | ✅ Supported | `ziri config provider openai --api-key <key>` |

### Command Line Options

| Legacy Command | New Command | Notes |
|---------------|-------------|-------|
| `ziri index` | `ziri index` | ✅ Same, but faster with new architecture |
| `ziri index --all` | `ziri index --force` | Force full re-index |
| `ziri query "text"` | `ziri query "text"` | ✅ Unchanged |
| `ziri sources add <path>` | `ziri sources add <path>` | ✅ Unchanged |
| `ziri doctor` | `ziri doctor` | ✅ Enhanced with more information |

### New Command Line Options

The new version adds many performance and configuration options:

```bash
# Performance tuning
ziri index --concurrency 5 --batch-size 100 --memory-limit 1024

# Provider selection
ziri index --provider ollama

# Detailed output
ziri index --verbose --stats

# Configuration management
ziri config show
ziri config provider openai --api-key sk-...

# Performance benchmarking
ziri benchmark --providers openai,ollama
```

## Performance Comparison

### Before (Legacy)
- Single-threaded processing
- Fixed batch sizes
- No incremental updates
- Limited memory management
- Single provider (OpenAI)

### After (New Architecture)
- Concurrent processing (2-8 threads)
- Adaptive batch sizing
- Incremental updates (only changed files)
- Memory optimization and monitoring
- Multiple providers with easy switching

### Typical Performance Improvements

| Repository Size | Legacy Time | New Time | Improvement |
|----------------|-------------|----------|-------------|
| Small (< 500 files) | 30s | 8s | 4x faster |
| Medium (1000-3000 files) | 2-5 min | 15-30s | 8x faster |
| Large (5000+ files) | 10-20 min | 1-3 min | 10x faster |

*Subsequent updates are even faster due to incremental processing*

## Provider Migration

### OpenAI Users

Your existing OpenAI setup continues to work, but you can optimize it:

```bash
# Check current configuration
ziri doctor

# Optimize for OpenAI
ziri config set performance.concurrency 4
ziri config set performance.batchSize 100

# Benchmark to find optimal settings
ziri benchmark --providers openai --duration 60
```

### Adding Local Providers

Take advantage of free local embedding providers:

```bash
# Install and start Ollama
# Visit: https://ollama.ai/download

# Configure Ollama in Ziri
ziri config provider ollama

# Test with local provider
ziri index --provider ollama

# Compare performance
ziri benchmark --providers openai,ollama
```

## Troubleshooting Migration Issues

### Issue: "Command not found" after update

**Solution:**
```bash
# Reinstall globally
npm uninstall -g ziri
npm install -g ziri

# Or use npx
npx ziri --version
```

### Issue: New indexer fails or is slower

**Solution:**
```bash
# Use legacy indexer as fallback
ziri index --legacy

# Or try conservative settings
ziri index --concurrency 2 --batch-size 25 --memory-limit 256

# Check system health
ziri doctor
```

### Issue: Configuration not found

**Solution:**
```bash
# Reset configuration
ziri config reset

# Reconfigure providers
ziri config provider openai --api-key sk-your-key

# Check configuration
ziri config show
```

### Issue: Memory errors during indexing

**Solution:**
```bash
# Reduce memory usage
ziri index --memory-limit 256 --batch-size 20 --concurrency 2

# Use streaming mode (automatic in new version)
ziri index --verbose  # Shows memory usage

# Use legacy indexer if needed
ziri index --legacy
```

### Issue: API rate limits

**Solution:**
```bash
# Reduce API pressure
ziri index --concurrency 1 --batch-size 10

# Switch to local provider
ziri config provider ollama
ziri index --provider ollama

# Use different provider
ziri config provider huggingface --api-key hf_your-key
```

## Feature Comparison

### Legacy Features (Still Available)

| Feature | Legacy | New | Notes |
|---------|--------|-----|-------|
| Basic indexing | ✅ | ✅ | Much faster in new version |
| OpenAI provider | ✅ | ✅ | Enhanced with optimization |
| Query interface | ✅ | ✅ | Unchanged |
| Source management | ✅ | ✅ | Enhanced with better organization |
| Progress reporting | ✅ | ✅ | Much more detailed |

### New Features

| Feature | Description | Benefit |
|---------|-------------|---------|
| Incremental updates | Only process changed files | 10-100x faster updates |
| Multiple providers | OpenAI, Ollama, Hugging Face, Cohere | Cost savings, privacy, flexibility |
| Concurrent processing | Multi-threaded indexing | 5-10x faster initial indexing |
| Memory optimization | Smart memory management | Handle larger repositories |
| Adaptive batching | Dynamic batch size optimization | Better API utilization |
| Performance benchmarking | Compare providers and settings | Data-driven optimization |
| Advanced configuration | Fine-tune all parameters | Optimize for your use case |
| Detailed statistics | Comprehensive performance metrics | Better visibility and debugging |

## Best Practices for Migration

### 1. Gradual Migration

```bash
# Start with current repository
cd /path/to/main/project
ziri index --verbose

# Verify everything works
ziri query "test query"

# Gradually add other repositories
ziri sources add /path/to/other/project
cd /path/to/other/project && ziri index
```

### 2. Performance Optimization

```bash
# Run benchmark to find optimal settings
ziri benchmark --duration 60

# Apply recommended settings
ziri config set performance.concurrency 4
ziri config set performance.batchSize 75

# Test with optimized settings
ziri index --force --stats
```

### 3. Provider Diversification

```bash
# Set up multiple providers
ziri config provider openai --api-key sk-your-key
ziri config provider ollama  # Local, free
ziri config provider huggingface --api-key hf-your-key

# Compare providers
ziri benchmark --providers openai,ollama,huggingface

# Use different providers for different purposes
ziri index --provider ollama  # Development
ziri index --provider openai  # Production
```

### 4. Monitoring and Maintenance

```bash
# Regular health checks
ziri doctor

# Monitor performance over time
ziri benchmark --output monthly-benchmark.json

# Keep configuration optimized
ziri config show > current-config.json
```

## Rollback Plan

If you need to rollback to legacy behavior:

### Temporary Rollback
```bash
# Use legacy indexer for specific operations
ziri index --legacy
```

### Full Rollback
```bash
# Install previous version (if needed)
npm install -g ziri@0.1.0

# Or use legacy mode permanently
echo 'alias ziri="ziri --legacy"' >> ~/.bashrc
```

## Getting Help

If you encounter issues during migration:

1. **Check system health**: `ziri doctor`
2. **Use verbose mode**: `ziri index --verbose`
3. **Try legacy mode**: `ziri index --legacy`
4. **Reset configuration**: `ziri config reset`
5. **Check documentation**: Review CLI reference and usage examples

## Migration Checklist

- [ ] Update Ziri to latest version
- [ ] Run `ziri doctor` to check system health
- [ ] Test indexing with current repository
- [ ] Configure additional providers (optional)
- [ ] Run performance benchmark
- [ ] Apply optimized settings
- [ ] Re-index repositories for incremental updates
- [ ] Update any automation scripts
- [ ] Train team on new features
- [ ] Monitor performance and adjust as needed

The migration process is designed to be smooth and non-disruptive. Your existing workflows will continue to work while you gradually adopt the new performance features.