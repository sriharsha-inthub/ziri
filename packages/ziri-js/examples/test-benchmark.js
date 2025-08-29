#!/usr/bin/env node

/**
 * Simple test script for provider benchmarking
 */

import { quickProviderComparison } from '../lib/embedding/provider-benchmark.js';

async function main() {
  console.log('🔬 Testing Provider Benchmarking Tools\n');
  
  try {
    console.log('Running quick provider comparison...');
    
    const results = await quickProviderComparison({
      iterations: 1,
      testTexts: ['Hello world', 'This is a test']
    });
    
    console.log('\n📊 Results:');
    console.log(`Available providers: ${results.summary.providers?.length || 0}`);
    
    if (results.summary.providers?.length > 0) {
      console.log(`Providers: ${results.summary.providers.join(', ')}`);
      
      if (results.recommendations?.useCase) {
        console.log('\n💡 Recommendations:');
        Object.entries(results.recommendations.useCase).forEach(([useCase, provider]) => {
          console.log(`  ${useCase}: ${provider}`);
        });
      }
    } else {
      console.log('No providers available (this is expected without API keys)');
    }
    
    console.log('\n✅ Benchmarking tools are working correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();