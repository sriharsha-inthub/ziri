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
   - Create specification in `internal/specs/`
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
docs/developer/api-changes.md      # Developer API documentation
internal/tasks/TASK-N-SUMMARY.md   # Implementation details
internal/validation/test-feature.js # Feature validation

# ❌ Wrong placement  
README.md                          # Don't add feature details here
docs/NEW-FEATURE.md               # Don't use old naming convention
root/feature-test.js               # Don't put files in root
```

## 🎯 Quality Gates

### Before Committing

1. **Code Quality**:
   - [ ] Follows TypeScript/JavaScript standards
   - [ ] Includes appropriate error handling
   - [ ] Has meaningful variable and function names
   - [ ] Includes JSDoc comments for public APIs

2. **Testing**:
   - [ ] Unit tests for new functionality
   - [ ] Integration tests for workflows
   - [ ] Validation scripts updated if needed

3. **Documentation**:
   - [ ] User documentation updated (if user-facing)
   - [ ] Developer documentation updated (if API changes)
   - [ ] Internal documentation created (for implementation)
   - [ ] No documentation in wrong locations

4. **Organization**:
   - [ ] Files in correct directories
   - [ ] No files added to root directory
   - [ ] Documentation follows audience separation
   - [ ] README.md remains simple and focused

## 🚨 Common Mistakes to Avoid

1. **Documentation Organization**:
   - ❌ Adding files to root directory
   - ❌ Mixing user and internal documentation
   - ❌ Using old naming conventions (UPPERCASE.md)
   - ❌ Creating documentation without index files

2. **Code Organization**:
   - ❌ Putting business logic in CLI files
   - ❌ Creating circular dependencies
   - ❌ Using `any` types in TypeScript
   - ❌ Not handling errors properly

3. **User Experience**:
   - ❌ Exposing internal complexity to users
   - ❌ Breaking backward compatibility
   - ❌ Adding features without documentation
   - ❌ Creating overwhelming documentation

## 🔄 Maintenance Rules

### Regular Maintenance

1. **Documentation Review**:
   - Ensure user docs remain beginner-friendly
   - Update examples with current syntax
   - Remove outdated information
   - Maintain clear navigation paths

2. **Code Review**:
   - Check for adherence to standards
   - Verify error handling patterns
   - Ensure proper separation of concerns
   - Validate test coverage

3. **Organization Review**:
   - Audit file placement
   - Check for root directory cleanliness
   - Verify documentation organization
   - Ensure user/internal separation

## � Developsment Workflow

### Adding New Features

1. **Planning Phase**:
   ```bash
   # Create specification in internal/specs/
   internal/specs/feature-name/
   ├── requirements.md
   ├── design.md
   └── tasks.md
   ```

2. **Implementation Phase**:
   ```bash
   # Follow established patterns
   packages/ziri-js/src/core/new-feature/
   ├── index.ts              # Main implementation
   ├── types.ts             # Type definitions
   ├── errors.ts            # Custom errors
   └── utils.ts             # Helper functions
   
   # Add comprehensive tests
   packages/ziri-js/test/unit/core/new-feature/
   ├── index.test.ts
   ├── utils.test.ts
   └── integration.test.ts
   ```

3. **Documentation Phase**:
   ```bash
   # User-facing features
   docs/user/new-feature.md
   
   # Developer APIs
   docs/developer/api-changes.md
   
   # Implementation details
   internal/tasks/TASK-N-SUMMARY.md
   ```

### File Placement Decision Tree

```
New file needed?
├── Is it user-facing documentation?
│   ├── Basic usage? → docs/user/
│   ├── Deployment? → docs/deployment/
│   └── Development? → docs/developer/
├── Is it internal documentation?
│   ├── Task summary? → internal/tasks/
│   ├── Specification? → internal/specs/
│   └── Validation? → internal/validation/
├── Is it source code?
│   ├── CLI code? → packages/ziri-js/src/cli/
│   ├── Core logic? → packages/ziri-js/src/core/
│   ├── Utilities? → packages/ziri-js/src/utils/
│   └── Types? → packages/ziri-js/src/types/
└── Is it a test?
    ├── Unit test? → packages/ziri-js/test/unit/
    ├── Integration? → packages/ziri-js/test/integration/
    └── Validation? → internal/validation/
```

## 🧪 Testing Standards

### Test Structure and Naming
```typescript
// ✅ Good: Descriptive test names and clear structure
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
      expect(result[0]).toHaveLength(1536) // OpenAI dimensions
    })
    
    it('should handle API rate limit errors gracefully', async () => {
      // Arrange
      const provider = new OpenAIProvider(validConfig)
      mockApiResponse(429, { error: 'Rate limit exceeded' })
      
      // Act & Assert
      await expect(provider.embed(['test']))
        .rejects
        .toThrow(ProviderError)
    })
  })
})

// ❌ Bad: Unclear test names and structure
describe('Provider', () => {
  it('works', async () => {
    const result = await provider.embed(['test'])
    expect(result).toBeTruthy()
  })
})
```

### Test Categories
1. **Unit Tests**: Test individual functions/classes in isolation
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Regression Tests**: Prevent performance degradation

## 🔍 Validation and Quality Gates

### Automated Validation Commands
```bash
# Validate project structure
npm run validate:structure

# Run all validations
npm run validate:all

# Check documentation organization
npm run docs:check

# Verify root directory cleanliness
npm run clean:root
```

### Pre-Commit Checklist

#### Code Quality
- [ ] Follows TypeScript/JavaScript standards
- [ ] Uses proper error handling patterns
- [ ] Has meaningful names for variables/functions
- [ ] Includes JSDoc comments for public APIs
- [ ] No `any` types without justification
- [ ] Proper separation of concerns

#### Testing
- [ ] Unit tests for new functionality
- [ ] Integration tests for workflows
- [ ] Error scenarios covered
- [ ] Performance impact considered

#### Documentation
- [ ] User docs updated (if user-facing changes)
- [ ] Developer docs updated (if API changes)
- [ ] Internal docs created (for implementation)
- [ ] All docs in correct locations
- [ ] Index files updated

#### Organization
- [ ] Files in correct directories
- [ ] Root directory remains clean
- [ ] Documentation follows audience separation
- [ ] No breaking changes without migration path

## 🚨 Common Mistakes to Avoid

### Documentation Organization Mistakes
```bash
# ❌ Wrong: Adding files to root
README-FEATURE.md
INSTALLATION.md
API-DOCS.md

# ✅ Correct: Proper organization
docs/user/feature-guide.md
docs/user/installation.md
docs/developer/api.md
```

### Code Organization Mistakes
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

### User Experience Mistakes
- ❌ Exposing internal complexity to users
- ❌ Breaking backward compatibility
- ❌ Adding features without documentation
- ❌ Creating overwhelming documentation

## 🔄 Maintenance and Code Review

### Regular Maintenance Tasks

#### Monthly Documentation Review
- [ ] User docs remain beginner-friendly
- [ ] Examples work with current version
- [ ] Links are not broken
- [ ] Navigation paths are clear

#### Quarterly Code Review
- [ ] Adherence to coding standards
- [ ] Error handling patterns consistent
- [ ] Performance hasn't degraded
- [ ] Dependencies are up to date

#### Continuous Organization Review
- [ ] Root directory stays clean
- [ ] Documentation in correct locations
- [ ] User/internal separation maintained
- [ ] New files follow conventions

### Code Review Guidelines

#### For Authors
1. **Self-review first**: Check your own code against standards
2. **Test thoroughly**: Include unit and integration tests
3. **Document changes**: Update relevant documentation
4. **Follow conventions**: Use established patterns
5. **Validate structure**: Run `npm run validate:all`

#### For Reviewers
1. **Check standards**: Verify adherence to coding standards
2. **Test coverage**: Ensure adequate test coverage
3. **Documentation**: Verify docs are updated and in correct locations
4. **User impact**: Consider impact on user experience
5. **Organization**: Ensure files are in correct directories

## 📋 Universal Checklist for All Agents

**Before making ANY changes, verify:**

- [ ] Root directory remains clean (only README.md + essential directories)
- [ ] Documentation goes to correct audience-specific directory
- [ ] User documentation remains simple and actionable
- [ ] Internal documentation stays in `internal/`
- [ ] Code follows established patterns and standards
- [ ] Tests are added for new functionality
- [ ] Error handling follows project conventions
- [ ] No breaking changes without migration path
- [ ] `npm run validate:structure` passes

## 🎯 Success Metrics

The project maintains quality when:

1. **Users can find what they need quickly** (< 2 clicks from README)
2. **Root directory stays clean** (≤ 5 files)
3. **Documentation serves its audience** (user vs developer vs internal)
4. **Code is consistent and maintainable** (follows established patterns)
5. **New features don't break existing workflows** (backward compatibility)
6. **Validation passes** (`npm run validate:structure` succeeds)

## 🆘 Quick Help and Resources

### Immediate Help
```bash
# Check if your changes follow standards
npm run validate:all

# Get detailed structure report
node internal/validation/validate-project-structure.js
```

### Documentation Resources
- **User Documentation**: `docs/user/` - Installation, usage, troubleshooting
- **Deployment Documentation**: `docs/deployment/` - Docker, CI/CD, security
- **Developer Documentation**: `docs/developer/` - Architecture, APIs, contributing
- **Internal Documentation**: `internal/` - Task summaries, specs, validation

### When in Doubt
1. **Check existing patterns**: Look at similar implementations
2. **Follow the decision tree**: Use the file placement guide above
3. **Run validation**: `npm run validate:structure`
4. **Keep it simple**: Prioritize user experience over complexity

---

**Universal Principle**: This project prioritizes user experience and maintainability. Every change should make the project easier to use and understand, not more complex. When in doubt, choose the path that helps users succeed faster.