/**
 * Environment Variable Loader
 * Handles loading configuration from environment variables with proper type conversion
 */

export class EnvironmentLoader {
  /**
   * Load all Ziri-related environment variables
   */
  static loadEnvironmentConfig() {
    const config = {};
    
    // Core configuration
    this.setIfDefined(config, 'defaultProvider', process.env.ZIRI_DEFAULT_PROVIDER);
    this.setIfDefined(config, 'configPath', process.env.ZIRI_CONFIG_PATH);
    this.setIfDefined(config, 'baseDirectory', process.env.ZIRI_BASE_DIR);
    
    // Performance settings
    const performance = {};
    this.setIfDefined(performance, 'concurrency', process.env.ZIRI_CONCURRENCY, 'int');
    this.setIfDefined(performance, 'batchSize', process.env.ZIRI_BATCH_SIZE, 'int');
    this.setIfDefined(performance, 'memoryLimit', process.env.ZIRI_MEMORY_LIMIT, 'int');
    this.setIfDefined(performance, 'chunkSize', process.env.ZIRI_CHUNK_SIZE, 'int');
    this.setIfDefined(performance, 'chunkOverlap', process.env.ZIRI_CHUNK_OVERLAP, 'int');
    this.setIfDefined(performance, 'maxFileSize', process.env.ZIRI_MAX_FILE_SIZE, 'int');
    this.setIfDefined(performance, 'adaptiveBatching', process.env.ZIRI_ADAPTIVE_BATCHING, 'bool');
    
    if (Object.keys(performance).length > 0) {
      config.performance = performance;
    }
    
    // Provider configurations
    const providers = {};
    
    // OpenAI provider
    const openai = {};
    this.setIfDefined(openai, 'apiKey', process.env.OPENAI_API_KEY);
    this.setIfDefined(openai, 'baseUrl', process.env.OPENAI_BASE_URL);
    this.setIfDefined(openai, 'model', process.env.OPENAI_MODEL);
    this.setIfDefined(openai, 'dimensions', process.env.OPENAI_DIMENSIONS, 'int');
    this.setIfDefined(openai, 'maxTokens', process.env.OPENAI_MAX_TOKENS, 'int');
    this.setIfDefined(openai, 'enabled', process.env.OPENAI_ENABLED, 'bool');
    
    if (Object.keys(openai).length > 0) {
      providers.openai = openai;
    }
    
    // Ollama provider
    const ollama = {};
    this.setIfDefined(ollama, 'baseUrl', process.env.OLLAMA_BASE_URL);
    this.setIfDefined(ollama, 'model', process.env.OLLAMA_MODEL);
    this.setIfDefined(ollama, 'dimensions', process.env.OLLAMA_DIMENSIONS, 'int');
    this.setIfDefined(ollama, 'enabled', process.env.OLLAMA_ENABLED, 'bool');
    
    if (Object.keys(ollama).length > 0) {
      providers.ollama = ollama;
    }
    
    // Hugging Face provider
    const huggingface = {};
    this.setIfDefined(huggingface, 'apiKey', process.env.HUGGINGFACE_API_KEY);
    this.setIfDefined(huggingface, 'model', process.env.HUGGINGFACE_MODEL);
    this.setIfDefined(huggingface, 'dimensions', process.env.HUGGINGFACE_DIMENSIONS, 'int');
    this.setIfDefined(huggingface, 'enabled', process.env.HUGGINGFACE_ENABLED, 'bool');
    
    if (Object.keys(huggingface).length > 0) {
      providers.huggingface = huggingface;
    }
    
    // Cohere provider
    const cohere = {};
    this.setIfDefined(cohere, 'apiKey', process.env.COHERE_API_KEY);
    this.setIfDefined(cohere, 'model', process.env.COHERE_MODEL);
    this.setIfDefined(cohere, 'dimensions', process.env.COHERE_DIMENSIONS, 'int');
    this.setIfDefined(cohere, 'enabled', process.env.COHERE_ENABLED, 'bool');
    
    if (Object.keys(cohere).length > 0) {
      providers.cohere = cohere;
    }
    
    if (Object.keys(providers).length > 0) {
      config.providers = providers;
    }
    
    // Logging configuration
    const logging = {};
    this.setIfDefined(logging, 'level', process.env.ZIRI_LOG_LEVEL);
    this.setIfDefined(logging, 'fileLogging', process.env.ZIRI_FILE_LOGGING, 'bool');
    this.setIfDefined(logging, 'performanceLogging', process.env.ZIRI_PERFORMANCE_LOGGING, 'bool');
    this.setIfDefined(logging, 'apiLogging', process.env.ZIRI_API_LOGGING, 'bool');
    
    if (Object.keys(logging).length > 0) {
      config.logging = logging;
    }
    
    // Storage configuration
    const storage = {};
    this.setIfDefined(storage, 'baseDirectory', process.env.ZIRI_STORAGE_DIR);
    this.setIfDefined(storage, 'vectorDatabase', process.env.ZIRI_VECTOR_DB);
    
    if (Object.keys(storage).length > 0) {
      config.storage = storage;
    }
    
    return config;
  }
  
  /**
   * Set configuration value if environment variable is defined
   */
  static setIfDefined(config, key, value, type = 'string') {
    if (value !== undefined && value !== null && value !== '') {
      switch (type) {
        case 'int':
          const intValue = parseInt(value, 10);
          if (!isNaN(intValue)) {
            config[key] = intValue;
          }
          break;
        case 'float':
          const floatValue = parseFloat(value);
          if (!isNaN(floatValue)) {
            config[key] = floatValue;
          }
          break;
        case 'bool':
          config[key] = value.toLowerCase() === 'true' || value === '1';
          break;
        case 'json':
          try {
            config[key] = JSON.parse(value);
          } catch {
            // Ignore invalid JSON
          }
          break;
        case 'array':
          config[key] = value.split(',').map(item => item.trim()).filter(item => item);
          break;
        default:
          config[key] = value;
      }
    }
  }
  
  /**
   * Get all available environment variable names for documentation
   */
  static getAvailableEnvironmentVariables() {
    return {
      core: [
        'ZIRI_DEFAULT_PROVIDER',
        'ZIRI_CONFIG_PATH',
        'ZIRI_BASE_DIR'
      ],
      performance: [
        'ZIRI_CONCURRENCY',
        'ZIRI_BATCH_SIZE',
        'ZIRI_MEMORY_LIMIT',
        'ZIRI_CHUNK_SIZE',
        'ZIRI_CHUNK_OVERLAP',
        'ZIRI_MAX_FILE_SIZE',
        'ZIRI_ADAPTIVE_BATCHING'
      ],
      providers: {
        openai: [
          'OPENAI_API_KEY',
          'OPENAI_BASE_URL',
          'OPENAI_MODEL',
          'OPENAI_DIMENSIONS',
          'OPENAI_MAX_TOKENS',
          'OPENAI_ENABLED'
        ],
        ollama: [
          'OLLAMA_BASE_URL',
          'OLLAMA_MODEL',
          'OLLAMA_DIMENSIONS',
          'OLLAMA_ENABLED'
        ],
        huggingface: [
          'HUGGINGFACE_API_KEY',
          'HUGGINGFACE_MODEL',
          'HUGGINGFACE_DIMENSIONS',
          'HUGGINGFACE_ENABLED'
        ],
        cohere: [
          'COHERE_API_KEY',
          'COHERE_MODEL',
          'COHERE_DIMENSIONS',
          'COHERE_ENABLED'
        ]
      },
      logging: [
        'ZIRI_LOG_LEVEL',
        'ZIRI_FILE_LOGGING',
        'ZIRI_PERFORMANCE_LOGGING',
        'ZIRI_API_LOGGING'
      ],
      storage: [
        'ZIRI_STORAGE_DIR',
        'ZIRI_VECTOR_DB'
      ]
    };
  }
}