/**
 * Simple HTTP server for Ziri Configuration UI
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create HTTP server for configuration UI
 * @param {number} port - Port to listen on
 * @returns {http.Server} HTTP server instance
 */
export function createConfigServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    try {
      // Serve the configuration UI
      if (req.method === 'GET' && req.url === '/') {
        const indexPath = path.join(__dirname, 'index.html');
        const content = await fs.readFile(indexPath, 'utf-8');
        
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Length': Buffer.byteLength(content)
        });
        res.end(content);
      } 
      // Serve static assets (CSS, JS, etc.)
      else if (req.method === 'GET' && req.url.startsWith('/static/')) {
        const filePath = path.join(__dirname, req.url);
        const content = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        
        const contentType = getContentType(ext);
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(content)
        });
        res.end(content);
      }
      // API endpoints
      else if (req.method === 'GET' && req.url === '/api/config') {
        // Return current configuration
        const config = {
          general: {
            defaultProvider: 'ollama',
            concurrency: 5,
            batchSize: 100,
            memoryLimit: 512
          },
          indexing: {
            chunkSize: 4000,
            overlapRatio: 0.15,
            excludePatterns: [
              '**/node_modules/**',
              '**/.git/**',
              '**/dist/**'
            ],
            parallelWalk: {
              enabled: false,
              concurrency: 4
            }
          },
          query: {
            defaultResults: 8,
            ranking: {
              bm25: {
                enabled: true,
                k1: 1.5,
                b: 0.75,
                weights: {
                  vector: 0.7,
                  bm25: 0.2,
                  structural: 0.1
                }
              }
            }
          },
          advanced: {
            caching: {
              enabled: true,
              maxSize: 1000
            },
            memory: {
              gcInterval: 30000
            },
            performance: {
              profiling: false
            }
          }
        };
        
        const json = JSON.stringify(config, null, 2);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(json)
        });
        res.end(json);
      }
      else if (req.method === 'POST' && req.url === '/api/config') {
        // Save configuration
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            console.log('Configuration saved:', config);
            
            res.writeHead(200, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: true, message: 'Configuration saved' }));
          } catch (error) {
            res.writeHead(400, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        });
      }
      else {
        // 404 Not Found
        res.writeHead(404, {
          'Content-Type': 'text/plain'
        });
        res.end('Not Found');
      }
    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });
      res.end('Internal Server Error');
    }
  });
  
  return server;
}

/**
 * Get content type based on file extension
 * @param {string} ext - File extension
 * @returns {string} Content type
 */
function getContentType(ext) {
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  
  return types[ext] || 'application/octet-stream';
}

/**
 * Start configuration UI server
 * @param {Object} options - Server options
 */
export async function startConfigUI(options = {}) {
  const port = options.port || 3000;
  const server = createConfigServer(port);
  
  server.listen(port, () => {
    console.log(`🚀 Ziri Configuration UI Server running on http://localhost:${port}`);
    console.log(`🔧 Access the configuration UI at http://localhost:${port}`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down configuration UI server...');
    server.close(() => {
      console.log('✅ Configuration UI server closed');
      process.exit(0);
    });
  });
  
  return server;
}