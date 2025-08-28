import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function sanitizeAlias(name){ return name.replace(/[^a-zA-Z0-9-_]/g,'-').slice(0,64) || 'repo'; }

export async function computeRepoId(cwd){
  try{
    const { execFile } = await import('node:child_process');
    const exec = (c,a)=>new Promise((res,rej)=>execFile(c,a,{cwd},(e,so)=>e?rej(e):res(so.trim())));
    const root = await exec('git',['rev-parse','--show-toplevel']).catch(()=>null);
    if (root){
      const remote = await exec('git',['config','--get','remote.origin.url']).catch(()=>root);
      const rootCommit = await exec('git',['rev-list','--max-parents=0','HEAD']).catch(()=> 'nogitroot');
      const canon = String(remote).replace(/\.git$/,'').replace(/^git@/,'https://').replace(/:/,'/');
      const id = crypto.createHash('sha256').update(canon+'|'+rootCommit).digest('hex');
      const alias = sanitizeAlias(path.basename(root));
      return { repoId:id, alias: alias || 'repo' };
    }
  }catch(error){
    console.warn('Git command failed:', error.message);
  }
  
  // Fallback to directory-based ID
  const abs = path.resolve(cwd || process.cwd());
  const id = crypto.createHash('sha256').update(abs).digest('hex');
  const dirName = path.basename(abs);
  const alias = sanitizeAlias(dirName);
  
  // Ensure alias is never undefined or empty
  const finalAlias = alias && alias.length > 0 ? alias : 'repo';
  
  return { repoId:id, alias: finalAlias };
}

export function repoStoreDir(home, alias, repoId){
  const short = repoId.slice(0,6);
  return path.join(home, 'repos', `${alias}--${short}`);
}
