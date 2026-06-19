import { describe, expect, it } from 'vitest';
import {
  parseInstitutionSettings,
  parseStudentFrameworks,
  validateSchoolFrameworks,
} from '../institutionRules';

describe('institutionRules', () => {
  it('parseInstitutionSettings returns object or empty', () => {
    expect(parseInstitutionSettings({ locale: 'es' })).toEqual({ locale: 'es' });
    expect(parseInstitutionSettings(null)).toEqual({});
    expect(parseInstitutionSettings([])).toEqual({});
  });

  it('validateSchoolFrameworks requires anep_ebi', () => {
    expect(validateSchoolFrameworks(['anep_ebi', 'cambridge_igcse'])).toBeNull();
    expect(validateSchoolFrameworks(['cambridge_igcse'])).toContain('ANEP');
  });

  it('parseStudentFrameworks filters invalid entries', () => {
    expect(parseStudentFrameworks(['anep_ebi', '', 1, 'ib_myp'])).toEqual([
      'anep_ebi',
      'ib_myp',
    ]);
    expect(parseStudentFrameworks(null)).toEqual([]);
  });
});
