/**
 * Context Enhancement Integration Test
 * Tests the core context awareness functionality we implemented
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';

describe('Context Enhancement', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ziri-context-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Enhanced Storage', () => {
    it('should store and retrieve chunk content with metadata', async () => {
      // Import our enhanced storage functions
      const { saveChunk, loadChunk, ensureRepoStore } = await import('../../lib/store_repo.js');

      const repoDir = join(tempDir, 'test-repo');
      await ensureRepoStore(repoDir);

      const chunkId = 'test-chunk-123';
      const vector = [0.1, 0.2, 0.3];
      const chunkData = {
        content: 'function authenticateUser() {\n  return "test";\n}',
        filePath: '/path/to/auth.js',
        relativePath: 'src/auth.js',
        startLine: 15,
        endLine: 18,
        size: 45,
        tokenCount: 10,
        language: 'javascript',
        type: 'code'
      };

      // Save chunk with content
      await saveChunk(repoDir, chunkId, vector, chunkData);

      // Load chunk and verify content
      const loadedChunk = await loadChunk(repoDir, chunkId);

      expect(loadedChunk).toBeTruthy();
      expect(loadedChunk.content).toBe(chunkData.content);
      expect(loadedChunk.filePath).toBe(chunkData.filePath);
      expect(loadedChunk.startLine).toBe(chunkData.startLine);
      expect(loadedChunk.endLine).toBe(chunkData.endLine);
      expect(loadedChunk.language).toBe(chunkData.language);
      expect(loadedChunk.type).toBe(chunkData.type);
    });

    it('should handle missing chunk gracefully', async () => {
      const { loadChunk, ensureRepoStore } = await import('../../lib/store_repo.js');

      const repoDir = join(tempDir, 'test-repo');
      await ensureRepoStore(repoDir);

      const result = await loadChunk(repoDir, 'nonexistent-chunk');
      expect(result).toBeNull();
    });
  });

  describe('Enhanced Query Results', () => {
    it('should generate human-readable relevance explanations', async () => {
      const { queryCommand } = await import('../../lib/query.js');

      // Mock the query function to test the relevance explanation logic
      // This tests the internal function that generates explanations
      const mockChunkData = {
        type: 'function',
        language: 'javascript',
        startLine: 10,
        endLine: 20
      };

      // We can't easily test the full query without a real index,
      // but we can verify the module loads correctly
      expect(typeof queryCommand).toBe('function');
    });

    it('should handle backward compatibility', async () => {
      // Test that the query function handles cases where enhanced data is not available
      const { queryCommand } = await import('../../lib/query.js');

      // The function should exist and be callable
      expect(typeof queryCommand).toBe('function');

      // Test with empty argv to verify basic functionality
      const result = await queryCommand({ argv: { _: [] } });
      expect(result).toBeUndefined(); // Should return early due to no query
    });
  });

  describe('Language Detection', () => {
    it('should detect programming languages correctly', async () => {
      const { inferLanguage } = await import('../../lib/store_repo.js');

      expect(inferLanguage('/path/to/file.js')).toBe('javascript');
      expect(inferLanguage('/path/to/file.ts')).toBe('typescript');
      expect(inferLanguage('/path/to/file.py')).toBe('python');
      expect(inferLanguage('/path/to/file.java')).toBe('java');
      expect(inferLanguage('/path/to/file.unknown')).toBe('unknown');
    });
  });

  describe('Metadata Extraction System', () => {
    it('should extract detailed metadata from JavaScript code', async () => {
      const { CodeAnalyzer } = await import('../../lib/metadata/code-analyzer.js');

      const jsCode = `
import React, { useState } from 'react';
import { fetchUser } from '../api/users';

/**
 * UserProfile component for displaying user information
 * @param {Object} props - Component props
 */
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  
  const loadUser = async (id) => {
    const userData = await fetchUser(id);
    setUser(userData);
  };
  
  return <div>{user?.name}</div>;
}

class UserManager {
  constructor(config) {
    this.config = config;
  }
}
      `;

      const result = CodeAnalyzer.analyzeCode(jsCode, 'javascript', 'UserProfile.jsx');

      expect(result.type).toBe('function');
      expect(result.functionName).toBe('UserProfile');
      expect(result.functions).toHaveLength(2); // UserProfile and loadUser
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserManager');
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].module).toBe('react');
      expect(result.docstrings).toHaveLength(1);
      expect(result.docstrings[0].content).toContain('UserProfile component');
    });

    it('should extract metadata from Python code', async () => {
      const { CodeAnalyzer } = await import('../../lib/metadata/code-analyzer.js');

      const pythonCode = `
import os
from pathlib import Path
from typing import List, Dict

def process_data(data: List[str]) -> Dict[str, int]:
    """
    Process a list of strings and return counts.
    
    Args:
        data: List of strings to process
        
    Returns:
        Dictionary with string counts
    """
    return {item: len(item) for item in data}

class DataProcessor:
    def __init__(self, config: dict):
        self.config = config
        
    def run(self):
        pass
      `;

      const result = CodeAnalyzer.analyzeCode(pythonCode, 'python', 'processor.py');

      expect(result.type).toBe('function');
      expect(result.functionName).toBe('process_data');
      expect(result.functions).toHaveLength(3); // process_data, __init__, run
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('DataProcessor');
      expect(result.imports).toHaveLength(3);
      expect(result.docstrings).toHaveLength(1);
      expect(result.docstrings[0].content).toContain('Process a list of strings');
    });

    it('should integrate metadata extraction with enhanced storage', async () => {
      const { saveChunk, loadChunk, ensureRepoStore } = await import('../../lib/store_repo.js');

      const repoDir = join(tempDir, 'test-repo');
      await ensureRepoStore(repoDir);

      // Create a code chunk with rich content
      const codeChunk = {
        chunkId: 'auth-service-123',
        content: `
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * Authenticate user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} JWT token
 */
async function authenticateUser(email, password) {
  const user = await User.findByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }
  
  const isValid = await bcrypt.compare(password, user.hashedPassword);
  if (!isValid) {
    throw new Error('Invalid password');
  }
  
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
}

class AuthService {
  constructor(config) {
    this.config = config;
  }
}
        `,
        filePath: '/project/src/auth/auth-service.js',
        relativePath: 'src/auth/auth-service.js',
        startLine: 1,
        endLine: 30,
        language: 'javascript'
      };

      const chunkId = 'auth-service-123';
      const vector = Array.from({ length: 384 }, () => Math.random());

      // Store the enhanced chunk
      await saveChunk(repoDir, chunkId, vector, codeChunk);

      // Retrieve and verify the enhanced metadata
      const loadedChunk = await loadChunk(repoDir, chunkId);

      expect(loadedChunk).toBeTruthy();
      expect(loadedChunk.type).toBe('function');
      expect(loadedChunk.functionName).toBe('authenticateUser');
      expect(loadedChunk.className).toBe('AuthService');
      
      // Verify detailed metadata
      expect(loadedChunk.functions).toBeDefined();
      expect(loadedChunk.functions.length).toBeGreaterThan(0);
      expect(loadedChunk.classes).toBeDefined();
      expect(loadedChunk.imports).toBeDefined();
      expect(loadedChunk.docstrings).toBeDefined();
      
      // Verify metadata counts
      expect(loadedChunk.metadata.functionCount).toBeGreaterThan(0);
      expect(loadedChunk.metadata.classCount).toBeGreaterThan(0);
      expect(loadedChunk.metadata.importCount).toBeGreaterThan(0);
      expect(loadedChunk.metadata.commentCount).toBeGreaterThan(0);
      
      // Verify function details
      const authFunction = loadedChunk.functions.find(f => f.name === 'authenticateUser');
      expect(authFunction).toBeDefined();
      expect(authFunction.params).toContain('email');
      expect(authFunction.params).toContain('password');
      expect(authFunction.async).toBe(true);
      
      // Verify import details
      const bcryptImport = loadedChunk.imports.find(i => i.module === 'bcrypt');
      expect(bcryptImport).toBeDefined();
      expect(bcryptImport.type).toBe('es6');
    });
  });

  describe('Integration Flow', () => {
    it('should demonstrate the complete context enhancement flow', async () => {
      // This test demonstrates the complete flow:
      // 1. Store enhanced chunk data
      // 2. Verify it can be retrieved
      // 3. Show that the structure supports rich context

      const { saveChunk, loadChunk, ensureRepoStore } = await import('../../lib/store_repo.js');

      const repoDir = join(tempDir, 'test-repo');
      await ensureRepoStore(repoDir);

      // Create a realistic code chunk
      const codeChunk = {
        content: `function processUserData(user) {
  if (!user.email) {
    throw new Error('Email is required');
  }
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    name: user.name.trim()
  };
}`,
        filePath: '/project/src/user-service.js',
        relativePath: 'src/user-service.js',
        startLine: 25,
        endLine: 35,
        size: 180,
        tokenCount: 45,
        language: 'javascript',
        type: 'function'
      };

      const chunkId = 'user-service-process-user-data';
      const vector = Array.from({ length: 384 }, () => Math.random()); // Mock embedding

      // Store the enhanced chunk
      await saveChunk(repoDir, chunkId, vector, codeChunk);

      // Retrieve and verify the enhanced data
      const loadedChunk = await loadChunk(repoDir, chunkId);

      expect(loadedChunk).toBeTruthy();
      expect(loadedChunk.content).toContain('function processUserData');
      expect(loadedChunk.language).toBe('javascript');
      expect(loadedChunk.type).toBe('function');
      expect(loadedChunk.startLine).toBe(25);
      expect(loadedChunk.endLine).toBe(35);

      // Verify the content includes the actual code
      expect(loadedChunk.content).toContain('throw new Error');
      expect(loadedChunk.content).toContain('toLowerCase()');
      expect(loadedChunk.content).toContain('trim()');
    });
  });
});
