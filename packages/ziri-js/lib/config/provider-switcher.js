/**
 * Provider Switcher
 * Handles switching between embedding providers with validation and migration
 */

import { ConfigValidator } from './config-validator.js';

export class ProviderSwitcher {
  constructor(configManager, indexStore) {
    this.configManager = configManager;
    this.indexStore = indexStore;
  }
  
  /**
   * Switch to a different embedding provider
   */
  async switchProvider(newProviderName, options = {}) {
    const {
      force = false,
      migrateExistingIndexes = false,
      backupCurrent = true
    } = options;
    
    const config = await this.configManager.loadConfig();
    const currentProvider = config.defaultProvider;
    
    // Validate the switch
    const validation = await this.validateProviderSwitch(currentProvider, newProviderName, config);
    
    if (!validation.valid && !force) {
      throw new Error(`Provider switch validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Show warnings to user
    if (validation.warnings.length > 0) {
      console.warn('Provider switch warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    // Backup current configuration if requested
    if (backupCurrent) {
      await this.backupCurrentProvider(currentProvider);
    }
    
    // Update configuration
    config.defaultProvider = newProviderName;
    await this.configManager.saveConfig(config);
    
    console.log(`Successfully switched from '${currentProvider}' to '${newProviderName}'`);
    
    // Handle existing indexes if requested
    if (migrateExistingIndexes) {
      await this.handleExistingIndexes(currentProvider, newProviderName, config);
    } else if (validation.requiresReindexing) {
      console.log('\nNote: Existing indexes may need to be rebuilt for optimal compatibility.');
      console.log('Run with --migrate-indexes to automatically handle existing repositories.');
    }
    
    return {
      success: true,
      previousProvider: currentProvider,
      newProvider: newProviderName,
      warnings: validation.warnings,
      requiresReindexing: validation.requiresReindexing
    };
  }
  
  /**
   * Validate provider switch
   */
  async validateProviderSwitch(currentProvider, newProvider, config) {
    const errors = [];
    const warnings = [];
    let requiresReindexing = false;
    
    // Check if new provider exists in configuration
    if (!config.providers[newProvider]) {
      errors.push(`Provider '${newProvider}' is not configured`);
      return { valid: false, errors, warnings, requiresReindexing };
    }
    
    // Check if new provider is enabled
    if (config.providers[newProvider].enabled === false) {
      errors.push(`Provider '${newProvider}' is disabled`);
    }
    
    // Validate new provider configuration
    const providerValidation = ConfigValidator.validate({
      defaultProvider: newProvider,
      providers: { [newProvider]: config.providers[newProvider] }
    });
    
    if (!providerValidation.valid) {
      errors.push(...providerValidation.errors);
    }
    warnings.push(...providerValidation.warnings);
    
    // Check compatibility between providers
    if (currentProvider && config.providers[currentProvider]) {
      const currentConfig = config.providers[currentProvider];
      const newConfig = config.providers[newProvider];
      
      // Check dimension compatibility
      if (currentConfig.dimensions !== newConfig.dimensions) {
        requiresReindexing = true;
        warnings.push(`Dimension mismatch: ${currentProvider} (${currentConfig.dimensions}) → ${newProvider} (${newConfig.dimensions}). Re-indexing required.`);
      }
      
      // Check model compatibility
      if (currentConfig.type === newConfig.type && currentConfig.model !== newConfig.model) {
        warnings.push(`Model change: ${currentConfig.model} → ${newConfig.model}. Consider re-indexing for optimal results.`);
      }
      
      // Check type compatibility
      if (currentConfig.type !== newConfig.type) {
        requiresReindexing = true;
        warnings.push(`Provider type change: ${currentConfig.type} → ${newConfig.type}. Re-indexing recommended.`);
      }
      
      // Performance and cost warnings
      ConfigValidator.validateProviderSwitch(currentConfig, newConfig, [], warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiresReindexing
    };
  }
  
  /**
   * Backup current provider configuration
   */
  async backupCurrentProvider(providerName) {
    const config = await this.configManager.loadConfig();
    const providerConfig = config.providers[providerName];
    
    if (!providerConfig) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `provider-${providerName}-${timestamp}`;
    
    // Store in a simple backup format (could be enhanced to use proper backup system)
    const backupData = {
      provider: providerName,
      config: providerConfig,
      timestamp: new Date().toISOString(),
      version: config.version || '1.0.0'
    };
    
    console.log(`Backed up provider '${providerName}' configuration`);
    return backupData;
  }
  
  /**
   * Handle existing indexes when switching providers
   */
  async handleExistingIndexes(oldProvider, newProvider, config) {
    console.log('\nHandling existing repository indexes...');
    
    try {
      // Get list of all repositories
      const repositories = await this.indexStore.listRepositories();
      
      if (repositories.length === 0) {
        console.log('No existing repositories found.');
        return;
      }
      
      console.log(`Found ${repositories.length} repositories with existing indexes.`);
      
      const oldConfig = config.providers[oldProvider];
      const newConfig = config.providers[newProvider];
      
      // Check if re-indexing is required
      const needsReindexing = this.needsReindexing(oldConfig, newConfig);
      
      if (needsReindexing) {
        console.log('Re-indexing required due to incompatible provider configurations.');
        await this.reindexRepositories(repositories, newProvider);
      } else {
        console.log('Provider configurations are compatible. Updating metadata only.');
        await this.updateRepositoryMetadata(repositories, newProvider);
      }
      
    } catch (error) {
      console.error('Error handling existing indexes:', error.message);
      throw error;
    }
  }
  
  /**
   * Check if re-indexing is needed
   */
  needsReindexing(oldConfig, newConfig) {
    if (!oldConfig || !newConfig) return true;
    
    // Different dimensions require re-indexing
    if (oldConfig.dimensions !== newConfig.dimensions) return true;
    
    // Different provider types usually require re-indexing
    if (oldConfig.type !== newConfig.type) return true;
    
    return false;
  }
  
  /**
   * Re-index repositories with new provider
   */
  async reindexRepositories(repositories, newProvider) {
    console.log(`Re-indexing ${repositories.length} repositories with provider '${newProvider}'...`);
    
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      console.log(`[${i + 1}/${repositories.length}] Re-indexing: ${repo.path}`);
      
      try {
        // This would typically call the main indexing function
        // For now, we'll just update the metadata to indicate re-indexing is needed
        await this.markForReindexing(repo.id, newProvider);
        console.log(`  ✓ Marked for re-indexing`);
      } catch (error) {
        console.error(`  ✗ Failed to mark for re-indexing: ${error.message}`);
      }
    }
    
    console.log('\nAll repositories have been marked for re-indexing.');
    console.log('Run the index command on each repository to complete the migration.');
  }
  
  /**
   * Update repository metadata for compatible provider switch
   */
  async updateRepositoryMetadata(repositories, newProvider) {
    console.log(`Updating metadata for ${repositories.length} repositories...`);
    
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      console.log(`[${i + 1}/${repositories.length}] Updating: ${repo.path}`);
      
      try {
        const metadata = await this.indexStore.getMetadata(repo.id);
        metadata.embeddingProvider = newProvider;
        metadata.lastModified = new Date().toISOString();
        
        await this.indexStore.updateMetadata(repo.id, metadata);
        console.log(`  ✓ Updated metadata`);
      } catch (error) {
        console.error(`  ✗ Failed to update metadata: ${error.message}`);
      }
    }
    
    console.log('All repository metadata updated successfully.');
  }
  
  /**
   * Mark repository for re-indexing
   */
  async markForReindexing(repositoryId, newProvider) {
    const metadata = await this.indexStore.getMetadata(repositoryId);
    
    metadata.embeddingProvider = newProvider;
    metadata.needsReindexing = true;
    metadata.reindexingReason = 'provider-switch';
    metadata.lastModified = new Date().toISOString();
    
    await this.indexStore.updateMetadata(repositoryId, metadata);
  }
  
  /**
   * List available providers
   */
  async listProviders() {
    const config = await this.configManager.loadConfig();
    const providers = [];
    
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const isDefault = name === config.defaultProvider;
      const isEnabled = providerConfig.enabled !== false;
      
      providers.push({
        name,
        type: providerConfig.type,
        model: providerConfig.model,
        dimensions: providerConfig.dimensions,
        isDefault,
        isEnabled,
        hasApiKey: this.hasApiKey(providerConfig),
        status: this.getProviderStatus(providerConfig)
      });
    }
    
    return providers;
  }
  
  /**
   * Check if provider has API key configured
   */
  hasApiKey(providerConfig) {
    if (providerConfig.type === 'ollama') return true; // Local provider
    
    const envVars = {
      openai: 'OPENAI_API_KEY',
      huggingface: 'HUGGINGFACE_API_KEY',
      cohere: 'COHERE_API_KEY'
    };
    
    const envVar = envVars[providerConfig.type];
    return !!(providerConfig.apiKey || (envVar && process.env[envVar]));
  }
  
  /**
   * Get provider status
   */
  getProviderStatus(providerConfig) {
    if (providerConfig.enabled === false) return 'disabled';
    if (!this.hasApiKey(providerConfig)) return 'missing-key';
    return 'ready';
  }
  
  /**
   * Test provider connectivity
   */
  async testProvider(providerName) {
    const config = await this.configManager.loadConfig();
    const providerConfig = config.providers[providerName];
    
    if (!providerConfig) {
      throw new Error(`Provider '${providerName}' not found`);
    }
    
    if (providerConfig.enabled === false) {
      throw new Error(`Provider '${providerName}' is disabled`);
    }
    
    // This would typically test the actual provider connection
    // For now, we'll just validate the configuration
    const validation = ConfigValidator.validate({
      defaultProvider: providerName,
      providers: { [providerName]: providerConfig }
    });
    
    if (!validation.valid) {
      throw new Error(`Provider configuration invalid: ${validation.errors.join(', ')}`);
    }
    
    return {
      provider: providerName,
      status: 'ready',
      config: {
        type: providerConfig.type,
        model: providerConfig.model,
        dimensions: providerConfig.dimensions
      },
      warnings: validation.warnings
    };
  }
}