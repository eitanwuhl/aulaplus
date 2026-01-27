/**
 * Utilidades compartidas para contemplaciones
 */

/**
 * Normalizar ID de estudiante para comparación consistente
 * 
 * Garantiza que el mismo ID siempre se normaliza igual, independientemente
 * de si viene como string o number. Esto es crítico para:
 * - Matching de estudiantes asignados
 * - Lookup en Maps de recordatorios
 * - Keys de localStorage
 * 
 * @param id ID del estudiante (string o number)
 * @returns String normalizado (trimmed, sin espacios)
 */
export function normalizeStudentId(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}



