/**
 * Regla: un alumno del catálogo pertenece a exactamente un liceo.
 * En BD: school_students.school_id + id global único; el trigger impide cambiar school_id.
 */

import { DEMO_SCHOOL_IDS, DEMO_STUDENT_IDS_BY_SCHOOL } from './demoTenantManifest';

export function catalogStudentIdBelongsToSchool(
  studentId: number,
  schoolId: string
): boolean {
  const ids = DEMO_STUDENT_IDS_BY_SCHOOL[schoolId as keyof typeof DEMO_STUDENT_IDS_BY_SCHOOL];
  if (!ids) return false;
  return ids.includes(studentId);
}

/** Devuelve el liceo del alumno si el id aparece en el manifest demo, o null si no está. */
export function demoSchoolForCatalogStudentId(studentId: number): string | null {
  for (const schoolId of DEMO_SCHOOL_IDS) {
    if (DEMO_STUDENT_IDS_BY_SCHOOL[schoolId].includes(studentId)) {
      return schoolId;
    }
  }
  return null;
}

export function assertNoCatalogStudentInMultipleSchools(): boolean {
  const seen = new Map<number, string>();
  for (const schoolId of DEMO_SCHOOL_IDS) {
    for (const id of DEMO_STUDENT_IDS_BY_SCHOOL[schoolId]) {
      const prev = seen.get(id);
      if (prev != null && prev !== schoolId) return false;
      seen.set(id, schoolId);
    }
  }
  return true;
}
