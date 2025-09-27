function debugMethodRegex() {
  const content = `
        function calculateSum(a, b) {
          return a + b;
        }
        
        async function fetchData(url) {
          const response = await fetch(url);
          return response.json();
        }
      `;
  
  console.log('Testing method regex...');
  const methodRegex = /(?:^|[\s;{}])\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/gm;
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    console.log('Match:', JSON.stringify(match, null, 2));
    console.log('Full match:', JSON.stringify(match[0]));
    console.log('Method name:', match[1]);
    console.log('Params:', match[2]);
    console.log('---');
  }
}

debugMethodRegex();