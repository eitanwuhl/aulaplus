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
 * - Normalize quotes and apostrophes
 * - Normalize dashes (em-dash, en-dash → hyphen)
 * - Remove parentheses content
 * - Remove any leftover stray parentheses
 * - Remove trailing punctuation
 * - Collapse multiple spaces to single space
 */
export function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[""\u201C\u201D]/g, '"') // Normalize double quotes
    .replace(/[''\u2018\u2019]/g, "'") // Normalize single quotes/apostrophes
    .replace(/[\u2013\u2014]/g, '-') // Normalize en-dash and em-dash to hyphen
    .replace(/\([^)]*\)/g, '') // Remove parentheses content
    .replace(/[()]/g, '') // Remove any leftover stray parentheses
    .replace(/[.:;,]+$/g, '') // Remove trailing punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Resolve a contemplacion ID by matching label text.
 * 
 * Uses exact normalized match first, then conservative fallback with startsWith.
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
  const isDev = typeof window !== 'undefined' && import.meta.env.DEV;

  // First pass: exact normalized match
  for (const contemplacion of allContemplaciones) {
    const contemplacionNormalized = normalizeLabel(contemplacion.label);
    
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

  // Second pass: conservative startsWith fallback (min 12 chars to avoid false positives)
  const MIN_LENGTH_FOR_STARTS_WITH = 12;
  
  if (normalized.length >= MIN_LENGTH_FOR_STARTS_WITH) {
    for (const contemplacion of allContemplaciones) {
      const contemplacionNormalized = normalizeLabel(contemplacion.label);
      
      // Allow match when one normalized string starts with the other
      const longerStr = contemplacionNormalized.length >= normalized.length ? contemplacionNormalized : normalized;
      const shorterStr = contemplacionNormalized.length < normalized.length ? contemplacionNormalized : normalized;
      
      if (shorterStr.length >= MIN_LENGTH_FOR_STARTS_WITH && longerStr.startsWith(shorterStr)) {
        // Category check
        if (category) {
          if (contemplacion.category === category || contemplacion.category === 'ambas') {
            if (isDev) {
              console.log(`[RESOLVER] Fallback match (startsWith): "${label}" → "${contemplacion.label}" (${contemplacion.id})`);
            }
            return contemplacion.id;
          }
        } else {
          if (isDev) {
            console.log(`[RESOLVER] Fallback match (startsWith): "${label}" → "${contemplacion.label}" (${contemplacion.id})`);
          }
          return contemplacion.id;
        }
      }
    }
  }

  // No match found - log details in DEV
  if (isDev) {
    console.warn(`[RESOLVER] Unresolved label: "${label}"`);
    console.warn(`[RESOLVER] Normalized: "${normalized}"`);
    
    // Show catalog normalized labels (first 5 as candidates)
    const candidates = allContemplaciones
      .filter(c => !category || c.category === category || c.category === 'ambas')
      .slice(0, 5)
      .map(c => `"${normalizeLabel(c.label)}" (${c.id})`);
    
    console.warn(`[RESOLVER] Sample catalog labels:`, candidates);
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
  const isDev = typeof window !== 'undefined' && import.meta.env.DEV;

  for (const label of labels) {
    const id = resolveContemplacionId(label, category);
    if (id) {
      resolved.push(id);
    } else {
      unresolved.push(label);
    }
  }

  // Enhanced logging for unresolved labels in DEV
  if (isDev && unresolved.length > 0) {
    console.group(`[RESOLVER] Found ${unresolved.length} unresolved label(s) for category: ${category || 'any'}`);
    
    const allContemplaciones = getAllContemplaciones();
    const catalogLabels = allContemplaciones
      .filter(c => !category || c.category === category || c.category === 'ambas')
      .map(c => normalizeLabel(c.label));
    
    unresolved.forEach(label => {
      const normalized = normalizeLabel(label);
      console.log(`  ❌ Original: "${label}"`);
      console.log(`     Normalized: "${normalized}"`);
      
      // Find closest matches (Levenshtein would be ideal, but simple contains check for now)
      const partialMatches = allContemplaciones
        .filter(c => !category || c.category === category || c.category === 'ambas')
        .filter(c => {
          const cNorm = normalizeLabel(c.label);
          return cNorm.includes(normalized.substring(0, 10)) || normalized.includes(cNorm.substring(0, 10));
        })
        .slice(0, 3)
        .map(c => `"${c.label}" (${c.id})`);
      
      if (partialMatches.length > 0) {
        console.log(`     Possible matches:`, partialMatches);
      }
    });
    
    console.groupEnd();
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







