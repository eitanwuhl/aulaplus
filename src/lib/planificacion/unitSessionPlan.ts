import type { UnidadDidactica, UnitAssignmentMetadata } from '@/types/planificacion';

/** Expand didactic units into one slot per estimated class. */
export function expandUnitsToSessionPlan(unidades: UnidadDidactica[]): UnitAssignmentMetadata[] {
  const expanded: UnitAssignmentMetadata[] = [];

  for (let i = 0; i < unidades.length; i++) {
    const unidad = unidades[i];
    const totalClases =
      unidad.clases_estimadas && unidad.clases_estimadas > 0 && !isNaN(unidad.clases_estimadas)
        ? unidad.clases_estimadas
        : 1;

    for (let claseNum = 1; claseNum <= totalClases; claseNum++) {
      expanded.push({
        unidadIndex: i,
        unidadId: unidad.id,
        contenido_texto: unidad.contenido_texto,
        competencias_ids: unidad.competencias_ids || [],
        claseEnUnidad: claseNum,
        totalClasesUnidad: totalClases,
        isExtraSlot: false,
      });
    }
  }

  return expanded;
}

/** Map session slots to expanded unit plan (truncate, pad, or repeat last unit). */
export function mapSessionsToUnits(
  totalSlots: number,
  expandedPlan: UnitAssignmentMetadata[],
  options?: { fallbackContenido?: string }
): UnitAssignmentMetadata[] {
  const fallbackContenido = options?.fallbackContenido ?? '';

  if (expandedPlan.length === 0) {
    return Array.from({ length: Math.max(totalSlots, 0) }, () => ({
      unidadIndex: -1,
      unidadId: '',
      contenido_texto: fallbackContenido,
      competencias_ids: [],
      claseEnUnidad: 1,
      totalClasesUnidad: 1,
      isExtraSlot: false,
    }));
  }

  if (totalSlots <= expandedPlan.length) {
    return expandedPlan.slice(0, totalSlots);
  }

  const remaining = totalSlots - expandedPlan.length;
  const lastUnit = expandedPlan[expandedPlan.length - 1];

  const additionalSessions: UnitAssignmentMetadata[] = [];
  for (let i = 1; i <= remaining; i++) {
    additionalSessions.push({
      ...lastUnit,
      claseEnUnidad: lastUnit.totalClasesUnidad + i,
      isExtraSlot: true,
    });
  }

  return [...expandedPlan, ...additionalSessions];
}
