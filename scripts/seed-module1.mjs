#!/usr/bin/env node
/**
 * Applies Module 1 SQL seed (ANEP catalog + school framework activation).
 * Requires migration 20260601120000_module1_institutional_config.sql applied.
 */
import { repoRootFromImportMeta, runSqlSeed } from './lib/run-sql-seed.mjs';

const root = repoRootFromImportMeta(import.meta.url);

await runSqlSeed({
  repoRoot: root,
  sqlRelativePath: 'supabase/seeds/module1_anep_catalog.sql',
  logPrefix: 'seed:module1',
  successMessage: 'OK — Module 1 catalog seed applied from',
});
