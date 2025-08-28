export async function embedOllama(texts, model='nomic-embed-text'){
  const base = process.env.ZIRI_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const url = base.replace(/\/$/,'') + '/api/embeddings';
  
  // Test Ollama connectivity on first call
  if (texts.length > 1) {
    try {
      const testStart = Date.now();
      const testRes = await fetch(base + '/api/tags', { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      const testTime = Date.now() - testStart;
      if (testRes.ok) {
        console.log(`🔗 Ollama connectivity: ${testTime}ms (${testRes.ok ? 'OK' : 'SLOW'})`);
      }
    } catch (error) {
      console.warn(`⚠️  Ollama connectivity issue: ${error.message}`);
    }
  }
  
  // For single text, use original approach
  if (texts.length === 1) {
    const res = await fetch(url, {
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ model, prompt: texts[0] })
    });
    if (!res.ok) { 
      const x = await res.text(); 
      throw new Error('Ollama embeddings error: ' + x); 
    }
    const js = await res.json();
    return [js.embedding];
  }
  
  // For multiple texts, batch them efficiently with higher concurrency
  const batchSize = 20; // Increased batch size for better performance
  const out = [];
  
  console.log(`🔄 Processing ${texts.length} embeddings in batches of ${batchSize}...`);
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchStart = Date.now();
    
    const batchPromises = batch.map(async (text, idx) => {
      try {
        const res = await fetch(url, {
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ model, prompt: text }),
          signal: AbortSignal.timeout(10000) // 10 second timeout per request
        });
        if (!res.ok) { 
          const x = await res.text(); 
          throw new Error(`Ollama embeddings error: ${res.status} ${x}`); 
        }
        const js = await res.json();
        return js.embedding;
      } catch (error) {
        console.error(`❌ Embedding failed for text ${i + idx}: ${error.message}`);
        throw error;
      }
    });
    
    // Process batch concurrently
    const batchResults = await Promise.all(batchPromises);
    out.push(...batchResults);
    
    const batchTime = Date.now() - batchStart;
    const rate = batch.length / (batchTime / 1000);
    console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}: ${batch.length} embeddings in ${batchTime}ms (${rate.toFixed(1)}/sec)`);
  }
  
  return out;
}
