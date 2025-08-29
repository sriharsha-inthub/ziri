/**
 * Provider Benchmarking and Comparison Tools
 * Comprehensive benchmarking system for embedding providers
 */

import { EventEmitter } from 'events';
import { ProviderFactory } from './provider-factory.js';
import { EmbeddingClient } from './embedding-client.js';

export class ProviderBenchmark extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      testTexts: options.testTexts || this._getDefaultTestTexts(),
      iterations: options.iterations || 3,
      warmupIterations: options.warmupIterations || 1,
      timeout: options.timeout || 60000,
      includeQualityTests: options.includeQualityTests !== false,
      ...options
    };
    
    this.results = new Map();
  }

  /**
   * Benchmark multiple providers
   * @param {Object} providerConfigs - Map of provider name to config
   * @returns {Promise<BenchmarkResults>} Benchmark results
   */
  async benchmarkProviders(providerConfigs) {
    this.emit('benchmark:start', { 
      providers: Object.keys(providerConfigs),
      testCount: this.options.testTexts.length,
      iterations: this.options.iterations
    });

    const results = {
      summary: {},
      detailed: {},
      comparison: {},
      recommendations: {},
      timestamp: new Date().toISOString()
    };

    // Test each provider
    for (const [providerName, config] of Object.entries(providerConfigs)) {
      this.emit('provider:start', { provider: providerName });
      
      try {
        const providerResults = await this._benchmarkProvider(providerName, config);
        results.detailed[providerName] = providerResults;
        
        this.emit('provider:complete', { 
          provider: providerName, 
          results: providerResults.summary 
        });
      } catch (error) {
        this.emit('provider:error', { provider: providerName, error: error.message });
        results.detailed[providerName] = {
          error: error.message,
          available: false
        };
      }
    }

    // Generate comparison and recommendations
    results.summary = this._generateSummary(results.detailed);
    results.comparison = this._generateComparison(results.detailed);
    results.recommendations = this._generateRecommendations(results.detailed);

    this.emit('benchmark:complete', results);
    return results;
  }

  /**
   * Benchmark a single provider
   * @param {string} providerName - Provider name
   * @param {Object} config - Provider configuration
   * @returns {Promise<ProviderBenchmarkResult>} Provider benchmark results
   * @private
   */
  async _benchmarkProvider(providerName, config) {
    const provider = ProviderFactory.createProvider(providerName, config);
    
    // Test connectivity first
    const connectivityTest = await provider.test();
    if (!connectivityTest.success) {
      throw new Error(`Provider connectivity failed: ${connectivityTest.error}`);
    }

    const results = {
      provider: providerName,
      config: {
        model: provider.model,
        dimensions: provider.dimensions,
        maxTokens: provider.maxTokens
      },
      connectivity: connectivityTest,
      performance: {},
      quality: {},
      summary: {},
      available: true
    };

    // Performance benchmarks
    results.performance = await this._runPerformanceBenchmarks(provider);
    
    // Quality benchmarks (if enabled)
    if (this.options.includeQualityTests) {
      results.quality = await this._runQualityBenchmarks(provider);
    }

    // Generate summary
    results.summary = this._generateProviderSummary(results);

    return results;
  }

  /**
   * Run performance benchmarks for a provider
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<PerformanceBenchmarkResult>} Performance results
   * @private
   */
  async _runPerformanceBenchmarks(provider) {
    const results = {
      latency: {},
      throughput: {},
      reliability: {},
      scalability: {}
    };

    // Warmup
    for (let i = 0; i < this.options.warmupIterations; i++) {
      try {
        await provider.embed(['warmup test']);
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Latency tests
    results.latency = await this._testLatency(provider);
    
    // Throughput tests
    results.throughput = await this._testThroughput(provider);
    
    // Reliability tests
    results.reliability = await this._testReliability(provider);
    
    // Scalability tests
    results.scalability = await this._testScalability(provider);

    return results;
  }

  /**
   * Test provider latency
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<LatencyTestResult>} Latency test results
   * @private
   */
  async _testLatency(provider) {
    const singleTextLatencies = [];
    const batchLatencies = [];

    // Single text latency
    for (let i = 0; i < this.options.iterations; i++) {
      const startTime = Date.now();
      try {
        await provider.embed([this.options.testTexts[0]]);
        singleTextLatencies.push(Date.now() - startTime);
      } catch (error) {
        singleTextLatencies.push(null);
      }
    }

    // Batch latency (10 texts)
    const batchTexts = this.options.testTexts.slice(0, 10);
    for (let i = 0; i < this.options.iterations; i++) {
      const startTime = Date.now();
      try {
        await provider.embed(batchTexts);
        batchLatencies.push(Date.now() - startTime);
      } catch (error) {
        batchLatencies.push(null);
      }
    }

    return {
      singleText: this._calculateStats(singleTextLatencies.filter(l => l !== null)),
      batch: this._calculateStats(batchLatencies.filter(l => l !== null)),
      successRate: {
        single: singleTextLatencies.filter(l => l !== null).length / singleTextLatencies.length,
        batch: batchLatencies.filter(l => l !== null).length / batchLatencies.length
      }
    };
  }

  /**
   * Test provider throughput
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<ThroughputTestResult>} Throughput test results
   * @private
   */
  async _testThroughput(provider) {
    const throughputResults = [];
    const batchSizes = [1, 5, 10, 20, 50];

    for (const batchSize of batchSizes) {
      const texts = this.options.testTexts.slice(0, batchSize);
      const throughputs = [];

      for (let i = 0; i < this.options.iterations; i++) {
        const startTime = Date.now();
        try {
          await provider.embed(texts);
          const duration = (Date.now() - startTime) / 1000;
          const throughput = texts.length / duration;
          throughputs.push(throughput);
        } catch (error) {
          throughputs.push(null);
        }
      }

      const validThroughputs = throughputs.filter(t => t !== null);
      throughputResults.push({
        batchSize,
        throughput: this._calculateStats(validThroughputs),
        successRate: validThroughputs.length / throughputs.length
      });
    }

    return {
      byBatchSize: throughputResults,
      optimal: this._findOptimalBatchSize(throughputResults)
    };
  }

  /**
   * Test provider reliability
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<ReliabilityTestResult>} Reliability test results
   * @private
   */
  async _testReliability(provider) {
    const results = {
      successRate: 0,
      errorTypes: {},
      recoveryTime: [],
      consistency: {}
    };

    let successCount = 0;
    let totalRequests = 0;
    const embeddings = [];

    // Test multiple requests
    for (let i = 0; i < this.options.iterations * 5; i++) {
      totalRequests++;
      try {
        const embedding = await provider.embed([this.options.testTexts[0]]);
        successCount++;
        embeddings.push(embedding[0]);
      } catch (error) {
        const errorType = error.message.includes('rate limit') ? 'rate_limit' :
                         error.message.includes('timeout') ? 'timeout' :
                         error.message.includes('network') ? 'network' : 'other';
        
        results.errorTypes[errorType] = (results.errorTypes[errorType] || 0) + 1;
      }
    }

    results.successRate = successCount / totalRequests;

    // Test consistency (if we have embeddings)
    if (embeddings.length > 1) {
      results.consistency = this._testEmbeddingConsistency(embeddings);
    }

    return results;
  }

  /**
   * Test provider scalability
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<ScalabilityTestResult>} Scalability test results
   * @private
   */
  async _testScalability(provider) {
    const textCounts = [10, 50, 100, 200];
    const results = [];

    for (const textCount of textCounts) {
      const texts = Array(textCount).fill().map((_, i) => 
        this.options.testTexts[i % this.options.testTexts.length]
      );

      const startTime = Date.now();
      try {
        await provider.embed(texts);
        const duration = Date.now() - startTime;
        const throughput = textCount / (duration / 1000);
        
        results.push({
          textCount,
          duration,
          throughput,
          success: true
        });
      } catch (error) {
        results.push({
          textCount,
          error: error.message,
          success: false
        });
      }
    }

    return {
      results,
      scalabilityScore: this._calculateScalabilityScore(results)
    };
  }

  /**
   * Run quality benchmarks for a provider
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<QualityBenchmarkResult>} Quality results
   * @private
   */
  async _runQualityBenchmarks(provider) {
    const results = {
      similarity: {},
      clustering: {},
      dimensionality: {}
    };

    try {
      // Test semantic similarity
      results.similarity = await this._testSemanticSimilarity(provider);
      
      // Test clustering capability
      results.clustering = await this._testClustering(provider);
      
      // Test dimensionality
      results.dimensionality = await this._testDimensionality(provider);
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Test semantic similarity quality
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<SimilarityTestResult>} Similarity test results
   * @private
   */
  async _testSemanticSimilarity(provider) {
    const similarPairs = [
      ['The cat sat on the mat', 'A feline rested on the rug'],
      ['I love programming', 'Coding is my passion'],
      ['The weather is sunny', 'It\'s a bright day outside']
    ];

    const dissimilarPairs = [
      ['The cat sat on the mat', 'Quantum physics is complex'],
      ['I love programming', 'The ocean is deep'],
      ['The weather is sunny', 'Mathematics involves numbers']
    ];

    const similarityScores = [];

    // Test similar pairs (should have high similarity)
    for (const [text1, text2] of similarPairs) {
      const embeddings = await provider.embed([text1, text2]);
      const similarity = this._cosineSimilarity(embeddings[0], embeddings[1]);
      similarityScores.push({ type: 'similar', similarity });
    }

    // Test dissimilar pairs (should have low similarity)
    for (const [text1, text2] of dissimilarPairs) {
      const embeddings = await provider.embed([text1, text2]);
      const similarity = this._cosineSimilarity(embeddings[0], embeddings[1]);
      similarityScores.push({ type: 'dissimilar', similarity });
    }

    const similarScores = similarityScores.filter(s => s.type === 'similar').map(s => s.similarity);
    const dissimilarScores = similarityScores.filter(s => s.type === 'dissimilar').map(s => s.similarity);

    return {
      averageSimilarScore: similarScores.reduce((a, b) => a + b, 0) / similarScores.length,
      averageDissimilarScore: dissimilarScores.reduce((a, b) => a + b, 0) / dissimilarScores.length,
      separation: (similarScores.reduce((a, b) => a + b, 0) / similarScores.length) - 
                 (dissimilarScores.reduce((a, b) => a + b, 0) / dissimilarScores.length),
      allScores: similarityScores
    };
  }

  /**
   * Test clustering capability
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<ClusteringTestResult>} Clustering test results
   * @private
   */
  async _testClustering(provider) {
    const categories = {
      technology: ['programming', 'software', 'computer', 'algorithm'],
      nature: ['tree', 'flower', 'mountain', 'river'],
      food: ['pizza', 'burger', 'salad', 'soup']
    };

    const allTexts = Object.values(categories).flat();
    const embeddings = await provider.embed(allTexts);

    // Calculate intra-cluster and inter-cluster similarities
    const results = {};
    let textIndex = 0;

    for (const [category, texts] of Object.entries(categories)) {
      const categoryEmbeddings = embeddings.slice(textIndex, textIndex + texts.length);
      textIndex += texts.length;

      // Intra-cluster similarity (within category)
      const intraSimilarities = [];
      for (let i = 0; i < categoryEmbeddings.length; i++) {
        for (let j = i + 1; j < categoryEmbeddings.length; j++) {
          intraSimilarities.push(
            this._cosineSimilarity(categoryEmbeddings[i], categoryEmbeddings[j])
          );
        }
      }

      results[category] = {
        intraClusterSimilarity: intraSimilarities.reduce((a, b) => a + b, 0) / intraSimilarities.length
      };
    }

    return results;
  }

  /**
   * Test dimensionality properties
   * @param {BaseEmbeddingProvider} provider - Provider to test
   * @returns {Promise<DimensionalityTestResult>} Dimensionality test results
   * @private
   */
  async _testDimensionality(provider) {
    const testTexts = this.options.testTexts.slice(0, 10);
    const embeddings = await provider.embed(testTexts);

    // Calculate various dimensionality metrics
    const dimensions = embeddings[0].length;
    const norms = embeddings.map(emb => Math.sqrt(emb.reduce((sum, val) => sum + val * val, 0)));
    const sparsity = embeddings.map(emb => emb.filter(val => Math.abs(val) < 0.001).length / emb.length);

    return {
      dimensions,
      averageNorm: norms.reduce((a, b) => a + b, 0) / norms.length,
      averageSparsity: sparsity.reduce((a, b) => a + b, 0) / sparsity.length,
      normVariance: this._calculateVariance(norms)
    };
  }

  /**
   * Generate summary across all providers
   * @param {Object} detailedResults - Detailed results for all providers
   * @returns {Object} Summary results
   * @private
   */
  _generateSummary(detailedResults) {
    const availableProviders = Object.entries(detailedResults)
      .filter(([_, result]) => result.available)
      .map(([name, _]) => name);

    const summary = {
      totalProviders: Object.keys(detailedResults).length,
      availableProviders: availableProviders.length,
      providers: availableProviders
    };

    if (availableProviders.length === 0) {
      return summary;
    }

    // Find best performers
    const performanceMetrics = {};
    
    for (const provider of availableProviders) {
      const result = detailedResults[provider];
      if (result.performance?.latency?.singleText?.average) {
        performanceMetrics[provider] = {
          latency: result.performance.latency.singleText.average,
          throughput: result.performance.throughput?.optimal?.throughput?.average || 0,
          reliability: result.performance.reliability?.successRate || 0
        };
      }
    }

    // Find best in each category
    if (Object.keys(performanceMetrics).length > 0) {
      summary.bestPerformers = {
        latency: this._findBestProvider(performanceMetrics, 'latency', 'min'),
        throughput: this._findBestProvider(performanceMetrics, 'throughput', 'max'),
        reliability: this._findBestProvider(performanceMetrics, 'reliability', 'max')
      };
    }

    return summary;
  }

  /**
   * Generate comparison between providers
   * @param {Object} detailedResults - Detailed results for all providers
   * @returns {Object} Comparison results
   * @private
   */
  _generateComparison(detailedResults) {
    const availableResults = Object.entries(detailedResults)
      .filter(([_, result]) => result.available)
      .reduce((acc, [name, result]) => {
        acc[name] = result;
        return acc;
      }, {});

    if (Object.keys(availableResults).length < 2) {
      return { message: 'Need at least 2 providers for comparison' };
    }

    const comparison = {
      performance: {},
      features: {},
      costEffectiveness: {}
    };

    // Performance comparison
    const providers = Object.keys(availableResults);
    comparison.performance = {
      latency: this._compareMetric(availableResults, 'performance.latency.singleText.average'),
      throughput: this._compareMetric(availableResults, 'performance.throughput.optimal.throughput.average'),
      reliability: this._compareMetric(availableResults, 'performance.reliability.successRate')
    };

    // Feature comparison
    comparison.features = {};
    for (const provider of providers) {
      const result = availableResults[provider];
      comparison.features[provider] = {
        dimensions: result.config.dimensions,
        maxTokens: result.config.maxTokens,
        model: result.config.model,
        localDeployment: provider === 'ollama'
      };
    }

    return comparison;
  }

  /**
   * Generate recommendations based on results
   * @param {Object} detailedResults - Detailed results for all providers
   * @returns {Object} Recommendations
   * @private
   */
  _generateRecommendations(detailedResults) {
    const availableResults = Object.entries(detailedResults)
      .filter(([_, result]) => result.available);

    if (availableResults.length === 0) {
      return {
        message: 'No providers available for recommendations',
        troubleshooting: [
          'Check API keys and credentials',
          'Verify network connectivity',
          'Ensure required services are running (e.g., Ollama)'
        ]
      };
    }

    const recommendations = {
      general: [],
      useCase: {},
      performance: [],
      cost: []
    };

    // General recommendations
    if (availableResults.length === 1) {
      recommendations.general.push(`Only ${availableResults[0][0]} is available. Consider setting up additional providers for redundancy.`);
    } else {
      recommendations.general.push(`${availableResults.length} providers are available. Consider using different providers for different use cases.`);
    }

    // Use case recommendations
    const performanceData = availableResults.map(([name, result]) => ({
      name,
      latency: result.performance?.latency?.singleText?.average || Infinity,
      throughput: result.performance?.throughput?.optimal?.throughput?.average || 0,
      reliability: result.performance?.reliability?.successRate || 0,
      local: name === 'ollama'
    }));

    // Sort by different criteria
    const fastestLatency = performanceData.sort((a, b) => a.latency - b.latency)[0];
    const highestThroughput = performanceData.sort((a, b) => b.throughput - a.throughput)[0];
    const mostReliable = performanceData.sort((a, b) => b.reliability - a.reliability)[0];
    const localProvider = performanceData.find(p => p.local);

    recommendations.useCase = {
      'Low latency applications': fastestLatency?.name,
      'High throughput batch processing': highestThroughput?.name,
      'Production reliability': mostReliable?.name,
      'Privacy-sensitive applications': localProvider?.name || 'Consider setting up Ollama',
      'Development and testing': localProvider?.name || 'Any available provider'
    };

    // Performance recommendations
    for (const [name, result] of availableResults) {
      const perf = result.performance;
      if (perf?.reliability?.successRate < 0.9) {
        recommendations.performance.push(`${name}: Consider checking configuration - reliability is below 90%`);
      }
      if (perf?.latency?.singleText?.average > 5000) {
        recommendations.performance.push(`${name}: High latency detected - consider optimizing network or switching providers for latency-sensitive applications`);
      }
    }

    // Cost recommendations
    recommendations.cost = [
      'Ollama: Free local deployment, but requires local resources',
      'OpenAI: Pay-per-use, good for production with predictable costs',
      'Hugging Face: Free tier available, good for experimentation',
      'Cohere: Competitive pricing, good for commercial applications'
    ];

    return recommendations;
  }

  /**
   * Calculate statistics for an array of numbers
   * @param {number[]} values - Array of values
   * @returns {Object} Statistics
   * @private
   */
  _calculateStats(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      average: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      stdDev: Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - (sum / values.length), 2), 0) / values.length)
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} a - First vector
   * @param {number[]} b - Second vector
   * @returns {number} Cosine similarity
   * @private
   */
  _cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
  }

  /**
   * Calculate variance of an array
   * @param {number[]} values - Array of values
   * @returns {number} Variance
   * @private
   */
  _calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Find optimal batch size from throughput results
   * @param {Array} throughputResults - Throughput test results
   * @returns {Object} Optimal batch size info
   * @private
   */
  _findOptimalBatchSize(throughputResults) {
    const validResults = throughputResults.filter(r => r.throughput && r.successRate > 0.8);
    if (validResults.length === 0) return null;

    const best = validResults.reduce((best, current) => 
      (current.throughput.average > best.throughput.average) ? current : best
    );

    return {
      batchSize: best.batchSize,
      throughput: best.throughput,
      successRate: best.successRate
    };
  }

  /**
   * Calculate scalability score
   * @param {Array} results - Scalability test results
   * @returns {number} Scalability score (0-1)
   * @private
   */
  _calculateScalabilityScore(results) {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;

    // Score based on how well throughput scales with text count
    const throughputs = successfulResults.map(r => r.throughput);
    const textCounts = successfulResults.map(r => r.textCount);
    
    // Simple linear regression to see if throughput increases with text count
    const correlation = this._calculateCorrelation(textCounts, throughputs);
    return Math.max(0, correlation); // Positive correlation is good
  }

  /**
   * Calculate correlation coefficient
   * @param {number[]} x - X values
   * @param {number[]} y - Y values
   * @returns {number} Correlation coefficient
   * @private
   */
  _calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Find best provider for a metric
   * @param {Object} metrics - Provider metrics
   * @param {string} metricName - Metric name
   * @param {string} direction - 'min' or 'max'
   * @returns {string} Best provider name
   * @private
   */
  _findBestProvider(metrics, metricName, direction) {
    const providers = Object.keys(metrics);
    if (providers.length === 0) return null;

    return providers.reduce((best, current) => {
      const bestValue = metrics[best][metricName];
      const currentValue = metrics[current][metricName];
      
      if (direction === 'min') {
        return currentValue < bestValue ? current : best;
      } else {
        return currentValue > bestValue ? current : best;
      }
    });
  }

  /**
   * Compare a metric across providers
   * @param {Object} results - Provider results
   * @param {string} metricPath - Dot-notation path to metric
   * @returns {Object} Comparison results
   * @private
   */
  _compareMetric(results, metricPath) {
    const comparison = {};
    
    for (const [provider, result] of Object.entries(results)) {
      const value = this._getNestedValue(result, metricPath);
      if (value !== undefined && value !== null) {
        comparison[provider] = value;
      }
    }

    return comparison;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-notation path
   * @returns {*} Value at path
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Generate provider summary
   * @param {Object} results - Provider results
   * @returns {Object} Provider summary
   * @private
   */
  _generateProviderSummary(results) {
    const summary = {
      available: results.available,
      model: results.config.model,
      dimensions: results.config.dimensions
    };

    if (results.performance) {
      summary.performance = {
        avgLatency: results.performance.latency?.singleText?.average,
        maxThroughput: results.performance.throughput?.optimal?.throughput?.average,
        reliability: results.performance.reliability?.successRate
      };
    }

    if (results.quality) {
      summary.quality = {
        semanticSeparation: results.quality.similarity?.separation,
        dimensionality: results.quality.dimensionality?.dimensions
      };
    }

    return summary;
  }

  /**
   * Test embedding consistency
   * @param {Array} embeddings - Array of embeddings
   * @returns {Object} Consistency metrics
   * @private
   */
  _testEmbeddingConsistency(embeddings) {
    // Test if same input produces same output
    const similarities = [];
    for (let i = 0; i < embeddings.length - 1; i++) {
      similarities.push(this._cosineSimilarity(embeddings[i], embeddings[i + 1]));
    }

    return {
      averageSimilarity: similarities.reduce((a, b) => a + b, 0) / similarities.length,
      minSimilarity: Math.min(...similarities),
      maxSimilarity: Math.max(...similarities)
    };
  }

  /**
   * Get default test texts for benchmarking
   * @returns {string[]} Array of test texts
   * @private
   */
  _getDefaultTestTexts() {
    return [
      'The quick brown fox jumps over the lazy dog.',
      'Machine learning is a subset of artificial intelligence.',
      'JavaScript is a versatile programming language.',
      'The weather today is sunny and warm.',
      'Database optimization improves query performance.',
      'React is a popular frontend framework.',
      'Cloud computing enables scalable applications.',
      'Natural language processing analyzes human language.',
      'Version control systems track code changes.',
      'API design principles ensure maintainable interfaces.',
      'Microservices architecture promotes modularity.',
      'Data visualization helps understand complex datasets.',
      'Cybersecurity protects digital assets.',
      'DevOps practices streamline software delivery.',
      'Blockchain technology enables decentralized systems.'
    ];
  }
}

/**
 * Convenience function to create and run a benchmark
 * @param {Object} providerConfigs - Provider configurations
 * @param {Object} options - Benchmark options
 * @returns {Promise<BenchmarkResults>} Benchmark results
 */
export async function benchmarkProviders(providerConfigs, options = {}) {
  const benchmark = new ProviderBenchmark(options);
  return await benchmark.benchmarkProviders(providerConfigs);
}

/**
 * Quick comparison of available providers
 * @param {Object} options - Options
 * @returns {Promise<BenchmarkResults>} Comparison results
 */
export async function quickProviderComparison(options = {}) {
  const configs = {
    openai: {
      type: 'openai',
      apiKey: process.env.ZIRI_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    },
    ollama: {
      type: 'ollama'
    },
    huggingface: {
      type: 'huggingface',
      apiKey: process.env.ZIRI_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY
    },
    cohere: {
      type: 'cohere',
      apiKey: process.env.ZIRI_COHERE_API_KEY || process.env.COHERE_API_KEY
    }
  };

  // Filter out providers without required credentials
  const availableConfigs = {};
  for (const [name, config] of Object.entries(configs)) {
    if (name === 'ollama' || config.apiKey) {
      availableConfigs[name] = config;
    }
  }

  return await benchmarkProviders(availableConfigs, {
    iterations: 2,
    includeQualityTests: false,
    ...options
  });
}