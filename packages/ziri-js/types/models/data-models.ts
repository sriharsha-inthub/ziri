/**
 * Core Data Models for Ziri Performance Optimization
 */

export interface RepositoryInfo {
  /** Unique repository identifier (hash-based) */
  id: string;
  
  /** Absolute path to repository */
  path: string;
  
  /** Repository name (derived from path) */
  name: string;
  
  /** Repository URL if available */
  url?: string;
  
  /** Git branch if applicable */
  branch?: string;
  
  /** Repository creation timestamp */
  createdAt: Date;
  
  /** Last access timestamp */
  lastAccessed: Date;
}

export interface ProcessingJob {
  /** Unique job identifier */
  id: string;
  
  /** Repository being processed */
  repositoryId: string;
  
  /** Job type */
  type: JobType;
  
  /** Current job status */
  status: JobStatus;
  
  /** Job creation timestamp */
  createdAt: Date;
  
  /** Job start timestamp */
  startedAt?: Date;
  
  /** Job completion timestamp */
  completedAt?: Date;
  
  /** Progress information */
  progress: JobProgress;
  
  /** Error information if failed */
  error?: JobError;
}

export interface JobProgress {
  /** Current step description */
  currentStep: string;
  
  /** Total items to process */
  totalItems: number;
  
  /** Items processed so far */
  processedItems: number;
  
  /** Percentage complete (0-100) */
  percentage: number;
  
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;
  
  /** Processing rate (items/sec) */
  processingRate: number;
}

export interface JobError {
  /** Error code */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Detailed error information */
  details?: string;
  
  /** Stack trace if available */
  stack?: string;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Whether the job can be retried */
  retryable: boolean;
}

export interface PerformanceMetrics {
  /** Metric collection timestamp */
  timestamp: Date;
  
  /** Memory usage in MB */
  memoryUsage: number;
  
  /** CPU usage percentage */
  cpuUsage: number;
  
  /** Active concurrent operations */
  concurrentOperations: number;
  
  /** API requests per second */
  apiRequestsPerSecond: number;
  
  /** Average API response time (ms) */
  avgApiResponseTime: number;
  
  /** Queue sizes */
  queueSizes: {
    fileProcessing: number;
    embedding: number;
    storage: number;
  };
}

export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  
  /** Cache entry creation timestamp */
  createdAt: Date;
  
  /** Cache entry expiration timestamp */
  expiresAt: Date;
  
  /** Number of times this entry was accessed */
  accessCount: number;
  
  /** Last access timestamp */
  lastAccessed: Date;
  
  /** Entry size in bytes */
  size: number;
}

export type JobType = 
  | 'full_index'
  | 'incremental_update'
  | 'summary_generation'
  | 'provider_migration'
  | 'cleanup';

export type JobStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface BatchInfo {
  /** Batch identifier */
  id: string;
  
  /** Batch size (number of items) */
  size: number;
  
  /** Total tokens in batch */
  tokenCount: number;
  
  /** Batch creation timestamp */
  createdAt: Date;
  
  /** Processing start timestamp */
  startedAt?: Date;
  
  /** Processing completion timestamp */
  completedAt?: Date;
  
  /** Batch processing duration (ms) */
  duration?: number;
  
  /** Success/failure status */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
}

export interface RetryAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;
  
  /** Timestamp of attempt */
  timestamp: Date;
  
  /** Delay before this attempt (ms) */
  delay: number;
  
  /** Error that caused the retry */
  error: string;
  
  /** Whether this attempt succeeded */
  success: boolean;
}