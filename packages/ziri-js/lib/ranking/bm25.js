/**
 * BM25-style ranking implementation for code search
 * Adapted from traditional BM25 for use with code chunks
 */

/**
 * BM25 Scoring Class
 * Implements BM25 algorithm adapted for code search context
 */
export class BM25Scorer {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.k1 - Term saturation parameter (default: 1.5)
   * @param {number} options.b - Length normalization parameter (default: 0.75)
   * @param {Object} options.termStats - Repository-level term statistics
   */
  constructor(options = {}) {
    this.k1 = options.k1 || 1.5;
    this.b = options.b || 0.75;
    this.termStats = options.termStats || {};
    this.totalDocuments = options.totalDocuments || 0;
    this.averageDocumentLength = options.averageDocumentLength || 1000;
  }

  /**
   * Calculate BM25 score for a query against a document
   * @param {Array<string>} queryTerms - Tokenized query terms
   * @param {Object} documentTerms - Term frequency mapping for document
   * @param {number} documentLength - Length of document in characters
   * @returns {number} BM25 score
   */
  calculateScore(queryTerms, documentTerms, documentLength) {
    if (!queryTerms || !documentTerms || queryTerms.length === 0) {
      return 0;
    }

    let score = 0;
    
    // Calculate length normalization factor
    const lengthNorm = this.calculateLengthNormalization(documentLength);
    
    // Calculate score for each query term
    for (const term of queryTerms) {
      const termScore = this.calculateTermScore(term, documentTerms, lengthNorm);
      score += termScore;
    }
    
    return score;
  }

  /**
   * Calculate score contribution for a single term
   * @param {string} term - Query term
   * @param {Object} documentTerms - Term frequency mapping for document
   * @param {number} lengthNorm - Length normalization factor
   * @returns {number} Term score contribution
   */
  calculateTermScore(term, documentTerms, lengthNorm) {
    // Get term frequency in document
    const termFreq = documentTerms[term] || 0;
    if (termFreq === 0) {
      return 0;
    }

    // Get inverse document frequency
    const idf = this.calculateIDF(term);
    if (idf === 0) {
      return 0;
    }

    // Calculate BM25 term score
    // BM25 formula: IDF * (tf * (k1+1)) / (tf + k1 * lengthNorm)
    const numerator = termFreq * (this.k1 + 1);
    const denominator = termFreq + (this.k1 * lengthNorm);
    
    return idf * (numerator / denominator);
  }

  /**
   * Calculate inverse document frequency for a term
   * @param {string} term - Term to calculate IDF for
   * @returns {number} Inverse document frequency
   */
  calculateIDF(term) {
    if (!this.termStats[term] || this.termStats[term] === 0) {
      return 0;
    }

    if (this.totalDocuments === 0) {
      return 0;
    }

    // Traditional IDF formula: log((N - n + 0.5) / (n + 0.5))
    // Where N = total documents, n = documents containing term
    const docFreq = this.termStats[term];
    const numerator = this.totalDocuments - docFreq + 0.5;
    const denominator = docFreq + 0.5;
    
    if (denominator <= 0) {
      return 0;
    }
    
    const idf = Math.log(numerator / denominator);
    return Math.max(0, idf); // Ensure non-negative
  }

  /**
   * Calculate length normalization factor
   * @param {number} documentLength - Length of document in characters
   * @returns {number} Length normalization factor
   */
  calculateLengthNormalization(documentLength) {
    if (this.averageDocumentLength <= 0) {
      return 1;
    }
    
    // Length normalization: ((1-b) + b * (|d|/avgdl))
    // Where |d| = document length, avgdl = average document length
    const lengthRatio = documentLength / this.averageDocumentLength;
    return (1 - this.b) + (this.b * lengthRatio);
  }

  /**
   * Normalize score to 0-1 range
   * @param {number} score - Raw BM25 score
   * @param {number} maxScore - Maximum possible score for normalization
   * @returns {number} Normalized score (0-1)
   */
  normalizeScore(score, maxScore = 10) {
    if (score <= 0) {
      return 0;
    }
    
    // Simple normalization, could be enhanced with more sophisticated methods
    return Math.min(1, score / maxScore);
  }

  /**
   * Update term statistics
   * @param {Object} termStats - New term statistics
   * @param {number} totalDocuments - Total document count
   * @param {number} averageDocumentLength - Average document length
   */
  updateTermStats(termStats, totalDocuments, averageDocumentLength) {
    this.termStats = termStats || {};
    this.totalDocuments = totalDocuments || 0;
    this.averageDocumentLength = averageDocumentLength || 1000;
  }
}

/**
 * Extract terms from code content
 * @param {string} content - Code content to extract terms from
 * @param {string} language - Programming language
 * @param {Object} metadata - Additional metadata (function names, etc.)
 * @returns {Object} Term frequency mapping
 */
export function extractTerms(content, language, metadata = {}) {
  if (!content) {
    return {};
  }

  const terms = {};
  
  // Extract basic terms from content
  const basicTerms = extractBasicTerms(content, language);
  Object.assign(terms, basicTerms);
  
  // Add special terms from metadata
  if (metadata.functionName) {
    // Function names get higher weight
    terms[metadata.functionName] = (terms[metadata.functionName] || 0) + 2;
  }
  
  if (metadata.className) {
    // Class names get higher weight
    terms[metadata.className] = (terms[metadata.className] || 0) + 2;
  }
  
  if (metadata.imports && Array.isArray(metadata.imports)) {
    // Imports get moderate weight
    for (const imp of metadata.imports) {
      if (typeof imp === 'string') {
        terms[imp] = (terms[imp] || 0) + 1;
      }
    }
  }
  
  return terms;
}

/**
 * Extract basic terms from content based on language
 * @param {string} content - Content to extract terms from
 * @param {string} language - Programming language
 * @returns {Object} Term frequency mapping
 */
function extractBasicTerms(content, language) {
  const terms = {};
  
  if (!content) {
    return terms;
  }
  
  // Language-specific term extraction
  switch (language) {
    case 'javascript':
    case 'typescript':
      extractJavaScriptTerms(content, terms);
      break;
    case 'python':
      extractPythonTerms(content, terms);
      break;
    case 'java':
      extractJavaTerms(content, terms);
      break;
    default:
      // Generic term extraction for other languages
      extractGenericTerms(content, terms);
  }
  
  return terms;
}

/**
 * Extract terms from JavaScript/TypeScript content
 * @param {string} content - JavaScript content
 * @param {Object} terms - Terms object to populate
 */
function extractJavaScriptTerms(content, terms) {
  // Extract identifiers (variables, functions, etc.)
  const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
  let match;
  
  while ((match = identifierRegex.exec(content)) !== null) {
    const term = match[1].toLowerCase();
    // Filter out common keywords
    if (!isJavaScriptKeyword(term)) {
      terms[term] = (terms[term] || 0) + 1;
    }
  }
  
  // Extract string literals (potential domain terms)
  const stringRegex = /(["'`])([^"'`]+)\1/g;
  while ((match = stringRegex.exec(content)) !== null) {
    const stringContent = match[2];
    // Only include reasonably long strings
    if (stringContent.length > 2 && stringContent.length < 50) {
      const stringTerms = stringContent.toLowerCase().split(/[^a-zA-Z0-9]+/);
      for (const term of stringTerms) {
        if (term.length > 2) {
          terms[term] = (terms[term] || 0) + 1;
        }
      }
    }
  }
}

/**
 * Extract terms from Python content
 * @param {string} content - Python content
 * @param {Object} terms - Terms object to populate
 */
function extractPythonTerms(content, terms) {
  // Extract identifiers
  const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;
  
  while ((match = identifierRegex.exec(content)) !== null) {
    const term = match[1].toLowerCase();
    // Filter out common keywords
    if (!isPythonKeyword(term)) {
      terms[term] = (terms[term] || 0) + 1;
    }
  }
  
  // Extract string literals
  const stringRegex = /(["'`])([^"'`]+)\1/g;
  while ((match = stringRegex.exec(content)) !== null) {
    const stringContent = match[2];
    if (stringContent.length > 2 && stringContent.length < 50) {
      const stringTerms = stringContent.toLowerCase().split(/[^a-zA-Z0-9]+/);
      for (const term of stringTerms) {
        if (term.length > 2) {
          terms[term] = (terms[term] || 0) + 1;
        }
      }
    }
  }
}

/**
 * Extract terms from Java content
 * @param {string} content - Java content
 * @param {Object} terms - Terms object to populate
 */
function extractJavaTerms(content, terms) {
  // Extract identifiers
  const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
  let match;
  
  while ((match = identifierRegex.exec(content)) !== null) {
    const term = match[1].toLowerCase();
    // Filter out common keywords
    if (!isJavaKeyword(term)) {
      terms[term] = (terms[term] || 0) + 1;
    }
  }
  
  // Extract string literals
  const stringRegex = /"([^"]+)"/g;
  while ((match = stringRegex.exec(content)) !== null) {
    const stringContent = match[1];
    if (stringContent.length > 2 && stringContent.length < 50) {
      const stringTerms = stringContent.toLowerCase().split(/[^a-zA-Z0-9]+/);
      for (const term of stringTerms) {
        if (term.length > 2) {
          terms[term] = (terms[term] || 0) + 1;
        }
      }
    }
  }
}

/**
 * Extract terms from generic content
 * @param {string} content - Generic content
 * @param {Object} terms - Terms object to populate
 */
function extractGenericTerms(content, terms) {
  // Simple word-based term extraction
  const wordRegex = /\b([a-zA-Z][a-zA-Z0-9]{2,})\b/g;
  let match;
  
  while ((match = wordRegex.exec(content)) !== null) {
    const term = match[1].toLowerCase();
    terms[term] = (terms[term] || 0) + 1;
  }
}

/**
 * Check if term is a JavaScript keyword
 * @param {string} term - Term to check
 * @returns {boolean} True if term is a JavaScript keyword
 */
function isJavaScriptKeyword(term) {
  const keywords = new Set([
    'abstract', 'await', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
    'const', 'continue', 'debugger', 'default', 'delete', 'do', 'double', 'else',
    'enum', 'export', 'extends', 'false', 'final', 'finally', 'float', 'for',
    'function', 'goto', 'if', 'implements', 'import', 'in', 'instanceof', 'int',
    'interface', 'let', 'long', 'native', 'new', 'null', 'package', 'private',
    'protected', 'public', 'return', 'short', 'static', 'super', 'switch',
    'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try',
    'typeof', 'var', 'void', 'volatile', 'while', 'with', 'yield'
  ]);
  
  return keywords.has(term);
}

/**
 * Check if term is a Python keyword
 * @param {string} term - Term to check
 * @returns {boolean} True if term is a Python keyword
 */
function isPythonKeyword(term) {
  const keywords = new Set([
    'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif',
    'else', 'except', 'exec', 'finally', 'for', 'from', 'global', 'if', 'import',
    'in', 'is', 'lambda', 'not', 'or', 'pass', 'print', 'raise', 'return', 'try',
    'while', 'with', 'yield', 'None', 'True', 'False'
  ]);
  
  return keywords.has(term);
}

/**
 * Check if term is a Java keyword
 * @param {string} term - Term to check
 * @returns {boolean} True if term is a Java keyword
 */
function isJavaKeyword(term) {
  const keywords = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
    'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
    'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
    'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
    'package', 'private', 'protected', 'public', 'return', 'short', 'static',
    'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
    'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null'
  ]);
  
  return keywords.has(term);
}

/**
 * Combine vector similarity score with BM25 score
 * @param {number} vectorScore - Cosine similarity score (0-1)
 * @param {number} bm25Score - Normalized BM25 score (0-1)
 * @param {Object} weights - Weighting parameters
 * @returns {number} Combined score (0-1)
 */
export function combineScores(vectorScore, bm25Score, weights = {}) {
  const vectorWeight = weights.vector || 0.7;
  const bm25Weight = weights.bm25 || 0.2;
  const structuralWeight = weights.structural || 0.1;
  
  // Ensure weights sum to 1
  const totalWeight = vectorWeight + bm25Weight + structuralWeight;
  const normalizedVectorWeight = vectorWeight / totalWeight;
  const normalizedBm25Weight = bm25Weight / totalWeight;
  const normalizedStructuralWeight = structuralWeight / totalWeight;
  
  return (vectorScore * normalizedVectorWeight) + 
         (bm25Score * normalizedBm25Weight) + 
         (0 * normalizedStructuralWeight); // Placeholder for structural score
}

/**
 * Tokenize query string into terms
 * @param {string} query - Query string
 * @param {string} language - Programming language context
 * @returns {Array<string>} Array of query terms
 */
export function tokenizeQuery(query, language) {
  if (!query) {
    return [];
  }
  
  // Simple tokenization for now
  const terms = query.toLowerCase()
    .split(/[^a-zA-Z0-9_]+/)
    .filter(term => term.length > 1);
  
  return terms;
}