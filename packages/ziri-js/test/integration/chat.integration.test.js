/**
 * Chat Command Integration Tests
 * Tests the chat command with mocked external dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chatCommand } from '../../lib/chat.js';

// Mock external dependencies
vi.mock('../../lib/query.js', () => ({
  queryCommand: vi.fn()
}));

vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

const originalConsole = { ...console };

describe('Chat Command Integration', () => {
  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    vi.clearAllMocks();
  });

  describe('Full Workflow Integration', () => {
    it('should successfully process a query with context and generate response', async () => {
      // Mock successful context retrieval
      const mockContextResults = [
        {
          file: 'src/store/index.js',
          chunks: 2,
          content: `import { createStore, combineReducers } from 'redux';
const rootReducer = combineReducers({
  user: userReducer,
  cart: cartReducer
});
export const store = createStore(rootReducer);`
        },
        {
          file: 'src/store/cart.js',
          chunks: 1,
          content: `const cartReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'ADD_TO_CART':
      return { ...state, items: [...state.items, action.payload] };
    default:
      return state;
  }
};`
        }
      ];

      // Mock query command to return context
      const { queryCommand } = await import('../../lib/query.js');
      queryCommand.mockImplementation(() => {
        // Simulate the console output that parseQueryOutput would parse
        console.log('📄 src/store/index.js (2 chunks, 0.5KB)');
        console.log('📄 src/store/cart.js (1 chunks, 0.3KB)');
        console.log('📊 Found 2 indexed items');
        console.log('📭 No results found in current repository');
        return Promise.resolve(mockContextResults);
      });

      // Mock Ollama API response
      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: 'Based on the Redux store implementation, the state management works by using combineReducers to merge multiple reducers (user and cart) into a root reducer, then creating a store with createStore(). The cart reducer handles actions like ADD_TO_CART by returning new state with the added item.'
        })
      });

      // Mock configuration manager
      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          providers: {
            ollama: {
              baseUrl: 'http://localhost:11434',
              model: 'nomic-embed-text'
            }
          }
        })
      };

      await chatCommand({
        argv: {
          _: ['chat', 'how does state management work?'],
          k: '5',
          scope: 'repo',
          verbose: true
        },
        configManager: mockConfigManager
      });

      // Verify the workflow
      expect(queryCommand).toHaveBeenCalledWith({
        _: ['query', 'how does state management work?'],
        k: '5',
        scope: 'repo',
        verbose: true
      });

      expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));

      // Check that the final response was displayed
      expect(console.log).toHaveBeenCalledWith('\n🎯 Ziri Chat Response:');
      expect(console.log).toHaveBeenCalledWith('═'.repeat(80));
      expect(console.log).toHaveBeenCalledWith(
        'Based on the Redux store implementation, the state management works by using combineReducers to merge multiple reducers (user and cart) into a root reducer, then creating a store with createStore(). The cart reducer handles actions like ADD_TO_CART by returning new state with the added item.'
      );
    });

    it('should handle case when no context is found', async () => {
      // Mock empty context results
      const { queryCommand } = await import('../../lib/query.js');
      queryCommand.mockImplementation(() => {
        console.log('📭 No results found in current repository');
        return Promise.resolve([]);
      });

      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          providers: {
            ollama: { baseUrl: 'http://localhost:11434' }
          }
        })
      };

      await chatCommand({
        argv: { _: ['chat', 'unknown topic'], k: '3' },
        configManager: mockConfigManager
      });

      expect(console.log).toHaveBeenCalledWith('❌ No relevant context found in vector store.');
      expect(console.log).toHaveBeenCalledWith('💡 Try indexing your repository first: ziri index');
    });

    it('should handle Ollama API errors gracefully', async () => {
      // Mock context retrieval
      const { queryCommand } = await import('../../lib/query.js');
      queryCommand.mockResolvedValue([
        {
          file: 'test.js',
          chunks: 1,
          content: 'console.log("test");'
        }
      ]);

      // Mock Ollama API failure
      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          providers: {
            ollama: { baseUrl: 'http://localhost:11434' }
          }
        })
      };

      await expect(chatCommand({
        argv: { _: ['chat', 'test query'], verbose: true },
        configManager: mockConfigManager
      })).rejects.toThrow('Ollama API error: 500 Internal Server Error');
    });

    it('should handle network connection errors', async () => {
      const { queryCommand } = await import('../../lib/query.js');
      queryCommand.mockResolvedValue([
        {
          file: 'test.js',
          chunks: 1,
          content: 'console.log("test");'
        }
      ]);

      const fetch = (await import('node-fetch')).default;
      fetch.mockRejectedValue(new Error('Network connection failed'));

      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          providers: {
            ollama: { baseUrl: 'http://invalid-host' }
          }
        })
      };

      await expect(chatCommand({
        argv: { _: ['chat', 'test query'] },
        configManager: mockConfigManager
      })).rejects.toThrow('Cannot connect to Ollama');
    });
  });

  describe('Context Parsing', () => {
    it('should correctly parse query output into context results', async () => {
      // This is testing the internal parseQueryOutput function indirectly
      const { queryCommand } = await import('../../lib/query.js');

      // Simulate the exact console output format
      queryCommand.mockImplementation(() => {
        console.log('📄 src/components/App.jsx (4 chunks, 11.8KB)');
        console.log('import React, { useState } from "react";');
        console.log('const App = () => {');
        console.log('  const [user, setUser] = useState(null);');
        console.log('  return <div>Hello World</div>;');
        console.log('};');
        console.log('📄 src/utils/helpers.js (2 chunks, 3.2KB)');
        console.log('export const formatDate = (date) => {');
        console.log('  return date.toLocaleDateString();');
        console.log('};');
        console.log('📊 Found 2 indexed items');
        console.log('📭 No results found in current repository');

        return Promise.resolve([
          {
            file: 'src/components/App.jsx',
            chunks: 4,
            content: 'import React, { useState } from "react";\nconst App = () => {\n  const [user, setUser] = useState(null);\n  return <div>Hello World</div>;\n};'
          },
          {
            file: 'src/utils/helpers.js',
            chunks: 2,
            content: 'export const formatDate = (date) => {\n  return date.toLocaleDateString();\n};'
          }
        ]);
      });

      const fetch = (await import('node-fetch')).default;
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: 'This is a React application with a helper utility.'
        })
      });

      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          providers: {
            ollama: { baseUrl: 'http://localhost:11434' }
          }
        })
      };

      await chatCommand({
        argv: { _: ['chat', 'what is this application?'], k: '5' },
        configManager: mockConfigManager
      });

      expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));

      // Verify the prompt contains both files
      const callArgs = fetch.mock.calls[0][1];
      const requestBody = JSON.parse(callArgs.body);
      expect(requestBody.prompt).toContain('src/components/App.jsx');
      expect(requestBody.prompt).toContain('src/utils/helpers.js');
    });
  });
});
