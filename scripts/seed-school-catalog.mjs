#!/usr/bin/env node
import { repoRootFromImportMeta, runSqlSeed } from './lib/run-sql-seed.mjs';

const root = repoRootFromImportMeta(import.meta.url);

await runSqlSeed({
  repoRoot: root,
  sqlRelativePath: 'supabase/seeds/school_catalog_demo.sql',
  logPrefix: 'seed:school-catalog',
  successMessage: 'OK — school catalog seed applied from',
});
