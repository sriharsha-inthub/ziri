/**
 * Configuration Migrator
 * Handles migration and upgrade of configuration files between versions
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';

export class ConfigMigrator {
  constructor(baseDirectory) {
    this.baseDirectory = baseDirectory;
    this.configPath = join(baseDirectory, 'config', 'ziri.json');
    this.backupPath = join(baseDirectory, 'config', 'backups');
  }
  
  /**
   * Get current configuration version
   */
  async getCurrentVersion() {
    try {
      await access(this.configPath);
      const configData = await readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      return config.version || '0.1.0';
    } catch {
      return null; // No config file exists
    }
  }
  
  /**
   * Check if migration is needed
   */
  async needsMigration(targetVersion = '1.0.0') {
    const currentVersion = await this.getCurrentVersion();
    if (!currentVersion) return false;
    
    return this.compareVersions(currentVersion, targetVersion) < 0;
  }
  
  /**
   * Perform migration to target version
   */
  async migrate(targetVersion = '1.0.0') {
    const currentVersion = await this.getCurrentVersion();
    
    if (!currentVersion) {
      throw new Error('No configuration file found to migrate');
    }
    
    console.log(`Migrating configuration from v${currentVersion} to v${targetVersion}`);
    
    // Create backup before migration
    await this.createBackup(currentVersion);
    
    // Load current configuration
    const configData = await readFile(this.configPath, 'utf8');
    let config = JSON.parse(configData);
    
    // Apply migrations in sequence
    config = await this.applyMigrations(config, currentVersion, targetVersion);
    
    // Update version
    config.version = targetVersion;
    
    // Save migrated configuration
    await writeFile(this.configPath, JSON.stringify(config, null, 2));
    
    console.log(`Configuration successfully migrated to v${targetVersion}`);
    return config;
  }
  
  /**
   * Create backup of current configuration
   */
  async createBackup(version) {
    const { mkdir } = await import('fs/promises');
    
    try {
      await mkdir(this.backupPath, { recursive: true });
    } catch {
      // Directory already exists
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(this.backupPath, `ziri-v${version}-${timestamp}.json`);
    
    const configData = await readFile(this.configPath, 'utf8');
    await writeFile(backupFile, configData);
    
    console.log(`Configuration backed up to: ${backupFile}`);
  }
  
  /**
   * Apply migrations in sequence
   */
  async applyMigrations(config, fromVersion, toVersion) {
    const migrations = this.getMigrationChain(fromVersion, toVersion);
    
    let currentConfig = { ...config };
    
    for (const migration of migrations) {
      console.log(`Applying migration: ${migration.from} → ${migration.to}`);
      currentConfig = await migration.migrate(currentConfig);
    }
    
    return currentConfig;
  }
  
  /**
   * Get chain of migrations needed
   */
  getMigrationChain(fromVersion, toVersion) {
    const migrations = [];
    
    // Define migration steps
    const migrationSteps = [
      {
        from: '0.1.0',
        to: '0.2.0',
        migrate: this.migrateFrom010To020.bind(this)
      },
      {
        from: '0.2.0',
        to: '0.3.0',
        migrate: this.migrateFrom020To030.bind(this)
      },
      {
        from: '0.3.0',
        to: '1.0.0',
        migrate: this.migrateFrom030To100.bind(this)
      }
    ];
    
    // Find applicable migrations
    let currentVersion = fromVersion;
    
    while (this.compareVersions(currentVersion, toVersion) < 0) {
      const migration = migrationSteps.find(m => m.from === currentVersion);
      
      if (!migration) {
        throw new Error(`No migration path found from ${currentVersion} to ${toVersion}`);
      }
      
      migrations.push(migration);
      currentVersion = migration.to;
    }
    
    return migrations;
  }
  
  /**
   * Migration from 0.1.0 to 0.2.0
   * - Add provider rate limiting configuration
   * - Add performance cache settings
   * - Add missing default providers
   */
  async migrateFrom010To020(config) {
    const migrated = { ...config };
    
    // Add missing default providers
    const defaultProviders = {
      ollama: {
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
        textModel: 'qwen2:1.5b',
        dimensions: 768,
        enabled: true,
        rateLimit: this.getDefaultRateLimit('ollama')
      },
      openai: {
        type: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        maxTokens: 8192,
        rateLimit: this.getDefaultRateLimit('openai'),
        enabled: true
      }
    };
    
    if (!migrated.providers) {
      migrated.providers = {};
    }
    
    // Add missing default providers
    for (const [name, providerConfig] of Object.entries(defaultProviders)) {
      if (!migrated.providers[name]) {
        migrated.providers[name] = providerConfig;
      }
    }
    
    // Add rate limiting to existing providers
    for (const [name, provider] of Object.entries(migrated.providers)) {
      if (!provider.rateLimit) {
        provider.rateLimit = this.getDefaultRateLimit(provider.type);
      }
    }
    
    // Add cache settings to performance
    if (migrated.performance && !migrated.performance.cache) {
      migrated.performance.cache = {
        enabled: true,
        maxSize: 100,
        ttl: 3600,
        type: 'memory'
      };
    }
    
    return migrated;
  }
  
  /**
   * Migration from 0.2.0 to 0.3.0
   * - Add storage compression settings
   * - Add logging configuration
   * - Restructure exclusions
   */
  async migrateFrom020To030(config) {
    const migrated = { ...config };
    
    // Add storage compression
    if (migrated.storage && !migrated.storage.compression) {
      migrated.storage.compression = {
        enabled: true,
        algorithm: 'gzip',
        level: 6
      };
    }
    
    // Add logging configuration
    if (!migrated.logging) {
      migrated.logging = {
        level: 'info',
        fileLogging: false,
        maxFileSize: 10,
        maxFiles: 5,
        performanceLogging: false,
        apiLogging: false
      };
    }
    
    // Restructure exclusions if needed
    if (migrated.exclusions && Array.isArray(migrated.exclusions)) {
      migrated.exclusions = {
        patterns: migrated.exclusions,
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
        maxFileSize: 1024 * 1024,
        minFileSize: 10
      };
    }
    
    return migrated;
  }
  
  /**
   * Migration from 0.3.0 to 1.0.0
   * - Add backup and cleanup settings
   * - Add retry configuration with jitter
   * - Add adaptive batching settings
   */
  async migrateFrom030To100(config) {
    const migrated = { ...config };
    
    // Add backup settings to storage
    if (migrated.storage && !migrated.storage.backup) {
      migrated.storage.backup = {
        enabled: false,
        interval: 24,
        maxBackups: 7
      };
    }
    
    // Add cleanup settings to storage
    if (migrated.storage && !migrated.storage.cleanup) {
      migrated.storage.cleanup = {
        enabled: true,
        maxAge: 30,
        maxSize: 1024
      };
    }
    
    // Add jitter to retry configurations
    if (migrated.providers) {
      for (const provider of Object.values(migrated.providers)) {
        if (provider.rateLimit && provider.rateLimit.retry && !provider.rateLimit.retry.hasOwnProperty('jitter')) {
          provider.rateLimit.retry.jitter = true;
        }
      }
    }
    
    // Add adaptive batching to performance
    if (migrated.performance && !migrated.performance.hasOwnProperty('adaptiveBatching')) {
      migrated.performance.adaptiveBatching = true;
    }
    
    return migrated;
  }
  
  /**
   * Get default rate limit configuration for provider type
   */
  getDefaultRateLimit(providerType) {
    const defaults = {
      openai: {
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
      ollama: {
        requestsPerMinute: 60,
        concurrentRequests: 2,
        retry: {
          maxRetries: 2,
          baseDelay: 500,
          maxDelay: 5000,
          jitter: true,
          backoffMultiplier: 2
        }
      },
      huggingface: {
        requestsPerMinute: 1000,
        tokensPerMinute: 300000,
        concurrentRequests: 3,
        retry: {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 60000,
          jitter: true,
          backoffMultiplier: 2
        }
      },
      cohere: {
        requestsPerMinute: 1000,
        tokensPerMinute: 1000000,
        concurrentRequests: 4,
        retry: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 30000,
          jitter: true,
          backoffMultiplier: 2
        }
      }
    };
    
    return defaults[providerType] || defaults.openai;
  }
  
  /**
   * Compare version strings
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }
  
  /**
   * List available backups
   */
  async listBackups() {
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.backupPath);
      
      return files
        .filter(file => file.startsWith('ziri-v') && file.endsWith('.json'))
        .map(file => {
          const match = file.match(/ziri-v(.+?)-(.+)\.json/);
          return {
            file,
            version: match ? match[1] : 'unknown',
            timestamp: match ? match[2] : 'unknown',
            path: join(this.backupPath, file)
          };
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch {
      return [];
    }
  }
  
  /**
   * Restore from backup
   */
  async restoreFromBackup(backupFile) {
    const backupPath = join(this.backupPath, backupFile);
    
    try {
      await access(backupPath);
    } catch {
      throw new Error(`Backup file not found: ${backupFile}`);
    }
    
    // Create backup of current config before restoring
    const currentVersion = await this.getCurrentVersion();
    if (currentVersion) {
      await this.createBackup(`${currentVersion}-pre-restore`);
    }
    
    // Restore from backup
    const backupData = await readFile(backupPath, 'utf8');
    await writeFile(this.configPath, backupData);
    
    console.log(`Configuration restored from backup: ${backupFile}`);
  }
}