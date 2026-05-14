#!/usr/bin/env node
/**
 * Apply login demo seed (idempotent) against any Postgres with the login tables.
 * Requires: migration 20260213120000_login_demo_accounts applied (tables + RPCs + pgcrypto).
 *
 * Connection (first that succeeds):
 *   1. DATABASE_URL, DIRECT_URL, or SUPABASE_DB_URL
 *   2. VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD → tries Supavisor **session** pooler (IPv4-friendly),
 *      then direct db.<ref>.supabase.co (often IPv6-only; may not resolve on all networks).
 *      Optional: SUPABASE_POOLER_REGION=us-east-1 (from Dashboard → Connect → Session pooler) to skip probing.
 *
 * Usage: npm run seed:login
 * Debug: DEBUG_SEED=1 npm run seed:login
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** Regions used by Supabase pooler hostnames; probed in order unless SUPABASE_POOLER_REGION is set. */
const POOLER_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'sa-east-1',
  'ca-central-1',
  'eu-west-2',
  'ap-southeast-2',
  'us-west-1',
  'eu-north-1',
];

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function projectRefFromSupabaseUrl(viteSupabaseUrl) {
  if (!viteSupabaseUrl || typeof viteSupabaseUrl !== 'string') return null;
  try {
    const host = new URL(viteSupabaseUrl.trim()).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function buildPoolerSessionUrl(ref, password, region) {
  const pass = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${pass}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

function buildDirectPostgresUrl(ref, password) {
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

function collectCandidates(merged) {
  const explicit = merged.DATABASE_URL || merged.DIRECT_URL || merged.SUPABASE_DB_URL;
  if (explicit) {
    return [{ url: explicit, label: 'DATABASE_URL / DIRECT_URL / SUPABASE_DB_URL' }];
  }

  const ref = projectRefFromSupabaseUrl(merged.VITE_SUPABASE_URL);
  const password = merged.SUPABASE_DB_PASSWORD;
  if (!ref || !password) return [];

  const out = [];
  const envRegion = merged.SUPABASE_POOLER_REGION?.trim();
  const regions = envRegion ? [envRegion] : POOLER_REGIONS;
  for (const region of regions) {
    out.push({
      url: buildPoolerSessionUrl(ref, password, region),
      label: `pooler session aws-0-${region}.pooler.supabase.com`,
    });
  }
  out.push({
    url: buildDirectPostgresUrl(ref, password),
    label: 'direct db.<ref>.supabase.co:5432',
  });
  return out;
}

async function connectFirst(candidates) {
  let lastErr;
  for (const { url, label } of candidates) {
    const client = new pg.Client({
      connectionString: url,
      ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      if (process.env.DEBUG_SEED === '1') {
        console.error('[seed:login] using', label);
      }
      return { client, label };
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
      if (process.env.DEBUG_SEED === '1') {
        console.warn('[seed:login] skip', label, '-', e?.message || e);
      }
    }
  }
  throw lastErr ?? new Error('No connection candidates');
}

const fileEnv = { ...parseEnvFile(resolve(root, '.env')), ...parseEnvFile(resolve(root, '.env.local')) };
const merged = { ...fileEnv, ...process.env };

const candidates = collectCandidates(merged);

if (!candidates.length) {
  console.error(
    'Missing database connection. Use one of:\n' +
      '  • DATABASE_URL=… (Dashboard → Connect → Session pooler URI recommended on Windows)\n' +
      '  • VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD (script tries pooler regions, then direct)\n' +
      '  • Optional SUPABASE_POOLER_REGION=us-east-1 (or your project region) to avoid probing.'
  );
  process.exit(1);
}

const sqlPath = resolve(root, 'supabase/seeds/login_demo.sql');
const sql = readFileSync(sqlPath, 'utf8');

let client;
let usedLabel = '';
try {
  const r = await connectFirst(candidates);
  client = r.client;
  usedLabel = r.label;
} catch (e) {
  console.error('Could not connect to Postgres:', e?.message || e);
  console.error(
    'Tip: open Supabase Dashboard → Connect → Session pooler, copy host region into .env:\n' +
      '  SUPABASE_POOLER_REGION=us-east-1\n' +
      'or paste the full URI as DATABASE_URL.'
  );
  process.exit(1);
}

try {
  await client.query(sql);
  console.log('OK — login demo seed applied from', sqlPath, usedLabel ? `(${usedLabel})` : '');
} finally {
  await client.end();
}
