#!/usr/bin/env node
/**
 * Seeds school_students.profile_data for ALL demo schools.
 */
import { createServer } from 'vite';
import { resolve } from 'path';
import { connectPgClient, repoRootFromImportMeta } from './lib/run-sql-seed.mjs';

const repoRoot = repoRootFromImportMeta(import.meta.url);

async function loadSeedModules() {
  const server = await createServer({
    root: repoRoot,
    configFile: resolve(repoRoot, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const mockMod = await server.ssrLoadModule('/src/data/mockData.ts');
    const schoolMod = await server.ssrLoadModule('/src/data/seedStudentsBySchool.ts');
    return {
      mockStudents: mockMod.mockStudents ?? [],
      extraSeeds: [
        ...(schoolMod.LICEO_NORTE_STUDENT_SEEDS ?? []),
        ...(schoolMod.LICEO_ST_PATRICKS_STUDENT_SEEDS ?? []),
      ],
      DEFAULT_RESULTADOS_EVALUACION: mockMod.DEFAULT_RESULTADOS_EVALUACION,
      DEFAULT_EVOLUCION_DETALLADA: mockMod.DEFAULT_EVOLUCION_DETALLADA,
      buildDefaultDashboardEvolucion: mockMod.buildDefaultDashboardEvolucion,
    };
  } finally {
    await server.close();
  }
}

const {
  mockStudents,
  extraSeeds,
  DEFAULT_RESULTADOS_EVALUACION,
  DEFAULT_EVOLUCION_DETALLADA,
  buildDefaultDashboardEvolucion,
} = await loadSeedModules();

function studentProfilePayload(student) {
  const { id: _id, name: _name, perfil: _perfil, ...rest } = student;
  return {
    ...rest,
    resultadosEvaluaciones:
      rest.resultadosEvaluaciones ?? DEFAULT_RESULTADOS_EVALUACION ?? [],
    evolucionDetallada:
      rest.evolucionDetallada ?? DEFAULT_EVOLUCION_DETALLADA ?? [],
    dashboardEvolucion:
      rest.dashboardEvolucion ??
      buildDefaultDashboardEvolucion?.({
        promedio: rest.promedio,
        progreso: rest.progreso,
      }),
  };
}

function buildFromTemplate(meta, templateIndex) {
  const template = mockStudents[templateIndex];
  if (!template) {
    throw new Error(`Missing mockStudents template at index ${templateIndex}`);
  }
  return studentProfilePayload({
    ...template,
    id: meta.id,
    name: meta.name,
    perfil: meta.perfil,
    promedio: meta.promedio,
    progreso: meta.progreso,
    tendencia: meta.tendencia,
    avatar: template.avatar?.replace(/\d+/, String(meta.id)) ?? `student-${meta.id}`,
  });
}

const updates = [
  ...mockStudents.map((s) => ({ id: s.id, payload: studentProfilePayload(s) })),
  ...extraSeeds.map((meta, index) => ({
    id: meta.id,
    payload: buildFromTemplate(meta, index % mockStudents.length),
  })),
];

if (!updates.length) {
  console.error('No students to seed');
  process.exit(1);
}

const client = await connectPgClient(repoRoot, 'seed:student-profiles');
let updated = 0;
try {
  await client.query('BEGIN');
  for (const { id, payload } of updates) {
    const result = await client.query(
      `UPDATE public.school_students
       SET profile_data = $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(payload), id]
    );
    if (result.rowCount === 0) {
      console.warn(`[seed:student-profiles] No school_students row for id=${id}`);
    } else {
      updated += 1;
    }
  }
  await client.query('COMMIT');
  console.log(
    `OK — profile_data updated for ${updated} students (demo: ${mockStudents.length}, otros liceos: ${extraSeeds.length})`
  );
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('seed:student-profiles failed:', e?.message || e);
  process.exit(1);
} finally {
  await client.end();
}
