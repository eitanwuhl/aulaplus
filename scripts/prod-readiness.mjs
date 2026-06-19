#!/usr/bin/env node
/**
 * Pre-production gate: env checks + unit tests + build + migration presence.
 * Usage: node scripts/prod-readiness.mjs [--skip-build] [--skip-tests]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const skipBuild = args.has('--skip-build');
const skipTests = args.has('--skip-tests');

const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const requiredMigrations = [
  'supabase/migrations/20260612120000_module2_prod_hardening.sql',
];

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    fail(`${cmd} ${cmdArgs.join(' ')} failed (exit ${result.status})`);
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

console.log('=== Aula+ production readiness ===\n');

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));

for (const key of requiredEnv) {
  if (!process.env[key]) {
    fail(`Missing env var ${key} (set in .env for build/deploy)`);
  }
  ok(`Env ${key} present`);
}

for (const rel of requiredMigrations) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    fail(`Missing migration: ${rel}`);
  }
  ok(`Migration found: ${path.basename(rel)}`);
}

if (!skipTests) {
  console.log('\nRunning unit tests...');
  run('npm', ['test']);
} else {
  console.log('\nSkipping unit tests (--skip-tests)');
}

if (!skipBuild) {
  console.log('\nRunning production build...');
  run('npm', ['run', 'build']);
} else {
  console.log('\nSkipping build (--skip-build)');
}

console.log('\n=== Ready for deploy ===');
console.log('Next steps:');
console.log('  npx supabase db push');
console.log('  npm run seed:auth-users && npm run seed:teacher-grupos');
console.log('  npm run supabase:deploy:plans');
console.log('  npm run test:e2e   # optional smoke against preview');
console.log('  Manual checklist: docs/PRODUCTION.md');
