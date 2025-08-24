# Contributing to Ziri

Thank you for your interest in contributing to Ziri! This guide will help you get started with development, understand the codebase, and make meaningful contributions.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

- Node.js 16+ or Python 3.8+
- Git
- A code editor (VS Code recommended)
- Access to at least one embedding provider (OpenAI, Ollama, etc.)

### Quick Start

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/ziri.git
   cd ziri
   ```

2. **Install Dependencies**
   ```bash
   # Node.js version
   cd packages/ziri-js
   npm install
   
   # Python version
   cd packages/ziri-py
   pip install -e .
   ```

3. **Set Up Development Environment**
   ```bash
   # Configure test provider
   export OPENAI_API_KEY="sk-your-test-key"
   # or
   export ZIRI_TEST_PROVIDER="ollama"
   
   # Link for development
   npm link  # In packages/ziri-js
   ```

4. **Run Tests**
   ```bash
   npm test
   npm run test:integration
   ```

## Development Setup

### Environment Configuration

Create a `.env` file in the project root:

```bash
# Test configuration
ZIRI_TEST_PROVIDER=ollama
OPENAI_API_KEY=sk-your-test-key
HUGGINGFACE_API_KEY=hf_your-test-key

# Development settings
ZIRI_LOG_LEVEL=debug
ZIRI_HOME=./test-data/.ziri

# Test repository paths
ZIRI_TEST_REPO_SMALL=./test-data/small-repo
ZIRI_TEST_REPO_MEDIUM=./test-data/medium-repo
ZIRI_TEST_REPO_LARGE=./test-data/large-repo
```

### IDE Setup

#### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.ziri": true
  }
}
```

#### Recommended Extensions

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Jest
- GitLens
- Thunder Client (for API testing)

## Project Structure

```
ziri/
├── packages/
│   ├── ziri-js/                 # Node.js implementation
│   │   ├── src/
│   │   │   ├── cli/             # CLI interface
│   │   │   ├── core/            # Core business logic
│   │   │   │   ├── indexing/    # Indexing pipeline
│   │   │   │   ├── querying/    # Query processing
│   │   │   │   ├── providers/   # Embedding providers
│   │   │   │   ├── storage/     # Storage backends
│   │   │   │   └── config/      # Configuration management
│   │   │   ├── utils/           # Utility functions
│   │   │   └── types/           # TypeScript type definitions
│   │   ├── test/                # Test files
│   │   ├── docs/                # Package-specific docs
│   │   └── examples/            # Usage examples
│   └── ziri-py/                 # Python implementation
│       ├── ziri/
│       ├── tests/
│       └── docs/
├── docs/                        # Main documentation
├── test-data/                   # Test repositories
├── scripts/                     # Build and utility scripts
└── .github/                     # GitHub workflows
```

### Core Modules

#### Indexing Pipeline (`src/core/indexing/`)

- `IndexManager.ts` - Main indexing orchestrator
- `RepositoryParser.ts` - File discovery and parsing
- `EmbeddingPipeline.ts` - Embedding generation pipeline
- `ChangeDetector.ts` - Incremental update logic
- `FileChunker.ts` - Text chunking strategies

#### Query Processing (`src/core/querying/`)

- `QueryManager.ts` - Query processing and execution
- `ResultScorer.ts` - Result ranking and scoring
- `QueryOptimizer.ts` - Query preprocessing

#### Providers (`src/core/providers/`)

- `BaseProvider.ts` - Abstract provider interface
- `OpenAIProvider.ts` - OpenAI implementation
- `OllamaProvider.ts` - Ollama implementation
- `HuggingFaceProvider.ts` - Hugging Face implementation
- `CohereProvider.ts` - Cohere implementation

#### Storage (`src/core/storage/`)

- `IndexStore.ts` - Main storage interface
- `VectorStore.ts` - Vector database operations
- `MetadataStore.ts` - Metadata management
- `FileSystemStore.ts` - File system operations

## Development Workflow

### Branch Strategy

We use a simplified Git flow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `fix/*` - Bug fix branches
- `release/*` - Release preparation branches

### Feature Development

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Develop and Test**
   ```bash
   # Make changes
   npm test
   npm run lint
   npm run type-check
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(providers): add Cohere embedding provider
fix(indexing): handle empty files gracefully
docs(api): update provider interface documentation
perf(storage): optimize vector similarity search
```

## Code Standards

### TypeScript Guidelines

1. **Use strict TypeScript configuration**
2. **Prefer interfaces over types for object shapes**
3. **Use explicit return types for public methods**
4. **Avoid `any` - use proper typing**
5. **Use meaningful variable and function names**

#### Example Code Style

```typescript
// Good
interface EmbeddingResult {
  vectors: number[][]
  processingTime: number
  tokenCount: number
}

class OpenAIProvider implements EmbeddingProvider {
  constructor(private config: ProviderConfig) {}
  
  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now()
    
    try {
      const response = await this.makeRequest(texts)
      return {
        vectors: response.data.map(item => item.embedding),
        processingTime: Date.now() - startTime,
        tokenCount: this.estimateTokens(texts)
      }
    } catch (error) {
      throw new ProviderError(
        `OpenAI embedding failed: ${error.message}`,
        'openai',
        error.status
      )
    }
  }
}

// Bad
class Provider {
  async embed(texts: any): Promise<any> {
    let result = await this.api(texts)
    return result
  }
}
```

### Error Handling

1. **Use custom error classes**
2. **Provide meaningful error messages**
3. **Include context in errors**
4. **Handle errors at appropriate levels**

```typescript
// Good
try {
  await this.processFile(filePath)
} catch (error) {
  if (error instanceof FileNotFoundError) {
    this.logger.warn(`File not found: ${filePath}`, { filePath })
    return // Skip missing files
  }
  
  throw new IndexingError(
    `Failed to process file: ${error.message}`,
    filePath,
    undefined,
    { originalError: error }
  )
}

// Bad
try {
  await this.processFile(filePath)
} catch (error) {
  console.log('Error:', error)
  throw error
}
```

### Async/Await Guidelines

1. **Prefer async/await over Promises**
2. **Handle errors properly**
3. **Use concurrent processing when appropriate**
4. **Avoid blocking operations**

```typescript
// Good
async function processFiles(files: string[]): Promise<ProcessingResult[]> {
  const results = await Promise.allSettled(
    files.map(file => this.processFile(file))
  )
  
  return results.map((result, index) => ({
    file: files[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : undefined,
    error: result.status === 'rejected' ? result.reason : undefined
  }))
}

// Bad
function processFiles(files: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    let results = []
    files.forEach(file => {
      this.processFile(file).then(result => {
        results.push(result)
        if (results.length === files.length) {
          resolve(results)
        }
      }).catch(reject)
    })
  })
}
```

## Testing

### Test Structure

```
test/
├── unit/                    # Unit tests
│   ├── core/
│   │   ├── indexing/
│   │   ├── querying/
│   │   └── providers/
│   └── utils/
├── integration/             # Integration tests
│   ├── end-to-end/
│   ├── provider-integration/
│   └── storage-integration/
├── performance/             # Performance tests
├── fixtures/                # Test data
└── helpers/                 # Test utilities
```

### Unit Testing

Use Jest for unit testing:

```typescript
// test/unit/core/providers/OpenAIProvider.test.ts
import { OpenAIProvider } from '../../../../src/core/providers/OpenAIProvider'
import { ProviderConfig } from '../../../../src/types'

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  let mockConfig: ProviderConfig
  
  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxTokens: 8191,
      timeout: 30000,
      retryAttempts: 3
    }
    provider = new OpenAIProvider(mockConfig)
  })
  
  describe('embed', () => {
    it('should generate embeddings for text inputs', async () => {
      const texts = ['Hello world', 'Test text']
      const mockResponse = {
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] }
        ]
      }
      
      jest.spyOn(provider as any, 'makeRequest').mockResolvedValue(mockResponse)
      
      const result = await provider.embed(texts)
      
      expect(result.vectors).toHaveLength(2)
      expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3])
      expect(result.processingTime).toBeGreaterThan(0)
    })
    
    it('should handle API errors gracefully', async () => {
      const texts = ['Test text']
      const apiError = new Error('API Error')
      
      jest.spyOn(provider as any, 'makeRequest').mockRejectedValue(apiError)
      
      await expect(provider.embed(texts)).rejects.toThrow('OpenAI embedding failed')
    })
  })
})
```

### Integration Testing

```typescript
// test/integration/end-to-end/indexing.test.ts
import { IndexManager } from '../../../src/core/indexing/IndexManager'
import { createTestRepository, cleanupTestData } from '../../helpers/testUtils'

describe('End-to-End Indexing', () => {
  let indexManager: IndexManager
  let testRepoPath: string
  
  beforeAll(async () => {
    testRepoPath = await createTestRepository('small')
    indexManager = new IndexManager()
  })
  
  afterAll(async () => {
    await cleanupTestData(testRepoPath)
  })
  
  it('should index a repository completely', async () => {
    const result = await indexManager.indexRepository(testRepoPath, {
      provider: 'ollama',
      concurrency: 2,
      batchSize: 10,
      memoryLimit: 256,
      forceFullIndex: true,
      excludePatterns: ['node_modules', '.git'],
      verbose: false,
      dryRun: false
    })
    
    expect(result.filesProcessed).toBeGreaterThan(0)
    expect(result.chunksGenerated).toBeGreaterThan(0)
    expect(result.embeddingsCreated).toEqual(result.chunksGenerated)
    expect(result.duration).toBeGreaterThan(0)
  }, 60000) // 60 second timeout
})
```

### Performance Testing

```typescript
// test/performance/indexing-benchmark.test.ts
import { performance } from 'perf_hooks'
import { IndexManager } from '../../src/core/indexing/IndexManager'

describe('Indexing Performance', () => {
  it('should index medium repository within time limit', async () => {
    const indexManager = new IndexManager()
    const startTime = performance.now()
    
    const result = await indexManager.indexRepository('./test-data/medium-repo', {
      provider: 'ollama',
      concurrency: 4,
      batchSize: 50,
      memoryLimit: 512,
      forceFullIndex: true,
      excludePatterns: ['node_modules'],
      verbose: false,
      dryRun: false
    })
    
    const duration = performance.now() - startTime
    
    expect(duration).toBeLessThan(60000) // Should complete in under 60 seconds
    expect(result.throughput).toBeGreaterThan(10) // At least 10 files per second
  }, 120000)
})
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern=OpenAIProvider
```

## Documentation

### Code Documentation

1. **Use JSDoc comments for public APIs**
2. **Document complex algorithms**
3. **Include examples in documentation**
4. **Keep documentation up to date**

```typescript
/**
 * Generates embeddings for text chunks using the configured provider
 * 
 * @param chunks - Array of text chunks to embed
 * @param options - Processing options
 * @returns Promise resolving to embedded chunks with vectors
 * 
 * @example
 * ```typescript
 * const pipeline = new EmbeddingPipeline(provider)
 * const chunks = [{ content: 'Hello world', ... }]
 * const embedded = await pipeline.processChunks(chunks)
 * ```
 */
async processChunks(
  chunks: TextChunk[],
  options?: ProcessingOptions
): Promise<EmbeddedChunk[]> {
  // Implementation
}
```

### README Updates

When adding new features, update relevant README files:

- Main `README.md` - High-level feature descriptions
- Package `README.md` - Package-specific information
- `docs/` files - Detailed documentation

### API Documentation

Update `docs/API-DOCUMENTATION.md` when:

- Adding new interfaces
- Changing method signatures
- Adding new modules
- Modifying error types

## Submitting Changes

### Pull Request Process

1. **Ensure tests pass**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

2. **Update documentation**
   - Update relevant docs
   - Add JSDoc comments
   - Update CHANGELOG.md

3. **Create pull request**
   - Use descriptive title
   - Fill out PR template
   - Link related issues
   - Request appropriate reviewers

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Code Review Guidelines

#### For Authors

1. **Keep PRs focused and small**
2. **Write clear commit messages**
3. **Test thoroughly**
4. **Update documentation**
5. **Respond to feedback promptly**

#### For Reviewers

1. **Review for correctness and style**
2. **Check test coverage**
3. **Verify documentation updates**
4. **Test locally if needed**
5. **Provide constructive feedback**

## Release Process

### Version Management

We use [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- `MAJOR` - Breaking changes
- `MINOR` - New features (backward compatible)
- `PATCH` - Bug fixes (backward compatible)

### Release Steps

1. **Update version numbers**
   ```bash
   npm version patch|minor|major
   ```

2. **Update CHANGELOG.md**
   - Add release notes
   - Document breaking changes
   - List new features and fixes

3. **Create release branch**
   ```bash
   git checkout -b release/v1.2.3
   ```

4. **Final testing**
   ```bash
   npm run test:all
   npm run build
   npm run package
   ```

5. **Merge to main and tag**
   ```bash
   git checkout main
   git merge release/v1.2.3
   git tag v1.2.3
   git push origin main --tags
   ```

6. **Publish packages**
   ```bash
   npm publish
   ```

## Getting Help

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Discord** - Real-time chat (link in README)

### Development Questions

When asking for help:

1. **Search existing issues first**
2. **Provide minimal reproduction case**
3. **Include system information**
4. **Share relevant logs**
5. **Be specific about the problem**

### Mentorship

New contributors can request mentorship:

- Comment on "good first issue" tickets
- Join our Discord for guidance
- Attend virtual office hours (schedule in Discord)

## Recognition

Contributors are recognized through:

- **Contributors file** - All contributors listed
- **Release notes** - Major contributions highlighted
- **GitHub achievements** - Automatic recognition
- **Swag** - Stickers and shirts for significant contributions

Thank you for contributing to Ziri! Your efforts help make AI-assisted development more accessible and efficient for developers worldwide.