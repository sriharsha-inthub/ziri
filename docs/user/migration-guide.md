# Migration Guide: Legacy to Enhanced Context

## Overview

Ziri v1.0 introduces enhanced context as the default indexing method, with Ollama as the default provider and new AI chat functionality. Legacy indexing is available via the `--legacy` flag for backward compatibility.

## What Changed

### Enhanced Context (Default in v1.0)
- **Rich metadata extraction**: Functions, classes, imports automatically detected
- **Actual code snippets**: See real code in query results, not just file paths
- **Surrounding context**: 2-3 lines before/after for better understanding
- **Language detection**: Syntax highlighting and language-aware processing
- **Better relevance**: Improved explanations of why results match
- **AI Chat integration**: New `ziri chat` command with contextual assistance

### Ollama as Default Provider
- **Local AI**: No API keys required, runs on your machine
- **Privacy**: Your code never leaves your system
- **Chat functionality**: Enables the new `ziri chat` command
- **Free**: No usage costs or rate limits

### Legacy Indexing (Deprecated)
- Available via `--legacy` flag
- Minimal metadata, no code snippets
- No chat functionality
- Will be removed in v2.0

## Migration Steps

### 1. Setup Ollama (Recommended)
```bash
# Download and install Ollama: https://ollama.ai/download

# Pull required models
ollama pull nomic-embed-text    # For embeddings
ollama pull llama3.2           # For chat functionality

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

### 2. Re-index with Enhanced Context
```bash
# Enhanced context is now default
ziri index

# Force full re-index to get enhanced features
ziri index --force --verbose
```

### 3. Test New Features
```bash
# Test enhanced queries (should show code snippets)
ziri query "authentication logic"

# Test new chat functionality
ziri chat "how does user authentication work?"

# Compare with legacy mode
ziri index --legacy
ziri query "authentication logic"  # Notice the difference
```

### 4. Update Scripts and Workflows
```bash
# Old approach
ziri config provider openai --api-key sk-...
ziri index --legacy

# New recommended approach
ziri config provider ollama  # Default, no API key needed
ziri index                   # Enhanced context by default
ziri chat "your question"    # New AI assistance
```

### 5. Fallback Options
If you encounter issues:
```bash
# Temporary fallback to legacy indexing
ziri index --legacy

# Use cloud provider if Ollama issues
ziri config provider openai --api-key sk-your-key
ziri index

# Check system health
ziri doctor
```

## Timeline and Roadmap

### v1.0 (Current)
- ✅ Enhanced context as default indexing method
- ✅ Ollama as default provider (local, free)
- ✅ New `ziri chat` command for AI assistance
- ✅ Legacy indexing available via `--legacy` flag
- ✅ Rich metadata extraction and code snippets

### v2.0 (Future)
- 🔄 Legacy indexing removed completely
- 🔄 Advanced code structure analysis
- 🔄 Improved chat context understanding
- 🔄 Performance optimizations

### v3.0 (Future - RAG Graph)
- 🔮 Full RAG Graph implementation
- 🔮 Advanced context ranking and filtering
- 🔮 Interactive context exploration
- 🔮 Natural language query enhancement

## Benefits of Enhanced Context

1. **Richer Results**: See actual code snippets, not just file paths
2. **Better Context**: Surrounding lines help understand code structure
3. **Metadata**: Function names, classes, imports automatically extracted
4. **Language Aware**: Syntax highlighting and language detection
5. **Relevance**: Better explanations of why results match your query
6. **AI Chat**: New contextual assistance with `ziri chat` command
7. **Local Privacy**: Ollama keeps your code on your machine

## New Chat Functionality

The `ziri chat` command provides AI-powered assistance using your codebase:

```bash
# Ask about your code
ziri chat "how does the authentication system work?"

# Debug issues
ziri chat "why might the login be failing?"

# Understand patterns
ziri chat "explain the database connection pattern"

# Get architectural insights
ziri chat "what are the main components of this system?"
```

## Troubleshooting

### Enhanced Context Issues
1. Re-index with force: `ziri index --force`
2. Check disk space and permissions
3. Verify enhanced context is enabled: `ziri config show`
4. Fallback to legacy: `ziri index --legacy`

### Ollama Issues
1. Check if Ollama is running: `curl http://localhost:11434/api/tags`
2. Pull required models: `ollama pull nomic-embed-text && ollama pull llama3.2`
3. Restart Ollama: `ollama serve`
4. Check system health: `ziri doctor`

### Chat Command Issues
1. Ensure repository is indexed: `ziri index --force`
2. Verify Ollama models: `ollama list`
3. Test with verbose output: `ziri chat "test" --verbose`
4. Check context retrieval: `ziri query "test" --k 5`

### Performance
Enhanced context uses more storage but provides significantly richer results:
- **Storage overhead**: 2-3x for metadata and code snippets
- **Query speed**: Similar or faster due to better indexing
- **Result quality**: Much higher with actual code and context

## Migration Checklist

- [ ] Install Ollama and pull required models
- [ ] Re-index repositories with enhanced context
- [ ] Test query results for code snippets
- [ ] Try the new chat functionality
- [ ] Update any automation scripts
- [ ] Remove `--legacy` flags from scripts
- [ ] Configure team members on new features

## Support

For migration help:
1. **Quick Issues**: Check the [Troubleshooting Guide](troubleshooting.md)
2. **System Health**: Run `ziri doctor` for diagnostics
3. **Chat Setup**: Ensure Ollama is installed and models are pulled
4. **Performance**: Run `ziri benchmark` to optimize settings

### Common Migration Questions

**Q: Do I need to re-index everything?**
A: Yes, to get enhanced context features. Use `ziri index --force` for a complete re-index.

**Q: Can I still use OpenAI/other providers?**
A: Yes, all providers still work. Ollama is just the new default for local privacy and chat.

**Q: What if Ollama doesn't work on my system?**
A: You can still use cloud providers: `ziri config provider openai --api-key sk-your-key`

**Q: Is the chat feature secure?**
A: Yes, with Ollama everything runs locally. Your code never leaves your machine.

**Q: How much extra storage does enhanced context use?**
A: Typically 2-3x more storage, but the improved results are worth it.