// Global test setup
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock console methods to prevent spam during tests
const originalConsole = { ...console };
console.log = vi.fn();
console.error = vi.fn();
console.warn = vi.fn();

// Set test environment
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

// Mock Ollama responses
global.fetch.mockImplementation((url) => {
  if (url.includes('/api/tags')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        models: [
          { name: 'llama3.2' },
          { name: 'nomic-embed-text' }
        ]
      })
    });
  }
  
  if (url.includes('/api/chat')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        message: {
          content: 'Mock response from Ollama'
        }
      })
    });
  }
  
  return Promise.reject(new Error('Network connection failed'));
});

// Restore console for debugging when needed
global.restoreConsole = () => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
};