import {
  expandUnitsToSessionPlan,
  mapSessionsToUnits,
} from '@/lib/planificacion/unitSessionPlan';
import type { UnidadDidactica } from '@/types/planificacion';

export interface UnitContextForPayload {
  unidadId: string;
  contenido: string;
  claseEnUnidad: number;
  totalClasesUnidad: number;
  isExtraSlot?: boolean;
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
