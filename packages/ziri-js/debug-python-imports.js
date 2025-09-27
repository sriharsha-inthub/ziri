import { CodeAnalyzer } from './lib/metadata/code-analyzer.js';

function debugPythonImports() {
  const code = `
        import os
        import json as js
        from pathlib import Path
        from typing import List, Dict
      `;
  
  console.log('Analyzing Python code...');
  const result = CodeAnalyzer.analyzeCode(code, 'python', 'test.py');
  console.log('Result:', JSON.stringify(result, null, 2));
  
  console.log('\nImports found:', JSON.stringify(result.imports, null, 2));
}

debugPythonImports();