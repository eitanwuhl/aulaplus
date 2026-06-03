import { DEFAULT_ANIO_LECTIVO } from '@/lib/annualProgram/constants';
import type { WizardData } from '@/types/planificacion';

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Resolves plan-level dates for DB insert.
 * - periodo_especifico: uses wizard dates (required).
 * - sin_periodo: symbolic window (sessions are backlog); satisfies NOT NULL on planificaciones.
 */
export function resolvePlanificacionFechas(wizardData: WizardData): {
  fecha_inicio: string;
  fecha_fin: string;
} {
  const inicio = wizardData.contexto?.fecha_inicio;
  const fin = wizardData.contexto?.fecha_fin;

  if (wizardData.tipo_planificacion === 'periodo_especifico') {
    if (!inicio || !fin) {
      throw new Error('Completá las fechas de inicio y fin del período.');
    }
    return { fecha_inicio: inicio, fecha_fin: fin };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yearStart = new Date(DEFAULT_ANIO_LECTIVO, 0, 1);
  const fecha_inicio = toIsoDateLocal(today < yearStart ? yearStart : today);

  const sessions = Math.max(1, wizardData.contexto?.cantidad_sesiones ?? 1);
  const end = new Date(fecha_inicio);
  end.setDate(end.getDate() + Math.max(7, sessions * 7));

  const yearEnd = new Date(DEFAULT_ANIO_LECTIVO, 11, 31);
  const fecha_fin = toIsoDateLocal(end > yearEnd ? yearEnd : end);

  if (fecha_fin < fecha_inicio) {
    return { fecha_inicio, fecha_fin: fecha_inicio };
  }

  return { fecha_inicio, fecha_fin };
}
