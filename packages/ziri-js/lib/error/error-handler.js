/**
 * Enhanced Error Handler with Better Messages and Recovery Suggestions
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
 * Enhanced Error Handler with recovery strategies and fallback mechanisms
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
   * Format error message with emojis and structured output
   * @param {Error} error - The error
   * @param {Object} context - Context information
   * @returns {string} Formatted error message
   */
  formatErrorMessage(error, context = {}) {
    const errorInfo = this._analyzeError(error, context);
    const suggestions = this._generateSuggestions(errorInfo);
    const troubleshooting = this._getTroubleshootingSteps(errorInfo);
    
    let output = '';
    
    // Error header with emoji
    switch (errorInfo.type) {
      case 'RATE_LIMIT_EXCEEDED':
        output += '🚨 ';
        break;
      case 'AUTHENTICATION_FAILED':
        output += '🔑 ';
        break;
      case 'NETWORK_ERROR':
        output += '🌐 ';
        break;
      case 'CONFIGURATION_ERROR':
        output += '⚙️  ';
        break;
      default:
        output += '❌ ';
        break;
    }
    
    output += `${errorInfo.message}\n\n`;
    
    // Context information
    if (errorInfo.provider && errorInfo.provider !== 'unknown') {
      output += `📍 Provider: ${errorInfo.provider}\n`;
    }
    
    if (context.operation) {
      output += `🔧 Operation: ${context.operation}\n`;
    }
    
    if (context.file) {
      output += `📄 File: ${context.file}\n`;
    }
    
    output += '\n';
    
    // Recovery suggestions with emojis
    if (suggestions.length > 0) {
      output += '💡 Recovery Suggestions:\n';
      suggestions.forEach((suggestion, index) => {
        output += `  ${index + 1}. ${suggestion}\n`;
      });
      output += '\n';
    }
    
    // Troubleshooting steps
    if (troubleshooting.length > 0) {
      output += '📋 Troubleshooting Steps:\n';
      troubleshooting.forEach((step, index) => {
        output += `  ${step}\n`;
      });
      output += '\n';
    }
    
    // Documentation links
    const docs = this._getDocumentationLinks(errorInfo);
    if (docs.specific) {
      output += `📖 See documentation: ${docs.specific}\n`;
    }
    output += `📘 General troubleshooting: ${docs.general}\n`;
    
    return output;
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
          message: `⏰ Rate limit exceeded. Retrying after ${retryAfter}ms`,
          formattedMessage: this._formatRecoveryMessage('⏰', `Rate limit exceeded for ${errorInfo.provider}. Retrying after ${retryAfter}ms...`)
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
              message: `🔄 Authentication failed for ${errorInfo.provider}. Switching to ${fallbackProvider}`,
              formattedMessage: this._formatRecoveryMessage('🔄', `Authentication failed for ${errorInfo.provider}. Switching to fallback provider: ${fallbackProvider}`)
            };
          }
        }
        
        return {
          recovered: false,
          shouldRetry: false,
          message: '🔑 Authentication failed and no fallback providers available',
          formattedMessage: this._formatRecoveryMessage('🔑', 'Authentication failed and no fallback providers available. Please check your API key configuration.')
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
          message: `🌐 Network error. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`,
          formattedMessage: this._formatRecoveryMessage('🌐', `Network error detected. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`)
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
              message: `🔄 Provider ${errorInfo.provider} failed. Switching to ${fallbackProvider}`,
              formattedMessage: this._formatRecoveryMessage('🔄', `Provider ${errorInfo.provider} failed. Switching to fallback provider: ${fallbackProvider}`)
            };
          }
        }
        
        // Otherwise retry with backoff
        const delay = this._calculateBackoffDelay(context.attempt);
        
        return {
          recovered: false,
          shouldRetry: context.attempt < this.options.maxRetries,
          delay,
          message: `🔧 Provider error. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`,
          formattedMessage: this._formatRecoveryMessage('🔧', `Provider error detected. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`)
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
          message: '⚙️  Configuration error requires manual intervention',
          formattedMessage: this._formatRecoveryMessage('⚙️', 'Configuration error requires manual intervention. Please check your configuration file and environment variables.')
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
          message: `🔧 Unknown error. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`,
          formattedMessage: this._formatRecoveryMessage('🔧', `Unknown error detected. Retrying in ${delay}ms (attempt ${context.attempt}/${this.options.maxRetries})`)
        };
      }
    });
  }

  /**
   * Format recovery message with emoji
   * @param {string} emoji - Emoji to use
   * @param {string} message - Message text
   * @returns {string} Formatted message
   * @private
   */
  _formatRecoveryMessage(emoji, message) {
    return `${emoji} ${message}`;
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
        suggestions.push('Reduce batch size or concurrency level to stay within rate limits');
        suggestions.push('Implement longer delays between requests using --batch-size and --concurrency options');
        suggestions.push('Consider upgrading to a higher tier API plan for increased rate limits');
        suggestions.push('Switch to a different embedding provider with higher limits');
        break;
        
      case 'AUTHENTICATION_FAILED':
        suggestions.push('Check your API key configuration with: ziri config show');
        suggestions.push('Verify the API key has the correct permissions and is not expired');
        suggestions.push('Try regenerating your API key from the provider dashboard');
        suggestions.push('For Ollama, ensure the service is running: ollama serve');
        break;
        
      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection and try again');
        suggestions.push('Verify the provider endpoint is accessible and not blocked by firewall');
        suggestions.push('Try increasing timeout values if you have a slow connection');
        suggestions.push('Check for proxy or VPN issues that might be blocking requests');
        break;
        
      case 'PROVIDER_ERROR':
        suggestions.push('Check provider service status on their official status page');
        suggestions.push('Verify your request format and parameters are correct');
        suggestions.push('Try switching to a different provider with: ziri config provider <name>');
        suggestions.push('Check provider-specific documentation for any API changes');
        break;
        
      case 'CONFIGURATION_ERROR':
        suggestions.push('Review your configuration file with: ziri config show');
        suggestions.push('Check environment variables are set correctly');
        suggestions.push('Verify all required settings are provided for your chosen provider');
        suggestions.push('Reset to defaults if needed: ziri config reset');
        break;
        
      default:
        suggestions.push('Check the detailed error message for specific troubleshooting information');
        suggestions.push('Try the operation again after a few minutes');
        suggestions.push('Check system resources (memory, disk space) and connectivity');
        suggestions.push('Run ziri doctor to check system health and configuration');
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
        steps.push('1️⃣ Wait for the rate limit to reset (usually 1-60 minutes)');
        steps.push('2️⃣ Reduce concurrent requests with --concurrency flag (e.g., --concurrency 2)');
        steps.push('3️⃣ Decrease batch size with --batch-size flag (e.g., --batch-size 25)');
        steps.push('4️⃣ Switch to a different provider: ziri config provider ollama');
        break;
        
      case 'AUTHENTICATION_FAILED':
        steps.push('1️⃣ Verify API key with: echo $OPENAI_API_KEY (or relevant env var)');
        steps.push('2️⃣ Check Ziri configuration: ziri config show');
        steps.push('3️⃣ Test provider connectivity: ziri doctor');
        steps.push('4️⃣ Regenerate API key from provider dashboard if needed');
        break;
        
      case 'NETWORK_ERROR':
        steps.push('1️⃣ Test internet connectivity: ping google.com');
        steps.push('2️⃣ Try accessing the provider URL directly in browser');
        steps.push('3️⃣ Check DNS resolution: nslookup api.openai.com');
        steps.push('4️⃣ Verify no proxy/firewall is blocking requests');
        break;
        
      case 'CONFIGURATION_ERROR':
        steps.push('1️⃣ Review current configuration: ziri config show');
        steps.push('2️⃣ Check environment variables are set correctly');
        steps.push('3️⃣ Validate configuration syntax and required fields');
        steps.push('4️⃣ Reset to defaults if needed: ziri config reset');
        break;
        
      default:
        steps.push('1️⃣ Review the detailed error message for specific information');
        steps.push('2️⃣ Check system logs for additional error details');
        steps.push('3️⃣ Try reproducing the error with --verbose flag for more details');
        steps.push('4️⃣ Run ziri doctor to check system health and configuration');
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
      general: 'https://github.com/sriharsha-inthub/ziri/blob/main/docs/user/troubleshooting.md'
    };
    
    switch (errorInfo.type) {
      case 'RATE_LIMIT_EXCEEDED':
        links.specific = 'https://github.com/sriharsha-inthub/ziri/blob/main/docs/user/configuration.md#rate-limiting';
        break;
      case 'AUTHENTICATION_FAILED':
        links.specific = 'https://github.com/sriharsha-inthub/ziri/blob/main/docs/user/configuration.md#provider-authentication';
        break;
      case 'CONFIGURATION_ERROR':
        links.specific = 'https://github.com/sriharsha-inthub/ziri/blob/main/docs/user/configuration.md';
        break;
      case 'NETWORK_ERROR':
        links.specific = 'https://github.com/sriharsha-inthub/ziri/blob/main/docs/user/troubleshooting.md#network-issues';
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

/**
 * Convenience function to format error messages
 * @param {Error} error - Error to format
 * @param {Object} context - Context information
 * @returns {string} Formatted error message
 */
export function formatErrorMessage(error, context = {}) {
  return globalErrorHandler.formatErrorMessage(error, context);
}