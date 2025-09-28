function testRegex() {
  const code = `
        import os
        import json as js
        from pathlib import Path
        from typing import List, Dict
      `;
  
  console.log('Testing regex patterns...');
  
  // Standard imports
  const importRegex = /^import\s+([^\s#]+)(?:\s+as\s+(\w+))?/gm;
  let match;
  console.log('\nStandard import regex:');
  while ((match = importRegex.exec(code)) !== null) {
    console.log('Match:', match);
  }
  
  // From imports
  const fromImportRegex = /^from\s+([^\s#]+)\s+import\s+([^#\n]+)/gm;
  console.log('\nFrom import regex:');
  while ((match = fromImportRegex.exec(code)) !== null) {
    console.log('Match:', match);
  }
  
  // Let's try without the ^ anchor
  const importRegexNoAnchor = /\s*import\s+([^\s#]+)(?:\s+as\s+(\w+))?/gm;
  console.log('\nStandard import regex without anchor:');
  while ((match = importRegexNoAnchor.exec(code)) !== null) {
    console.log('Match:', match);
  }
  
  const fromImportRegexNoAnchor = /\s*from\s+([^\s#]+)\s+import\s+([^#\n]+)/gm;
  console.log('\nFrom import regex without anchor:');
  while ((match = fromImportRegexNoAnchor.exec(code)) !== null) {
    console.log('Match:', match);
  }
}

testRegex();