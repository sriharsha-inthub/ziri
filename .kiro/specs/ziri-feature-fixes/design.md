# Design Document

## Overview

This design implements a focused approach to fix the broken chat and enhanced context features while establishing a solid foundation for future RAG Graph capabilities. The design prioritizes:

1. **Immediate Fixes**: Resolve broken functionality and test failures
2. **Enhanced Context (Phase 1)**: Basic rich metadata and content storage
3. **Clean Architecture**: Remove unnecessary legacy code and organize files properly
4. **Cost-Effective Implementation**: Clear task separation to minimize complexity

## Architecture

### High-Level Component Structure

```
ziri/
├── packages/ziri-js/
│   ├── lib/
│   │   ├── core/                    # Core business logic
│   │   │   ├── indexing/           # Enhanced indexing system
│   │   │   ├── querying/           # Query processing with rich results
│   │   │   ├── providers/          # Embedding providers (Ollama default)
│   │   │   ├── storage/            # Enhanced storage with metadata
│   │   │   └── config/             # Fixed configuration management
│   │   ├── cli/                    # CLI interface (chat, index, query)
│   │   ├── utils/                  # Utility functions
│   │   └── types/                  # TypeScript definitions
│   └── test/                       # Organized test structure
└── docs/                           # User documentation
```

### Key Design Decisions

1. **Enhanced Context as Default**: Make enhanced indexing the primary method with `--legacy` flag for safety
2. **Hybrid Approach**: Keep minimal legacy support for transition period (v1.0), remove in v2.0
3. **Ollama as Primary Provider**: Default to local AI with fallback error handling
4. **Incremental Metadata**: Start with basic code structure analysis
5. **Unified Configuration**: Single config manager interface across all components

## Components and Interfaces

### 1. Enhanced Storage System

```typescript
interface EnhancedChunkData {
  content: string;                    // Actual code content
  filePath: string;                   // Full file path
  relativePath: string;               // Repository-relative path
  startLine: number;                  // Starting line number
  endLine: number;                    // Ending line number
  language: string;                   // Detected programming language
  type: 'function' | 'class' | 'import' | 'comment' | 'code';
  functionName?: string;              // Extracted function name
  className?: string;                 // Extracted class name
  imports?: string[];                 // Import statements
  surroundingContext?: {              // Context lines before/after
    before: string[];
    after: string[];
  };
  metadata: {
    fileType: string;
    size: number;
    tokenCount: number;
  };
}
```

### 2. Configuration Manager (Fixed Interface)

```typescript
interface ConfigManager {
  // Core methods that tests expect
  getConfig(): Promise<Configuration>;
  updateConfig(config: Partial<Configuration>): Promise<void>;
  configureProvider(name: string, config: ProviderConfig): Promise<void>;
  resetConfig(): Promise<void>;
  
  // Environment and validation
  loadEnvironmentConfig(): Promise<void>;
  validateConfig(config: Configuration): Promise<ValidationResult>;
  
  // Provider management
  getProviderConfigs(): Promise<Record<string, ProviderConfig>>;
}
```

### 3. Chat Command Integration

```typescript
interface ChatCommand {
  execute(query: string, options: ChatOptions): Promise<ChatResult>;
}

interface ChatOptions {
  k?: number;                         // Number of context results
  scope?: 'repo' | 'all' | string;   // Query scope
  verbose?: boolean;                  // Detailed output
}

interface ChatResult {
  query: string;
  contextResults: EnhancedQueryResult[];
  response: string;
  metadata: {
    processingTime: number;
    contextCount: number;
    ollamaModel: string;
  };
}
```

### 4. Enhanced Query Results

```typescript
interface EnhancedQueryResult {
  score: number;
  file: string;
  repo: string;
  lines: string;                      // "startLine-endLine"
  context: string;                    // Actual code content
  language: string;
  type: 'function' | 'class' | 'import' | 'comment' | 'code';
  functionName?: string;
  className?: string;
  relevanceExplanation: string;       // Why this result is relevant
  surroundingLines?: {
    before: string[];
    after: string[];
  };
}
```

## Data Models

### Configuration Structure

```typescript
interface Configuration {
  defaultProvider: 'ollama' | 'openai' | 'huggingface' | 'cohere';
  providers: Record<string, ProviderConfig>;
  performance: {
    concurrency: number;
    batchSize: number;
    memoryLimit: number;
  };
  indexing: {
    enhancedContext: boolean;         // Always true (no legacy)
    maxFileSize: number;
    excludePatterns: string[];
    includeMetadata: boolean;
  };
}

interface ProviderConfig {
  type: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  dimensions: number;
  textModel?: string;                 // For Ollama chat generation
}
```

### Storage Schema

```typescript
interface IndexEntry {
  id: string;                         // Chunk hash ID
  relPath: string;                    // File relative path
  vectorPath: string;                 // Path to vector file
  chunkPath: string;                  // Path to chunk data file
  metadata: {
    alias: string;                    // Repository alias
    language: string;
    type: string;
    functionName?: string;
    className?: string;
    lastModified: number;
  };
}
```

## Error Handling

### 1. Chat Command Errors
- **No Ollama**: Clear setup instructions with download links
- **No Context**: Suggest indexing with helpful commands
- **Network Issues**: Graceful degradation with retry suggestions
- **Timeout Prevention**: Async operations with proper cancellation

### 2. Configuration Errors
- **Invalid Provider**: Validation with specific error messages
- **Missing API Keys**: Environment variable suggestions
- **Corrupted Config**: Auto-recovery with backup restoration

### 3. Enhanced Storage Errors
- **Missing Components**: Graceful fallback to basic storage
- **Parsing Failures**: Skip problematic files with warnings
- **Storage Issues**: Disk space and permission error handling

## Testing Strategy

### 1. Unit Tests (Fixed)
- Mock all external dependencies (Ollama, file system)
- Test configuration manager interface compliance
- Validate enhanced storage data structures
- Test error handling paths

### 2. Integration Tests (Streamlined)
- End-to-end chat workflow with mocked Ollama
- Enhanced indexing with real file processing
- Provider switching scenarios
- Configuration persistence

### 3. Performance Tests
- Memory usage during enhanced indexing
- Query response times with rich results
- Concurrent processing validation

## Implementation Phases

### Phase A: Core Fixes (Priority 1)
1. Fix configuration manager interface
2. Resolve chat command timeouts
3. Implement basic enhanced storage
4. Update failing tests

### Phase B: Enhanced Context (Priority 2)  
1. Add metadata extraction for common languages
2. Implement surrounding context capture
3. Create rich query result formatting
4. Add basic code structure analysis

### Phase C: Integration & Cleanup (Priority 3)
1. Remove unnecessary legacy code
2. Organize file structure according to AGENTS.md
3. Update documentation
4. Ensure all tests pass

This design ensures each phase delivers working functionality while building toward the complete enhanced context system.