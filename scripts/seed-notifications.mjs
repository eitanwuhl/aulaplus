#!/usr/bin/env node
import { repoRootFromImportMeta, runSqlSeed } from './lib/run-sql-seed.mjs';

const root = repoRootFromImportMeta(import.meta.url);

for (const sqlRelativePath of [
  'supabase/seeds/dashboard_notifications_demo.sql',
  'supabase/seeds/dashboard_notifications_liceo_norte.sql',
  'supabase/seeds/dashboard_notifications_liceo_st_patricks.sql',
]) {
  await runSqlSeed({
    repoRoot: root,
    sqlRelativePath,
    logPrefix: 'seed:notifications',
    successMessage: 'OK — notifications seed applied from',
  });
}
