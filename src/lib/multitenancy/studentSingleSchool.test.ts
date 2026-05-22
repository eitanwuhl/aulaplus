import { describe, expect, it } from 'vitest';
import {
  assertNoCatalogStudentInMultipleSchools,
  catalogStudentIdBelongsToSchool,
  demoSchoolForCatalogStudentId,
} from './studentSingleSchool';

describe('studentSingleSchool', () => {
  it('each demo catalog student id maps to at most one school', () => {
    expect(assertNoCatalogStudentInMultipleSchools()).toBe(true);
  });

  it('resolves school for known student ids', () => {
    expect(demoSchoolForCatalogStudentId(1)).toBe('liceo-demo');
    expect(demoSchoolForCatalogStudentId(301)).toBe('liceo-st-patricks');
    expect(demoSchoolForCatalogStudentId(201)).toBe('liceo-norte');
  });

  it('rejects cross-school membership in demo manifest', () => {
    expect(catalogStudentIdBelongsToSchool(1, 'liceo-demo')).toBe(true);
    expect(catalogStudentIdBelongsToSchool(1, 'liceo-norte')).toBe(false);
  });
});
