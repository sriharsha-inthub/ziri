# Ziri Project Structure

This document describes the organized structure of the Ziri performance optimization project.

## Directory Structure

```
packages/ziri-js/
├── bin/                    # CLI executables
├── docs/                   # Documentation and task summaries
│   ├── reports/           # Generated test and validation reports
│   ├── TASK-*-SUMMARY.md  # Individual task documentation
│   └── PROJECT-STRUCTURE.md # This file
├── examples/              # Usage examples and demos
├── lib/                   # Core library implementation
│   ├── config/           # Configuration management
│   ├── embedding/        # Embedding providers and pipeline
│   ├── error/            # Error handling and resilience
│   ├── index/            # Index management
│   ├── memory/           # Memory optimization
│   ├── performance/      # Performance monitoring and optimization
│   ├── progress/         # Progress tracking and reporting
│   ├── repository/       # Repository management and isolation
│   ├── storage/          # Vector storage and retrieval
│   └── summarizer/       # Project summarization
├── scripts/              # Utility and validation scripts
│   ├── check-task-15.js         # Quick Task 15 completion check
│   ├── organize-tests.js        # Test organization utility
│   ├── run-integration-tests.js # Integration test runner
│   ├── test-exclusions.js       # Test exclusion patterns
│   ├── validate-task-15.js      # Comprehensive Task 15 validation
│   └── verify-task-2.js         # Task 2 verification
├── test/                  # Test suites (organized by type)
│   ├── unit/             # Unit tests (individual components)
│   ├── integration/      # Integration tests (component interactions)
│   ├── regression/       # Performance and regression tests
│   └── e2e/              # End-to-end workflow tests
├── types/                # TypeScript type definitions
├── package.json          # Project configuration and dependencies
└── README.md             # Main project documentation
```

## Test Organization

### Unit Tests (`test/unit/`)
Tests for individual components and modules:
- `change-detector.test.js` - File change detection
- `config-management.test.js` - Configuration management
- `embedding-providers.test.js` - Individual provider implementations
- `error-handling.test.js` - Error handling mechanisms
- `file-chunker.test.js` - Text chunking functionality
- `file-reader.test.js` - File reading operations
- `file-walker.test.js` - Directory traversal
- `index-store.test.js` - Vector storage operations
- `progress-monitoring.test.js` - Progress tracking
- `project-summarizer.test.js` - Project analysis
- `repository-parser.test.js` - Repository parsing

### Integration Tests (`test/integration/`)
Tests for component interactions and workflows:
- `basic-integration.test.js` - Basic integration scenarios
- `comprehensive-integration.test.js` - Complete end-to-end workflows
- `embedding-pipeline.test.js` - Embedding pipeline integration
- `memory-integration.test.js` - Memory management integration
- `provider-migration.test.js` - Provider switching scenarios
- `repository-isolation.test.js` - Repository isolation validation
- `requirements-validation.test.js` - All 41 requirements validation

### Regression Tests (`test/regression/`)
Performance and regression testing:
- `memory-optimization.test.js` - Memory usage optimization
- `performance-optimization.test.js` - General performance optimization
- `performance-regression.test.js` - Performance regression detection
- `provider-benchmark.test.js` - Provider performance comparison

### End-to-End Tests (`test/e2e/`)
Complete workflow testing (currently empty, ready for future E2E tests)

## Scripts

### Validation Scripts
- **`validate-task-15.js`** - Comprehensive validation of Task 15 completion
- **`check-task-15.js`** - Quick completion check for Task 15
- **`verify-task-2.js`** - Task 2 verification script

### Test Management
- **`run-integration-tests.js`** - Automated integration test execution
- **`organize-tests.js`** - Test file organization utility
- **`test-exclusions.js`** - Test exclusion pattern management

## Documentation

### Task Summaries (`docs/`)
Complete documentation for each implemented task:
- `TASK-1-SUMMARY.md` through `TASK-15-SUMMARY.md` - Individual task documentation
- `TASK-15-COMPLETION.md` - Task 15 completion report
- `PROJECT-STRUCTURE.md` - This structure documentation

### Generated Reports (`docs/reports/`)
Automatically generated validation and test reports:
- `TASK-15-VALIDATION-REPORT.md` - Task 15 validation results
- `INTEGRATION-TEST-REPORT.md` - Integration test execution results

## Running Tests

### All Tests
```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:regression
```

### Integration Tests
```bash
# Run comprehensive integration test suite
node scripts/run-integration-tests.js

# Run specific integration tests
npx vitest run test/integration/requirements-validation.test.js
npx vitest run test/integration/comprehensive-integration.test.js
```

### Validation
```bash
# Quick Task 15 completion check
node scripts/check-task-15.js

# Comprehensive Task 15 validation
node scripts/validate-task-15.js
```

### Individual Test Suites
```bash
# Unit tests
npx vitest run test/unit/

# Integration tests
npx vitest run test/integration/

# Regression tests
npx vitest run test/regression/

# Specific test file
npx vitest run test/unit/file-chunker.test.js
```

## Import Path Updates

After reorganization, test files have updated import paths:
- Unit tests: `from '../../lib/...'` (two levels up)
- Integration tests: `from '../../lib/...'` (two levels up)
- Regression tests: `from '../../lib/...'` (two levels up)

## Benefits of Organization

### Clear Separation of Concerns
- **Unit tests** focus on individual component functionality
- **Integration tests** validate component interactions
- **Regression tests** ensure performance standards
- **E2E tests** validate complete user workflows

### Improved Test Discovery
- Easy to find relevant tests for specific components
- Clear categorization helps with test maintenance
- Organized structure supports CI/CD pipeline integration

### Better Development Workflow
- Run only relevant test categories during development
- Faster feedback loops with targeted testing
- Clear validation and reporting infrastructure

## Future Enhancements

### E2E Tests
The `test/e2e/` directory is ready for future end-to-end tests that validate complete user workflows from CLI to results.

### Performance Monitoring
The regression test structure supports ongoing performance monitoring and baseline establishment.

### CI/CD Integration
The organized structure is ready for integration into continuous integration pipelines with category-specific test execution.

This organized structure provides a solid foundation for ongoing development, testing, and validation of the Ziri performance optimization system.