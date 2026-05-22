import { describe, expect, it } from 'vitest';
import {
  DEMO_SCHOOL_IDS,
  DEMO_STUDENT_IDS_BY_SCHOOL,
  DEMO_TEACHER_ASSIGNMENTS,
  studentIdsOverlapAcrossSchools,
  teacherGroupAssignmentsMatchSchool,
} from './demoTenantManifest';

describe('tenantIsolationRules', () => {
  it('student catalog ids do not overlap across schools', () => {
    expect(studentIdsOverlapAcrossSchools()).toBe(false);
  });

  it('each demo teacher is assigned only to groups in their school', () => {
    for (const teacher of DEMO_TEACHER_ASSIGNMENTS) {
      expect(teacherGroupAssignmentsMatchSchool(teacher.schoolId, teacher.groupIds)).toBe(
        true
      );
    }
  });

  it('DOC001 and DOC002 belong to different schools', () => {
    const doc1 = DEMO_TEACHER_ASSIGNMENTS.find((t) => t.loginCode === 'DOC001');
    const doc2 = DEMO_TEACHER_ASSIGNMENTS.find((t) => t.loginCode === 'DOC002');
    expect(doc1?.schoolId).toBe('liceo-demo');
    expect(doc2?.schoolId).toBe('liceo-norte');
    expect(doc1?.schoolId).not.toBe(doc2?.schoolId);
  });

  it('same group id string can exist in multiple schools without shared students', () => {
    const demoStudentsInGroup1 = DEMO_STUDENT_IDS_BY_SCHOOL['liceo-demo'].filter((id) =>
      [1, 2, 3, 4].includes(id)
    );
    const norteStudentsInGroup1 = DEMO_STUDENT_IDS_BY_SCHOOL['liceo-norte'];
    expect(demoStudentsInGroup1.length).toBeGreaterThan(0);
    expect(norteStudentsInGroup1.length).toBeGreaterThan(0);
    for (const id of norteStudentsInGroup1) {
      expect(demoStudentsInGroup1).not.toContain(id);
    }
    expect(DEMO_SCHOOL_IDS.length).toBeGreaterThanOrEqual(3);
  });
});
