#!/usr/bin/env node
import { repoRootFromImportMeta, runSqlSeed } from './lib/run-sql-seed.mjs';

const root = repoRootFromImportMeta(import.meta.url);

await runSqlSeed({
  repoRoot: root,
  sqlRelativePath: 'supabase/seeds/teacher_grupos_demo.sql',
  logPrefix: 'seed:teacher-grupos',
  successMessage: 'OK — teacher grupos demo seed applied from',
});
