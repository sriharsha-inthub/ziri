# Ziri Performance Optimization - Requirements Document

## Introduction

This project aims to optimize the Ziri CLI tool for faster indexing performance while maintaining the ability to easily swap embedding providers. The goal is to create a high-performance context-aware prompt enhancement system that serves as a bridge between lazy user prompts and AI coding assistants.

## Requirements

### Requirement 1: Performance Optimization

**User Story:** As a developer using Ziri, I want fast indexing of my codebase so that I can quickly get context-enhanced prompts without waiting minutes for processing.

#### Acceptance Criteria

1. WHEN indexing a medium-sized repository (1000-5000 files) THEN the system SHALL complete indexing in under 60 seconds
2. WHEN processing files THEN the system SHALL use parallel processing to handle multiple files concurrently
3. WHEN embedding text chunks THEN the system SHALL send multiple embedding requests concurrently to reduce API wait time
4. WHEN indexing large repositories THEN the system SHALL maintain memory usage under 512MB peak
5. WHEN re-indexing a repository THEN the system SHALL only process changed files based on file hashes
6. WHEN encountering API rate limits THEN the system SHALL implement adaptive backoff and retry logic

### Requirement 2: Embedding Provider Flexibility

**User Story:** As a developer working on a POC, I want to easily switch between different embedding providers (free and paid) so that I can optimize for cost and performance based on my needs.

#### Acceptance Criteria

1. WHEN configuring embeddings THEN the system SHALL support multiple providers (OpenAI, Ollama, Hugging Face, Cohere)
2. WHEN switching embedding providers THEN the system SHALL require minimal configuration changes
3. WHEN using free embedding providers THEN the system SHALL maintain comparable search quality to paid options
4. WHEN an embedding provider fails THEN the system SHALL provide clear error messages and fallback options
5. WHEN benchmarking providers THEN the system SHALL provide performance and quality metrics

### Requirement 3: Streaming Architecture

**User Story:** As a developer with large codebases, I want the indexing process to be memory-efficient and resumable so that I can index large repositories without system crashes.

#### Acceptance Criteria

1. WHEN processing files THEN the system SHALL stream file content rather than loading all files into memory
2. WHEN generating embeddings THEN the system SHALL process and store vectors incrementally
3. WHEN indexing is interrupted THEN the system SHALL be able to resume from the last processed file
4. WHEN handling large files THEN the system SHALL chunk files appropriately without memory overflow
5. WHEN writing to storage THEN the system SHALL use efficient batch writes to minimize I/O operations

### Requirement 4: Smart Batching and Concurrency

**User Story:** As a developer using API-based embeddings, I want intelligent batching and concurrency so that I can maximize throughput while respecting API limits.

#### Acceptance Criteria

1. WHEN sending embedding requests THEN the system SHALL dynamically adjust batch sizes based on API response times
2. WHEN hitting rate limits THEN the system SHALL implement exponential backoff with jitter
3. WHEN processing multiple batches THEN the system SHALL maintain optimal concurrency levels (2-5 concurrent requests)
4. WHEN API responses are slow THEN the system SHALL adapt batch sizes to maintain throughput
5. WHEN using different providers THEN the system SHALL apply provider-specific optimization strategies

### Requirement 5: Progress Monitoring and Feedback

**User Story:** As a developer running indexing operations, I want detailed progress feedback so that I can understand what's happening and estimate completion time.

#### Acceptance Criteria

1. WHEN indexing starts THEN the system SHALL display repository information and estimated file count
2. WHEN processing files THEN the system SHALL show real-time progress with file names and completion percentage
3. WHEN embedding batches THEN the system SHALL display embedding timing and batch sizes
4. WHEN indexing completes THEN the system SHALL provide comprehensive statistics (files processed, time taken, throughput)
5. WHEN errors occur THEN the system SHALL provide actionable error messages with suggested fixes

### Requirement 6: Repository Isolation and Incremental Updates

**User Story:** As a developer working on multiple projects, I want each repository to have its own isolated index store and only update changed files so that I can efficiently manage multiple codebases without conflicts.

#### Acceptance Criteria

1. WHEN indexing a repository THEN the system SHALL create an isolated index store specific to that repository
2. WHEN running indexing for the first time THEN the system SHALL perform a complete full index of all files
3. WHEN re-indexing a repository THEN the system SHALL only process files that have changed since the last index
4. WHEN detecting file changes THEN the system SHALL use file hashes and modification timestamps for change detection
5. WHEN switching between repositories THEN the system SHALL maintain separate index stores without cross-contamination
6. WHEN a file is deleted THEN the system SHALL remove its embeddings from the index store

### Requirement 7: Dynamic Project Summary

**User Story:** As a developer using prompt expansion, I want an automatically maintained project summary so that the AI assistant has up-to-date context about my codebase structure and purpose.

#### Acceptance Criteria

1. WHEN indexing completes THEN the system SHALL generate a project_summary.md file with codebase overview
2. WHEN files are added or modified THEN the system SHALL update the project summary incrementally
3. WHEN generating the summary THEN the system SHALL include project structure, key components, and technologies used
4. WHEN prompt expansion occurs THEN the system SHALL use the project summary as context for better AI responses
5. WHEN the summary becomes outdated THEN the system SHALL regenerate it based on significant codebase changes

### Requirement 8: Configuration and Extensibility

**User Story:** As a developer integrating Ziri into my workflow, I want flexible configuration options so that I can customize the behavior for my specific use case.

#### Acceptance Criteria

1. WHEN configuring Ziri THEN the system SHALL support environment variables and config files
2. WHEN setting embedding providers THEN the system SHALL allow easy switching via configuration
3. WHEN customizing exclusions THEN the system SHALL support custom ignore patterns
4. WHEN tuning performance THEN the system SHALL expose concurrency and batch size settings
5. WHEN debugging issues THEN the system SHALL provide verbose logging options