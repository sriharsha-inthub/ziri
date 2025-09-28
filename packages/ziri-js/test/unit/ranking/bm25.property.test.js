/**
 * Property-based tests for BM25 ranking implementation
 */

import { forall } from '../testing/property.js';
import { gen } from '../testing/property.js';
import { codeChunk, termFreqData, vector } from '../testing/generators.js';
import { BM25Scorer, extractTerms, combineScores, tokenizeQuery } from '../ranking/bm25.js';

describe('BM25 Property Tests', () => {
  it('BM25 score is non-negative', async () => {
    const results = await forall(
      'BM25 score is non-negative',
      [
        gen.array(gen.string({ minLength: 1, maxLength: 20 })), // queryTerms
        gen.dictionary(gen.string({ minLength: 1, maxLength: 20 }), gen.int(0, 100)), // documentTerms
        gen.int(100, 10000) // documentLength
      ],
      (queryTerms, documentTerms, documentLength) => {
        const scorer = new BM25Scorer({
          termStats: Object.keys(documentTerms).reduce((acc, term) => {
            acc[term] = 1;
            return acc;
          }, {}),
          totalDocuments: 100
        });
        const score = scorer.calculateScore(queryTerms, documentTerms, documentLength);
        return score >= 0;
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
  
  it('BM25 score increases with term frequency', async () => {
    const results = await forall(
      'BM25 score increases with term frequency',
      [
        gen.string({ minLength: 1, maxLength: 20 }), // term
        gen.int(1, 50), // base frequency
        gen.int(100, 1000), // document length
        gen.int(1, 100) // document count
      ],
      (term, baseFreq, documentLength, docCount) => {
        const documentTerms1 = { [term]: baseFreq };
        const documentTerms2 = { [term]: baseFreq * 2 };
        const queryTerms = [term];
        
        const scorer = new BM25Scorer({
          termStats: { [term]: docCount },
          totalDocuments: 100
        });
        
        const score1 = scorer.calculateScore(queryTerms, documentTerms1, documentLength);
        const score2 = scorer.calculateScore(queryTerms, documentTerms2, documentLength);
        
        // Score should be non-decreasing with frequency
        return score2 >= score1;
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
  
  it('BM25 score is normalized to 0-1 range', async () => {
    const results = await forall(
      'BM25 score is normalized to 0-1 range',
      [
        gen.float(0, 100), // raw score
        gen.float(1, 1000) // max score
      ],
      (rawScore, maxScore) => {
        const scorer = new BM25Scorer();
        const normalized = scorer.normalizeScore(rawScore, maxScore);
        return normalized >= 0 && normalized <= 1;
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
});

describe('Term Extraction Property Tests', () => {
  it('extractTerms returns object with string keys and number values', async () => {
    const results = await forall(
      'extractTerms returns valid term frequency object',
      [
        gen.string({ maxLength: 1000 }), // content
        gen.oneOf(['javascript', 'python', 'java', 'unknown']), // language
        gen.object({
          functionName: gen.string({ maxLength: 50 }),
          className: gen.string({ maxLength: 50 }),
          imports: gen.array(gen.string({ maxLength: 50 }))
        }) // metadata
      ],
      (content, language, metadata) => {
        const terms = extractTerms(content, language, metadata);
        
        // Check that terms is an object
        if (typeof terms !== 'object' || terms === null) {
          return false;
        }
        
        // Check that all keys are strings and values are numbers
        for (const [key, value] of Object.entries(terms)) {
          if (typeof key !== 'string' || typeof value !== 'number') {
            return false;
          }
          if (value < 0) {
            return false;
          }
        }
        
        return true;
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
});

describe('Score Combination Property Tests', () => {
  it('combineScores returns value in 0-1 range', async () => {
    const results = await forall(
      'combineScores returns value in 0-1 range',
      [
        gen.float(0, 1), // vectorScore
        gen.float(0, 1), // bm25Score
        gen.object({
          vector: gen.float(0, 1),
          bm25: gen.float(0, 1),
          structural: gen.float(0, 1)
        }) // weights
      ],
      (vectorScore, bm25Score, weights) => {
        const combined = combineScores(vectorScore, bm25Score, weights);
        return combined >= 0 && combined <= 1;
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
  
  it('combineScores with equal weights sums to components', async () => {
    const results = await forall(
      'combineScores with equal weights',
      [
        gen.float(0, 1), // vectorScore
        gen.float(0, 1)  // bm25Score
      ],
      (vectorScore, bm25Score) => {
        const combined = combineScores(vectorScore, bm25Score, {
          vector: 1,
          bm25: 1,
          structural: 0
        });
        
        // With equal weights of 1 and structural=0, result should be average
        const expected = (vectorScore + bm25Score) / 2;
        // Allow for small floating point differences
        return Math.abs(combined - expected) < 0.0001;
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
});

describe('Query Tokenization Property Tests', () => {
  it('tokenizeQuery returns array of strings', async () => {
    const results = await forall(
      'tokenizeQuery returns array of strings',
      [
        gen.string({ maxLength: 200 }), // query
        gen.oneOf(['javascript', 'python', 'java']) // language
      ],
      (query, language) => {
        const terms = tokenizeQuery(query, language);
        
        // Check that terms is an array
        if (!Array.isArray(terms)) {
          return false;
        }
        
        // Check that all elements are strings
        return terms.every(term => typeof term === 'string');
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
  
  it('tokenizeQuery filters short terms', async () => {
    const results = await forall(
      'tokenizeQuery filters short terms',
      [
        gen.string({ maxLength: 200 }), // query
        gen.oneOf(['javascript', 'python', 'java']) // language
      ],
      (query, language) => {
        const terms = tokenizeQuery(query, language);
        
        // Check that all terms have length >= 2
        return terms.every(term => term.length >= 2);
      },
      { numTests: 50 }
    );
    
    expect(results.failed).toBe(0);
  });
});