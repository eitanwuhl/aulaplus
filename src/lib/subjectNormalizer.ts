/**
 * Subject Name Normalization Utility
 * 
 * Centralizes the mapping between user-facing subject labels and internal data keys.
 * This ensures consistent behavior across all components that filter competencies,
 * content, or other subject-specific data.
 * 
 * Issue: Users see "Educación para la Ciudadanía" in the UI, but the data layer
 * uses "Formación para la ciudadanía" as the canonical key.
 */

import { Materia } from '@/data/catalogo';

/**
 * Maps user-facing subject labels to canonical data keys
 */
const SUBJECT_LABEL_MAP: Record<string, Materia> = {
  // Canonical forms (pass-through)
  'Historia': 'Historia',
  'Literatura': 'Literatura',
  'Formación para la ciudadanía': 'Formación para la ciudadanía',
  
  // User-facing aliases (normalize)
  'Educación para la Ciudadanía': 'Formación para la ciudadanía',
  'Educacion para la Ciudadania': 'Formación para la ciudadanía', // no accents
  'educación para la ciudadanía': 'Formación para la ciudadanía', // lowercase
};

/**
 * Normalizes a subject label to its canonical data key.
 * 
 * Use this function whenever:
 * - Filtering competencies by subject
 * - Loading content from catalogo by subject
 * - Switching on subject name in components
 * 
 * @param subjectLabel - The subject label from user input or UI
 * @returns The canonical Materia key for data lookups
 * 
 * @example
 * ```ts
 * normalizeSubjectName('Educación para la Ciudadanía') 
 * // => 'Formación para la ciudadanía'
 * 
 * normalizeSubjectName('Historia')
 * // => 'Historia'
 * ```
 */
export function normalizeSubjectName(subjectLabel: string): Materia {
  const normalized = SUBJECT_LABEL_MAP[subjectLabel];
  
  if (!normalized) {
    console.warn(
      `[subjectNormalizer] Unknown subject label: "${subjectLabel}". ` +
      `Falling back to input value. Known labels: ${Object.keys(SUBJECT_LABEL_MAP).join(', ')}`
    );
    return subjectLabel as Materia;
  }
  
  return normalized;
}

/**
 * Checks if a subject label matches a canonical key (case-insensitive, alias-aware).
 * 
 * @param subjectLabel - The subject label to check
 * @param canonicalKey - The canonical Materia key
 * @returns true if they represent the same subject
 * 
 * @example
 * ```ts
 * isSubjectMatch('Educación para la Ciudadanía', 'Formación para la ciudadanía')
 * // => true
 * 
 * isSubjectMatch('Historia', 'Literatura')
 * // => false
 * ```
 */
export function isSubjectMatch(subjectLabel: string, canonicalKey: Materia): boolean {
  return normalizeSubjectName(subjectLabel) === canonicalKey;
}
