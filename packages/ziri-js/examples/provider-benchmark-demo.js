/**
 * Provider Benchmarking Demo
 * Demonstrates comprehensive benchmarking and comparison of embedding providers
 */

import { 
  ProviderBenchmark, 
  benchmarkProviders, 
  quickProviderComparison 
} from '../lib/embedding/provider-benchmark.js';
import { createEmbeddingClient } from '../lib/embedding/index.js';

/**
 * Demonstrate basic provider benchmarking
 */
async function demonstrateBasicBenchmarking() {
  console.log('\n🔬 Basic Provider Benchmarking Demo\n');

  // Configure providers to test
  const providerConfigs = {
    openai: {
      type: 'openai',
      apiKey: process.env.ZIRI_OPENAI_API_KEY || 'demo-key-will-fail',
      model: 'text-embedding-3-small'
    },
    ollama: {
      type: 'ollama',
      model: 'nomic-embed-text'
    },
    huggingface: {
      type: 'huggingface',
      apiKey: process.env.ZIRI_HUGGINGFACE_API_KEY || 'demo-key-will-fail',
      model: 'sentence-transformers/all-MiniLM-L6-v2'
    }
  };

  console.log('📊 Testing providers:', Object.keys(providerConfigs).join(', '));
  console.log('⚠️  Note: Demo keys will fail - set real API keys for actual testing\n');

  try {
    // Run benchmark with progress tracking
    const benchmark = new ProviderBenchmark({
      iterations: 2,
      includeQualityTests: true,
      testTexts: [
        'Machine learning transforms data into insights',
        'JavaScript enables interactive web applications',
        'Cloud computing provides scalable infrastructure',
        'Natural language processing understands human text',
        'Database optimization improves query performance'
      ]
    });

    // Listen to progress events
    benchmark.on('benchmark:start', (data) => {
      console.log(`🚀 Starting benchmark for ${data.providers.length} providers`);
      console.log(`   Tests: ${data.testCount} texts, ${data.iterations} iterations\n`);
    });

    benchmark.on('provider:start', (data) => {
      console.log(`🔍 Testing ${data.provider}...`);
    });

    benchmark.on('provider:complete', (data) => {
      const perf = data.results.performance;
      console.log(`✅ ${data.provider} completed:`);
      console.log(`   Latency: ${perf?.avgLatency?.toFixed(0)}ms`);
      console.log(`   Throughput: ${perf?.maxThroughput?.toFixed(1)} texts/sec`);
      console.log(`   Reliability: ${(perf?.reliability * 100)?.toFixed(1)}%\n`);
    });

    benchmark.on('provider:error', (data) => {
      console.log(`❌ ${data.provider} failed: ${data.error}\n`);
    });

    const results = await benchmark.benchmarkProviders(providerConfigs);
    
    console.log('📈 Benchmark Results Summary:');
    console.log(`   Available providers: ${results.summary.availableProviders}/${results.summary.totalProviders}`);
    
    if (results.summary.bestPerformers) {
      console.log('🏆 Best performers:');
      console.log(`   Lowest latency: ${results.summary.bestPerformers.latency}`);
      console.log(`   Highest throughput: ${results.summary.bestPerformers.throughput}`);
      console.log(`   Most reliable: ${results.summary.bestPerformers.reliability}`);
    }

    return results;

  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    return null;
  }
}

/**
 * Demonstrate quick provider comparison
 */
async function demonstrateQuickComparison() {
  console.log('\n⚡ Quick Provider Comparison Demo\n');

  try {
    console.log('🔍 Running quick comparison of available providers...');
    
    const results = await quickProviderComparison({
      iterations: 1,
      testTexts: [
        'Hello world',
        'This is a test',
        'Quick comparison'
      ]
    });

    console.log('\n📊 Quick Comparison Results:');
    
    // Display available providers
    if (results.summary.providers.length > 0) {
      console.log(`✅ Available providers: ${results.summary.providers.join(', ')}`);
      
      // Show performance comparison
      if (results.comparison.performance) {
        console.log('\n⚡ Performance Comparison:');
        
        const latencies = results.comparison.performance.latency;
        if (latencies && Object.keys(latencies).length > 0) {
          console.log('   Latency (ms):');
          Object.entries(latencies).forEach(([provider, latency]) => {
            console.log(`     ${provider}: ${latency?.toFixed(0) || 'N/A'}`);
          });
        }

        const throughputs = results.comparison.performance.throughput;
        if (throughputs && Object.keys(throughputs).length > 0) {
          console.log('   Throughput (texts/sec):');
          Object.entries(throughputs).forEach(([provider, throughput]) => {
            console.log(`     ${provider}: ${throughput?.toFixed(1) || 'N/A'}`);
          });
        }
      }

      // Show recommendations
      if (results.recommendations.useCase) {
        console.log('\n💡 Use Case Recommendations:');
        Object.entries(results.recommendations.useCase).forEach(([useCase, provider]) => {
          console.log(`   ${useCase}: ${provider}`);
        });
      }

    } else {
      console.log('❌ No providers available');
      console.log('💡 Troubleshooting tips:');
      results.recommendations.troubleshooting?.forEach(tip => {
        console.log(`   • ${tip}`);
      });
    }

    return results;

  } catch (error) {
    console.error('❌ Quick comparison failed:', error.message);
    return null;
  }
}

/**
 * Demonstrate detailed performance analysis
 */
async function demonstrateDetailedAnalysis() {
  console.log('\n🔬 Detailed Performance Analysis Demo\n');

  // This would typically use real providers, but for demo we'll simulate
  console.log('📊 Simulating detailed performance analysis...');
  
  const simulatedResults = {
    openai: {
      latency: { single: 150, batch: 800 },
      throughput: { optimal: 45.2 },
      reliability: 0.98,
      cost: 'Pay-per-use',
      features: ['High quality', 'Large context', 'Reliable API']
    },
    ollama: {
      latency: { single: 300, batch: 1200 },
      throughput: { optimal: 25.1 },
      reliability: 0.95,
      cost: 'Free (local)',
      features: ['Privacy', 'No API limits', 'Local deployment']
    },
    huggingface: {
      latency: { single: 400, batch: 1800 },
      throughput: { optimal: 18.7 },
      reliability: 0.92,
      cost: 'Free tier + paid',
      features: ['Open source models', 'Free tier', 'Model variety']
    }
  };

  console.log('📈 Performance Analysis Results:\n');

  // Performance comparison table
  console.log('Provider      | Latency (ms) | Throughput | Reliability | Cost');
  console.log('------------- | ------------ | ---------- | ----------- | ----');
  
  Object.entries(simulatedResults).forEach(([provider, data]) => {
    const name = provider.padEnd(12);
    const latency = data.latency.single.toString().padEnd(11);
    const throughput = data.throughput.optimal.toFixed(1).padEnd(9);
    const reliability = (data.reliability * 100).toFixed(0).padEnd(10) + '%';
    const cost = data.cost;
    
    console.log(`${name} | ${latency} | ${throughput} | ${reliability} | ${cost}`);
  });

  console.log('\n🎯 Analysis Insights:');
  console.log('• OpenAI: Best for production with high reliability requirements');
  console.log('• Ollama: Best for privacy-sensitive applications and development');
  console.log('• Hugging Face: Best for experimentation and cost-conscious projects');

  console.log('\n💡 Optimization Recommendations:');
  console.log('• Use OpenAI for latency-critical applications');
  console.log('• Use Ollama for local development and testing');
  console.log('• Use Hugging Face for batch processing and experimentation');
  console.log('• Consider hybrid approach: Ollama for dev, OpenAI for production');
}

/**
 * Demonstrate provider selection guidance
 */
async function demonstrateProviderSelection() {
  console.log('\n🎯 Provider Selection Guidance Demo\n');

  const selectionCriteria = {
    'Startup MVP': {
      priority: ['Cost', 'Ease of setup', 'Reliability'],
      recommendation: 'Hugging Face (free tier) or Ollama (local)',
      reasoning: 'Low cost, quick setup, sufficient quality for MVP'
    },
    'Enterprise Production': {
      priority: ['Reliability', 'Performance', 'Support'],
      recommendation: 'OpenAI or Cohere',
      reasoning: 'High reliability, professional support, proven at scale'
    },
    'Privacy-Sensitive': {
      priority: ['Data privacy', 'Local deployment', 'Control'],
      recommendation: 'Ollama',
      reasoning: 'Complete local control, no data leaves your infrastructure'
    },
    'Research Project': {
      priority: ['Model variety', 'Experimentation', 'Cost'],
      recommendation: 'Hugging Face',
      reasoning: 'Access to many models, free tier, research-friendly'
    },
    'High-Volume Processing': {
      priority: ['Throughput', 'Cost efficiency', 'Scalability'],
      recommendation: 'OpenAI or Cohere with batching',
      reasoning: 'Optimized for high throughput, predictable scaling'
    }
  };

  console.log('🎯 Provider Selection Guide:\n');

  Object.entries(selectionCriteria).forEach(([useCase, criteria]) => {
    console.log(`📋 ${useCase}:`);
    console.log(`   Priorities: ${criteria.priority.join(', ')}`);
    console.log(`   Recommended: ${criteria.recommendation}`);
    console.log(`   Reasoning: ${criteria.reasoning}\n`);
  });

  console.log('🔧 Setup Complexity Comparison:');
  console.log('• Ollama: Medium (local installation required)');
  console.log('• OpenAI: Easy (just API key)');
  console.log('• Hugging Face: Easy (API key, free tier available)');
  console.log('• Cohere: Easy (API key, good documentation)');

  console.log('\n💰 Cost Comparison:');
  console.log('• Ollama: Free (hardware costs)');
  console.log('• Hugging Face: Free tier + usage-based');
  console.log('• OpenAI: Usage-based, predictable pricing');
  console.log('• Cohere: Competitive usage-based pricing');
}

/**
 * Demonstrate benchmarking best practices
 */
async function demonstrateBestPractices() {
  console.log('\n📚 Benchmarking Best Practices Demo\n');

  console.log('🎯 Best Practices for Provider Benchmarking:\n');

  console.log('1. 🔧 Environment Setup:');
  console.log('   • Test in production-like conditions');
  console.log('   • Use consistent network conditions');
  console.log('   • Warm up providers before benchmarking');
  console.log('   • Run multiple iterations for statistical significance\n');

  console.log('2. 📊 Metrics to Track:');
  console.log('   • Latency: Single request and batch processing');
  console.log('   • Throughput: Requests per second at different batch sizes');
  console.log('   • Reliability: Success rate and error patterns');
  console.log('   • Quality: Semantic similarity and clustering performance');
  console.log('   • Cost: Per-token or per-request pricing\n');

  console.log('3. 🧪 Test Scenarios:');
  console.log('   • Varied text lengths (short, medium, long)');
  console.log('   • Different domains (technical, general, domain-specific)');
  console.log('   • Peak and off-peak usage times');
  console.log('   • Error conditions and recovery\n');

  console.log('4. 📈 Analysis Guidelines:');
  console.log('   • Consider percentiles, not just averages');
  console.log('   • Account for cold start effects');
  console.log('   • Test under realistic load conditions');
  console.log('   • Validate quality with domain-specific tests\n');

  console.log('5. 🔄 Continuous Monitoring:');
  console.log('   • Set up regular benchmarking schedules');
  console.log('   • Monitor for performance degradation');
  console.log('   • Track cost changes over time');
  console.log('   • Update benchmarks as providers evolve\n');

  // Example benchmark configuration
  console.log('📋 Example Benchmark Configuration:');
  console.log(`
const benchmarkConfig = {
  iterations: 5,
  warmupIterations: 2,
  timeout: 60000,
  includeQualityTests: true,
  testTexts: [
    // Mix of short and long texts
    // Domain-specific content
    // Edge cases (empty, very long, special characters)
  ],
  providers: {
    // All available providers with production configs
  }
};
  `);
}

/**
 * Main demo function
 */
async function main() {
  console.log('🚀 Provider Benchmarking and Comparison Demo');
  console.log('='.repeat(50));

  try {
    // Run all demonstrations
    await demonstrateBasicBenchmarking();
    await demonstrateQuickComparison();
    await demonstrateDetailedAnalysis();
    await demonstrateProviderSelection();
    await demonstrateBestPractices();

    console.log('\n✅ Demo completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('• Set up real API keys for actual benchmarking');
    console.log('• Customize test texts for your specific use case');
    console.log('• Run benchmarks regularly to monitor performance');
    console.log('• Use results to optimize your provider selection');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Export functions for testing
export {
  demonstrateBasicBenchmarking,
  demonstrateQuickComparison,
  demonstrateDetailedAnalysis,
  demonstrateProviderSelection,
  demonstrateBestPractices
};

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}