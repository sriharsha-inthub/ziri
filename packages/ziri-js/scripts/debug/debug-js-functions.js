import { CodeAnalyzer } from './lib/metadata/code-analyzer.js';

function debugJavaScriptFunctions() {
  const code = `
        function calculateSum(a, b) {
          return a + b;
        }
        
        async function fetchData(url) {
          const response = await fetch(url);
          return response.json();
        }
      `;
  
  console.log('Analyzing JavaScript code...');
  const result = CodeAnalyzer.analyzeCode(code, 'javascript', 'test.js');
  console.log('Result:', JSON.stringify(result, null, 2));
  
  console.log('\nFunctions found:', JSON.stringify(result.functions, null, 2));
}

debugJavaScriptFunctions();