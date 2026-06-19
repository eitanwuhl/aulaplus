import type { CurriculumFramework } from '@/types/institution';
import type { InstitutionSettings } from '@/types/institution';

export function parseInstitutionSettings(raw: unknown): InstitutionSettings {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as InstitutionSettings;
  }
  return {};
}

/** ANEP MCN/EBI must remain active as base framework. */
export function validateSchoolFrameworks(frameworks: CurriculumFramework[]): string | null {
  const unique = [...new Set(frameworks)];
  if (!unique.includes('anep_ebi')) {
    return 'ANEP MCN/EBI es obligatorio como marco base.';
  }
  return null;
}

export function parseStudentFrameworks(raw: unknown): CurriculumFramework[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is CurriculumFramework => typeof x === 'string' && x.length > 0);
}
