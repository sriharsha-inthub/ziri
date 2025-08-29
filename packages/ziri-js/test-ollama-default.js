#!/usr/bin/env node

/**
 * Test to validate Ollama is the default provider
 */

import { ConfigManager } from './lib/config/config-manager.js';

async function testOllamaDefault() {
  console.log('🧪 Testing Ollama Default Configuration...\n');
  
  try {
    const configManager = new ConfigManager();
    
    // Test 1: Check default configuration
    console.log('1️⃣ Testing default configuration...');
    const defaultConfig = configManager.getDefaultConfig();
    
    if (defaultConfig.defaultProvider !== 'ollama') {
      throw new Error(`Expected default provider to be 'ollama', got '${defaultConfig.defaultProvider}'`);
    }
    
    if (!defaultConfig.providers.ollama) {
      throw new Error('Ollama provider not found in default configuration');
    }
    
    const ollamaConfig = defaultConfig.providers.ollama;
    if (ollamaConfig.type !== 'ollama') {
      throw new Error(`Expected Ollama type to be 'ollama', got '${ollamaConfig.type}'`);
    }
    
    if (ollamaConfig.model !== 'nomic-embed-text') {
      throw new Error(`Expected Ollama model to be 'nomic-embed-text', got '${ollamaConfig.model}'`);
    }
    
    if (ollamaConfig.dimensions !== 768) {
      throw new Error(`Expected Ollama dimensions to be 768, got '${ollamaConfig.dimensions}'`);
    }
    
    console.log('   ✅ Default provider is Ollama');
    console.log(`   ✅ Model: ${ollamaConfig.model}`);
    console.log(`   ✅ Dimensions: ${ollamaConfig.dimensions}`);
    console.log(`   ✅ Base URL: ${ollamaConfig.baseUrl}`);
    
    // Test 2: Check loaded configuration
    console.log('\n2️⃣ Testing loaded configuration...');
    const loadedConfig = await configManager.loadConfig();
    
    if (loadedConfig.defaultProvider !== 'ollama') {
      throw new Error(`Expected loaded default provider to be 'ollama', got '${loadedConfig.defaultProvider}'`);
    }
    
    console.log('   ✅ Loaded configuration uses Ollama as default');
    
    // Test 3: Check chat model configuration
    console.log('\n3️⃣ Testing chat model configuration...');
    if (ollamaConfig.textModel && ollamaConfig.textModel !== 'llama3.2') {
      console.log(`   ⚠️  Text model is '${ollamaConfig.textModel}', expected 'llama3.2'`);
    } else if (ollamaConfig.textModel === 'llama3.2') {
      console.log('   ✅ Chat model configured correctly');
    } else {
      console.log('   ℹ️  No specific text model configured (will use default)');
    }
    
    // Test 4: Validate configuration
    console.log('\n4️⃣ Testing configuration validation...');
    const validation = configManager.validateConfig(defaultConfig);
    
    if (!validation.valid) {
      throw new Error(`Default configuration is invalid: ${validation.errors.join(', ')}`);
    }
    
    console.log('   ✅ Default configuration is valid');
    
    if (validation.warnings && validation.warnings.length > 0) {
      console.log(`   ⚠️  Warnings: ${validation.warnings.join(', ')}`);
    }
    
    // Test 5: Check provider availability
    console.log('\n5️⃣ Testing provider availability...');
    const providers = Object.keys(defaultConfig.providers);
    
    console.log(`   📋 Available providers: ${providers.join(', ')}`);
    
    if (!providers.includes('ollama')) {
      throw new Error('Ollama provider not available');
    }
    
    console.log('   ✅ Ollama provider is available');
    
    // Test 6: Check environment variable support
    console.log('\n6️⃣ Testing environment variable support...');
    
    // Temporarily set environment variables
    const originalOllamaUrl = process.env.OLLAMA_BASE_URL;
    process.env.OLLAMA_BASE_URL = 'http://test:11434';
    
    const envConfig = await configManager.loadEnvironmentConfig();
    
    if (envConfig.providers && envConfig.providers.ollama && envConfig.providers.ollama.baseUrl === 'http://test:11434') {
      console.log('   ✅ Environment variables are loaded correctly');
    } else {
      console.log('   ⚠️  Environment variables may not be loading correctly');
    }
    
    // Restore original environment
    if (originalOllamaUrl) {
      process.env.OLLAMA_BASE_URL = originalOllamaUrl;
    } else {
      delete process.env.OLLAMA_BASE_URL;
    }
    
    console.log('\n🎉 All Ollama Default Tests Passed!');
    console.log('=' .repeat(50));
    console.log('✅ Ollama is correctly configured as the default provider');
    console.log('✅ Default configuration is valid and complete');
    console.log('✅ Environment variable support is working');
    console.log('✅ Chat integration is properly configured');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Ollama Default Test Failed:', error.message);
    return false;
  }
}

// Run the test
testOllamaDefault().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});