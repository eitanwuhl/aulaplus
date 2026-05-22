#!/usr/bin/env node
import { repoRootFromImportMeta, runSqlSeed } from './lib/run-sql-seed.mjs';

const root = repoRootFromImportMeta(import.meta.url);

for (const sqlRelativePath of [
  'supabase/seeds/school_catalog_demo.sql',
  'supabase/seeds/school_liceo_norte_demo.sql',
  'supabase/seeds/school_liceo_st_patricks_demo.sql',
]) {
  await runSqlSeed({
    repoRoot: root,
    sqlRelativePath,
    logPrefix: 'seed:school-catalog',
    successMessage: 'OK — school catalog seed applied from',
  });
}
