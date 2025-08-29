/**
 * Configuration Management System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, rmdir, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { ConfigManager } from '../../lib/config/config-manager.js';
import { EnvironmentLoader } from '../../lib/config/environment-loader.js';
import { ConfigValidator } from '../../lib/config/config-validator.js';
import { ConfigMigrator } from '../../lib/config/config-migrator.js';
import { ProviderSwitcher } from '../../lib/config/provider-switcher.js';

describe('Configuration Management System', () => {
  let testDir;
  let configManager;
  let mockIndexStore;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = join(tmpdir(), `ziri-config-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    // Mock IndexStore
    mockIndexStore = {
      listRepositories: () => Promise.resolve([]),
      getMetadata: () => Promise.resolve({}),
      updateMetadata: () => Promise.resolve()
    };
    
    configManager = new ConfigManager(testDir, mockIndexStore);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rmdir(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ConfigManager', () => {
    it('should load default configuration', async () => {
      const config = await configManager.loadConfig();
      
      expect(config).toBeDefined();
      expect(config.defaultProvider).toBe('ollama');
      expect(config.providers).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.exclusions).toBeDefined();
    }, 10000);

    it('should save and load configuration', async () => {
      const testConfig = {
        defaultProvider: 'test-provider',
        providers: {
          'test-provider': {
            type: 'openai',
            model: 'test-model',
            dimensions: 1536
          }
        },
        performance: {
          concurrency: 5,
          batchSize: 200
        }
      };

      await configManager.saveConfig(testConfig);
      
      // Clear cache and reload
      configManager._config = null;
      const loadedConfig = await configManager.loadConfig({ includeEnvironment: false });
      
      expect(loadedConfig.defaultProvider).toBe('test-provider');
      expect(loadedConfig.providers['test-provider']).toBeDefined();
      expect(loadedConfig.performance.concurrency).toBe(5);
    }, 10000);

    it('should validate configuration', async () => {
      const validConfig = {
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768
          }
        }
      };

      const validation = configManager.validateConfig(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    }, 5000);

    it('should detect invalid configuration', async () => {
      const invalidConfig = {
        defaultProvider: 'nonexistent',
        providers: {
          openai: {
            // Missing required fields
          }
        }
      };

      const validation = configManager.validateConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    }, 5000);

    it('should merge environment variables', async () => {
      // Set test environment variables
      process.env.ZIRI_DEFAULT_PROVIDER = 'test-env-provider';
      process.env.ZIRI_CONCURRENCY = '10';
      process.env.OPENAI_API_KEY = 'test-key';

      const config = await configManager.loadConfig();
      
      expect(config.defaultProvider).toBe('test-env-provider');
      expect(config.performance.concurrency).toBe(10);
      expect(config.providers.openai.apiKey).toBe('test-key');

      // Clean up
      delete process.env.ZIRI_DEFAULT_PROVIDER;
      delete process.env.ZIRI_CONCURRENCY;
      delete process.env.OPENAI_API_KEY;
    }, 10000);

    it('should add and remove providers', async () => {
      const newProvider = {
        type: 'ollama',
        model: 'llama2',
        dimensions: 4096,
        baseUrl: 'http://localhost:11434'
      };

      await configManager.addProvider('ollama', newProvider);
      
      let config = await configManager.loadConfig({ skipCache: true });
      expect(config.providers.ollama).toBeDefined();
      expect(config.providers.ollama.model).toBe('llama2');

      await configManager.removeProvider('ollama');
      
      config = await configManager.loadConfig({ skipCache: true });
      expect(config.providers.ollama).toBeUndefined();
    }, 15000);

    it('should update performance settings', async () => {
      const newSettings = {
        concurrency: 8,
        batchSize: 150,
        memoryLimit: 1024
      };

      const result = await configManager.updatePerformanceSettings(newSettings);
      
      expect(result.success).toBe(true);
      expect(result.settings.concurrency).toBe(8);
      expect(result.settings.batchSize).toBe(150);
      expect(result.settings.memoryLimit).toBe(1024);
    }, 10000);

    it('should get performance recommendations', () => {
      const recommendations = configManager.getPerformanceRecommendations();
      
      expect(recommendations).toBeDefined();
      expect(recommendations.concurrency).toBeGreaterThan(0);
      expect(recommendations.batchSize).toBeGreaterThan(0);
      expect(recommendations.memoryLimit).toBeGreaterThan(0);
      expect(Array.isArray(recommendations.reasoning)).toBe(true);
    }, 5000);

    it('should export and import configuration', async () => {
      const exportPath = join(testDir, 'exported-config.json');
      
      // Export configuration
      await configManager.exportConfig(exportPath);
      
      // Verify export file exists and contains data
      const exportedData = await readFile(exportPath, 'utf8');
      const exportedConfig = JSON.parse(exportedData);
      
      expect(exportedConfig.defaultProvider).toBeDefined();
      expect(exportedConfig.providers).toBeDefined();
      
      // Modify current config
      await configManager.updatePerformanceSettings({ concurrency: 99 });
      
      // Import the exported config
      await configManager.importConfig(exportPath);
      
      const config = await configManager.loadConfig({ skipCache: true });
      expect(config.performance.concurrency).not.toBe(99);
    }, 15000);

    it('should reset to defaults', async () => {
      // Modify configuration
      await configManager.updatePerformanceSettings({ concurrency: 99 });
      
      // Reset to defaults
      await configManager.resetToDefaults();
      
      const config = await configManager.loadConfig({ skipCache: true });
      expect(config.performance.concurrency).toBe(3); // Default value
    }, 10000);

    it('should get configuration summary', async () => {
      const summary = await configManager.getConfigSummary();
      
      expect(summary.version).toBeDefined();
      expect(summary.defaultProvider).toBeDefined();
      expect(summary.providersCount).toBeGreaterThan(0);
      expect(summary.performance).toBeDefined();
      expect(summary.validation).toBeDefined();
    }, 10000);
  });

  describe('EnvironmentLoader', () => {
    it('should load environment configuration', () => {
      process.env.ZIRI_CONCURRENCY = '5';
      process.env.ZIRI_BATCH_SIZE = '100';
      process.env.OPENAI_API_KEY = 'test-key';
      
      const envConfig = EnvironmentLoader.loadEnvironmentConfig();
      
      expect(envConfig.performance.concurrency).toBe(5);
      expect(envConfig.performance.batchSize).toBe(100);
      expect(envConfig.providers.openai.apiKey).toBe('test-key');
      
      // Clean up
      delete process.env.ZIRI_CONCURRENCY;
      delete process.env.ZIRI_BATCH_SIZE;
      delete process.env.OPENAI_API_KEY;
    }, 5000);

    it('should handle boolean environment variables', () => {
      process.env.ZIRI_ADAPTIVE_BATCHING = 'true';
      process.env.ZIRI_FILE_LOGGING = 'false';
      
      const envConfig = EnvironmentLoader.loadEnvironmentConfig();
      
      expect(envConfig.performance.adaptiveBatching).toBe(true);
      expect(envConfig.logging.fileLogging).toBe(false);
      
      // Clean up
      delete process.env.ZIRI_ADAPTIVE_BATCHING;
      delete process.env.ZIRI_FILE_LOGGING;
    });

    it('should get available environment variables', () => {
      const vars = EnvironmentLoader.getAvailableEnvironmentVariables();
      
      expect(vars.core).toBeDefined();
      expect(vars.performance).toBeDefined();
      expect(vars.providers).toBeDefined();
      expect(vars.logging).toBeDefined();
      expect(vars.storage).toBeDefined();
    });
  });

  describe('ConfigValidator', () => {
    it('should validate complete configuration', () => {
      const config = {
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768,
            baseUrl: 'http://localhost:11434'
          }
        },
        performance: {
          concurrency: 3,
          batchSize: 100,
          memoryLimit: 512
        }
      };

      const validation = ConfigValidator.validate(config);
      expect(validation.valid).toBe(true);
    });

    it('should detect provider configuration errors', () => {
      const config = {
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'invalid-type',
            // Missing model and dimensions
          }
        }
      };

      const validation = ConfigValidator.validate(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('invalid type'))).toBe(true);
      expect(validation.errors.some(e => e.includes('missing \'model\''))).toBe(true);
    });

    it('should validate performance settings', () => {
      const config = {
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768
          }
        },
        performance: {
          concurrency: -1, // Invalid
          batchSize: 2000, // Too high
          memoryLimit: 50 // Too low
        }
      };

      const validation = ConfigValidator.validate(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('concurrency'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('batchSize'))).toBe(true);
      expect(validation.errors.some(e => e.includes('memoryLimit'))).toBe(true);
    });

    it('should validate provider switching', () => {
      const fromProvider = {
        type: 'ollama',
        dimensions: 768,
        model: 'nomic-embed-text'
      };
      
      const toProvider = {
        type: 'openai',
        dimensions: 1536,
        model: 'text-embedding-3-small'
      };

      const errors = [];
      const warnings = [];
      
      ConfigValidator.validateProviderSwitch(fromProvider, toProvider, errors, warnings);
      
      expect(warnings.some(w => w.includes('Dimension mismatch'))).toBe(true);
    });
  });

  describe('ConfigMigrator', () => {
    let migrator;

    beforeEach(() => {
      migrator = new ConfigMigrator(testDir);
    });

    it('should detect when migration is needed', async () => {
      // Create old version config
      const configDir = join(testDir, 'config');
      await mkdir(configDir, { recursive: true });
      
      const oldConfig = {
        version: '0.1.0',
        defaultProvider: 'ollama'
      };
      
      await writeFile(join(configDir, 'ziri.json'), JSON.stringify(oldConfig));
      
      const needsMigration = await migrator.needsMigration('1.0.0');
      expect(needsMigration).toBe(true);
    });

    it('should perform migration', async () => {
      // Create old version config
      const configDir = join(testDir, 'config');
      await mkdir(configDir, { recursive: true });
      
      const oldConfig = {
        version: '0.1.0',
        defaultProvider: 'ollama',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768
          }
        }
      };
      
      await writeFile(join(configDir, 'ziri.json'), JSON.stringify(oldConfig));
      
      const migratedConfig = await migrator.migrate('1.0.0');
      
      expect(migratedConfig.version).toBe('1.0.0');
      expect(migratedConfig.providers.openai.rateLimit).toBeDefined();
    });

    it('should create backups during migration', async () => {
      // Create old version config
      const configDir = join(testDir, 'config');
      await mkdir(configDir, { recursive: true });
      
      const oldConfig = {
        version: '0.1.0',
        defaultProvider: 'ollama'
      };
      
      await writeFile(join(configDir, 'ziri.json'), JSON.stringify(oldConfig));
      
      await migrator.migrate('1.0.0');
      
      const backups = await migrator.listBackups();
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0].version).toBe('0.1.0');
    });
  });

  describe('ProviderSwitcher', () => {
    let providerSwitcher;

    beforeEach(() => {
      providerSwitcher = new ProviderSwitcher(configManager, mockIndexStore);
    });

    it('should list available providers', async () => {
      const providers = await providerSwitcher.listProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0]).toHaveProperty('name');
      expect(providers[0]).toHaveProperty('type');
      expect(providers[0]).toHaveProperty('isDefault');
    });

    it('should validate provider switch', async () => {
      const config = await configManager.loadConfig();
      
      const validation = await providerSwitcher.validateProviderSwitch(
        'openai',
        'openai', // Same provider
        config
      );
      
      expect(validation.valid).toBe(true);
    });

    it('should detect incompatible provider switches', async () => {
      // Add a test provider with different dimensions
      await configManager.addProvider('test-provider', {
        type: 'ollama',
        model: 'test',
        dimensions: 4096
      });
      
      const config = await configManager.loadConfig({ skipCache: true });
      
      const validation = await providerSwitcher.validateProviderSwitch(
        'openai',
        'test-provider',
        config
      );
      
      expect(validation.requiresReindexing).toBe(true);
      expect(validation.warnings.some(w => w.includes('Dimension mismatch'))).toBe(true);
    });

    it('should test provider configuration', async () => {
      const result = await providerSwitcher.testProvider('openai');
      
      expect(result.provider).toBe('openai');
      expect(result.status).toBe('ready');
      expect(result.config).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete configuration workflow', async () => {
      // 1. Load initial configuration
      let config = await configManager.loadConfig();
      expect(config.defaultProvider).toBe('ollama');
      
      // 2. Add new provider
      await configManager.addProvider('ollama', {
        type: 'ollama',
        model: 'llama2',
        dimensions: 4096,
        baseUrl: 'http://localhost:11434'
      });
      
      // 3. Update performance settings
      await configManager.updatePerformanceSettings({
        concurrency: 5,
        batchSize: 150
      });
      
      // 4. Switch provider
      const switchResult = await configManager.switchProvider('ollama');
      expect(switchResult.success).toBe(true);
      
      // 5. Validate final configuration
      config = await configManager.loadConfig({ skipCache: true });
      const validation = configManager.validateConfig(config);
      
      expect(validation.valid).toBe(true);
      expect(config.defaultProvider).toBe('ollama');
      expect(config.performance.concurrency).toBe(5);
    });

    it('should handle environment variable overrides', async () => {
      // Set environment variables
      process.env.ZIRI_DEFAULT_PROVIDER = 'test-env';
      process.env.ZIRI_CONCURRENCY = '7';
      process.env.OPENAI_API_KEY = 'env-key';
      
      // Add the test provider
      await configManager.addProvider('test-env', {
        type: 'openai',
        model: 'test',
        dimensions: 1536
      });
      
      const config = await configManager.loadConfig({ skipCache: true });
      
      expect(config.defaultProvider).toBe('test-env');
      expect(config.performance.concurrency).toBe(7);
      expect(config.providers.openai.apiKey).toBe('env-key');
      
      // Clean up
      delete process.env.ZIRI_DEFAULT_PROVIDER;
      delete process.env.ZIRI_CONCURRENCY;
      delete process.env.OPENAI_API_KEY;
    });

    it('should validate and fix configuration issues', async () => {
      // Create invalid configuration
      const invalidConfig = {
        defaultProvider: 'nonexistent',
        providers: {
          ollama: {
            type: 'ollama',
            model: 'nomic-embed-text',
            dimensions: 768
          }
        },
        performance: {
          concurrency: 50, // Too high
          memoryLimit: 50 // Too low
        }
      };
      
      await configManager.saveConfig(invalidConfig);
      configManager._config = null;
      
      const result = await configManager.validateAndFix();
      
      expect(result.fixes.length).toBeGreaterThan(0);
      
      const config = await configManager.loadConfig({ skipCache: true });
      expect(config.defaultProvider).toBe('ollama'); // Should be fixed
      expect(config.performance.concurrency).toBeLessThanOrEqual(20); // Should be capped
      expect(config.performance.memoryLimit).toBeGreaterThanOrEqual(128); // Should be increased
    });
  });
});