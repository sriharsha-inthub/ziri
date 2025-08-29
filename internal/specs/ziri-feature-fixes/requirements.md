# Requirements Document

## Introduction

This specification addresses critical issues with two recently added features in the Ziri codebase and implements a comprehensive cleanup:
1. The new "chat" command that combines vector search with Ollama LLM generation
2. The enhanced context storage and retrieval system as the primary indexing method
3. Codebase cleanup to remove unnecessary legacy components and organize files properly

The enhanced context system should be the default, with legacy indexing only available via `--legacy` flag for backward compatibility during transition. This spec will fix these features, clean up the codebase, and ensure all tests pass.

## Requirements

### Requirement 1: Fix Chat Command Integration

**User Story:** As a developer, I want to use the `ziri chat` command to get AI-powered responses based on my codebase context, so that I can quickly understand and debug code issues.

#### Acceptance Criteria

1. WHEN I run `ziri chat "my question"` THEN the system SHALL retrieve relevant context from the vector store
2. WHEN context is found THEN the system SHALL format it appropriately for Ollama
3. WHEN Ollama is configured and running THEN the system SHALL generate a contextual response
4. WHEN Ollama is not configured THEN the system SHALL show a clear error message with setup instructions
5. WHEN no context is found THEN the system SHALL inform the user and suggest indexing the repository
6. WHEN the chat command completes THEN it SHALL not hang or timeout indefinitely

### Requirement 2: Fix Configuration Manager Interface

**User Story:** As a developer, I want the configuration system to work consistently across all commands, so that provider switching and configuration management functions properly.

#### Acceptance Criteria

1. WHEN tests call `configManager.updateConfig()` THEN the method SHALL exist and function correctly
2. WHEN tests call `configManager.getConfig()` THEN it SHALL return the expected configuration structure
3. WHEN the system switches providers THEN the configuration SHALL be updated properly
4. WHEN environment variables are set THEN they SHALL be loaded into the configuration
5. WHEN configuration validation is performed THEN invalid configurations SHALL be rejected

### Requirement 3: Implement Enhanced Context Storage as Default (Phase 1)

**User Story:** As a developer, I want the enhanced indexing system to be the primary method for storing rich metadata and content alongside vectors, so that query results always include actual code snippets and contextual information.

#### Acceptance Criteria

1. WHEN files are indexed without `--legacy` flag THEN the enhanced context system SHALL be used by default
2. WHEN files are indexed THEN chunk content SHALL be stored alongside vectors with rich metadata
3. WHEN files are indexed THEN metadata SHALL include file type, language, basic function/class names, and imports
4. WHEN files are indexed THEN surrounding context (2-3 lines before/after) SHALL be included
5. WHEN queries are performed THEN results SHALL include actual code snippets with language detection
6. WHEN queries are performed THEN results SHALL show relevant lines with basic syntax information
7. WHEN the `--legacy` flag is used THEN the system SHALL fall back to the original indexing method
8. WHEN enhanced storage is used THEN query results SHALL include basic relevance explanations

### Requirement 7: Basic Code Structure Analysis (Phase 1)

**User Story:** As a developer, I want the system to understand basic code structure, so that search results are more relevant and contextual.

#### Acceptance Criteria

1. WHEN JavaScript/TypeScript files are indexed THEN function and class names SHALL be extracted
2. WHEN Python files are indexed THEN function and class definitions SHALL be identified
3. WHEN any code file is indexed THEN import statements SHALL be captured
4. WHEN code chunks are created THEN function signatures SHALL be preserved when possible
5. WHEN queries match function names THEN those results SHALL be ranked higher
6. WHEN comments or docstrings are present THEN they SHALL be included in the chunk context

### Requirement 4: Fix Provider Integration and Default Settings

**User Story:** As a developer, I want Ollama to be the default provider with proper configuration, so that I can use local AI without requiring API keys.

#### Acceptance Criteria

1. WHEN no provider is configured THEN the system SHALL default to Ollama with "llama3.2" model
2. WHEN Ollama embeddings are used THEN the system SHALL use "nomic-embed-text" model
3. WHEN Ollama is not running THEN the system SHALL provide clear error messages
4. WHEN provider configuration is invalid THEN the system SHALL show helpful error messages
5. WHEN switching between providers THEN existing indexes SHALL remain compatible

### Requirement 5: Clean Up Codebase and File Organization

**User Story:** As a developer, I want the codebase to be well-organized with unnecessary files removed, so that the project is maintainable and follows the established architecture patterns.

#### Acceptance Criteria

1. WHEN unused or duplicate files exist THEN they SHALL be removed from the codebase
2. WHEN files are not following the established directory structure THEN they SHALL be moved to appropriate locations
3. WHEN legacy code is no longer needed THEN it SHALL be removed or clearly marked as deprecated
4. WHEN new architecture components are missing THEN they SHALL be implemented or properly stubbed
5. WHEN tests reference non-existent components THEN they SHALL be updated to use correct interfaces

### Requirement 6: Fix Test Suite and Integration Issues

**User Story:** As a developer, I want all tests to pass consistently, so that I can confidently deploy and maintain the codebase.

#### Acceptance Criteria

1. WHEN tests are run THEN no tests SHALL timeout due to infinite loops
2. WHEN integration tests run THEN missing components SHALL be properly mocked or implemented
3. WHEN configuration tests run THEN all expected methods SHALL be available
4. WHEN chat tests run THEN they SHALL complete within reasonable time limits
5. WHEN provider tests run THEN they SHALL handle missing API keys gracefully
6. WHEN tests reference removed files THEN they SHALL be updated or removed

## Future Enhancements (Next Version - RAG Graph Implementation)

The following advanced features are planned for the next major version and will leverage RAG (Retrieval-Augmented Generation) with knowledge graphs:

### Phase 2: Multi-Modal Context Understanding
- Full AST parsing for deep code structure analysis
- Semantic context enrichment from comments and business logic
- Code pattern recognition and architectural element mapping

### Phase 3: Intelligent Context Ranking & Filtering  
- Advanced result ranking based on code structure relevance
- Git history integration for recency and change frequency
- Context type filtering (functions, classes, error handling, etc.)

### Phase 4: Query Understanding & Refinement
- Natural language query enhancement and intent parsing
- Interactive context exploration ("show me more", "find similar")
- Query expansion with related terms and follow-up questions

**Note:** These advanced features will be implemented using RAG Graph architecture in a future specification, providing comprehensive context understanding and intelligent code exploration capabilities.