#!/usr/bin/env node

/**
 * Ziri LSP Server Entry Point
 * 
 * This script starts the Ziri Language Server Protocol server
 * for IDE integration.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the LSP server implementation
const serverPath = join(__dirname, 'lib', 'lsp', 'server.js');

// Start the LSP server
const server = spawn('node', [serverPath], {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc']
});

server.on('error', (error) => {
  console.error('❌ Failed to start Ziri LSP server:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Ziri LSP server exited with code ${code}`);
    process.exit(code || 1);
  }
  console.log('✅ Ziri LSP server stopped');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Ziri LSP server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping Ziri LSP server...');
  server.kill('SIGTERM');
});