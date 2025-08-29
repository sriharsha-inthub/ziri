/**
 * Configuration Management System Demo
 * Demonstrates the comprehensive configuration management capabilities
 */

import { ConfigManager } from '../lib/config/config-manager.js';
import { EnvironmentLoader } from '../lib/config/environment-loader.js';

async function demonstrateConfigManagement() {
  console.log('🔧 Ziri Configuration Management Demo\n');

  // Initialize configuration manager
  const configManager = new ConfigManager();

  try {
    // 1. Load and display current configuration
    console.log('📋 Loading current configuration...');
    const config = await configManager.loadConfig();
    console.log(`Default provider: ${config.defaultProvider}`);
    console.log(`Configured providers: ${Object.keys(config.providers).join(', ')}`);
    console.log(`Performance settings: concurrency=${config.performance.concurrency}, batchSize=${config.performance.batchSize}\n`);

    // 2. Display configuration summary
    console.log('📊 Configuration Summary:');
    const summary = await configManager.getConfigSummary();
    console.log(`Version: ${summary.version}`);
    console.log(`Providers: ${summary.enabledProviders}/${summary.providersCount} enabled`);
    console.log(`Validation: ${summary.validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    if (summary.validation.errorCount > 0) {
      console.log(`Errors: ${summary.validation.errorCount}`);
    }
    if (summary.validation.warningCount > 0) {
      console.log(`Warnings: ${summary.validation.warningCount}`);
    }
    console.log();

    // 3. Demonstrate environment variable support
    console.log('🌍 Environment Variable Support:');
    const envVars = configManager.getAvailableEnvironmentVariables();
    console.log('Available environment variables:');
    console.log(`Core: ${envVars.core.join(', ')}`);
    console.log(`Performance: ${envVars.performance.join(', ')}`);
    console.log(`OpenAI: ${envVars.providers.openai.join(', ')}`);
    console.log();

    // 4. Add a new provider
    console.log('➕ Adding new provider (Ollama)...');
    try {
      await configManager.addProvider('ollama', {
        type: 'ollama',
        model: 'llama2',
        dimensions: 4096,
        baseUrl: 'http://localhost:11434',
        enabled: true,
        rateLimit: {
          requestsPerMinute: 60,
          concurrentRequests: 2,
          retry: {
            maxRetries: 2,
            baseDelay: 500,
            maxDelay: 5000,
            jitter: true,
            backoffMultiplier: 2
          }
        }
      });
      console.log('✅ Ollama provider added successfully\n');
    } catch (error) {
      console.log(`⚠️ Provider already exists or error: ${error.message}\n`);
    }

    // 5. List all providers
    console.log('📋 Available Providers:');
    const providers = await configManager.listProviders();
    providers.forEach(provider => {
      const status = provider.isEnabled ? '🟢' : '🔴';
      const defaultMark = provider.isDefault ? ' (default)' : '';
      console.log(`${status} ${provider.name} (${provider.type})${defaultMark}`);
    });
    console.log();

    // 6. Performance tuning
    console.log('⚡ Performance Tuning:');
    const recommendations = configManager.getPerformanceRecommendations();
    console.log('Recommended settings:');
    console.log(`Concurrency: ${recommendations.concurrency}`);
    console.log(`Batch Size: ${recommendations.batchSize}`);
    console.log(`Memory Limit: ${recommendations.memoryLimit}MB`);
    console.log('Reasoning:');
    recommendations.reasoning.forEach(reason => console.log(`  - ${reason}`));
    console.log();

    // 7. Update performance settings
    console.log('🔧 Updating performance settings...');
    const performanceResult = await configManager.updatePerformanceSettings({
      concurrency: recommendations.concurrency,
      batchSize: recommendations.batchSize,
      adaptiveBatching: true
    });
    
    if (performanceResult.success) {
      console.log('✅ Performance settings updated');
      if (performanceResult.warnings.length > 0) {
        console.log('Warnings:');
        performanceResult.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
      }
    }
    console.log();

    // 8. Validate configuration
    console.log('✅ Validating configuration...');
    const validation = configManager.validateConfig();
    if (validation.valid) {
      console.log('✅ Configuration is valid');
    } else {
      console.log('❌ Configuration has errors:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('Warnings:');
      validation.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
    }
    console.log();

    // 9. Provider switching (if we have multiple providers)
    if (providers.length > 1) {
      console.log('🔄 Provider Switching Demo:');
      const nonDefaultProvider = providers.find(p => !p.isDefault);
      
      if (nonDefaultProvider) {
        console.log(`Switching to provider: ${nonDefaultProvider.name}`);
        
        try {
          const switchResult = await configManager.switchProvider(nonDefaultProvider.name, {
            force: false,
            migrateExistingIndexes: false
          });
          
          if (switchResult.success) {
            console.log(`✅ Successfully switched to ${switchResult.newProvider}`);
            if (switchResult.warnings.length > 0) {
              console.log('Warnings:');
              switchResult.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
            }
            
            // Switch back to original
            await configManager.switchProvider(switchResult.previousProvider);
            console.log(`✅ Switched back to ${switchResult.previousProvider}`);
          }
        } catch (error) {
          console.log(`❌ Provider switch failed: ${error.message}`);
        }
      }
      console.log();
    }

    // 10. Configuration export/import
    console.log('💾 Configuration Export/Import:');
    const exportPath = './ziri-config-backup.json';
    
    try {
      await configManager.exportConfig(exportPath);
      console.log(`✅ Configuration exported to ${exportPath}`);
      
      // Demonstrate import (in real usage, you'd import a different file)
      console.log('📥 Configuration import capability available');
      console.log('   Use: configManager.importConfig(filePath)');
    } catch (error) {
      console.log(`❌ Export failed: ${error.message}`);
    }
    console.log();

    // 11. Migration status
    console.log('🔄 Migration Status:');
    const needsMigration = await configManager.needsMigration();
    if (needsMigration) {
      console.log('⚠️ Configuration migration needed');
      console.log('   Run: configManager.migrate() to update');
    } else {
      console.log('✅ Configuration is up to date');
    }
    
    const backups = await configManager.listBackups();
    if (backups.length > 0) {
      console.log(`📦 Available backups: ${backups.length}`);
      backups.slice(0, 3).forEach(backup => {
        console.log(`   - v${backup.version} (${backup.timestamp})`);
      });
    }
    console.log();

    // 12. Auto-fix demonstration
    console.log('🔧 Auto-fix Configuration Issues:');
    const fixResult = await configManager.validateAndFix();
    
    if (fixResult.success) {
      console.log('✅ Configuration is valid');
    } else {
      console.log('❌ Configuration has unfixable issues');
    }
    
    if (fixResult.fixes.length > 0) {
      console.log('Applied fixes:');
      fixResult.fixes.forEach(fix => console.log(`  ✅ ${fix}`));
    } else {
      console.log('No fixes needed');
    }

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Environment variable demonstration
function demonstrateEnvironmentVariables() {
  console.log('\n🌍 Environment Variables Demo\n');
  
  // Show current environment configuration
  const envConfig = EnvironmentLoader.loadEnvironmentConfig();
  
  if (Object.keys(envConfig).length > 0) {
    console.log('Current environment overrides:');
    console.log(JSON.stringify(envConfig, null, 2));
  } else {
    console.log('No environment variables set. Try setting:');
    console.log('  ZIRI_DEFAULT_PROVIDER=ollama');
    console.log('  ZIRI_CONCURRENCY=5');
    console.log('  ZIRI_BATCH_SIZE=150');
    console.log('  OPENAI_API_KEY=your-key-here');
  }
  
  console.log('\nAvailable environment variables:');
  const availableVars = EnvironmentLoader.getAvailableEnvironmentVariables();
  
  Object.entries(availableVars).forEach(([category, vars]) => {
    console.log(`\n${category.toUpperCase()}:`);
    if (Array.isArray(vars)) {
      vars.forEach(varName => console.log(`  ${varName}`));
    } else {
      Object.entries(vars).forEach(([provider, providerVars]) => {
        console.log(`  ${provider}:`);
        providerVars.forEach(varName => console.log(`    ${varName}`));
      });
    }
  });
}

// Provider management demonstration
async function demonstrateProviderManagement() {
  console.log('\n🔌 Provider Management Demo\n');
  
  const configManager = new ConfigManager();
  
  try {
    // List current providers
    console.log('Current providers:');
    const providers = await configManager.listProviders();
    providers.forEach(provider => {
      console.log(`  ${provider.name}: ${provider.type} (${provider.status})`);
    });
    
    // Add Hugging Face provider
    console.log('\nAdding Hugging Face provider...');
    try {
      await configManager.addProvider('huggingface', {
        type: 'huggingface',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        dimensions: 384,
        enabled: true,
        rateLimit: {
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
        }
      });
      console.log('✅ Hugging Face provider added');
    } catch (error) {
      console.log(`⚠️ ${error.message}`);
    }
    
    // Test provider connectivity
    console.log('\nTesting provider connectivity...');
    const testProviders = ['openai', 'huggingface'];
    
    for (const providerName of testProviders) {
      try {
        const testResult = await configManager.testProvider(providerName);
        console.log(`✅ ${providerName}: ${testResult.status}`);
      } catch (error) {
        console.log(`❌ ${providerName}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Provider management demo failed:', error.message);
  }
}

// Run all demonstrations
async function runAllDemos() {
  await demonstrateConfigManagement();
  demonstrateEnvironmentVariables();
  await demonstrateProviderManagement();
  
  console.log('\n🎉 Configuration Management Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('✅ Configuration loading and validation');
  console.log('✅ Environment variable support');
  console.log('✅ Provider management and switching');
  console.log('✅ Performance tuning and recommendations');
  console.log('✅ Configuration export/import');
  console.log('✅ Migration and backup system');
  console.log('✅ Auto-fix for common issues');
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllDemos().catch(console.error);
}

export {
  demonstrateConfigManagement,
  demonstrateEnvironmentVariables,
  demonstrateProviderManagement,
  runAllDemos
};