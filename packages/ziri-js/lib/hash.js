import crypto from 'node:crypto';
export function sha256(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
