/**
 * Summary Analyzer
 * Provides detailed analysis capabilities for project summaries
 */

export class SummaryAnalyzer {
  constructor() {
    this.analysisVersion = '1.0.0';
  }

  /**
   * Analyze code complexity based on file content
   */
  analyzeComplexity(fileContent, language) {
    const metrics = {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(fileContent, language),
      nestingDepth: this.calculateNestingDepth(fileContent),
      functionCount: this.countFunctions(fileContent, language),
      classCount: this.countClasses(fileContent, language),
      linesOfCode: this.countLinesOfCode(fileContent)
    };

    return {
      ...metrics,
      complexityScore: this.calculateOverallComplexity(metrics)
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  calculateCyclomaticComplexity(content, language) {
    const complexityPatterns = {
      'JavaScript': /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g,
      'TypeScript': /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g,
      'Python': /\b(if|elif|else|while|for|try|except|and|or)\b/g,
      'Java': /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g
    };

    const pattern = complexityPatterns[language] || complexityPatterns['JavaScript'];
    const matches = content.match(pattern) || [];
    return matches.length + 1; // Base complexity of 1
  }

  /**
   * Calculate maximum nesting depth
   */
  calculateNestingDepth(content) {
    const lines = content.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Count opening braces/blocks
      const openBraces = (trimmed.match(/[{(]/g) || []).length;
      const closeBraces = (trimmed.match(/[})]/g) || []).length;
      
      currentDepth += openBraces - closeBraces;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  /**
   * Count functions in code
   */
  countFunctions(content, language) {
    const functionPatterns = {
      'JavaScript': /\b(function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\(.*\)\s*=>)/g,
      'TypeScript': /\b(function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\(.*\)\s*=>)/g,
      'Python': /\bdef\s+\w+/g,
      'Java': /\b(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/g
    };

    const pattern = functionPatterns[language] || functionPatterns['JavaScript'];
    const matches = content.match(pattern) || [];
    return matches.length;
  }

  /**
   * Count classes in code
   */
  countClasses(content, language) {
    const classPatterns = {
      'JavaScript': /\bclass\s+\w+/g,
      'TypeScript': /\bclass\s+\w+/g,
      'Python': /\bclass\s+\w+/g,
      'Java': /\b(public|private|protected)?\s*class\s+\w+/g
    };

    const pattern = classPatterns[language] || classPatterns['JavaScript'];
    const matches = content.match(pattern) || [];
    return matches.length;
  }

  /**
   * Count meaningful lines of code (excluding comments and empty lines)
   */
  countLinesOfCode(content) {
    const lines = content.split('\n');
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('#') &&
             !trimmed.startsWith('/*') &&
             !trimmed.startsWith('*') &&
             trimmed !== '*/';
    }).length;
  }

  /**
   * Calculate overall complexity score (1-10)
   */
  calculateOverallComplexity(metrics) {
    const weights = {
      cyclomaticComplexity: 0.3,
      nestingDepth: 0.2,
      functionCount: 0.2,
      classCount: 0.1,
      linesOfCode: 0.2
    };

    // Normalize metrics to 0-10 scale
    const normalized = {
      cyclomaticComplexity: Math.min(metrics.cyclomaticComplexity / 10, 10),
      nestingDepth: Math.min(metrics.nestingDepth / 5, 10),
      functionCount: Math.min(metrics.functionCount / 20, 10),
      classCount: Math.min(metrics.classCount / 10, 10),
      linesOfCode: Math.min(metrics.linesOfCode / 500, 10)
    };

    let weightedScore = 0;
    for (const [metric, value] of Object.entries(normalized)) {
      weightedScore += value * weights[metric];
    }

    return Math.min(Math.max(Math.round(weightedScore), 1), 10);
  }

  /**
   * Analyze project architecture patterns
   */
  analyzeArchitecturePatterns(files) {
    const patterns = {
      mvc: this.detectMVCPattern(files),
      microservices: this.detectMicroservicesPattern(files),
      layered: this.detectLayeredPattern(files),
      modular: this.detectModularPattern(files)
    };

    return {
      detectedPatterns: Object.entries(patterns)
        .filter(([, detected]) => detected)
        .map(([pattern]) => pattern),
      confidence: this.calculatePatternConfidence(patterns)
    };
  }

  /**
   * Detect MVC pattern
   */
  detectMVCPattern(files) {
    const hasModels = files.some(f => f.relativePath.toLowerCase().includes('model'));
    const hasViews = files.some(f => f.relativePath.toLowerCase().includes('view'));
    const hasControllers = files.some(f => f.relativePath.toLowerCase().includes('controller'));
    
    return hasModels && hasViews && hasControllers;
  }

  /**
   * Detect microservices pattern
   */
  detectMicroservicesPattern(files) {
    const serviceFiles = files.filter(f => 
      f.relativePath.toLowerCase().includes('service') ||
      f.relativePath.toLowerCase().includes('api')
    );
    
    return serviceFiles.length > 3; // Multiple services indicate microservices
  }

  /**
   * Detect layered architecture pattern
   */
  detectLayeredPattern(files) {
    const layers = ['controller', 'service', 'repository', 'model', 'dao'];
    const detectedLayers = layers.filter(layer =>
      files.some(f => f.relativePath.toLowerCase().includes(layer))
    );
    
    return detectedLayers.length >= 3;
  }

  /**
   * Detect modular pattern
   */
  detectModularPattern(files) {
    const modules = new Set();
    
    for (const file of files) {
      const parts = file.relativePath.split('/');
      if (parts.length > 2) {
        modules.add(parts[1]); // Second level directory as module
      }
    }
    
    return modules.size > 3; // Multiple modules indicate modular architecture
  }

  /**
   * Calculate pattern detection confidence
   */
  calculatePatternConfidence(patterns) {
    const detectedCount = Object.values(patterns).filter(Boolean).length;
    const totalPatterns = Object.keys(patterns).length;
    
    return Math.round((detectedCount / totalPatterns) * 100);
  }

  /**
   * Generate insights from analysis
   */
  generateInsights(analysis) {
    const insights = [];

    if (analysis.complexityScore > 7) {
      insights.push('High complexity detected - consider refactoring for maintainability');
    }

    if (analysis.nestingDepth > 4) {
      insights.push('Deep nesting detected - consider extracting methods');
    }

    if (analysis.cyclomaticComplexity > 15) {
      insights.push('High cyclomatic complexity - consider breaking down complex functions');
    }

    if (analysis.functionCount > 50) {
      insights.push('Large number of functions - consider organizing into modules');
    }

    return insights;
  }
}