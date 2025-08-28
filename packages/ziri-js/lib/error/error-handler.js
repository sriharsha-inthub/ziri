/**
 * Comprehensive Error Handler
 * Provides graceful error recovery, detailed error messages, and fallback strategies
 */

import { EventEmitter } from 'events';

/**
 * Custom error classes for different types of failures
 */
export class ZiriError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ZiriError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
}

export class ProviderError extends ZiriError {
  constructor(message, provider, originalError = null, details = {}) {
    super(message, 'PROVIDER_ERROR', {
      provider,
      originalError: originalError?.message,
      ...details
    });
    this.name = 'ProviderError';
    this.provider = provider;
    this.originalError = originalError;
  }
}

export class RateLimitError extends ProviderError {
  constructor(provider, retryAfter = null, details = {}) {
    super(
      `Rate limit exceeded for provider ${provider}`,
      provider,
      null,
      { retryAfter, ...details }
    );
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends ProviderError {
  constructor(provider, details = {}) {
    super(
      `Authentication failed for provider ${provider}`,
      provider,
      null,
      details
    );
    this.name = 'AuthenticationError';
    this.code = 'AUTHENTICATION_FAILED';
  }
}

export class NetworkError extends ProviderError {
  constructor(provider, originalError, details = {}) {
    super(
      `Network error for provider ${provider}`,
      provider,
      originalError,
      details
    );
    this.name = 'NetworkError';
    this.code = 'NETWORK_ERROR';
  }
}

export class ConfigurationError extends ZiriError {
  constructor(message, details = {}) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error Handler with recovery strategies and fallback mechanisms
 */
export class ErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      baseRetryDelay: options.baseRetryDelay || 1000,
      maxRetryDelay: options.maxRetryDelay || 30000,
      enableFallback: options.enableFallback !== false,
      fallbackProviders: options.fallbackProviders || [],
      logErrors: options.logErrors !== false,
      ...options
    };
    
    // Error statistics
    this.errorStats = {
      total: 0,
      byType: new Map(),
      byProvider: new Map(),
      recovered: 0,
      fallbacksUsed: 0
    };
    
    // Recovery strategies
    this.recoveryStrategies = new Map();
    this._initializeRecoveryStrategies();
  }

  /**
   * Handle an error with appropriate recovery strategy
   * @param {Error} error - The error to handle
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Recovery result
   */
  async handleError(error, context = {}) {
    this._updateErrorStats(error, context);
    
    const errorInfo = this._analyzeError(error, context);
    const strategy = this._getRecoveryStrategy(errorInfo);
    
    this.emit('error:detected', {
      error: errorInfo,
      strategy: strategy.name,
      context
    });
    
    try {
      const result = await strategy.execute(errorInfo, context);
      
      if (result.recovered) {
        this.errorStats.recovered++;
        this.emit('error:recovered', {
          error: errorInfo,
          strategy: strategy.name,
          result,
          context
        });
      }
      
      return result;
    } catch (recoveryError) {
      this.emit('error:recovery_failed', {
        originalError: errorInfo,
        recoveryError,
        strategy: strategy.name,
        context
      });
      
      throw recoveryError;
    }
  }

  /**
   * Execute operation with error handling and recovery
   * @param {Function} operation - Operation to execute
   * @param {Object} context - Context information
   * @returns {Promise<any>} Operation result
   */
  async executeWithRecovery(operation, context = {}) {
    let lastError;
    let attempt = 0;
    
    while (attempt <= this.options.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= this.options.maxRetries) {
          const recoveryResult = await this.handleError(error, {
            ...context,
            attempt,
            maxRetries: this.options.maxRetries
          });
          
          if (recoveryResult.shouldRetry) {
            if (recoveryResult.delay > 0) {
              await this._sleep(recoveryResult.delay);
            }
            continue;
          } else if (recoveryResult.fallbackOperation) {
            try {
              return await recoveryResult.fallbackOperation();
            } catch (fallbackError) {
              // Continue with retry loop if fallback fails
              lastError = fallbackError;
            }
          }
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get detailed error message with actionable suggestions
   * @param {Error} error - The error
   * @param {Object} context - Context information
   * @returns {Object} Detailed error information
   */
  getDetailedErrorMessage(error, context = {}) {
    const errorInfo = this._analyzeError(error, context);
    const suggestions = this._generateSuggestions(errorInfo);
    
    return {
      message: errorInfo.message,
      code: errorInfo.code,
      type: errorInfo.type,
      provider: errorInfo.provider,
      suggestions,
      troubleshooting: this._getTroubleshootingSteps(errorInfo),
      documentation: this._getDocumentationLinks(errorInfo),
      context: errorInfo.context
    };
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      byType: Object.fromEntries(this.errorStats.byType),
      byProvider: Object.fromEntries(this.errorStats.byProvider),
      recoveryRate: this.errorStats.total > 0 
        ? (this.errorStats.recovered / this.errorStats.total) * 100 
        : 0
    };
  }

  /**
   * Reset error statistics
   */
  resetStats() {
    this.errorStats = {
      total: 0,
      byType: new Map(),
      byProvider: new Map(),
      recovered: 0,
      fallbacksUsed: 0
    };
  }

  /**
   * Initialize recovery strategies
   * @private
   */
  _initializeRecoveryStrategies() {
    // Rate limit recovery
    this.recoveryStrategies.set('RATE_LIMIT_EXCEEDED', {
      name: 'Rate Limit Recovery',
      execute: async (errorInfo, context) => {
        const retryAfter = errorInfo.retryAfter || this._calculateBackoffDelay(context.attempt);
        
        return {
          recovered: false,
          shouldRetry: true,
          delay: retryAfter,
          message: `Rate limit exceeded. Retrying after ${retryAfter}ms`
        };
      }
    });

    // Authentication error recovery
    this.recoveryStrategies.set('AUTHENTICATION_FAILED', {
      name: 'Authentication Recovery',
      execute: async (errorInfo, context) => {
        // Try fallback providers if available
        if (this.options.enableFallback && this.options.fallbackProviders.length > 0) {
          const fallbackProvider = this._getNextFallbackProvider(errorInfo.provider);
          
          if (fallbackProvider && context.fallbackOperation) {
            this.errorStats.fallbacksUsed++;
            
            return {
              recovered: true,
              shouldRetry: false,
              fallbackOperation: () => context.fallbackOperation(fallbackProvider),
              message: `Authentication failed for ${errorInfo.provider}. Switching to ${fallbackProvider}`
            };
          }
        }
        
        return {
          recovered: false,
          shouldRetry: false,
          message: 'Authentication failed and no fallback providers available'
        };
      }
    });

    // Network error recovery
    this.recoveryStrategies.set('NETWORK_ERROR', {
      name: 'Network Recovery',
      execute: async (errorInfo, context) => {
        const delay = this._calculateBackoffDelay(context.attempt);
        
        return {
          recovered: false,
          shouldRetry: context.attempt < this.options.maxRetries,
          delay,
          message: `Network error. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`
        };
      }
    });

    // Provider error recovery
    this.recoveryStrategies.set('PROVIDER_ERROR', {
      name: 'Provider Recovery',
      execute: async (errorInfo, context) => {
        // Try fallback providers first
        if (this.options.enableFallback && this.options.fallbackProviders.length > 0) {
          const fallbackProvider = this._getNextFallbackProvider(errorInfo.provider);
          
          if (fallbackProvider) {
            this.errorStats.fallbacksUsed++;
            
            return {
              recovered: true,
              shouldRetry: false,
              fallbackOperation: () => context.fallbackOperation?.(fallbackProvider),
              message: `Provider ${errorInfo.provider} failed. Switching to ${fallbackProvider}`
            };
          }
        }
        
        // Otherwise retry with backoff
        const delay = this._calculateBackoffDelay(context.attempt);
        
        return {
          recovered: false,
          shouldRetry: context.attempt < this.options.maxRetries,
          delay,
          message: `Provider error. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`
        };
      }
    });

    // Configuration error recovery
    this.recoveryStrategies.set('CONFIGURATION_ERROR', {
      name: 'Configuration Recovery',
      execute: async (errorInfo, context) => {
        return {
          recovered: false,
          shouldRetry: false,
          message: 'Configuration error requires manual intervention'
        };
      }
    });

    // Default recovery strategy
    this.recoveryStrategies.set('DEFAULT', {
      name: 'Default Recovery',
      execute: async (errorInfo, context) => {
        const delay = this._calculateBackoffDelay(context.attempt);
        
        return {
          recovered: false,
          shouldRetry: context.attempt < this.options.maxRetries,
          delay,
          message: `Unknown error. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`
        };
      }
    });
  }

  /**
   * Analyze error to determine type and context
   * @param {Error} error - The error to analyze
   * @param {Object} context - Additional context
   * @returns {Object} Error analysis
   * @private
   */
  _analyzeError(error, context) {
    let errorType = 'UNKNOWN_ERROR';
    let provider = context.provider || 'unknown';
    let retryAfter = null;
    
    // Analyze error type
    if (error instanceof RateLimitError) {
      errorType = 'RATE_LIMIT_EXCEEDED';
      retryAfter = error.retryAfter;
    } else if (error instanceof AuthenticationError) {
      errorType = 'AUTHENTICATION_FAILED';
    } else if (error instanceof NetworkError) {
      errorType = 'NETWORK_ERROR';
    } else if (error instanceof ProviderError) {
      errorType = 'PROVIDER_ERROR';
    } else if (error instanceof ConfigurationError) {
      errorType = 'CONFIGURATION_ERROR';
    } else {
      // Analyze error message for common patterns
      const message = error.message?.toLowerCase() || '';
      
      if (message.includes('rate limit') || message.includes('429')) {
        errorType = 'RATE_LIMIT_EXCEEDED';
        // Try to extract retry-after from error message
        const retryMatch = message.match(/retry.*?(\d+)/);
        if (retryMatch) {
          retryAfter = parseInt(retryMatch[1]) * 1000; // Convert to milliseconds
        }
      } else if (message.includes('unauthorized') || message.includes('401') || message.includes('api key')) {
        errorType = 'AUTHENTICATION_FAILED';
      } else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        errorType = 'NETWORK_ERROR';
      } else if (message.includes('config')) {
        errorType = 'CONFIGURATION_ERROR';
      }
    }
    
    return {
      type: errorType,
      code: error.code || errorType,
      message: error.message,
      provider,
      retryAfter,
      originalError: error,
      context
    };
  }

  /**
   * Get recovery strategy for error type
   * @param {Object} errorInfo - Error information
   * @returns {Object} Recovery strategy
   * @private
   */
  _getRecoveryStrategy(errorInfo) {
    return this.recoveryStrategies.get(errorInfo.type) || 
           this.recoveryStrategies.get('DEFAULT');
  }

  /**
   * Calculate exponential backoff delay with jitter
   * @param {number} attempt - Attempt number
   * @returns {number} Delay in milliseconds
   * @private
   */
  _calculateBackoffDelay(attempt) {
    const exponentialDelay = this.options.baseRetryDelay * Math.pow(2, attempt - 1);
    const jitter = exponentialDelay * 0.1 * Math.random(); // 10% jitter
    const delay = exponentialDelay + jitter;
    
    return Math.min(delay, this.options.maxRetryDelay);
  }

  /**
   * Get next fallback provider
   * @param {string} failedProvider - Provider that failed
   * @returns {string|null} Next fallback provider
   * @private
   */
  _getNextFallbackProvider(failedProvider) {
    const availableProviders = this.options.fallbackProviders.filter(p => p !== failedProvider);
    return availableProviders.length > 0 ? availableProviders[0] : null;
  }

  /**
   * Update error statistics
   * @param {Error} error - The error
   * @param {Object} context - Context information
   * @private
   */
  _updateErrorStats(error, context) {
    this.errorStats.total++;
    
    const errorType = error.constructor.name;
    this.errorStats.byType.set(errorType, (this.errorStats.byType.get(errorType) || 0) + 1);
    
    const provider = context.provider || 'unknown';
    this.errorStats.byProvider.set(provider, (this.errorStats.byProvider.get(provider) || 0) + 1);
  }

  /**
   * Generate actionable suggestions for error
   * @param {Object} errorInfo - Error information
   * @returns {string[]} Array of suggestions
   * @private
   */
  _generateSuggestions(errorInfo) {
    const suggestions = [];
    
    switch (errorInfo.type) {
      case 'RATE_LIMIT_EXCEEDED':
        suggestions.push('Reduce batch size or concurrency level');
        suggestions.push('Implement longer delays between requests');
        suggestions.push('Consider upgrading to a higher tier API plan');
        suggestions.push('Switch to a different embedding provider');
        break;
        
      case 'AUTHENTICATION_FAILED':
        suggestions.push('Check your API key configuration');
        suggestions.push('Verify the API key has the correct permissions');
        suggestions.push('Ensure the API key is not expired');
        suggestions.push('Try regenerating your API key');
        break;
        
      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Verify the provider endpoint is accessible');
        suggestions.push('Try increasing timeout values');
        suggestions.push('Check for firewall or proxy issues');
        break;
        
      case 'PROVIDER_ERROR':
        suggestions.push('Check provider service status');
        suggestions.push('Verify your request format is correct');
        suggestions.push('Try switching to a different provider');
        suggestions.push('Check provider-specific documentation');
        break;
        
      case 'CONFIGURATION_ERROR':
        suggestions.push('Review your configuration file');
        suggestions.push('Check environment variables');
        suggestions.push('Verify all required settings are provided');
        suggestions.push('Consult the configuration documentation');
        break;
        
      default:
        suggestions.push('Check the error message for specific details');
        suggestions.push('Try the operation again');
        suggestions.push('Check system resources and connectivity');
        break;
    }
    
    return suggestions;
  }

  /**
   * Get troubleshooting steps for error
   * @param {Object} errorInfo - Error information
   * @returns {string[]} Array of troubleshooting steps
   * @private
   */
  _getTroubleshootingSteps(errorInfo) {
    const steps = [];
    
    switch (errorInfo.type) {
      case 'RATE_LIMIT_EXCEEDED':
        steps.push('1. Wait for the rate limit to reset');
        steps.push('2. Reduce the number of concurrent requests');
        steps.push('3. Implement exponential backoff');
        steps.push('4. Consider using a different provider');
        break;
        
      case 'AUTHENTICATION_FAILED':
        steps.push('1. Verify your API key is set correctly');
        steps.push('2. Check environment variables');
        steps.push('3. Test the API key with a simple request');
        steps.push('4. Contact provider support if key is valid');
        break;
        
      case 'NETWORK_ERROR':
        steps.push('1. Test internet connectivity');
        steps.push('2. Try accessing the provider URL directly');
        steps.push('3. Check DNS resolution');
        steps.push('4. Verify no proxy/firewall blocking');
        break;
        
      default:
        steps.push('1. Review the error message carefully');
        steps.push('2. Check system logs for additional details');
        steps.push('3. Try reproducing the error');
        steps.push('4. Contact support if issue persists');
        break;
    }
    
    return steps;
  }

  /**
   * Get documentation links for error type
   * @param {Object} errorInfo - Error information
   * @returns {Object} Documentation links
   * @private
   */
  _getDocumentationLinks(errorInfo) {
    const links = {
      general: 'https://github.com/ziri-ai/ziri/docs/troubleshooting.md'
    };
    
    switch (errorInfo.type) {
      case 'RATE_LIMIT_EXCEEDED':
        links.specific = 'https://github.com/ziri-ai/ziri/docs/rate-limits.md';
        break;
      case 'AUTHENTICATION_FAILED':
        links.specific = 'https://github.com/ziri-ai/ziri/docs/authentication.md';
        break;
      case 'CONFIGURATION_ERROR':
        links.specific = 'https://github.com/ziri-ai/ziri/docs/configuration.md';
        break;
    }
    
    return links;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Convenience function to handle errors
 * @param {Error} error - Error to handle
 * @param {Object} context - Context information
 * @returns {Promise<Object>} Recovery result
 */
export async function handleError(error, context = {}) {
  return globalErrorHandler.handleError(error, context);
}

/**
 * Convenience function to execute with recovery
 * @param {Function} operation - Operation to execute
 * @param {Object} context - Context information
 * @returns {Promise<any>} Operation result
 */
export async function executeWithRecovery(operation, context = {}) {
  return globalErrorHandler.executeWithRecovery(operation, context);
}