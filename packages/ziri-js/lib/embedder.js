import { embedOpenAI } from './embed_openai.js';
import { embedOllama } from './embed_ollama.js';
import { EmbedCache } from './embed_cache.js';
export function makeEmbedder(kind, config = {}){
  if (kind==='openai') return create('openai', embedOpenAI, 'text-embedding-3-small');
  if (kind==='ollama' || !kind) {
    // Use configured embedding model or default to nomic-embed-text for better quality
    const ollamaConfig = config.providers?.ollama || {};
    const embeddingModel = ollamaConfig.embeddingModel || 'nomic-embed-text';
    return create('ollama', embedOllama, embeddingModel);
  }
  return create('ollama', embedOllama, 'nomic-embed-text'); // Default to higher quality model
}
function create(id, fn, model){
  const cache = new EmbedCache(id+':'+model);
  return {
    id, model,
    async embedBatch(texts){
      const out=new Array(texts.length); const missIdx=[];
      for(let i=0;i<texts.length;i++){ const hit=await cache.get(texts[i]); if(hit) out[i]=hit; else missIdx.push(i); }
      if (missIdx.length){
        const miss = missIdx.map(i=>texts[i]);
        const vecs = await fn(miss, model);
        for (let j=0;j<missIdx.length;j++){ const i=missIdx[j]; out[i]=vecs[j]; await cache.set(texts[i], vecs[j]); }
      }
      return out;
    }
  };
}
