import { toIsoDateLocal } from '@/lib/dates/localDate';
import type { ConfiguracionHorario, WizardData } from '@/types/planificacion';
import { generateSessionDatesFromSchedule } from './sessionSchedule';

const EMPTY_SESION_FIELDS = {
  competencias_anep: [] as string[],
  contenidos_anep: [] as string[],
  criterios_logro_anep: [] as string[],
  plan_desarrollo: {} as Record<string, unknown>,
  evaluacion: { tipo: 'observacion' as const },
  recursos: [] as string[],
  es_feriado: false,
  bloqueo_reserva: false,
};

export type SesionClaseInsertRow = {
  planificacion_id: string;
  fecha: string | null;
  orden: number;
  estado: 'backlog' | 'planificada';
  duracion_minutos: number;
  competencias_anep: string[];
  contenidos_anep: string[];
  criterios_logro_anep: string[];
  plan_desarrollo: Record<string, unknown>;
  evaluacion: { tipo: 'observacion' };
  recursos: string[];
  es_feriado: boolean;
  bloqueo_reserva: boolean;
};

const WEEKDAY_TO_DIA: Partial<Record<number, ConfiguracionHorario['dia']>> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
};

function resolveDuracionForDate(fecha: Date, configuracion: ConfiguracionHorario[]): number {
  const dia = WEEKDAY_TO_DIA[fecha.getDay()];
  const configDia = dia ? configuracion.find((c) => c.dia === dia) : undefined;
  return configDia?.duracionMinutos ?? 60;
}

/** Backlog sessions (sin período): no date, estado backlog. */
export function buildBacklogSesionesInsert(input: {
  planificacionId: string;
  cantidadSesiones: number;
  duracionPorSesion: number;
}): SesionClaseInsertRow[] {
  return Array.from({ length: input.cantidadSesiones }, (_, i) => ({
    planificacion_id: input.planificacionId,
    fecha: null,
    orden: i + 1,
    estado: 'backlog' as const,
    duracion_minutos: input.duracionPorSesion,
    ...EMPTY_SESION_FIELDS,
  }));
}

/** Calendar sessions (período específico): one row per scheduled weekday in range. */
export function buildCalendarioSesionesInsert(input: {
  planificacionId: string;
  fecha_inicio: string;
  fecha_fin: string;
  configuracion: ConfiguracionHorario[];
}): SesionClaseInsertRow[] {
  const fechas = generateSessionDatesFromSchedule({
    fecha_inicio: input.fecha_inicio,
    fecha_fin: input.fecha_fin,
    configuracion: input.configuracion,
  });

  return fechas.map((fecha, index) => ({
    planificacion_id: input.planificacionId,
    fecha: toIsoDateLocal(fecha),
    orden: index + 1,
    estado: 'planificada' as const,
    duracion_minutos: resolveDuracionForDate(fecha, input.configuracion),
    ...EMPTY_SESION_FIELDS,
  }));
}

/** Builds session insert rows from wizard state after planificacion is created. */
export function buildSesionesInsertFromWizard(
  planificacionId: string,
  wizardData: WizardData
): { mode: 'backlog' | 'calendario'; rows: SesionClaseInsertRow[] } {
  if (wizardData.tipo_planificacion === 'sin_periodo') {
    return {
      mode: 'backlog',
      rows: buildBacklogSesionesInsert({
        planificacionId,
        cantidadSesiones: wizardData.contexto?.cantidad_sesiones ?? 0,
        duracionPorSesion: wizardData.contexto?.duracion_por_sesion ?? 60,
      }),
    };
  }

  const ctx = wizardData.contexto;
  const horario = wizardData.horario;
  if (!ctx?.fecha_inicio || !ctx?.fecha_fin || !horario?.configuracion?.length) {
    return { mode: 'calendario', rows: [] };
  }

  return {
    mode: 'calendario',
    rows: buildCalendarioSesionesInsert({
      planificacionId,
      fecha_inicio: ctx.fecha_inicio,
      fecha_fin: ctx.fecha_fin,
      configuracion: horario.configuracion,
    }),
  };
}
