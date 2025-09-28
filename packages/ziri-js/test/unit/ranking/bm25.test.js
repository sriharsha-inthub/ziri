/**
 * Tests for BM25 ranking implementation
 */

import { BM25Scorer, extractTerms, combineScores, tokenizeQuery } from './bm25.js';
import { describe, it, expect } from 'vitest';

describe('BM25Scorer', () => {
  describe('calculateIDF', () => {
    it('should calculate IDF correctly', () => {
      const scorer = new BM25Scorer({
        termStats: { 'test': 5 },
        totalDocuments: 100
      });
      
      const idf = scorer.calculateIDF('test');
      expect(idf).toBeGreaterThan(0);
    });
    
    it('should return 0 for unknown terms', () => {
      const scorer = new BM25Scorer({
        termStats: { 'test': 5 },
        totalDocuments: 100
      });
      
      const idf = scorer.calculateIDF('unknown');
      expect(idf).toBe(0);
    });
    
    it('should return 0 when total documents is 0', () => {
      const scorer = new BM25Scorer({
        termStats: { 'test': 5 },
        totalDocuments: 0
      });
      
      const idf = scorer.calculateIDF('test');
      expect(idf).toBe(0);
    });
  });
  
  describe('calculateLengthNormalization', () => {
    it('should calculate length normalization correctly', () => {
      const scorer = new BM25Scorer({
        b: 0.75,
        averageDocumentLength: 1000
      });
      
      const norm = scorer.calculateLengthNormalization(500);
      expect(norm).toBeGreaterThan(0);
    });
    
    it('should return 1 when average document length is 0', () => {
      const scorer = new BM25Scorer({
        b: 0.75,
        averageDocumentLength: 0
      });
      
      const norm = scorer.calculateLengthNormalization(500);
      expect(norm).toBe(1);
    });
  });
  
  describe('calculateScore', () => {
    it('should calculate BM25 score correctly', () => {
      const scorer = new BM25Scorer({
        k1: 1.5,
        b: 0.75,
        termStats: { 'function': 10, 'user': 20 },
        totalDocuments: 100,
        averageDocumentLength: 1000
      });
      
      const queryTerms = ['function', 'user'];
      const documentTerms = { 'function': 3, 'user': 2 };
      const documentLength = 800;
      
      const score = scorer.calculateScore(queryTerms, documentTerms, documentLength);
      expect(score).toBeGreaterThanOrEqual(0);
    });
    
    it('should return 0 for empty query terms', () => {
      const scorer = new BM25Scorer();
      const score = scorer.calculateScore([], { 'test': 1 }, 100);
      expect(score).toBe(0);
    });
    
    it('should return 0 for null query terms', () => {
      const scorer = new BM25Scorer();
      const score = scorer.calculateScore(null, { 'test': 1 }, 100);
      expect(score).toBe(0);
    });
  });
  
  describe('normalizeScore', () => {
    it('should normalize score to 0-1 range', () => {
      const scorer = new BM25Scorer();
      const normalized = scorer.normalizeScore(5, 10);
      expect(normalized).toBe(0.5);
    });
    
    it('should return 0 for negative scores', () => {
      const scorer = new BM25Scorer();
      const normalized = scorer.normalizeScore(-1, 10);
      expect(normalized).toBe(0);
    });
    
    it('should cap at 1 for scores exceeding max', () => {
      const scorer = new BM25Scorer();
      const normalized = scorer.normalizeScore(15, 10);
      expect(normalized).toBe(1);
    });
  });
});

describe('extractTerms', () => {
  it('should extract terms from JavaScript content', () => {
    const content = `
      function getUserData(userId) {
        const userData = fetchUser(userId);
        return userData;
      }
    `;
    
    const terms = extractTerms(content, 'javascript');
    expect(terms).toHaveProperty('function');
    expect(terms).toHaveProperty('getuserdata');
    expect(terms).toHaveProperty('userid');
    expect(terms).toHaveProperty('userdata');
    expect(terms).toHaveProperty('fetchuser');
  });
  
  it('should extract terms from Python content', () => {
    const content = `
      def get_user_data(user_id):
        user_data = fetch_user(user_id)
        return user_data
    `;
    
    const terms = extractTerms(content, 'python');
    expect(terms).toHaveProperty('def');
    expect(terms).toHaveProperty('get_user_data');
    expect(terms).toHaveProperty('user_id');
    expect(terms).toHaveProperty('user_data');
    expect(terms).toHaveProperty('fetch_user');
  });
  
  it('should handle metadata terms', () => {
    const content = 'const data = getData();';
    const metadata = {
      functionName: 'getData',
      className: 'DataManager',
      imports: ['lodash', 'express']
    };
    
    const terms = extractTerms(content, 'javascript', metadata);
    expect(terms['getdata']).toBeGreaterThan(1); // Higher weight for function name
    expect(terms['datamanager']).toBeGreaterThan(1); // Higher weight for class name
    expect(terms['lodash']).toBe(1); // Normal weight for import
  });
  
  it('should return empty object for empty content', () => {
    const terms = extractTerms('', 'javascript');
    expect(terms).toEqual({});
  });
});

describe('combineScores', () => {
  it('should combine scores with default weights', () => {
    const combined = combineScores(0.8, 0.6);
    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThanOrEqual(1);
  });
  
  it('should combine scores with custom weights', () => {
    const combined = combineScores(0.8, 0.6, {
      vector: 0.5,
      bm25: 0.3,
      structural: 0.2
    });
    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThanOrEqual(1);
  });
  
  it('should handle edge cases', () => {
    const combined = combineScores(0, 0);
    expect(combined).toBe(0);
  });
});

describe('tokenizeQuery', () => {
  it('should tokenize query correctly', () => {
    const terms = tokenizeQuery('getUserData function', 'javascript');
    expect(terms).toContain('getuserdata');
    expect(terms).toContain('function');
  });
  
  it('should handle empty query', () => {
    const terms = tokenizeQuery('', 'javascript');
    expect(terms).toEqual([]);
  });
  
  it('should filter short terms', () => {
    const terms = tokenizeQuery('a bb ccc', 'javascript');
    expect(terms).not.toContain('a');
    expect(terms).toContain('bb');
    expect(terms).toContain('ccc');
  });
});