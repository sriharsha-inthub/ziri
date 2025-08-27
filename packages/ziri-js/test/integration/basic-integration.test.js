import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RepositoryParser } from '../../lib/repository/repository-parser.js';

describe('Integration Test - Streaming File Discovery and Processing', () => {
  let tempDir;
  let repositoryParser;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'integration-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    repositoryParser = new RepositoryParser();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should complete the full streaming workflow', async () => {
    // Create a realistic repository structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });
    
    // Create various file types
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\n\nThis is a test project for streaming file processing.');
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2));
    await fs.writeFile(path.join(tempDir, 'src', 'index.js'), 'console.log("Main entry point");\nexport default function main() {\n  return "Hello World";\n}');
    await fs.writeFile(path.join(tempDir, 'src', 'utils.js'), 'export function helper() {\n  return "utility function";\n}\n\nexport const constant = 42;');
    await fs.writeFile(path.join(tempDir, 'src', 'components', 'Button.jsx'), 'import React from "react";\n\nexport function Button({ children, onClick }) {\n  return <button onClick={onClick}>{children}</button>;\n}');
    await fs.writeFile(path.join(tempDir, 'tests', 'index.test.js'), 'import { test, expect } from "vitest";\nimport main from "../src/index.js";\n\ntest("main function", () => {\n  expect(main()).toBe("Hello World");\n});');
    
    // Create files that should be excluded
    await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'node_modules', 'package.json'), '{}');
    
    // Test file discovery
    const discoveredFiles = [];
    for await (const fileInfo of repositoryParser.discoverFiles(tempDir)) {
      discoveredFiles.push(fileInfo);
    }
    
    // Should discover 6 files (excluding node_modules)
    expect(discoveredFiles.length).toBe(6);
    
    // Verify file types are detected correctly
    const jsFiles = discoveredFiles.filter(f => f.extension === '.js');
    const jsxFiles = discoveredFiles.filter(f => f.extension === '.jsx');
    const jsonFiles = discoveredFiles.filter(f => f.extension === '.json');
    const mdFiles = discoveredFiles.filter(f => f.extension === '.md');
    
    expect(jsFiles.length).toBe(3); // index.js, utils.js, index.test.js
    expect(jsxFiles.length).toBe(1); // Button.jsx
    expect(jsonFiles.length).toBe(1); // package.json
    expect(mdFiles.length).toBe(1); // README.md
    
    // Test streaming chunk processing
    const allChunks = [];
    let fileCount = 0;
    
    for await (const chunk of repositoryParser.streamRepositoryChunks(tempDir, {
      onFileStart: (fileInfo) => {
        fileCount++;
        expect(fileInfo.path).toBeDefined();
        expect(fileInfo.relativePath).toBeDefined();
      },
      onChunk: (chunk) => {
        expect(chunk.content).toBeDefined();
        expect(chunk.chunkId).toBeDefined();
        expect(chunk.filePath).toBeDefined();
        expect(chunk.startLine).toBeGreaterThan(0);
        expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      }
    })) {
      allChunks.push(chunk);
    }
    
    // Should have processed all discoverable files
    expect(fileCount).toBe(6);
    
    // Should have generated chunks for text files
    expect(allChunks.length).toBeGreaterThan(0);
    
    // Verify chunk content
    const readmeChunk = allChunks.find(c => c.relativePath.includes('README.md'));
    expect(readmeChunk).toBeDefined();
    expect(readmeChunk.content).toContain('Test Project');
    
    const indexChunk = allChunks.find(c => c.relativePath.includes('src/index.js'));
    expect(indexChunk).toBeDefined();
    expect(indexChunk.content).toContain('Hello World');
    
    // Test repository statistics
    const stats = await repositoryParser.getRepositoryStats(tempDir);
    expect(stats.fileCount).toBe(6);
    expect(stats.textFiles).toBeGreaterThan(0);
    expect(stats.extensions['.js']).toBe(3);
    expect(stats.extensions['.jsx']).toBe(1);
    expect(stats.extensions['.json']).toBe(1);
    expect(stats.extensions['.md']).toBe(1);
    
    console.log('✅ Integration test completed successfully');
    console.log(`📁 Discovered ${discoveredFiles.length} files`);
    console.log(`📄 Generated ${allChunks.length} chunks`);
    console.log(`📊 Stats: ${stats.textFiles} text files, ${stats.binaryFiles} binary files`);
  }, 30000); // 30 second timeout
});