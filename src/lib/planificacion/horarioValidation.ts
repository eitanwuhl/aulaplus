import type { ConfiguracionHorario } from '@/types/planificacion';
import type { FieldError } from '@/types/validation';

export const HORAS_SEMANALES_MIN = 1;
export const HORAS_SEMANALES_MAX = 10;
export const DURACION_MINUTOS_MIN = 15;
export const DURACION_MINUTOS_MAX = 240;
/** Tolerancia entre duración declarada y diferencia hora fin − inicio (minutos). */
export const DURACION_VS_RANGO_TOLERANCE_MIN = 5;
/** Tolerancia al comparar horas semanales declaradas vs suma de bloques (horas). */
export const HORAS_COHERENCE_TOLERANCE = 0.25;

export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? '');
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function slotMinutesFromTimes(horaInicio: string, horaFin: string): number | null {
  const start = parseTimeToMinutes(horaInicio);
  const end = parseTimeToMinutes(horaFin);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

export function computeWeeklyHoursFromConfig(configuracion: ConfiguracionHorario[]): number {
  const totalMinutes = configuracion.reduce((sum, config) => {
    const fromRange = slotMinutesFromTimes(config.horaInicio, config.horaFin);
    if (fromRange !== null) return sum + fromRange;
    const duration = config.duracionMinutos;
    return sum + (Number.isFinite(duration) && duration > 0 ? duration : 0);
  }, 0);
  return totalMinutes / 60;
}

export function validateHorasSemanalesValue(
  horas: number | undefined
): FieldError | null {
  if (horas === undefined || Number.isNaN(horas)) {
    return {
      fieldId: 'horas_semanales',
      message: 'Horas semanales es obligatorio',
      type: 'required'
    };
  }
  if (!Number.isInteger(horas)) {
    return {
      fieldId: 'horas_semanales',
      message: 'Debe ser un número entero de horas',
      type: 'range'
    };
  }
  if (horas < HORAS_SEMANALES_MIN) {
    return {
      fieldId: 'horas_semanales',
      message: `Debe ser al menos ${HORAS_SEMANALES_MIN} hora por semana`,
      type: 'range'
    };
  }
  if (horas > HORAS_SEMANALES_MAX) {
    return {
      fieldId: 'horas_semanales',
      message: `No puede superar ${HORAS_SEMANALES_MAX} horas semanales para una materia`,
      type: 'range'
    };
  }
  return null;
}

export function validateHorarioConfigItem(
  config: ConfiguracionHorario,
  index: number
): FieldError[] {
  const errors: FieldError[] = [];
  const prefix = `configuracion[${index}]`;

  if (!config.dia) {
    errors.push({
      fieldId: `${prefix}.dia`,
      message: 'Día es obligatorio',
      type: 'required'
    });
  }

  if (!config.horaInicio) {
    errors.push({
      fieldId: `${prefix}.horaInicio`,
      message: 'Hora de inicio es obligatoria',
      type: 'required'
    });
  } else if (parseTimeToMinutes(config.horaInicio) === null) {
    errors.push({
      fieldId: `${prefix}.horaInicio`,
      message: 'Formato de hora inválido (use HH:MM)',
      type: 'format'
    });
  }

  if (!config.horaFin) {
    errors.push({
      fieldId: `${prefix}.horaFin`,
      message: 'Hora de fin es obligatoria',
      type: 'required'
    });
  } else if (parseTimeToMinutes(config.horaFin) === null) {
    errors.push({
      fieldId: `${prefix}.horaFin`,
      message: 'Formato de hora inválido (use HH:MM)',
      type: 'format'
    });
  } else if (config.horaInicio) {
    const rangeMinutes = slotMinutesFromTimes(config.horaInicio, config.horaFin);
    if (rangeMinutes === null) {
      errors.push({
        fieldId: `${prefix}.horaFin`,
        message: 'Debe ser posterior a la hora de inicio',
        type: 'range'
      });
    }
  }

  const duration = config.duracionMinutos;
  if (duration === undefined || Number.isNaN(duration) || duration <= 0) {
    errors.push({
      fieldId: `${prefix}.duracionMinutos`,
      message:
        duration === undefined || Number.isNaN(duration)
          ? 'Duración es obligatoria'
          : 'Debe ser mayor a 0 minutos',
      type: duration === undefined || Number.isNaN(duration) ? 'required' : 'range'
    });
  } else if (duration < DURACION_MINUTOS_MIN || duration > DURACION_MINUTOS_MAX) {
    errors.push({
      fieldId: `${prefix}.duracionMinutos`,
      message: `La duración debe estar entre ${DURACION_MINUTOS_MIN} y ${DURACION_MINUTOS_MAX} minutos`,
      type: 'range'
    });
  } else if (config.horaInicio && config.horaFin) {
    const rangeMinutes = slotMinutesFromTimes(config.horaInicio, config.horaFin);
    if (
      rangeMinutes !== null &&
      Math.abs(duration - rangeMinutes) > DURACION_VS_RANGO_TOLERANCE_MIN
    ) {
      errors.push({
        fieldId: `${prefix}.duracionMinutos`,
        message: `La duración (${duration} min) no coincide con el rango horario (${rangeMinutes} min entre inicio y fin)`,
        type: 'custom'
      });
    }
  }

  return errors;
}

export function horarioBlocksOverlap(
  a: ConfiguracionHorario,
  b: ConfiguracionHorario
): boolean {
  if (!a.dia || !b.dia || a.dia !== b.dia) return false;

  const startA = parseTimeToMinutes(a.horaInicio);
  const endA = parseTimeToMinutes(a.horaFin);
  const startB = parseTimeToMinutes(b.horaInicio);
  const endB = parseTimeToMinutes(b.horaFin);

  if (startA === null || endA === null || startB === null || endB === null) {
    return false;
  }

  return startA < endB && startB < endA;
}

function formatHorarioBlockLabel(config: ConfiguracionHorario, index: number): string {
  const dia = config.dia
    ? config.dia.charAt(0).toUpperCase() + config.dia.slice(1)
    : `bloque ${index + 1}`;
  return `${dia} ${config.horaInicio}–${config.horaFin}`;
}

/** Detecta bloques del mismo día con rangos horarios que se superponen. */
export function validateHorarioNoOverlaps(
  configuracion: ConfiguracionHorario[]
): FieldError[] {
  const overlapsByIndex = new Map<number, Set<number>>();

  for (let i = 0; i < configuracion.length; i++) {
    for (let j = i + 1; j < configuracion.length; j++) {
      if (!horarioBlocksOverlap(configuracion[i], configuracion[j])) continue;

      if (!overlapsByIndex.has(i)) overlapsByIndex.set(i, new Set());
      if (!overlapsByIndex.has(j)) overlapsByIndex.set(j, new Set());
      overlapsByIndex.get(i)!.add(j);
      overlapsByIndex.get(j)!.add(i);
    }
  }

  const errors: FieldError[] = [];
  for (const [index, otherIndices] of overlapsByIndex) {
    const refs = [...otherIndices]
      .sort((a, b) => a - b)
      .map((n) => `${n + 1} (${formatHorarioBlockLabel(configuracion[n], n)})`)
      .join(', ');
    errors.push({
      fieldId: `configuracion[${index}].solapamiento`,
      message: `Este bloque se superpone con: ${refs}. Cambiá el día u horario para que no coincidan.`,
      type: 'custom',
    });
  }

  return errors;
}

export function validateHorarioCoherence(
  horasSemanales: number | undefined,
  configuracion: ConfiguracionHorario[]
): FieldError | null {
  if (!horasSemanales || configuracion.length === 0) return null;

  const computedHours = computeWeeklyHoursFromConfig(configuracion);
  if (computedHours <= 0) return null;

  if (Math.abs(computedHours - horasSemanales) > HORAS_COHERENCE_TOLERANCE) {
    const computedLabel =
      computedHours % 1 === 0 ? String(computedHours) : computedHours.toFixed(1);
    return {
      fieldId: 'horas_semanales',
      message: `Las horas semanales (${horasSemanales} h) no coinciden con la suma de los bloques configurados (${computedLabel} h). Ajustá los horarios o el total semanal.`,
      type: 'custom'
    };
  }
  return null;
}
