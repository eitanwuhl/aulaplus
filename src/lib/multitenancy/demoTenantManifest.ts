/**
 * Canonical demo multi-tenant matrix (must match SQL seeds + ensure-demo-users).
 * Used by unit tests to catch drift between seeds, auth, and docs.
 */

export const DEMO_SCHOOL_IDS = ['liceo-demo', 'liceo-norte', 'liceo-st-patricks'] as const;
export type DemoSchoolId = (typeof DEMO_SCHOOL_IDS)[number];

export const DEMO_TEACHER_ASSIGNMENTS = [
  {
    loginCode: 'DOC001',
    email: 'demo.teacher@example.com',
    schoolId: 'liceo-demo' as DemoSchoolId,
    groupIds: ['1', '2'],
    displayName: 'María López',
  },
  {
    loginCode: 'DOC002',
    email: 'demo.teacher2@example.com',
    schoolId: 'liceo-norte' as DemoSchoolId,
    groupIds: ['1', '2'],
    displayName: 'Carlos Rodríguez',
  },
  {
    loginCode: 'DOC003',
    email: 'demo.teacher3@example.com',
    schoolId: 'liceo-demo' as DemoSchoolId,
    groupIds: ['1', '3'],
    displayName: 'Laura Fernández',
  },
  {
    loginCode: 'DOC004',
    email: 'demo.teacher4@example.com',
    schoolId: 'liceo-st-patricks' as DemoSchoolId,
    groupIds: ['1', '2'],
    displayName: 'Patricia Morales',
  },
  {
    loginCode: 'DOC005',
    email: 'demo.teacher5@example.com',
    schoolId: 'liceo-st-patricks' as DemoSchoolId,
    groupIds: ['2', '3'],
    displayName: 'Miguel Torres',
  },
] as const;

/** Catalog student ids per school (must match school_students seeds). */
export const DEMO_STUDENT_IDS_BY_SCHOOL: Record<DemoSchoolId, readonly number[]> = {
  'liceo-demo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'liceo-norte': [201, 202, 203, 204],
  'liceo-st-patricks': [301, 302, 303, 304, 305, 306],
};

export const DEMO_GROUP_IDS_BY_SCHOOL: Record<DemoSchoolId, readonly string[]> = {
  'liceo-demo': ['1', '2', '3'],
  'liceo-norte': ['1', '2'],
  'liceo-st-patricks': ['1', '2', '3'],
};

/** Student ids that must receive profile_data in seed:student-profiles */
export const DEMO_PROFILE_SEED_STUDENT_IDS: readonly number[] = DEMO_SCHOOL_IDS.flatMap(
  (schoolId) => [...DEMO_STUDENT_IDS_BY_SCHOOL[schoolId]]
);

export function studentIdsOverlapAcrossSchools(): boolean {
  const seen = new Set<number>();
  for (const schoolId of DEMO_SCHOOL_IDS) {
    for (const id of DEMO_STUDENT_IDS_BY_SCHOOL[schoolId]) {
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  return false;
}

export function teacherGroupAssignmentsMatchSchool(
  schoolId: DemoSchoolId,
  groupIds: readonly string[]
): boolean {
  const allowed = new Set(DEMO_GROUP_IDS_BY_SCHOOL[schoolId]);
  return groupIds.every((g) => allowed.has(g));
}
