import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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

function projectRefFromConfigToml(repoRoot) {
  const configPath = resolve(repoRoot, 'supabase/config.toml');
  if (!existsSync(configPath)) return null;
  const content = readFileSync(configPath, 'utf8');
  const m = content.match(/^\s*project_id\s*=\s*["']?([a-z0-9]+)["']?\s*$/im);
  return m ? m[1] : null;
}

function resolveDbPassword(env) {
  return (
    env.SUPABASE_DB_PASSWORD ||
    env.POSTGRES_PASSWORD ||
    env.DB_PASSWORD ||
    env.PGPASSWORD ||
    ''
  ).trim();
}

function buildPoolerSessionUrl(ref, password, region) {
  const pass = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${pass}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

function buildDirectPostgresUrl(ref, password) {
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

export function collectPgCandidates(env, repoRoot) {
  const explicit = env.DATABASE_URL || env.DIRECT_URL || env.SUPABASE_DB_URL;
  if (explicit) {
    return [{ url: explicit, label: 'DATABASE_URL / DIRECT_URL / SUPABASE_DB_URL' }];
  }

  const ref =
    projectRefFromSupabaseUrl(env.VITE_SUPABASE_URL) ||
    (repoRoot ? projectRefFromConfigToml(repoRoot) : null);
  const password = resolveDbPassword(env);
  if (!ref || !password) return { candidates: [], ref, hasPassword: Boolean(password) };

  const out = [];
  const envRegion = env.SUPABASE_POOLER_REGION?.trim();
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
  return { candidates: out, ref, hasPassword: true };
}

function printConnectionHelp(repoRoot, ref) {
  const linkedRef = ref || (repoRoot ? projectRefFromConfigToml(repoRoot) : null) || '<project-ref>';
  console.error(
    'Missing Postgres credentials for seed scripts (db push uses the CLI login, seeds use direct SQL).\n\n' +
      'Option A — add to .env.local (recommended):\n' +
      '  SUPABASE_DB_PASSWORD=<Database password from Dashboard → Settings → Database>\n' +
      `  SUPABASE_POOLER_REGION=us-west-2   # linked project ${linkedRef} is West US (Oregon)\n` +
      '  # optional if VITE_SUPABASE_URL points elsewhere:\n' +
      `  VITE_SUPABASE_URL=https://${linkedRef}.supabase.co\n\n` +
      'Option B — paste the full Session pooler URI:\n' +
      '  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-us-west-2.pooler.supabase.com:5432/postgres\n\n' +
      'Option C — Supabase Dashboard → SQL → run the file:\n' +
      '  supabase/seeds/teacher_grupos_demo.sql'
  );
}

async function connectFirst(candidates, logPrefix) {
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
        console.error(`[${logPrefix}] using`, label);
      }
      return { client, label };
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
      if (process.env.DEBUG_SEED === '1') {
        console.warn(`[${logPrefix}] skip`, label, '-', e?.message || e);
      }
    }
  }
  throw lastErr ?? new Error('No connection candidates');
}

/**
 * @param {{ repoRoot: string; sqlRelativePath: string; logPrefix: string; successMessage: string }} opts
 */
export async function runSqlSeed(opts) {
  const envPaths = [
    resolve(opts.repoRoot, '.env'),
    resolve(opts.repoRoot, '.env.local'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.env.local'),
  ];
  const fileEnv = {};
  for (const p of envPaths) {
    Object.assign(fileEnv, parseEnvFile(p));
  }
  const merged = { ...fileEnv, ...process.env };
  const collected = collectPgCandidates(merged, opts.repoRoot);
  const candidates = collected.candidates ?? collected;

  if (!candidates.length) {
    printConnectionHelp(opts.repoRoot, collected.ref);
    process.exit(1);
  }

  const sqlPath = resolve(opts.repoRoot, opts.sqlRelativePath);
  const sql = readFileSync(sqlPath, 'utf8');

  let client;
  let usedLabel = '';
  try {
    const r = await connectFirst(candidates, opts.logPrefix);
    client = r.client;
    usedLabel = r.label;
  } catch (e) {
    console.error('Could not connect to Postgres:', e?.message || e);
    process.exit(1);
  }

  try {
    await client.query(sql);
    console.log(opts.successMessage, sqlPath, usedLabel ? `(${usedLabel})` : '');
  } finally {
    await client.end();
  }
}

/** Repo root when called from a file in `scripts/` (e.g. seed-teacher-grupos.mjs). */
export function repoRootFromImportMeta(importMetaUrl) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), '..');
}
