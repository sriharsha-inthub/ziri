# Ziri Performance Optimization - Type Definitions

This directory contains TypeScript interfaces and type definitions for the Ziri performance optimization architecture.

## Structure

### Interfaces (`/interfaces`)

Core component interfaces that define the contracts for major system components:

- **`index-manager.ts`** - Main orchestrator for indexing operations
- **`repository-parser.ts`** - File system operations and change detection
- **`embedding-pipeline.ts`** - Concurrent embedding generation with batching
- **`index-store.ts`** - Isolated storage for repository embeddings
- **`project-summarizer.ts`** - Dynamic project summary generation

### Models (`/models`)

Data models and configuration schemas:

- **`data-models.ts`** - Core data structures (jobs, metrics, cache entries)
- **`config-schemas.ts`** - Configuration interfaces and default values

## Key Design Principles

### Repository Isolation
Each repository gets its own isolated storage directory with the structure:
```
~/.ziri/repositories/{repo-hash}/
├── vectors.db          # Vector embeddings
├── metadata.json       # Index metadata  
├── file-hashes.json    # Change detection
└── project_summary.md  # Generated summary
```

### Streaming Architecture
- Files are processed as streams to minimize memory usage
- Embeddings are generated and stored incrementally
- Support for resumable operations via checkpoints

### Provider Flexibility
- Abstract embedding provider interface
- Easy switching between OpenAI, Ollama, Hugging Face, Cohere
- Provider-specific optimization strategies

### Performance Optimization
- Intelligent batching with adaptive sizing
- Concurrent processing with configurable limits
- Memory usage monitoring and limits
- Incremental updates based on file changes

## Usage

```typescript
import {
  IndexManager,
  RepositoryParser,
  EmbeddingPipeline,
  IndexStore,
  ProjectSummarizer,
  ZiriConfig
} from './types/index.js';

// Use interfaces to implement concrete classes
class ConcreteIndexManager implements IndexManager {
  // Implementation
}
```

## Configuration

The system uses a hierarchical configuration approach:

1. **Default configuration** - Built-in sensible defaults
2. **Config file** - User-specific overrides in `~/.ziri/config/ziri.json`
3. **Environment variables** - Runtime overrides (e.g., `ZIRI_CONCURRENCY`)

See `config-schemas.ts` for the complete configuration structure and `DEFAULT_CONFIG` for default values.