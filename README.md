# Ziri — AI Code Context CLI

High-performance AI code context CLI with intelligent indexing, multiple embedding providers, and semantic search capabilities.

## 🚀 Quick Start

```bash
# Install
npm install -g ziri

# Configure provider
ziri config provider openai --api-key sk-your-key
# OR use local Ollama (free)
ziri config provider ollama

# Index your repository
ziri index

# Query your codebase
ziri query "authentication logic"
```

## ✨ Key Features

- **10x Faster Indexing** - Concurrent processing with intelligent batching
- **Incremental Updates** - Only re-index changed files
- **Multiple Providers** - OpenAI, Ollama, Hugging Face, Cohere support
- **Memory Optimized** - Handle large repositories without crashes
- **Repository Isolation** - Per-repo vector stores with no cross-contamination

## 📊 Performance

| Repository Size | Time | Improvement |
|----------------|------|-------------|
| Small (< 500 files) | 8s | **4x faster** |
| Medium (1000-3000 files) | 15-30s | **8x faster** |
| Large (5000+ files) | 1-3 min | **10x faster** |

## 🤖 Supported Providers

| Provider | Type | Best For |
|----------|------|----------|
| **OpenAI** | Cloud API | Production, high quality |
| **Ollama** | Local | Development, privacy, free |
| **Hugging Face** | Cloud API | Specific models, research |
| **Cohere** | Cloud API | Alternative to OpenAI |

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
# Performance optimization
ziri benchmark --providers openai,ollama
ziri index --concurrency 4 --batch-size 75

# Multi-repository management
ziri sources add ~/code/backend --set backend
ziri sources add ~/code/frontend --set frontend
ziri query "API endpoints" --scope set:backend

# Health monitoring
ziri doctor
```

## 🆘 Need Help?

- **Quick Issues**: Check the [Troubleshooting Guide](docs/user/troubleshooting.md)
- **Getting Started**: Follow the [Quickstart Guide](docs/user/quickstart.md)
- **Advanced Setup**: See [Usage Examples](docs/user/usage-examples.md)

## 📄 License

MIT License - see LICENSE file for details.

---

**Ziri** - Making AI-assisted development faster and more intelligent, one repository at a time.