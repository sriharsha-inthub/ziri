# Ziri — AI Code Context CLI

High-performance AI code context CLI with enhanced indexing, local AI chat, and intelligent semantic search capabilities.

## 🚀 Quick Start

```bash
# Install
npm install -g ziri

# Setup Ollama (local, free, recommended)
# Download from: https://ollama.ai/download
ollama pull nomic-embed-text && ollama pull llama3.2

# Index your repository with enhanced context
ziri index

# Query with rich results
ziri query "authentication logic"

# Chat with AI using your codebase context
ziri chat "how does the user login system work?"
```

## ✨ Key Features

- **Enhanced Context (Default)** - Rich metadata, code snippets, and surrounding context
- **AI Chat Integration** - Local Ollama chat with codebase context
- **10x Faster Indexing** - Concurrent processing with intelligent batching
- **Incremental Updates** - Only re-index changed files
- **Multiple Providers** - Ollama (default), OpenAI, Hugging Face, Cohere
- **Memory Optimized** - Handle large repositories without crashes
- **Repository Isolation** - Per-repo vector stores with no cross-contamination

## 📊 Performance

| Repository Size | Time | Improvement |
|----------------|------|-------------|
| Small (< 500 files) | 8s | **4x faster** |
| Medium (1000-3000 files) | 15-30s | **8x faster** |
| Large (5000+ files) | 1-3 min | **10x faster** |

## 🤖 Supported Providers

| Provider | Type | Best For | Setup |
|----------|------|----------|-------|
| **Ollama** ⭐ | Local | Development, privacy, free, chat | `ollama pull nomic-embed-text && ollama pull llama3.2` |
| **OpenAI** | Cloud API | Production, high quality | API key required |
| **Hugging Face** | Cloud API | Specific models, research | API key required |
| **Cohere** | Cloud API | Alternative to OpenAI | API key required |

⭐ **Ollama is the default provider** - no API keys needed, runs locally, supports chat!

## 📚 Documentation

### 👤 For Users
- **[Getting Started](docs/user/)** - Installation, quickstart, and basic usage
- **[CLI Reference](docs/user/cli-reference.md)** - Complete command documentation
- **[Configuration](docs/user/configuration.md)** - Provider setup and performance tuning
- **[Troubleshooting](docs/user/troubleshooting.md)** - Common issues and solutions

### 🚀 For Deployment
- **[Docker Setup](docs/deployment/docker.md)** - Container deployment
- **[CI/CD Integration](docs/deployment/cicd.md)** - GitHub Actions, GitLab CI, Jenkins
- **[Security Guide](docs/deployment/security.md)** - Security best practices

### 👨‍💻 For Developers
- **[AGENTS.md](AGENTS.md)** - Complete development standards and instructions
- **[Architecture](docs/developer/architecture.md)** - System design and components
- **[Contributing](docs/developer/contributing.md)** - How to contribute to Ziri
- **[API Documentation](docs/developer/api.md)** - Internal APIs and interfaces

## 🔧 Advanced Usage

```bash
# Enhanced context with AI chat (default)
ziri index                                    # Rich metadata extraction
ziri query "authentication logic"             # Code snippets in results
ziri chat "explain this auth flow"            # AI assistance with context

# Performance optimization
ziri benchmark --providers ollama,openai
ziri index --concurrency 4 --batch-size 75

# Multi-repository management
ziri sources add ~/code/backend --set backend
ziri sources add ~/code/frontend --set frontend
ziri query "API endpoints" --scope set:backend
ziri chat "how do these services communicate?" --scope set:backend

# Health monitoring and Ollama status
ziri doctor
```

## 🆕 Enhanced Context Features (v1.0)

- **Rich Metadata**: Automatic extraction of functions, classes, imports
- **Code Snippets**: See actual code in query results, not just file paths
- **Surrounding Context**: 2-3 lines before/after for better understanding
- **Language Detection**: Syntax highlighting and language-aware processing
- **AI Chat**: Local Ollama integration for contextual code assistance
- **Better Relevance**: Improved explanations of why results match your query

### Migration from Legacy
```bash
# Enhanced context is now default
ziri index                    # Uses enhanced context

# Legacy mode (deprecated, will be removed in v2.0)
ziri index --legacy          # Old indexing method
```

## 🆘 Need Help?

- **Quick Issues**: Check the [Troubleshooting Guide](docs/user/troubleshooting.md)
- **Getting Started**: Follow the [Quickstart Guide](docs/user/quickstart.md)
- **Advanced Setup**: See [Usage Examples](docs/user/usage-examples.md)

## 📄 License

MIT License - see LICENSE file for details.

---

**Ziri** - Making AI-assisted development faster and more intelligent, one repository at a time.