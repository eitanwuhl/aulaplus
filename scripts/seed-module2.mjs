#!/usr/bin/env node
/**
 * Applies Module 2 SQL seed (ANEP contenidos for annual program / macro planner).
 * Requires migration 20260605120000_module2_annual_program.sql and module1 catalog seed.
 */
import { repoRootFromImportMeta, runSqlSeed } from './lib/run-sql-seed.mjs';

const root = repoRootFromImportMeta(import.meta.url);

await runSqlSeed({
  repoRoot: root,
  sqlRelativePath: 'supabase/seeds/module2_anep_contenidos.sql',
  logPrefix: 'seed:module2',
  successMessage: 'OK — Module 2 catalog contenidos seed applied from',
});
