/**
 * Competency extraction utilities for planning workflow
 * Extracts, deduplicates, and maps competencies from unidades didácticas
 */

import type { UnidadDidactica } from '@/types/planificacion';

/**
 * Extracts and deduplicates competency IDs from unidades didácticas.
 * Preserves insertion order (first occurrence wins).
 * 
 * @param unidades - Array of UnidadDidactica objects from wizard
 * @returns Flattened array of unique competency IDs
 * 
 * @example
 * // Input:  [{ competencias_ids: ['C1', 'C2'] }, { competencias_ids: ['C2', 'C3'] }]
 * // Output: ['C1', 'C2', 'C3']  (C2 deduplicated, order preserved)
 */
export function extractCompetenciesFromUnits(unidades: UnidadDidactica[] = []): string[] {
  // Flatten all competency IDs from all units
  const allCompetencias = unidades.flatMap(u => u?.competencias_ids ?? []);
  
  // Deduplicate using Set (preserves insertion order per ES2015 spec)
  const uniqueCompetencias = Array.from(new Set(allCompetencias));
  
  return uniqueCompetencias;
}

/**
 * Extracts content texts from unidades didácticas.
 * Filters out empty strings.
 * 
 * @param unidades - Array of UnidadDidactica objects
 * @returns Array of content text strings
 * 
 * @example
 * // Input:  [{ contenido_texto: 'Historia' }, { contenido_texto: '' }, { contenido_texto: 'Geografía' }]
 * // Output: ['Historia', 'Geografía']
 */
export function extractContenidosFromUnits(unidades: UnidadDidactica[] = []): string[] {
  return unidades
    .map(u => u?.contenido_texto ?? '')
    .filter(Boolean);  // Remove empty strings
}

/**
 * Builds mapping of contenido_id to competencias_ids for traceability.
 * Only includes units that have both content and competencies.
 * 
 * @param unidades - Array of UnidadDidactica objects
 * @returns Object mapping contenido_id to competencias_ids array
 * 
 * @example
 * // Input:  [{ contenido_id: 'C1', competencias_ids: ['Comp1', 'Comp2'] }]
 * // Output: { 'C1': ['Comp1', 'Comp2'] }
 */
export function buildCompetenciasContenidosMap(
  unidades: UnidadDidactica[] = []
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  
  for (const unidad of unidades) {
    const contenidoId = unidad?.contenido_id;
    const competencias = unidad?.competencias_ids ?? [];
    
    // Only include if both content ID and competencies exist
    if (contenidoId && contenidoId.trim() !== '' && competencias.length > 0) {
      // Copy array to avoid mutation
      map[contenidoId] = competencias.slice();
    }
  }
  
  return map;
}

