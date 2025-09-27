```markdown
# Ziri Project Agent Instructions

**Universal instructions for AI agents, IDEs, developers, and development tools working on the Ziri project.**

## Project Overview

Ziri is a high-performance AI code context CLI with intelligent indexing, multiple embedding providers, and semantic search capabilities. The project follows strict organizational and coding standards to maintain clarity and prevent user overwhelm.

**Core Principle**: Every change should make the project easier to use and understand, not more complex.

## 🏗️ Project Structure Rules

### Directory Organization (CRITICAL - DO NOT VIOLATE)

```
ziri-monorepo/
├── README.md                    # Simple project overview ONLY
├── docs/                        # USER-FACING DOCUMENTATION
│   ├── user/                    # End-user documentation
│   ├── deployment/              # Deployment & integration guides  
│   └── developer/               # Developer documentation
├── internal/                    # INTERNAL DEVELOPMENT DOCS
│   ├── tasks/                   # Task summaries and implementation docs
│   ├── specs/                   # Project specifications
│   └── validation/              # Test and validation scripts
├── packages/                    # Source code packages
│   ├── ziri-js/                 # Node.js implementation
│   └── ziri-py/                 # Python implementation
└── .kiro/                       # Kiro IDE configuration (if present)
```

### 🚨 CRITICAL RULES - NEVER VIOLATE

1. **Root Directory Cleanliness**: 
   - ONLY `README.md` and essential directories in root
   - NO loose documentation files in root
   - NO test files in root
   - NO temporary files in root

2. **Documentation Separation**:
   - User-facing docs ONLY in `docs/user/`, `docs/deployment/`, `docs/developer/`
   - Internal development docs ONLY in `internal/`
   - Each section MUST have a README.md index file

3. **No User Overwhelm**:
   - Users should NEVER see internal development documentation
   - Keep user documentation focused and progressive
   - Separate concerns by audience (user/deployment/developer)

## 📝 Documentation Standards

### File Naming Conventions

```bash
# User Documentation
docs/user/quickstart.md          # NOT quick-start.md or QUICKSTART.md
docs/user/cli-reference.md       # NOT CLI-REFERENCE.md
docs/user/troubleshooting.md     # NOT TROUBLESHOOTING.md

# Internal Documentation  
internal/tasks/TASK-{N}-SUMMARY.md    # Consistent task naming
internal/validation/{purpose}.js       # Descriptive validation scripts
```

### Documentation Rules

1. **User Documentation**:
   - Start with the problem the user is trying to solve
   - Provide working examples
   - Include troubleshooting for common issues
   - Link to related documentation
   - Keep language simple and actionable

2. **Developer Documentation**:
   - Include architecture diagrams when helpful
   - Provide code examples for integrations
   - Document APIs with TypeScript interfaces
   - Include contribution guidelines

3. **Internal Documentation**:
   - Task summaries follow consistent format
   - Include implementation details and decisions
   - Reference requirements and specifications
   - Keep separate from user-facing docs

## 💻 Coding Standards

### TypeScript/JavaScript Standards

```typescript
// ✅ Good: Clear interfaces and error handling
interface EmbeddingProvider {
  readonly name: string
  readonly type: ProviderType
  embed(texts: string[]): Promise<number[][]>
  validateConfig(): Promise<ValidationResult>
}

class OpenAIProvider implements EmbeddingProvider {
  constructor(private config: ProviderConfig) {}
  
  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.makeRequest(texts)
      return response.data.map(item => item.embedding)
    } catch (error) {
      throw new ProviderError(
        `OpenAI embedding failed: ${error.message}`,
        'openai',
        error.status
      )
    }
  }
}

// ❌ Bad: Unclear types and poor error handling
class Provider {
  async embed(texts: any): Promise<any> {
    let result = await this.api(texts)
    return result
  }
}
```

### Code Organization Rules

1. **File Structure**:
   ```
   packages/ziri-js/
   ├── src/
   │   ├── cli/              # CLI interface
   │   ├── core/             # Core business logic
   │   │   ├── indexing/     # Indexing pipeline
   │   │   ├── querying/     # Query processing
   │   │   ├── providers/    # Embedding providers
   │   │   ├── storage/      # Storage backends
   │   │   └── config/       # Configuration management
   │   ├── utils/            # Utility functions
   │   └── types/            # TypeScript type definitions
   ```

2. **Naming Conventions**:
   - Classes: `PascalCase` (e.g., `EmbeddingProvider`)
   - Functions: `camelCase` (e.g., `generateEmbeddings`)
   - Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_BATCH_SIZE`)
   - Files: `kebab-case` (e.g., `embedding-provider.ts`)

3. **Error Handling**:
   - Use custom error classes with context
   - Provide meaningful error messages
   - Include recovery suggestions when possible
   - Log errors appropriately for debugging

## 🧪 Testing Standards

### Test Organization

```
packages/ziri-js/test/
├── unit/                    # Unit tests
├── integration/             # Integration tests
└── regression/              # Performance regression tests

internal/validation/         # Project validation scripts
├── test-*.js               # Feature testing scripts
└── validate-*.js           # Validation and verification scripts
```

### Testing Rules

1. **Test Naming**: Descriptive test names that explain the scenario
2. **Test Structure**: Arrange-Act-Assert pattern
3. **Mocking**: Mock external dependencies, test real integrations separately
4. **Coverage**: Focus on critical paths and error scenarios

## 🔧 Development Workflow

### Adding New Features

1. **Planning**:
   - Create a specification in `internal/specs/`
   - Break down into tasks in `internal/tasks/`
   - Consider impact on documentation organization

2. **Implementation**:
   - Follow existing code patterns
   - Add appropriate tests
   - Update relevant documentation
   - Maintain backward compatibility

3. **Documentation**:
   - Update user docs if user-facing changes
   - Update developer docs if API changes
   - Keep internal docs for implementation details
   - NEVER mix user and internal documentation

### File Placement Rules

```bash
# ✅ Correct placement
docs/user/new-feature.md           # User-facing feature docs
```

... (rest of the file omitted for brevity)
```