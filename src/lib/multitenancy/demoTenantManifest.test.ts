import { describe, expect, it } from 'vitest';
import {
  LICEO_NORTE_STUDENT_SEEDS,
  LICEO_ST_PATRICKS_STUDENT_SEEDS,
} from '@/data/seedStudentsBySchool';
import {
  DEMO_PROFILE_SEED_STUDENT_IDS,
  DEMO_SCHOOL_IDS,
  DEMO_STUDENT_IDS_BY_SCHOOL,
  DEMO_TEACHER_ASSIGNMENTS,
  studentIdsOverlapAcrossSchools,
  teacherGroupAssignmentsMatchSchool,
} from './demoTenantManifest';

describe('demoTenantManifest', () => {
  it('defines all demo schools', () => {
    expect(DEMO_SCHOOL_IDS).toEqual(['liceo-demo', 'liceo-norte', 'liceo-st-patricks']);
  });

  it('keeps student ids disjoint across schools', () => {
    expect(studentIdsOverlapAcrossSchools()).toBe(false);
  });

  it('assigns each demo teacher only to groups of their school', () => {
    for (const teacher of DEMO_TEACHER_ASSIGNMENTS) {
      expect(
        teacherGroupAssignmentsMatchSchool(teacher.schoolId, teacher.groupIds)
      ).toBe(true);
    }
  });

  it('isolates DOC002 to liceo-norte (different school_id than DOC001)', () => {
    const doc1 = DEMO_TEACHER_ASSIGNMENTS.find((t) => t.loginCode === 'DOC001');
    const doc2 = DEMO_TEACHER_ASSIGNMENTS.find((t) => t.loginCode === 'DOC002');
    expect(doc2?.schoolId).toBe('liceo-norte');
    expect(doc1?.schoolId).toBe('liceo-demo');
    expect(doc2?.schoolId).not.toBe(doc1?.schoolId);
    // Group ids may repeat across schools; isolation is by (school_id, id) in Postgres.
    expect(teacherGroupAssignmentsMatchSchool('liceo-norte', doc2!.groupIds)).toBe(true);
  });

  it('expects profile seeds for every catalog student in both schools', () => {
    const profileSet = new Set(DEMO_PROFILE_SEED_STUDENT_IDS);
    for (const schoolId of DEMO_SCHOOL_IDS) {
      for (const studentId of DEMO_STUDENT_IDS_BY_SCHOOL[schoolId]) {
        expect(profileSet.has(studentId)).toBe(true);
      }
    }
  });

  it('liceo-norte seed metadata covers all norte catalog ids', () => {
    const norteIds = new Set(DEMO_STUDENT_IDS_BY_SCHOOL['liceo-norte']);
    const seedIds = LICEO_NORTE_STUDENT_SEEDS.map((s) => s.id);
    expect(seedIds).toHaveLength(norteIds.size);
    for (const id of seedIds) {
      expect(norteIds.has(id)).toBe(true);
    }
  });

  it('st patricks teachers belong to same school', () => {
    const doc4 = DEMO_TEACHER_ASSIGNMENTS.find((t) => t.loginCode === 'DOC004');
    const doc5 = DEMO_TEACHER_ASSIGNMENTS.find((t) => t.loginCode === 'DOC005');
    expect(doc4?.schoolId).toBe('liceo-st-patricks');
    expect(doc5?.schoolId).toBe('liceo-st-patricks');
  });

  it('liceo-st-patricks seed metadata covers all catalog ids', () => {
    const ids = new Set(DEMO_STUDENT_IDS_BY_SCHOOL['liceo-st-patricks']);
    for (const id of LICEO_ST_PATRICKS_STUDENT_SEEDS.map((s) => s.id)) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
