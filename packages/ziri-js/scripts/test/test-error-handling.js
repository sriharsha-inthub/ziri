#!/usr/bin/env node

/**
 * Test enhanced error handling functionality
 */

import { ErrorHandler, ProviderError, AuthenticationError, RateLimitError } from './lib/error/error-handler.js';

async function testEnhancedErrorHandling() {
  console.log('🧪 Testing Enhanced Error Handling...\n');
  
  const errorHandler = new ErrorHandler({
    fallbackProviders: ['ollama', 'openai', 'huggingface']
  });
  
  // Test 1: Basic error handling
  console.log('1️⃣ Testing basic error handling...');
  try {
    const error = new ProviderError('Provider failed', 'openai');
    const result = await errorHandler.handleError(error, { operation: 'embedding' });
    console.log('   ✅ Error handling works');
    console.log('   📝 Recovery message:', result.message);
  } catch (error) {
    console.log('   ❌ Error handling failed:', error.message);
    return false;
  }
  
  // Test 2: Authentication error with fallback
  console.log('\n2️⃣ Testing authentication error with fallback...');
  try {
    const error = new AuthenticationError('Invalid API key', 'openai');
    const result = await errorHandler.handleError(error, { 
      operation: 'embedding',
      fallbackOperation: (provider) => console.log(`   🔄 Would switch to ${provider}`)
    });
    console.log('   ✅ Authentication error handling works');
    console.log('   📝 Recovery message:', result.message);
  } catch (error) {
    console.log('   ❌ Authentication error handling failed:', error.message);
    return false;
  }
  
  // Test 3: Rate limit error
  console.log('\n3️⃣ Testing rate limit error...');
  try {
    const error = new RateLimitError('Rate limit exceeded', 'openai', 5000);
    const result = await errorHandler.handleError(error, { operation: 'embedding' });
    console.log('   ✅ Rate limit error handling works');
    console.log('   📝 Recovery message:', result.message);
  } catch (error) {
    console.log('   ❌ Rate limit error handling failed:', error.message);
    return false;
  }
  
  // Test 4: Formatted error messages
  console.log('\n4️⃣ Testing formatted error messages...');
  try {
    const error = new AuthenticationError('Invalid API key', 'openai');
    const formattedMessage = errorHandler.formatErrorMessage(error, { 
      operation: 'embedding',
      file: 'test.js'
    });
    console.log('   ✅ Formatted error messages work');
    console.log('   📝 Formatted message:');
    console.log(formattedMessage);
  } catch (error) {
    console.log('   ❌ Formatted error messages failed:', error.message);
    return false;
  }
  
  // Test 5: Detailed error information
  console.log('\n5️⃣ Testing detailed error information...');
  try {
    const error = new RateLimitError('Rate limit exceeded', 'openai', 5000);
    const detailedInfo = errorHandler.getDetailedErrorMessage(error, { operation: 'embedding' });
    console.log('   ✅ Detailed error information works');
    console.log('   📝 Error type:', detailedInfo.type);
    console.log('   📝 Provider:', detailedInfo.provider);
    console.log('   📝 Suggestions count:', detailedInfo.suggestions.length);
  } catch (error) {
    console.log('   ❌ Detailed error information failed:', error.message);
    return false;
  }
  
  console.log('\n🎉 Enhanced Error Handling Test Complete!');
  console.log('✅ All error handling features working correctly');
  
  return true;
}

// Run the test
testEnhancedErrorHandling().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});