import { describe, expect, it } from 'vitest';
import {
  canManageInstitution,
  canViewInstitutionConfig,
  CURRICULUM_FRAMEWORKS,
} from '../curriculumFrameworks';

describe('curriculumFrameworks', () => {
  it('lists 10 marcos', () => {
    expect(CURRICULUM_FRAMEWORKS).toHaveLength(10);
  });

  it('gates institution admin', () => {
    expect(canManageInstitution('direccion')).toBe(true);
    expect(canManageInstitution('admin')).toBe(true);
    expect(canManageInstitution('teacher')).toBe(false);
    expect(canManageInstitution(undefined)).toBe(false);
    expect(canViewInstitutionConfig('psicopedagogico')).toBe(true);
    expect(canViewInstitutionConfig('teacher')).toBe(false);
    expect(canViewInstitutionConfig('direccion')).toBe(true);
  });
});
