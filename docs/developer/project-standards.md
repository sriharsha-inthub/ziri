# Ziri Project Standards Summary

Quick reference for maintaining Ziri's organizational and coding standards.

## 🏗️ Directory Structure (IMMUTABLE)

```
ziri-monorepo/
├── README.md                    # Simple project overview
├── AGENTS.md                    # AI agent instructions  
├── PROJECT-RULES.md            # Detailed project rules
├── package.json                # Root package with validation scripts
├── docs/                        # USER-FACING DOCUMENTATION
│   ├── user/                    # End-user documentation
│   ├── deployment/              # Deployment guides
│   └── developer/               # Developer documentation
├── internal/                    # INTERNAL DEVELOPMENT DOCS
│   ├── tasks/                   # Task summaries
│   ├── specs/                   # Specifications
│   └── validation/              # Test and validation scripts
└── packages/                    # Source code
    ├── ziri-js/                 # Node.js implementation
    └── ziri-py/                 # Python implementation
```

## 🚨 Critical Rules

### 1. Root Directory Cleanliness
- **ONLY** essential files: `README.md`, `AGENTS.md`, `PROJECT-RULES.md`, `package.json`, `LICENSE`
- **NO** loose documentation files
- **NO** test files  
- **NO** temporary files

### 2. Documentation Audience Separation
- **User docs**: `docs/user/` - Installation, usage, troubleshooting
- **Deployment docs**: `docs/deployment/` - Docker, CI/CD, security
- **Developer docs**: `docs/developer/` - Architecture, APIs, contributing
- **Internal docs**: `internal/` - Task summaries, specs, validation

### 3. No User Overwhelm
- Users should NEVER see internal development documentation
- Keep user paths simple: README → docs/user/ → success
- Progressive disclosure: basic → intermediate → advanced

## 📝 File Naming Conventions

```bash
# ✅ Correct naming
docs/user/quickstart.md
docs/deployment/docker.md
internal/tasks/TASK-17-SUMMARY.md
packages/ziri-js/src/core/embedding-provider.ts

# ❌ Incorrect naming
docs/QUICKSTART.md              # Wrong location + case
docs/user/CLI-REFERENCE.md      # Wrong case
internal/task-17-summary.md     # Wrong case for tasks
```

## 💻 Code Standards Quick Reference

### TypeScript Patterns
```typescript
// ✅ Good: Clear interfaces and error handling
interface EmbeddingProvider {
  readonly name: string
  embed(texts: string[]): Promise<number[][]>
  validateConfig(): Promise<ValidationResult>
}

class OpenAIProvider implements EmbeddingProvider {
  constructor(private readonly config: ProviderConfig) {}
  
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
```

### Naming Conventions
- **Classes**: `PascalCase` (e.g., `EmbeddingProvider`)
- **Functions**: `camelCase` (e.g., `generateEmbeddings`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_BATCH_SIZE`)
- **Files**: `kebab-case` (e.g., `embedding-provider.ts`)

## 🧪 Testing Standards

```typescript
describe('OpenAIProvider', () => {
  describe('embed', () => {
    it('should generate embeddings for valid text inputs', async () => {
      // Arrange
      const provider = new OpenAIProvider(validConfig)
      const texts = ['Hello world', 'Test text']
      
      // Act
      const result = await provider.embed(texts)
      
      // Assert
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveLength(1536)
    })
  })
})
```

## 🔧 Development Workflow

### Adding New Features

1. **Plan**: Create spec in `internal/specs/`
2. **Implement**: Follow established patterns in `packages/ziri-js/src/`
3. **Test**: Add tests in `packages/ziri-js/test/`
4. **Document**: 
   - User-facing → `docs/user/`
   - Developer APIs → `docs/developer/`
   - Implementation → `internal/tasks/`

### Pre-Commit Checklist

- [ ] `npm run validate:structure` passes
- [ ] Code follows TypeScript standards
- [ ] Tests added for new functionality
- [ ] Documentation updated in correct locations
- [ ] Root directory remains clean

## 🔍 Validation Commands

```bash
# Validate project structure
npm run validate:structure

# Run all validations
npm run validate:all

# Check documentation organization
npm run docs:check
```

## 🚨 Common Mistakes

### Documentation
```bash
# ❌ Wrong
README-FEATURE.md               # Don't add to root
docs/NEW-FEATURE.md            # Wrong location

# ✅ Correct  
docs/user/feature-guide.md     # User-facing features
docs/developer/api-changes.md  # Developer APIs
```

### Code
```typescript
// ❌ Wrong: Poor error handling
async function processFile(path: string) {
  const content = fs.readFileSync(path) // Can throw
  return await processContent(content)   // Can throw
}

// ✅ Correct: Proper error handling
async function processFile(path: string): Promise<ProcessResult> {
  try {
    const content = await fs.promises.readFile(path, 'utf8')
    return await processContent(content)
  } catch (error) {
    throw new FileProcessingError(
      `Failed to process file: ${error.message}`,
      path,
      { originalError: error }
    )
  }
}
```

## 📊 Success Metrics

The project maintains quality when:

1. **Root directory has ≤ 5 files**
2. **New users can get started in < 5 minutes**
3. **Documentation serves correct audience**
4. **Code follows consistent patterns**
5. **`npm run validate:structure` passes**

## 🆘 Quick Help

### File Placement Decision Tree
```
New file needed?
├── User documentation? → docs/user/
├── Deployment guide? → docs/deployment/
├── Developer documentation? → docs/developer/
├── Implementation details? → internal/tasks/
├── Source code? → packages/ziri-js/src/
└── Tests? → packages/ziri-js/test/
```

### Resources
- **[AGENTS.md](../../AGENTS.md)** - Complete project instructions and standards
- **[Architecture](architecture.md)** - System design
- **[API Documentation](api.md)** - Internal APIs
- **[Contributing Guide](contributing.md)** - Contribution process

---

**Remember**: All detailed standards are in [AGENTS.md](../../AGENTS.md). When in doubt, run `npm run validate:structure` and follow the guidance.