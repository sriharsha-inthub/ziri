/**
 * Configuration Validator
 * Provides comprehensive validation for Ziri configuration
 */

export class ConfigValidator {
  /**
   * Validate complete configuration
   */
  static validate(config) {
    const errors = [];
    const warnings = [];
    
    // Validate core configuration
    this.validateCore(config, errors, warnings);
    
    // Validate providers
    this.validateProviders(config, errors, warnings);
    
    // Validate performance settings
    this.validatePerformance(config, errors, warnings);
    
    // Validate exclusions
    this.validateExclusions(config, errors, warnings);
    
    // Validate storage settings
    this.validateStorage(config, errors, warnings);
    
    // Validate logging settings
    this.validateLogging(config, errors, warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate core configuration
   */
  static validateCore(config, errors, warnings) {
    if (!config.defaultProvider) {
      errors.push('defaultProvider is required');
    } else if (typeof config.defaultProvider !== 'string') {
      errors.push('defaultProvider must be a string');
    }
    
    if (config.defaultProvider && config.providers && !config.providers[config.defaultProvider]) {
      errors.push(`Default provider '${config.defaultProvider}' is not configured in providers`);
    }
  }
  
  /**
   * Validate provider configurations
   */
  static validateProviders(config, errors, warnings) {
    if (!config.providers || typeof config.providers !== 'object') {
      errors.push('providers configuration is required and must be an object');
      return;
    }
    
    if (Object.keys(config.providers).length === 0) {
      errors.push('At least one provider must be configured');
      return;
    }
    
    const validProviderTypes = ['openai', 'ollama', 'huggingface', 'cohere'];
    
    for (const [name, provider] of Object.entries(config.providers)) {
      const prefix = `Provider '${name}'`;
      
      if (!provider || typeof provider !== 'object') {
        errors.push(`${prefix} must be an object`);
        continue;
      }
      
      // Validate type
      if (!provider.type) {
        errors.push(`${prefix} missing 'type' field`);
      } else if (!validProviderTypes.includes(provider.type)) {
        errors.push(`${prefix} has invalid type '${provider.type}'. Valid types: ${validProviderTypes.join(', ')}`);
      }
      
      // Validate model
      if (!provider.model) {
        errors.push(`${prefix} missing 'model' field`);
      } else if (typeof provider.model !== 'string') {
        errors.push(`${prefix} 'model' must be a string`);
      }
      
      // Validate dimensions
      if (!provider.dimensions) {
        errors.push(`${prefix} missing 'dimensions' field`);
      } else if (!Number.isInteger(provider.dimensions) || provider.dimensions <= 0) {
        errors.push(`${prefix} 'dimensions' must be a positive integer`);
      }
      
      // Validate type-specific requirements
      this.validateProviderSpecific(name, provider, errors, warnings);
      
      // Validate rate limits
      if (provider.rateLimit) {
        this.validateRateLimit(name, provider.rateLimit, errors, warnings);
      }
      
      // Check for enabled flag
      if (provider.enabled === false) {
        warnings.push(`${prefix} is disabled`);
      }
    }
  }
  
  /**
   * Validate provider-specific configuration
   */
  static validateProviderSpecific(name, provider, errors, warnings) {
    const prefix = `Provider '${name}'`;
    
    switch (provider.type) {
      case 'openai':
        if (!provider.apiKey && !process.env.OPENAI_API_KEY) {
          warnings.push(`${prefix} missing API key. Set 'apiKey' in config or OPENAI_API_KEY environment variable`);
        }
        if (provider.baseUrl && typeof provider.baseUrl !== 'string') {
          errors.push(`${prefix} 'baseUrl' must be a string`);
        }
        break;
        
      case 'ollama':
        if (!provider.baseUrl) {
          warnings.push(`${prefix} missing 'baseUrl'. Defaulting to http://localhost:11434`);
        } else if (typeof provider.baseUrl !== 'string') {
          errors.push(`${prefix} 'baseUrl' must be a string`);
        }
        break;
        
      case 'huggingface':
        if (!provider.apiKey && !process.env.HUGGINGFACE_API_KEY) {
          warnings.push(`${prefix} missing API key. Set 'apiKey' in config or HUGGINGFACE_API_KEY environment variable`);
        }
        break;
        
      case 'cohere':
        if (!provider.apiKey && !process.env.COHERE_API_KEY) {
          warnings.push(`${prefix} missing API key. Set 'apiKey' in config or COHERE_API_KEY environment variable`);
        }
        break;
    }
  }
  
  /**
   * Validate rate limit configuration
   */
  static validateRateLimit(providerName, rateLimit, errors, warnings) {
    const prefix = `Provider '${providerName}' rate limit`;
    
    if (rateLimit.requestsPerMinute !== undefined) {
      if (!Number.isInteger(rateLimit.requestsPerMinute) || rateLimit.requestsPerMinute <= 0) {
        errors.push(`${prefix} 'requestsPerMinute' must be a positive integer`);
      }
    }
    
    if (rateLimit.tokensPerMinute !== undefined) {
      if (!Number.isInteger(rateLimit.tokensPerMinute) || rateLimit.tokensPerMinute <= 0) {
        errors.push(`${prefix} 'tokensPerMinute' must be a positive integer`);
      }
    }
    
    if (rateLimit.concurrentRequests !== undefined) {
      if (!Number.isInteger(rateLimit.concurrentRequests) || rateLimit.concurrentRequests <= 0) {
        errors.push(`${prefix} 'concurrentRequests' must be a positive integer`);
      } else if (rateLimit.concurrentRequests > 20) {
        warnings.push(`${prefix} 'concurrentRequests' is very high (${rateLimit.concurrentRequests}). Consider reducing for better stability`);
      }
    }
    
    if (rateLimit.retry) {
      this.validateRetryConfig(providerName, rateLimit.retry, errors, warnings);
    }
  }
  
  /**
   * Validate retry configuration
   */
  static validateRetryConfig(providerName, retry, errors, warnings) {
    const prefix = `Provider '${providerName}' retry`;
    
    if (retry.maxRetries !== undefined) {
      if (!Number.isInteger(retry.maxRetries) || retry.maxRetries < 0) {
        errors.push(`${prefix} 'maxRetries' must be a non-negative integer`);
      } else if (retry.maxRetries > 10) {
        warnings.push(`${prefix} 'maxRetries' is very high (${retry.maxRetries}). Consider reducing to avoid long delays`);
      }
    }
    
    if (retry.baseDelay !== undefined) {
      if (!Number.isInteger(retry.baseDelay) || retry.baseDelay <= 0) {
        errors.push(`${prefix} 'baseDelay' must be a positive integer (milliseconds)`);
      }
    }
    
    if (retry.maxDelay !== undefined) {
      if (!Number.isInteger(retry.maxDelay) || retry.maxDelay <= 0) {
        errors.push(`${prefix} 'maxDelay' must be a positive integer (milliseconds)`);
      }
    }
    
    if (retry.baseDelay && retry.maxDelay && retry.baseDelay > retry.maxDelay) {
      errors.push(`${prefix} 'baseDelay' cannot be greater than 'maxDelay'`);
    }
    
    if (retry.backoffMultiplier !== undefined) {
      if (typeof retry.backoffMultiplier !== 'number' || retry.backoffMultiplier <= 1) {
        errors.push(`${prefix} 'backoffMultiplier' must be a number greater than 1`);
      }
    }
  }
  
  /**
   * Validate performance configuration
   */
  static validatePerformance(config, errors, warnings) {
    const perf = config.performance;
    if (!perf) return;
    
    if (perf.concurrency !== undefined) {
      if (!Number.isInteger(perf.concurrency) || perf.concurrency < 1) {
        errors.push('Performance concurrency must be a positive integer');
      } else if (perf.concurrency > 20) {
        warnings.push(`Performance concurrency is very high (${perf.concurrency}). Consider reducing for better stability`);
      }
    }
    
    if (perf.batchSize !== undefined) {
      if (!Number.isInteger(perf.batchSize) || perf.batchSize < 1) {
        errors.push('Performance batchSize must be a positive integer');
      } else if (perf.batchSize > 1000) {
        warnings.push(`Performance batchSize is very high (${perf.batchSize}). This may cause memory issues`);
      }
    }
    
    if (perf.memoryLimit !== undefined) {
      if (!Number.isInteger(perf.memoryLimit) || perf.memoryLimit < 128) {
        errors.push('Performance memoryLimit must be at least 128MB');
      } else if (perf.memoryLimit < 256) {
        warnings.push(`Performance memoryLimit is low (${perf.memoryLimit}MB). Consider increasing for better performance`);
      }
    }
    
    if (perf.chunkSize !== undefined) {
      if (!Number.isInteger(perf.chunkSize) || perf.chunkSize < 100) {
        errors.push('Performance chunkSize must be at least 100 characters');
      } else if (perf.chunkSize > 8192) {
        warnings.push(`Performance chunkSize is very high (${perf.chunkSize}). This may exceed model limits`);
      }
    }
    
    if (perf.chunkOverlap !== undefined) {
      if (!Number.isInteger(perf.chunkOverlap) || perf.chunkOverlap < 0) {
        errors.push('Performance chunkOverlap must be a non-negative integer');
      }
      
      if (perf.chunkSize && perf.chunkOverlap >= perf.chunkSize) {
        errors.push('Performance chunkOverlap must be less than chunkSize');
      }
    }
    
    if (perf.maxFileSize !== undefined) {
      if (!Number.isInteger(perf.maxFileSize) || perf.maxFileSize <= 0) {
        errors.push('Performance maxFileSize must be a positive integer (bytes)');
      }
    }
  }
  
  /**
   * Validate exclusions configuration
   */
  static validateExclusions(config, errors, warnings) {
    const exclusions = config.exclusions;
    if (!exclusions) return;
    
    if (exclusions.patterns && !Array.isArray(exclusions.patterns)) {
      errors.push('Exclusions patterns must be an array');
    }
    
    if (exclusions.extensions && !Array.isArray(exclusions.extensions)) {
      errors.push('Exclusions extensions must be an array');
    }
    
    if (exclusions.directories && !Array.isArray(exclusions.directories)) {
      errors.push('Exclusions directories must be an array');
    }
    
    if (exclusions.maxFileSize !== undefined) {
      if (!Number.isInteger(exclusions.maxFileSize) || exclusions.maxFileSize <= 0) {
        errors.push('Exclusions maxFileSize must be a positive integer (bytes)');
      }
    }
    
    if (exclusions.minFileSize !== undefined) {
      if (!Number.isInteger(exclusions.minFileSize) || exclusions.minFileSize < 0) {
        errors.push('Exclusions minFileSize must be a non-negative integer (bytes)');
      }
    }
  }
  
  /**
   * Validate storage configuration
   */
  static validateStorage(config, errors, warnings) {
    const storage = config.storage;
    if (!storage) return;
    
    if (storage.vectorDatabase && !['sqlite', 'faiss', 'chroma'].includes(storage.vectorDatabase)) {
      errors.push("Storage vectorDatabase must be one of: 'sqlite', 'faiss', 'chroma'");
    }
    
    if (storage.compression && typeof storage.compression === 'object') {
      if (storage.compression.algorithm && !['gzip', 'lz4', 'zstd'].includes(storage.compression.algorithm)) {
        errors.push("Storage compression algorithm must be one of: 'gzip', 'lz4', 'zstd'");
      }
      
      if (storage.compression.level !== undefined) {
        if (!Number.isInteger(storage.compression.level) || storage.compression.level < 1 || storage.compression.level > 9) {
          errors.push('Storage compression level must be an integer between 1 and 9');
        }
      }
    }
  }
  
  /**
   * Validate logging configuration
   */
  static validateLogging(config, errors, warnings) {
    const logging = config.logging;
    if (!logging) return;
    
    if (logging.level && !['error', 'warn', 'info', 'debug', 'trace'].includes(logging.level)) {
      errors.push("Logging level must be one of: 'error', 'warn', 'info', 'debug', 'trace'");
    }
    
    if (logging.maxFileSize !== undefined) {
      if (!Number.isInteger(logging.maxFileSize) || logging.maxFileSize <= 0) {
        errors.push('Logging maxFileSize must be a positive integer (MB)');
      }
    }
    
    if (logging.maxFiles !== undefined) {
      if (!Number.isInteger(logging.maxFiles) || logging.maxFiles <= 0) {
        errors.push('Logging maxFiles must be a positive integer');
      }
    }
  }
  
  /**
   * Validate provider switching compatibility
   */
  static validateProviderSwitch(fromProvider, toProvider, errors, warnings) {
    if (!fromProvider || !toProvider) {
      errors.push('Both source and target providers must be specified for switching validation');
      return;
    }
    
    // Check dimension compatibility
    if (fromProvider.dimensions !== toProvider.dimensions) {
      warnings.push(`Dimension mismatch: ${fromProvider.type} uses ${fromProvider.dimensions} dimensions, ${toProvider.type} uses ${toProvider.dimensions}. Re-indexing will be required.`);
    }
    
    // Check model compatibility
    if (fromProvider.type === toProvider.type && fromProvider.model !== toProvider.model) {
      warnings.push(`Model change within same provider type: ${fromProvider.model} → ${toProvider.model}. Re-indexing may be required for optimal results.`);
    }
    
    // Check for potential performance differences
    const performanceWarnings = this.getProviderPerformanceWarnings(fromProvider.type, toProvider.type);
    warnings.push(...performanceWarnings);
  }
  
  /**
   * Get performance warnings for provider switches
   */
  static getProviderPerformanceWarnings(fromType, toType) {
    const warnings = [];
    
    const providerPerformance = {
      openai: { speed: 'fast', cost: 'high', quality: 'high' },
      ollama: { speed: 'medium', cost: 'free', quality: 'medium' },
      huggingface: { speed: 'slow', cost: 'medium', quality: 'medium' },
      cohere: { speed: 'fast', cost: 'high', quality: 'high' }
    };
    
    const from = providerPerformance[fromType];
    const to = providerPerformance[toType];
    
    if (from && to) {
      if (from.speed === 'fast' && to.speed !== 'fast') {
        warnings.push(`Switching from ${fromType} to ${toType} may result in slower embedding generation`);
      }
      
      if (from.cost === 'free' && to.cost !== 'free') {
        warnings.push(`Switching from ${fromType} to ${toType} will incur API costs`);
      }
      
      if (from.quality === 'high' && to.quality !== 'high') {
        warnings.push(`Switching from ${fromType} to ${toType} may result in lower embedding quality`);
      }
    }
    
    return warnings;
  }
}