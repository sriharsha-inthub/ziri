import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function lspCommand({ argv }) {
  console.log('🚀 Starting Ziri LSP server...');
  
  // Determine communication method
  let transport = '--stdio';
  if (argv.socket) {
    transport = `--socket=${argv.socket}`;
  } else if (argv['node-ipc']) {
    transport = '--node-ipc';
  }
  
  // Path to the LSP server implementation
  const serverPath = join(__dirname, '..', 'lib', 'lsp', 'server.js');
  
  // Start the LSP server
  const server = spawn('node', [serverPath, transport], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  });
  
  server.stdout?.on('data', (data) => {
    console.log(`[LSP Server] ${data}`);
  });
  
  server.stderr?.on('data', (data) => {
    console.error(`[LSP Server Error] ${data}`);
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
  
  console.log('✅ Ziri LSP server started');
  console.log('💡 Connect your IDE to use Ziri with Language Server Protocol');
  console.log('💡 Supported features: Hover, Definition, Workspace Symbols');
  
  // Keep the process alive
  await new Promise(() => {});
}