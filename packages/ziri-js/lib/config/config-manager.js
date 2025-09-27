/**
 * Configuration Manager
 * Handles loading, validation, and management of Ziri configuration
 */

import { join } from 'path';
import { readFile, writeFile, access } from 'fs/promises';
import { homedir } from 'os';
import { EnvironmentLoader } from './environment-loader.js';
import { ConfigValidator } from './config-validator.js';
import { ConfigMigrator } from './config-migrator.js';
import { ProviderSwitcher } from './provider-switcher.js';

export class ConfigManager {
  constructor(baseDirectory = '~/.ziri', indexStore = null) {
    this.baseDirectory = baseDirectory.startsWith('~') 
      ? join(homedir(), baseDirectory.slice(2))
      : baseDirectory;
    this.configPath = join(this.baseDirectory, 'config', 'ziri.json');
    this.providersPath = join(this.baseDirectory, 'config', 'providers.json');
    this._config = null;
    
    // Initialize sub-components
    this.migrator = new ConfigMigrator(this.baseDirectory);
    this.providerSwitcher = indexStore ? new ProviderSwitcher(this, indexStore) : null;
  }

  /**
   * Get configuration (expected by tests)
   */
  async getConfig() {
    return await this.loadConfig();
  }

  /**
   * Update configuration (expected by tests)
   */
  async updateConfig(configUpdate) {
    const currentConfig = await this.loadConfig({ includeEnvironment: false });
    const updatedConfig = this.deepMerge(currentConfig, configUpdate);
    await this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  /**
   * Configure provider (expected by tests)
   */
  async configureProvider(name, providerConfig) {
    const config = await this.loadConfig({ includeEnvironment: false });
    
    // Validate the new provider
    const testConfig = {
      ...config,
      providers: { 
        ...config.providers,
        [name]: {
          type: name,
          ...providerConfig
        }
      }
    };
    
    const validation = ConfigValidator.validate(testConfig);
    if (!validation.valid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
    }
    
    config.providers[name] = {
      type: name,
      ...providerConfig
    };
    
    await this.saveConfig(config);
    return { success: true, warnings: validation.warnings };
  }

  /**
   * Reset configuration (expected by tests)
   */
  async resetConfig() {
    return await this.resetToDefaults();
  }

  /**
   * Load environment configuration (expected by tests)
   */
  async loadEnvironmentConfig() {
    return EnvironmentLoader.loadEnvironmentConfig();
  }

  /**
   * Validate configuration (expected by tests)
   */
  validateConfig(config) {
    return ConfigValidator.validate(config || this._config);
  }

  /**
   * Get provider configurations (expected by tests and CLI)
   */
  async getProviderConfigs() {
    const config = await this.loadConfig();
    return config.providers;
  }

  /**
   * Load configuration from file or return defaults
   */
  async loadConfig(options = {}) {
    const { 
      skipCache = false, 
      includeEnvironment = true,
      autoMigrate = true 
    } = options;
    
    if (this._config && !skipCache) {
      return this._config;
    }

    // Check for migration needs
    if (autoMigrate && await this.migrator.needsMigration()) {
      console.log('Configuration migration required...');
      await this.migrator.migrate();
    }

    try {
      await access(this.configPath);
      const configData = await readFile(this.configPath, 'utf8');
      const userConfig = JSON.parse(configData);
      
      // Use saved configuration as-is, only fill in missing required fields
      this._config = this.fillMissingDefaults(userConfig);
    } catch {
      // Use default configuration
      this._config = this.getDefaultConfig();
    }

    // Apply environment variable overrides
    if (includeEnvironment) {
      const envConfig = EnvironmentLoader.loadEnvironmentConfig();
      this._config = this.deepMerge(this._config, envConfig);
    }

    return this._config;
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config) {
    // Ensure the config has a version number
    const configToSave = {
      version: '1.0.0',
      ...config
    };
    
    this._config = configToSave;
    
    // Ensure config directory exists
    const configDir = join(this.baseDirectory, 'config');
    try {
      await access(configDir);
    } catch {
      const { mkdir } = await import('fs/promises');
      await mkdir(configDir, { recursive: true });
    }

    await writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
  }

  /**
   * Get provider configuration
   */
  async getProviderConfig(provider) {
    const config = await this.loadConfig();
    return config.providers[provider];
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(provider, providerConfig) {
    const config = await this.loadConfig();
    config.providers[provider] = providerConfig;
    await this.saveConfig(config);
  }

  /**
   * Get performance configuration
   */
  async getPerformanceConfig() {
    const config = await this.loadConfig();
    return config.performance;
  }

  /**
   * Update performance configuration
   */
  async updatePerformanceConfig(performanceConfig) {
    const config = await this.loadConfig();
    config.performance = { ...config.performance, ...performanceConfig };
    await this.saveConfig(config);
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    return ConfigValidator.validate(config || this._config);
  }

  /**
   * Merge user config with defaults
   */
  mergeWithDefaults(userConfig) {
    const defaults = this.getDefaultConfig();
    
    return {
      ...defaults,
      ...userConfig,
      providers: {
        ...defaults.providers,
        ...userConfig.providers
      },
      performance: {
        ...defaults.performance,
        ...userConfig.performance
      },
      exclusions: {
        ...defaults.exclusions,
        ...userConfig.exclusions
      },
      storage: {
        ...defaults.storage,
        ...userConfig.storage
      },
      logging: {
        ...defaults.logging,
        ...userConfig.logging
      }
    };
  }

  /**
   * Fill missing required defaults without overriding existing config
   */
  fillMissingDefaults(userConfig) {
    const defaults = this.getDefaultConfig();
    
    return {
      // Only use defaults for missing top-level fields
      defaultProvider: userConfig.defaultProvider || defaults.defaultProvider,
      providers: userConfig.providers || {},
      performance: {
        ...defaults.performance,
        ...userConfig.performance
      },
      exclusions: {
        ...defaults.exclusions,
        ...userConfig.exclusions
      },
      storage: {
        ...defaults.storage,
        ...userConfig.storage
      },
      logging: {
        ...defaults.logging,
        ...userConfig.logging
      }
    };
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      defaultProvider: 'ollama',
      providers: {
        ollama: {
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
          textModel: 'qwen2:1.5b',
          dimensions: 768,
          enabled: true,
          rateLimit: {
            requestsPerMinute: 1000,
            tokensPerMinute: 500000,
            concurrentRequests: 3,
            retry: {
              maxRetries: 2,
              baseDelay: 500,
              maxDelay: 5000,
              jitter: false,
              backoffMultiplier: 2
            }
          }
        },
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
        batchSize: 150,
        memoryLimit: 1024,
        chunkSize: 750,
        chunkOverlap: 150,
        maxFileSize: 1024 * 1024, // 1MB
        adaptiveBatching: true,
        cache: {
          enabled: true,
          maxSize: 200,
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
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults() {
    this._config = this.getDefaultConfig();
    await this.saveConfig(this._config);
    return this._config;
  }

  /**
   * Get configuration for environment variables
   */
  getEnvironmentOverrides() {
    return EnvironmentLoader.loadEnvironmentConfig();
  }

  /**
   * Apply environment overrides to configuration
   */
  async applyEnvironmentOverrides() {
    const config = await this.loadConfig({ includeEnvironment: false });
    const overrides = this.getEnvironmentOverrides();
    
    // Deep merge overrides
    this._config = this.deepMerge(config, overrides);
    return this._config;
  }

  /**
   * Get available environment variables
   */
  getAvailableEnvironmentVariables() {
    return EnvironmentLoader.getAvailableEnvironmentVariables();
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Provider Management Methods

  /**
   * Switch to a different embedding provider
   */
  async switchProvider(providerName, options = {}) {
    if (!this.providerSwitcher) {
      throw new Error('Provider switcher not initialized. IndexStore required.');
    }
    return await this.providerSwitcher.switchProvider(providerName, options);
  }

  /**
   * List available providers
   */
  async listProviders() {
    if (!this.providerSwitcher) {
      // Fallback to basic provider listing
      const config = await this.loadConfig();
      return Object.keys(config.providers).map(name => ({
        name,
        type: config.providers[name].type,
        isDefault: name === config.defaultProvider,
        isEnabled: config.providers[name].enabled !== false
      }));
    }
    return await this.providerSwitcher.listProviders();
  }

  /**
   * Test provider connectivity
   */
  async testProvider(providerName) {
    if (!this.providerSwitcher) {
      throw new Error('Provider switcher not initialized. IndexStore required.');
    }
    return await this.providerSwitcher.testProvider(providerName);
  }

  /**
   * Add a new provider configuration
   */
  async addProvider(name, providerConfig) {
    const config = await this.loadConfig();
    
    // Validate the new provider
    const validation = ConfigValidator.validate({
      defaultProvider: config.defaultProvider,
      providers: { 
        ...config.providers,
        [name]: providerConfig 
      }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
    }
    
    config.providers[name] = providerConfig;
    await this.saveConfig(config);
    
    return { success: true, warnings: validation.warnings };
  }

  /**
   * Remove a provider configuration
   */
  async removeProvider(name) {
    const config = await this.loadConfig();
    
    if (!config.providers[name]) {
      throw new Error(`Provider '${name}' not found`);
    }
    
    // Check if this is the default provider
    if (config.defaultProvider === name) {
      // Check if we have other providers we can switch to
      const otherProviders = Object.keys(config.providers).filter(p => p !== name);
      if (otherProviders.length > 0) {
        // Switch to the first available provider
        config.defaultProvider = otherProviders[0];
        console.log(`Switched default provider from '${name}' to '${otherProviders[0]}'`);
      } else {
        throw new Error(`Cannot remove default provider '${name}' - no other providers available. Add another provider first.`);
      }
    }
    
    console.log(`Before deletion: ${JSON.stringify(config.providers)}`);
    delete config.providers[name];
    console.log(`After deletion: ${JSON.stringify(config.providers)}`);
    await this.saveConfig(config);
    
    return { success: true };
  }

  // Performance Tuning Methods

  /**
   * Update performance settings
   */
  async updatePerformanceSettings(settings) {
    const config = await this.loadConfig();
    
    // Validate performance settings
    const testConfig = {
      ...config,
      performance: { ...config.performance, ...settings }
    };
    
    const validation = this.validateConfig(testConfig);
    if (!validation.valid) {
      throw new Error(`Invalid performance settings: ${validation.errors.join(', ')}`);
    }
    
    config.performance = { ...config.performance, ...settings };
    await this.saveConfig(config);
    
    return { 
      success: true, 
      settings: config.performance,
      warnings: validation.warnings 
    };
  }

  /**
   * Get performance recommendations based on system
   */
  getPerformanceRecommendations() {
    const recommendations = {
      concurrency: 5,
      batchSize: 150,
      memoryLimit: 1024,
      chunkSize: 750,
      chunkOverlap: 150,
      reasoning: []
    };
    
    // Basic system detection (could be enhanced with actual system info)
    const totalMemory = process.memoryUsage().heapTotal / 1024 / 1024; // MB
    
    if (totalMemory > 2048) { // High-end systems (16GB+ RAM)
      recommendations.concurrency = 8;
      recommendations.batchSize = 200;
      recommendations.memoryLimit = 2048;
      recommendations.chunkSize = 1000;
      recommendations.reasoning.push('High-end system detected - maximized concurrency and chunk size for best performance');
    } else if (totalMemory > 1024) { // Mid-range systems (8GB+ RAM)
      recommendations.concurrency = 5;
      recommendations.batchSize = 150;
      recommendations.memoryLimit = 1024;
      recommendations.chunkSize = 750;
      recommendations.reasoning.push('Mid-range system detected - balanced settings for optimal performance');
    } else if (totalMemory < 512) { // Low-end systems (<4GB RAM)
      recommendations.concurrency = 2;
      recommendations.batchSize = 50;
      recommendations.memoryLimit = 256;
      recommendations.chunkSize = 500;
      recommendations.chunkOverlap = 100;
      recommendations.reasoning.push('Low-end system detected - reduced settings for memory efficiency');
    } else {
      recommendations.reasoning.push('Standard system detected - using optimized default settings');
    }
    
    // Add chunk size optimization reasoning
    recommendations.reasoning.push('Smaller chunk size (750) improves indexing speed and search precision');
    recommendations.reasoning.push('Reduced overlap (150) maintains context while minimizing redundancy');
    
    return recommendations;
  }

  /**
   * Auto-tune performance settings
   */
  async autoTunePerformance() {
    const recommendations = this.getPerformanceRecommendations();
    const { reasoning, ...settings } = recommendations;
    
    await this.updatePerformanceSettings(settings);
    
    return {
      success: true,
      appliedSettings: settings,
      reasoning
    };
  }

  // Configuration Management Methods

  /**
   * Export configuration to file
   */
  async exportConfig(filePath) {
    const config = await this.loadConfig({ includeEnvironment: false });
    
    // Remove sensitive information
    const exportConfig = JSON.parse(JSON.stringify(config));
    for (const provider of Object.values(exportConfig.providers)) {
      if (provider.apiKey) {
        provider.apiKey = '[REDACTED]';
      }
    }
    
    await writeFile(filePath, JSON.stringify(exportConfig, null, 2));
    return { success: true, path: filePath };
  }

  /**
   * Import configuration from file
   */
  async importConfig(filePath, options = {}) {
    const { merge = true, validate = true } = options;
    
    try {
      await access(filePath);
    } catch {
      throw new Error(`Configuration file not found: ${filePath}`);
    }
    
    const importData = await readFile(filePath, 'utf8');
    const importConfig = JSON.parse(importData);
    
    if (validate) {
      const validation = this.validateConfig(importConfig);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
    }
    
    let finalConfig;
    if (merge) {
      const currentConfig = await this.loadConfig({ includeEnvironment: false });
      finalConfig = this.deepMerge(currentConfig, importConfig);
    } else {
      finalConfig = importConfig;
    }
    
    await this.saveConfig(finalConfig);
    
    return { success: true, merged: merge };
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(options = {}) {
    const { keepProviders = false, keepPerformance = false } = options;
    
    const currentConfig = keepProviders || keepPerformance 
      ? await this.loadConfig({ includeEnvironment: false })
      : null;
    
    const defaultConfig = this.getDefaultConfig();
    
    if (keepProviders && currentConfig) {
      defaultConfig.providers = currentConfig.providers;
      defaultConfig.defaultProvider = currentConfig.defaultProvider;
    }
    
    if (keepPerformance && currentConfig) {
      defaultConfig.performance = currentConfig.performance;
    }
    
    await this.saveConfig(defaultConfig);
    this._config = defaultConfig;
    
    return { success: true, config: defaultConfig };
  }

  // Migration Methods

  /**
   * Check if migration is needed
   */
  async needsMigration() {
    return await this.migrator.needsMigration();
  }

  /**
   * Perform configuration migration
   */
  async migrate(targetVersion) {
    return await this.migrator.migrate(targetVersion);
  }

  /**
   * List available backups
   */
  async listBackups() {
    return await this.migrator.listBackups();
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupFile) {
    await this.migrator.restoreFromBackup(backupFile);
    this._config = null; // Force reload
    return { success: true };
  }

  // Utility Methods

  /**
   * Get configuration summary
   */
  async getConfigSummary() {
    const config = await this.loadConfig();
    const validation = this.validateConfig(config);
    
    return {
      version: config.version || '1.0.0',
      defaultProvider: config.defaultProvider,
      providersCount: Object.keys(config.providers).length,
      enabledProviders: Object.values(config.providers).filter(p => p.enabled !== false).length,
      performance: {
        concurrency: config.performance.concurrency,
        batchSize: config.performance.batchSize,
        memoryLimit: config.performance.memoryLimit
      },
      validation: {
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      },
      configPath: this.configPath
    };
  }

  /**
   * Check Ollama availability and provide helpful error messages
   */
  async checkOllamaAvailability() {
    const config = await this.loadConfig();
    const ollamaConfig = config.providers?.ollama;
    
    if (!ollamaConfig) {
      return {
        available: false,
        error: 'Ollama provider not configured',
        suggestions: [
          'Configure Ollama: ziri config provider ollama --base-url http://localhost:11434',
          'Or switch to OpenAI: ziri config set defaultProvider openai'
        ]
      };
    }

    const baseUrl = ollamaConfig.baseUrl || 'http://localhost:11434';
    
    try {
      // Test Ollama connectivity with short timeout
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Ollama server responded with error: ${response.status}`,
          suggestions: [
            'Start Ollama: ollama serve',
            'Check Ollama is running: curl http://localhost:11434/api/tags',
            'Install Ollama: https://ollama.ai/download'
          ]
        };
      }

      const data = await response.json();
      const models = data.models || [];
      
      // Check if required models are available
      const hasEmbeddingModel = models.some(m => 
        m.name.includes('all-minilm') || 
        m.name.includes('embed')
      );
      
      const hasTextModel = models.some(m => 
        m.name.includes('qwen2') || 
        (!m.name.includes('embed') && !m.name.includes('all-minilm'))
      );

      if (models.length === 0) {
        return {
          available: false,
          error: 'No models found in Ollama',
          suggestions: [
            'Pull embedding model: ollama pull all-minilm:latest',
            'Pull text model: ollama pull qwen2:1.5b',
            'List available models: ollama list'
          ]
        };
      }

      if (!hasEmbeddingModel) {
        return {
          available: false,
          error: 'No embedding model found in Ollama',
          suggestions: [
            'Pull embedding model: ollama pull nomic-embed-text',
            'Alternative: ollama pull mxbai-embed-large'
          ]
        };
      }

      if (!hasTextModel) {
        return {
          available: false,
          error: 'No text generation model found in Ollama',
          suggestions: [
            'Pull text model: ollama pull qwen2:1.5b',
            'Alternative: ollama pull llama3.2'
          ]
        };
      }

      return {
        available: true,
        models: models.map(m => m.name),
        embeddingModels: models.filter(m => m.name.includes('embed')).map(m => m.name),
        textModels: models.filter(m => !m.name.includes('embed')).map(m => m.name)
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          available: false,
          error: 'Ollama connection timeout',
          suggestions: [
            'Start Ollama: ollama serve',
            'Check if Ollama is running on the correct port',
            'Install Ollama: https://ollama.ai/download'
          ]
        };
      }

      return {
        available: false,
        error: `Cannot connect to Ollama: ${error.message}`,
        suggestions: [
          'Start Ollama: ollama serve',
          'Install Ollama: https://ollama.ai/download',
          'Check firewall settings for port 11434'
        ]
      };
    }
  }

  /**
   * Get graceful fallback provider when Ollama is unavailable
   */
  async getGracefulFallbackProvider() {
    const config = await this.loadConfig();
    
    // Check if OpenAI is configured
    const openaiConfig = config.providers?.openai;
    if (openaiConfig && (process.env.OPENAI_API_KEY || process.env.ZIRI_OPENAI_API_KEY)) {
      return {
        provider: 'openai',
        reason: 'Ollama unavailable, using OpenAI with API key'
      };
    }

    // Check other providers
    for (const [name, providerConfig] of Object.entries(config.providers || {})) {
      if (name === 'ollama') continue;
      
      // Check if provider has required credentials
      const envKey = `${name.toUpperCase()}_API_KEY`;
      const ziriEnvKey = `ZIRI_${envKey}`;
      
      if (process.env[envKey] || process.env[ziriEnvKey]) {
        return {
          provider: name,
          reason: `Ollama unavailable, using ${name} with API key`
        };
      }
    }

    return {
      provider: null,
      reason: 'No fallback providers available - no API keys configured'
    };
  }

  /**
   * Validate and fix common configuration issues
   */
  async validateAndFix() {
    const config = await this.loadConfig({ includeEnvironment: false });
    const validation = this.validateConfig(config);
    const fixes = [];
    
    if (!validation.valid) {
      // Apply automatic fixes where possible
      let modified = false;
      
      // Fix missing or invalid default provider
      if (!config.defaultProvider || !config.providers[config.defaultProvider]) {
        if (Object.keys(config.providers).length > 0) {
          config.defaultProvider = Object.keys(config.providers)[0];
          fixes.push(`Set default provider to '${config.defaultProvider}'`);
          modified = true;
        }
      }
      
      // Fix invalid performance settings
      if (config.performance) {
        if (config.performance.concurrency && config.performance.concurrency > 20) {
          config.performance.concurrency = 20;
          fixes.push('Reduced concurrency to maximum allowed (20)');
          modified = true;
        }
        
        if (config.performance.batchSize && config.performance.batchSize > 1000) {
          config.performance.batchSize = 1000;
          fixes.push('Reduced batch size to maximum allowed (1000)');
          modified = true;
        }
        
        if (config.performance.memoryLimit && config.performance.memoryLimit < 128) {
          config.performance.memoryLimit = 128;
          fixes.push('Increased memory limit to minimum required (128MB)');
          modified = true;
        }
      }
      
      if (modified) {
        await this.saveConfig(config);
        this._config = config;
      }
    }
    
    // Re-validate after fixes
    const finalValidation = this.validateConfig(config);
    
    return {
      success: finalValidation.valid,
      fixes,
      validation: finalValidation
    };
  }
}
