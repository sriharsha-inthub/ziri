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
- **Multi-Language Support** - Enhanced analysis for JavaScript, TypeScript, Python, Java, Dart, YAML, ESQL, DataWeave, Mulesoft, and more
- **Advanced AST Analysis** - Deep code structure understanding with function, class, and import extraction
- **Error Resilience** - Graceful handling of malformed code and API failures

## 📦 Installation

```bash
# Install the latest version
npm install -g ziri

# Check installation
ziri --version
```

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
- **[AGENTS.md](docs/developer/AGENTS.md)** - Complete development standards and instructions
- **[Architecture](docs/developer/architecture.md)** - System design and components
- **[Contributing](docs/developer/contributing.md)** - How to contribute to Ziri
- **[API Documentation](docs/developer/api.md)** - Internal APIs and interfaces

## 🛠️ Recent Improvements (v0.2.1)

### Enhanced Code Analysis
- **Improved AST Parsing**: Better handling of complex language constructs
- **Multi-Language Support**: Enhanced analyzers for Dart, YAML, IBM ACE, Mulesoft, and more
- **Regex Pattern Fixes**: Resolved issues with import and function extraction across languages
- **Type Detection**: More accurate classification of code elements

### Performance & Reliability
- **Memory Optimization**: Better handling of large repositories
- **Error Handling**: Improved resilience to API failures and malformed code
- **Batch Processing**: More efficient embedding generation
- **Incremental Indexing**: Faster updates with intelligent change detection

### Developer Experience
- **Better Documentation**: Updated guides and examples
- **Enhanced Testing**: More comprehensive test coverage
- **Configuration Management**: Improved provider switching and validation

## 📄 License

MIT License - see LICENSE file for details.

---

**Ziri** - Making AI-assisted development faster and more intelligent, one repository at a time.