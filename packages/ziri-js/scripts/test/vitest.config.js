import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    include: ['test/**/*.test.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**'
    ],
    // Prevent hanging tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Mock setup
    setupFiles: ['./test/setup.js']
  }
});