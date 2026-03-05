import type { UnidadDidactica } from '@/types/planificacion';

export interface UnitContextForPayload {
  unidadId: string;
  contenido: string;
  claseEnUnidad: number;
  totalClasesUnidad: number;
  isExtraSlot?: boolean;
}

interface UnitAssignmentMetadata {
  unidadId: string;
  contenido_texto: string;
  claseEnUnidad: number;
  totalClasesUnidad: number;
  isExtraSlot?: boolean;
}

function expandUnitsToSessionPlan(unidades: UnidadDidactica[]): UnitAssignmentMetadata[] {
  const expanded: UnitAssignmentMetadata[] = [];

  for (const unidad of unidades) {
    const totalClases =
      unidad.clases_estimadas && unidad.clases_estimadas > 0 && !isNaN(unidad.clases_estimadas)
        ? unidad.clases_estimadas
        : 1;

    for (let claseNum = 1; claseNum <= totalClases; claseNum++) {
      expanded.push({
        unidadId: unidad.id,
        contenido_texto: unidad.contenido_texto,
        claseEnUnidad: claseNum,
        totalClasesUnidad: totalClases,
        isExtraSlot: false,
      });
    }
  }

  return expanded;
}

function mapSessionsToUnits(totalSlots: number, expandedPlan: UnitAssignmentMetadata[]): UnitAssignmentMetadata[] {
  if (expandedPlan.length === 0) {
    return Array.from({ length: Math.max(totalSlots, 1) }, () => ({
      unidadId: '',
      contenido_texto: '',
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

export function buildUnitContextForSession(params: {
  unidades: UnidadDidactica[] | undefined;
  orden: number | undefined;
  totalSlots: number | undefined;
}): UnitContextForPayload {
  const { unidades, orden, totalSlots } = params;

  if (!Array.isArray(unidades) || unidades.length === 0 || !orden || orden <= 0) {
    // Fallback explícito para mantener contrato cuando no hay datos de secuencia.
    return { unidadId: '', contenido: '', claseEnUnidad: 1, totalClasesUnidad: 1 };
  }

  const expandedPlan = expandUnitsToSessionPlan(unidades);
  const slots = totalSlots && totalSlots > 0 ? totalSlots : Math.max(expandedPlan.length, orden);
  const sessionAssignments = mapSessionsToUnits(slots, expandedPlan);
  const assignment = sessionAssignments[orden - 1];

  if (!assignment) {
    return { unidadId: '', contenido: '', claseEnUnidad: 1, totalClasesUnidad: 1 };
  }

  return {
    unidadId: assignment.unidadId,
    contenido: assignment.contenido_texto,
    claseEnUnidad: assignment.claseEnUnidad,
    totalClasesUnidad: assignment.totalClasesUnidad,
    ...(assignment.isExtraSlot ? { isExtraSlot: true } : {}),
  };
}
