/**
 * Contemplaciones ID Resolver
 * 
 * Resolves contemplacion IDs by matching label text (normalized).
 * Used for deterministic preselection of suggested contemplaciones per student profile.
 */

import { getAllContemplaciones, type Contemplacion } from './catalog';

/**
 * Normalize a label for matching:
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove diacritics (á→a, é→e, etc.)
 * - Normalize quotes (" " → " ")
 * - Collapse multiple spaces to single space
 * - Remove parentheses content for more flexible matching
 */
export function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[""\u201C\u201D]/g, '"') // Normalize quotes
    .replace(/[''\u2018\u2019]/g, "'") // Normalize apostrophes
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\([^)]*\)/g, '') // Remove parentheses content
    .trim();
}

/**
 * Resolve a contemplacion ID by matching label text.
 * 
 * @param label - The label text to search for
 * @param category - Optional: restrict to specific category ('clase' | 'evaluaciones' | 'ambas')
 * @returns The contemplation ID if found, or null if not found
 */
export function resolveContemplacionId(
  label: string,
  category?: 'clase' | 'evaluaciones' | 'ambas'
): string | null {
  const normalized = normalizeLabel(label);
  const allContemplaciones = getAllContemplaciones();

  for (const contemplacion of allContemplaciones) {
    const contemplacionNormalized = normalizeLabel(contemplacion.label);
    
    // Check if labels match
    if (contemplacionNormalized === normalized) {
      // If category specified, verify this contemplation applies to that category
      if (category) {
        if (contemplacion.category === category || contemplacion.category === 'ambas') {
          return contemplacion.id;
        }
      } else {
        return contemplacion.id;
      }
    }
  }

  return null;
}

/**
 * Resolve multiple contemplacion IDs by matching label texts.
 * 
 * @param labels - Array of label texts to resolve
 * @param category - Optional: restrict to specific category
 * @returns Object with resolved IDs and warnings for unresolved labels
 */
export function resolveContemplacionIds(
  labels: string[],
  category?: 'clase' | 'evaluaciones' | 'ambas'
): {
  resolved: string[];
  unresolved: string[];
} {
  const resolved: string[] = [];
  const unresolved: string[] = [];

  for (const label of labels) {
    const id = resolveContemplacionId(label, category);
    if (id) {
      resolved.push(id);
    } else {
      unresolved.push(label);
    }
  }

  return { resolved, unresolved };
}

/**
 * Get a contemplation by its label (case-insensitive, normalized match).
 * 
 * @param label - The label text to search for
 * @returns The contemplation object if found, or null
 */
export function getContemplacionByLabel(label: string): Contemplacion | null {
  const normalized = normalizeLabel(label);
  const allContemplaciones = getAllContemplaciones();

  for (const contemplacion of allContemplaciones) {
    if (normalizeLabel(contemplacion.label) === normalized) {
      return contemplacion;
    }
  }

  return null;
}

/**
 * Verify if a label exists in the catalog (for a specific category).
 * 
 * @param label - The label text to verify
 * @param category - Optional: restrict to specific category
 * @returns true if the label exists and applies to the category
 */
export function labelExists(
  label: string,
  category?: 'clase' | 'evaluaciones' | 'ambas'
): boolean {
  return resolveContemplacionId(label, category) !== null;
}

