// Core TypeScript interfaces for Ziri Performance Optimization

// Main component interfaces
export * from './interfaces/index-manager.js';
export * from './interfaces/repository-parser.js';
export * from './interfaces/embedding-pipeline.js';
export * from './interfaces/index-store.js';
export * from './interfaces/project-summarizer.js';

// Data models and configuration schemas
export * from './models/data-models.js';
export * from './models/config-schemas.js';

// Re-export commonly used types for convenience
export type {
  IndexManager,
  IndexOptions,
  IndexResult,
  EmbeddingProvider
} from './interfaces/index-manager.js';

export type {
  RepositoryParser,
  FileInfo,
  TextChunk,
  IndexMetadata
} from './interfaces/repository-parser.js';

export type {
  EmbeddingPipeline,
  EmbeddedChunk,
  ProviderLimits
} from './interfaces/embedding-pipeline.js';

export type {
  IndexStore,
  SearchResult,
  VectorRecord
} from './interfaces/index-store.js';

export type {
  ProjectSummarizer,
  ProjectSummary,
  ComponentInfo
} from './interfaces/project-summarizer.js';

export type {
  ZiriConfig,
  ProviderConfig,
  PerformanceConfig,
  DEFAULT_CONFIG
} from './models/config-schemas.js';