# Implementation Plan

## Phase A: Core Fixes (Priority 1)

- [x] 1. Fix Configuration Manager Interface

  - Create unified ConfigManager class with all expected methods (getConfig, updateConfig, configureProvider, resetConfig, loadEnvironmentConfig, validateConfig)
  - Implement proper async/await patterns to prevent test timeouts
  - Add environment variable loading for provider configurations
  - Update CLI initialization to use fixed ConfigManager
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.3_

- [x] 2. Fix Chat Command Implementation

  - Remove infinite loops and blocking operations causing timeouts
  - Implement proper error handling for missing Ollama configuration
  - Add timeout controls and cancellation for long-running operations
  - Fix query context retrieval to work with existing vector store
  - Update Ollama integration to use correct API endpoints and models
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Implement Basic Enhanced Storage

  - Create EnhancedChunkData interface and storage implementation
  - Update indexer to store chunk content alongside vectors
  - Add basic metadata extraction (file type, language, line numbers)
  - Ensure backward compatibility with existing vector stores
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Update Failing Tests

  - Fix all configuration manager method calls in test files
  - Add proper mocking for Ollama and external dependencies
  - Remove or update tests for deleted legacy components
  - Set appropriate timeouts for async operations
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

## Phase B: Enhanced Context Features (Priority 2)

- [x] 5. Add Metadata Extraction System

  - Implement basic code structure analysis for JavaScript/TypeScript
  - Add Python function and class detection
  - Extract import statements and dependencies
  - Capture function signatures and docstrings/comments
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 6. Implement Rich Query Results

  - Update query command to return EnhancedQueryResult objects
  - Add actual code snippets to query responses
  - Include surrounding context lines (before/after)
  - Implement basic relevance explanations
  - Add language detection and syntax information
  - _Requirements: 3.5, 3.6, 7.5_

- [x] 7. Enhance Default Provider Configuration

  - Set Ollama as default provider with "llama3.2" model
  - Configure "nomic-embed-text" for embeddings
  - Add proper error messages for missing Ollama setup
  - Implement graceful fallback when providers are unavailable
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

## Phase C: Integration & Cleanup (Priority 3)

- [x] 8. Organize Files and Maintain Minimal Legacy Support

  - Keep legacy indexer as `--legacy` flag option for safety during transition
  - Delete duplicate or obsolete test files
  - Move files to proper directories according to AGENTS.md structure
  - Clean up package.json dependencies
  - Mark legacy components as deprecated with clear migration path
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Update CLI and Documentation

  - Update CLI help to show enhanced context as default with `--legacy` as fallback option
  - Update README.md to reflect Ollama as default and enhanced context features
  - Add chat command documentation and examples
  - Update troubleshooting guide for new features
  - Add migration guide from legacy to enhanced context
  - _Requirements: 4.4, 6.6_

- [x] 10. Final Integration Testing


  - Run complete test suite and ensure all tests pass
  - Test end-to-end workflows (index -> query -> chat)
  - Validate enhanced context results in real scenarios
  - Performance test with medium-sized repositories
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

## Task Execution Notes

### Cost-Effective Approach
- Each task is self-contained and can be completed independently
- Tasks build incrementally - each phase delivers working functionality
- Clear acceptance criteria prevent scope creep
- Focused on fixing existing issues rather than adding complex new features

### Dependencies
- Task 1 must complete before Task 2 (ConfigManager needed for Chat)
- Task 3 can run in parallel with Tasks 1-2
- Phase B tasks depend on Phase A completion
- Phase C is cleanup and can be done after core functionality works

### Success Criteria
- All tests pass without timeouts or errors
- Chat command works with Ollama integration
- Enhanced context provides rich query results
- Codebase is clean and well-organized
- Documentation reflects current functionality
## Ver
sion Roadmap

### v1.0 (This Implementation)
- Enhanced context as default indexing method
- Chat command with Ollama integration
- Legacy indexing available via `--legacy` flag for safety
- All tests passing and core functionality working

### v2.0 (Future - Remove Legacy)
- Remove `--legacy` flag and legacy indexing code completely
- Performance optimizations for enhanced context
- Additional metadata extraction improvements

### v3.0 (Future - RAG Graph)
- Full RAG Graph implementation
- Advanced context understanding and ranking
- Interactive context exploration
- Natural language query enhancement

## Implementation Strategy
- **Minimal Legacy Maintenance**: Keep existing legacy code functional but don't enhance it
- **Focus on Enhanced**: All new development goes into enhanced context system
- **Safety First**: Users can fall back to legacy if enhanced has issues
- **Clean Migration Path**: Clear documentation on when and how to migrate