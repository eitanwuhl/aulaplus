#!/usr/bin/env node
/**
 * Regenerates src/integrations/supabase/types.ts from the linked Supabase project.
 * Usage: npm run supabase:gen-types
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectId = process.env.SUPABASE_PROJECT_ID ?? 'bbzikjvrehfooaumkmui';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(repoRoot, 'src', 'integrations', 'supabase', 'types.ts');

const child = spawn(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
  { cwd: repoRoot, shell: true, stdio: ['ignore', 'pipe', 'inherit'] }
);

let stdout = '';
child.stdout?.on('data', (chunk) => {
  stdout += chunk;
});

child.on('close', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  writeFileSync(outPath, stdout, 'utf8');
  console.log(`[gen-supabase-types] Wrote ${outPath}`);
});
