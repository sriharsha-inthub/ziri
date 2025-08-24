/**
 * Configuration Schemas for Ziri Performance Optimization
 */

import { EmbeddingProvider } from '../interfaces/index-manager.js';

export interface ZiriConfig {
  /** Default embedding provider */
  defaultProvider: EmbeddingProvider;
  
  /** Provider-specific configurations */
  providers: {
    [key in EmbeddingProvider]?: ProviderConfig;
  };
  
  /** Performance tuning settings */
  performance: PerformanceConfig;
  
  /** File exclusion settings */
  exclusions: ExclusionConfig;
  
  /** Storage configuration */
  storage: StorageConfig;
  
  /** Logging configuration */
  logging: LoggingConfig;
}

export interface ProviderConfig {
  /** Provider type */
  type: EmbeddingProvider;
  
  /** API key for authentication */
  apiKey?: string;
  
  /** Base URL for API endpoints */
  baseUrl?: string;
  
  /** Model name to use */
  model: string;
  
  /** Embedding dimensions */
  dimensions: number;
  
  /** Maximum tokens per request */
  maxTokens: number;
  
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  
  /** Provider-specific options */
  options?: Record<string, any>;
  
  /** Whether this provider is enabled */
  enabled: boolean;
}

export interface PerformanceConfig {
  /** Number of concurrent operations */
  concurrency: number;
  
  /** Default batch size for embeddings */
  batchSize: number;
  
  /** Memory limit in MB */
  memoryLimit: number;
  
  /** Chunk size for text processing */
  chunkSize: number;
  
  /** Chunk overlap in characters */
  chunkOverlap: number;
  
  /** Maximum file size to process (bytes) */
  maxFileSize: number;
  
  /** Enable adaptive batch sizing */
  adaptiveBatching: boolean;
  
  /** Cache configuration */
  cache: CacheConfig;
}

export interface ExclusionConfig {
  /** File patterns to exclude */
  patterns: string[];
  
  /** File extensions to exclude */
  extensions: string[];
  
  /** Directories to exclude */
  directories: string[];
  
  /** Maximum file size to process (bytes) */
  maxFileSize: number;
  
  /** Minimum file size to process (bytes) */
  minFileSize: number;
}

export interface StorageConfig {
  /** Base directory for storage */
  baseDirectory: string;
  
  /** Database type for vector storage */
  vectorDatabase: 'sqlite' | 'duckdb' | 'memory';
  
  /** Compression settings */
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'lz4' | 'zstd';
    level: number;
  };
  
  /** Backup configuration */
  backup: {
    enabled: boolean;
    interval: number; // hours
    maxBackups: number;
  };
  
  /** Cleanup configuration */
  cleanup: {
    enabled: boolean;
    maxAge: number; // days
    maxSize: number; // MB
  };
}

export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  
  /** Enable file logging */
  fileLogging: boolean;
  
  /** Log file path */
  logFile?: string;
  
  /** Maximum log file size (MB) */
  maxFileSize: number;
  
  /** Number of log files to keep */
  maxFiles: number;
  
  /** Enable performance logging */
  performanceLogging: boolean;
  
  /** Enable API request logging */
  apiLogging: boolean;
}

export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;
  
  /** Tokens per minute */
  tokensPerMinute: number;
  
  /** Concurrent requests limit */
  concurrentRequests: number;
  
  /** Retry configuration */
  retry: RetryConfig;
}

export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  
  /** Base delay between retries (ms) */
  baseDelay: number;
  
  /** Maximum delay between retries (ms) */
  maxDelay: number;
  
  /** Whether to add jitter to delays */
  jitter: boolean;
  
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
}

export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  
  /** Cache size limit (MB) */
  maxSize: number;
  
  /** Cache TTL in seconds */
  ttl: number;
  
  /** Cache type */
  type: 'memory' | 'disk' | 'hybrid';
  
  /** Cache directory for disk cache */
  directory?: string;
}

export interface EnvironmentConfig {
  /** Environment name */
  environment: 'development' | 'production' | 'test';
  
  /** Debug mode enabled */
  debug: boolean;
  
  /** Verbose output enabled */
  verbose: boolean;
  
  /** Dry run mode (no actual changes) */
  dryRun: boolean;
  
  /** Force operations without confirmation */
  force: boolean;
}

// Default configurations
export const DEFAULT_CONFIG: ZiriConfig = {
  defaultProvider: 'openai',
  providers: {
    openai: {
      type: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      maxTokens: 8192,
      rateLimit: {
        requestsPerMinute: 3000,
        tokensPerMinute: 1000000,
        concurrentRequests: 5,
        retry: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 30000,
          jitter: true,
          backoffMultiplier: 2
        }
      },
      enabled: true
    }
  },
  performance: {
    concurrency: 3,
    batchSize: 100,
    memoryLimit: 512,
    chunkSize: 1000,
    chunkOverlap: 200,
    maxFileSize: 1024 * 1024, // 1MB
    adaptiveBatching: true,
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 3600,
      type: 'memory'
    }
  },
  exclusions: {
    patterns: [
      '**/.git/**',
      '**/node_modules/**',
      '**/.vscode/**',
      '**/.idea/**',
      '**/dist/**',
      '**/build/**',
      '**/*.log'
    ],
    extensions: [
      '.exe', '.dll', '.so', '.dylib',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp',
      '.mp3', '.mp4', '.avi', '.mov',
      '.zip', '.tar', '.gz', '.rar'
    ],
    directories: [
      '.git', 'node_modules', '.vscode', '.idea',
      'dist', 'build', 'target', 'bin', 'obj'
    ],
    maxFileSize: 1024 * 1024, // 1MB
    minFileSize: 10 // 10 bytes
  },
  storage: {
    baseDirectory: '~/.ziri',
    vectorDatabase: 'sqlite',
    compression: {
      enabled: true,
      algorithm: 'gzip',
      level: 6
    },
    backup: {
      enabled: false,
      interval: 24,
      maxBackups: 7
    },
    cleanup: {
      enabled: true,
      maxAge: 30,
      maxSize: 1024
    }
  },
  logging: {
    level: 'info',
    fileLogging: false,
    maxFileSize: 10,
    maxFiles: 5,
    performanceLogging: false,
    apiLogging: false
  }
};