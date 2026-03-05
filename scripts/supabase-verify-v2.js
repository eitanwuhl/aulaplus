#!/usr/bin/env node
/**
 * Verify modify-evaluation-v2: ping (expect -new / -legacy). Uses __ping payload only (no OpenAI calls).
 * With verify_jwt=true the gateway requires a valid JWT — send Authorization and apikey from .env.
 * Run from repo root: node scripts/supabase-verify-v2.js
 */
import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } from './load-env.js';

const FUNCTION_NAME = 'modify-evaluation-v2';
const MAX_BODY_PRINT = 1200;

/** Base headers: Supabase gateway expects Authorization + apikey when verify_jwt=true. */
function baseHeaders(extra = {}) {
  const key = VITE_SUPABASE_ANON_KEY || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key,
    'apikey': key,
    ...extra
  };
}

async function ping(extraHeaders = {}) {
  const url = (VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/' + FUNCTION_NAME;
  const res = await fetch(url, {
    method: 'POST',
    headers: baseHeaders(extraHeaders),
    body: JSON.stringify({ __ping: true })
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON response');
    err.status = res.status;
    err.body = text;
    throw err;
  }
  data._status = res.status;
  data._rawBody = text;
  return data;
}

function printFailure(label, status, body) {
  console.error('  HTTP status: ' + (status ?? 'unknown'));
  const toPrint = typeof body === 'string'
    ? (body.length <= MAX_BODY_PRINT ? body : body.slice(0, MAX_BODY_PRINT) + '\n... (truncated)')
    : JSON.stringify(body).slice(0, MAX_BODY_PRINT);
  console.error('  Response body: ' + toPrint);
}

async function main() {
  console.log('\n========================================');
  console.log('  Verify modify-evaluation-v2 (ping only)');
  console.log('========================================\n');

  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env / .env.local (required for JWT when verify_jwt=true).');
    process.exit(1);
  }

  const url = (VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/' + FUNCTION_NAME;
  console.log('URL: ' + url + '\n');

  let ok = true;

  // 1) No header -> expect -new
  try {
    const data = await ping();
    const build = data?.debug?.build;
    const status = data._status;
    const body = data._rawBody;
    if (typeof build !== 'string') {
      console.error('FAIL (default): response.debug.build missing or not a string');
      printFailure('default', status, body);
      ok = false;
    } else if (!build.endsWith('-new')) {
      console.error('FAIL (default): expected debug.build to end with "-new", got: ' + build);
      printFailure('default', status, body);
      ok = false;
    } else {
      console.log('OK (default, no header): debug.build = ' + build);
    }
  } catch (e) {
    console.error('FAIL (default): ' + (e.message || e));
    if (e.status != null) printFailure('default', e.status, e.body ?? '');
    ok = false;
  }

  // 2) x-aulaplus-env: legacy -> expect -legacy
  try {
    const data = await ping({ 'x-aulaplus-env': 'legacy' });
    const build = data?.debug?.build;
    const status = data._status;
    const body = data._rawBody;
    if (typeof build !== 'string') {
      console.error('FAIL (legacy): response.debug.build missing or not a string');
      printFailure('legacy', status, body);
      ok = false;
    } else if (!build.endsWith('-legacy')) {
      console.error('FAIL (legacy): expected debug.build to end with "-legacy", got: ' + build);
      printFailure('legacy', status, body);
      ok = false;
    } else {
      console.log('OK (legacy header): debug.build = ' + build);
    }
  } catch (e) {
    console.error('FAIL (legacy): ' + (e.message || e));
    if (e.status != null) printFailure('legacy', e.status, e.body ?? '');
    ok = false;
  }

  console.log('');
  if (!ok) {
    console.error('Verification failed. Check HTTP status and response body above.');
    console.error('Tip: With verify_jwt=true, ping requires a valid JWT. Use the anon/public key from Supabase Dashboard → API. If 401 persists, see docs/evaluations-duration/21-fix-v2-auth-501.md');
    process.exit(1);
  }
  console.log('All checks passed. NEW default and LEGACY rollback path are working.\n');
  process.exit(0);
}

main();
