#!/usr/bin/env node
/**
 * Seeds school_students.profile_data from src/data/mockData.ts (demo catalog).
 * Requires: migration 20260519120000_school_students_profile_data.sql, npm run seed:school-catalog
 */
import { createServer } from 'vite';
import { resolve } from 'path';
import { connectPgClient, repoRootFromImportMeta } from './lib/run-sql-seed.mjs';

const repoRoot = repoRootFromImportMeta(import.meta.url);

function studentProfilePayload(student) {
  const { id: _id, name: _name, perfil: _perfil, ...rest } = student;
  return rest;
}

async function loadMockStudents() {
  const server = await createServer({
    root: repoRoot,
    configFile: resolve(repoRoot, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const mod = await server.ssrLoadModule('/src/data/mockData.ts');
    return mod.mockStudents ?? [];
  } finally {
    await server.close();
  }
}

const mockStudents = await loadMockStudents();
if (!mockStudents.length) {
  console.error('No mockStudents found in mockData.ts');
  process.exit(1);
}

const client = await connectPgClient(repoRoot, 'seed:student-profiles');
try {
  await client.query('BEGIN');
  for (const student of mockStudents) {
    const payload = studentProfilePayload(student);
    const result = await client.query(
      `UPDATE public.school_students
       SET profile_data = $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(payload), student.id]
    );
    if (result.rowCount === 0) {
      console.warn(`[seed:student-profiles] No school_students row for id=${student.id}`);
    }
  }
  await client.query('COMMIT');
  console.log(`OK — profile_data updated for ${mockStudents.length} students`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('seed:student-profiles failed:', e?.message || e);
  process.exit(1);
} finally {
  await client.end();
}
