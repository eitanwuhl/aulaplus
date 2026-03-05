#!/usr/bin/env node
/**
 * Guided deploy: deploy ONLY modify-evaluation-v2 to the Supabase project from .env.
 * Shows project URL, asks for "YES" confirmation, runs deploy, prints verification steps.
 * Run from repo root: node scripts/supabase-deploy-v2.js
 */
import { spawnSync } from 'child_process';
import * as readline from 'readline';
import { VITE_SUPABASE_URL } from './load-env.js';

const FUNCTION_NAME = 'modify-evaluation-v2';

function main() {
  console.log('\n========================================');
  console.log('  Supabase Edge Function — Guided Deploy');
  console.log('  Function: ' + FUNCTION_NAME + ' only');
  console.log('========================================\n');

  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_URL.includes('supabase.co')) {
    console.error('ERROR: VITE_SUPABASE_URL not found or invalid in .env / .env.local');
    console.error('Add VITE_SUPABASE_URL=https://<project-ref>.supabase.co to .env');
    process.exit(1);
  }

  const projectRef = VITE_SUPABASE_URL.replace(/^https:\/\//, '').replace(/\.supabase\.co.*$/, '');
  console.log('Supabase project (from .env / .env.local):');
  console.log('  VITE_SUPABASE_URL = ' + VITE_SUPABASE_URL);
  console.log('  Project ref        = ' + projectRef);
  console.log('');
  console.log('This deploy will update the Edge Function on the project above.');
  console.log('If your Render production app uses this same project, it will use the new function after deploy.');
  console.log('Auth: verify_jwt=true (gateway validates JWT; no JWT secret needed in Supabase env).\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Type YES to continue (anything else cancels): ', (answer) => {
    rl.close();
    if (answer?.trim() !== 'YES') {
      console.log('Deploy cancelled.');
      process.exit(0);
    }
    console.log('\nDeploying...\n');
    const result = spawnSync('supabase', ['functions', 'deploy', FUNCTION_NAME], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });
    if (result.status !== 0) {
      console.error('\nDeploy failed. Fix errors above and try again.');
      process.exit(1);
    }
    console.log('\n========================================');
    console.log('  Deploy finished successfully');
    console.log('========================================\n');
    console.log('Verify that the deployed function uses the NEW default behavior:\n');
    console.log('  npm run supabase:verify:v2\n');
    console.log('Or manually: send a POST request with body { "__ping": true }');
    console.log('  - Without header: response.debug.build should end with "-new"');
    console.log('  - With header x-aulaplus-env: legacy: response.debug.build should end with "-legacy"\n');
    process.exit(0);
  });
}

main();
