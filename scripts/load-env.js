/**
 * Load VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env and .env.local (local overrides).
 * No external deps. Used by supabase-deploy-v2.js and supabase-verify-v2.js.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const root = resolve(process.cwd());
const env = { ...parseEnvFile(resolve(root, '.env')), ...parseEnvFile(resolve(root, '.env.local')) };
export const VITE_SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export { env };
