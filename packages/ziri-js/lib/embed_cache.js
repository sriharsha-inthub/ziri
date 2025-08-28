import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { homePath } from './home.js';
function shard(base, key){ return path.join(base, key.slice(0,2), key.slice(2,4)); }
function sha(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
function sanitize(s){ return s.replace(/[^a-zA-Z0-9-_]/g,'-'); }
export class EmbedCache {
  constructor(modelId){ this.base = homePath('cache', sanitize(modelId)); }
  async get(text){ const k=sha(text); const d=shard(this.base,k); const f=path.join(d,k+'.json'); try{ return JSON.parse(await fs.readFile(f,'utf-8')); }catch{ return null; } }
  async set(text, vec){ const k=sha(text); const d=shard(this.base,k); const f=path.join(d,k+'.json'); await fs.mkdir(d,{recursive:true}); await fs.writeFile(f, JSON.stringify(vec),'utf-8'); }
}
