const URL='https://api.openai.com/v1/embeddings';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function embedOpenAI(texts, model='text-embedding-3-small'){
  const key = process.env.ZIRI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key. Set ZIRI_OPENAI_API_KEY or OPENAI_API_KEY.');
  
  const maxRetries = 3;
  const baseDelay = 1000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(URL, { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        }, 
        body: JSON.stringify({ model, input: texts }),
        timeout: 30000 // 30 second timeout
      });
      
      if (!res.ok) { 
        const t = await res.text(); 
        throw new Error('OpenAI embeddings error: ' + t); 
      }
      
      const data = await res.json();
      return data.data.map(d => d.embedding);
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`OpenAI embeddings error after ${maxRetries + 1} attempts: ${error.message}`);
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}
