import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export function resolveHome() {
  if (process.env.ZIRI_HOME) return process.env.ZIRI_HOME;
  const plat = process.platform;
  if (plat === 'win32') {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'ziri');
  } else if (plat === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ziri');
  } else {
    return path.join(os.homedir(), '.local', 'share', 'ziri');
  }
}
export async function ensureDirs(){
  const base = resolveHome();
  await fs.mkdir(base, { recursive: true });
  await fs.mkdir(path.join(base, 'repos'), { recursive: true });
  await fs.mkdir(path.join(base, 'logs'), { recursive: true });
  await fs.mkdir(path.join(base, 'cache'), { recursive: true });
}
export function SOURCES_PATH(){ return homePath('sources.yaml'); }
export function homePath(...parts){ return path.join(resolveHome(), ...parts); }
