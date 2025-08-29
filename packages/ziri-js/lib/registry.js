import fs from 'node:fs/promises';
import YAML from 'yaml';
import { homePath } from './home.js';
export function SOURCES_PATH(){ return homePath('sources.yaml'); }
async function loadYaml(){ try{ return YAML.parse(await fs.readFile(SOURCES_PATH(),'utf-8')) || {sets:{}};}catch{return {sets:{}};} }
async function saveYaml(obj){ await fs.writeFile(SOURCES_PATH(), YAML.stringify(obj), 'utf-8'); }
export async function addSource(p, setName='default'){ const y=await loadYaml(); y.sets ||= {}; y.sets[setName] ||= []; if(!y.sets[setName].includes(p)) y.sets[setName].push(p); await saveYaml(y); }
export async function removeSource(p){ const y=await loadYaml(); for(const k of Object.keys(y.sets||{})){ y.sets[k]=(y.sets[k]||[]).filter(x=>x!==p);} await saveYaml(y); }
export async function removeSet(setName){ const y=await loadYaml(); if(y.sets && y.sets[setName]){ delete y.sets[setName]; await saveYaml(y); } }
export async function listSources(){ return await loadYaml(); }
export async function getSources(){ return await loadYaml(); }
