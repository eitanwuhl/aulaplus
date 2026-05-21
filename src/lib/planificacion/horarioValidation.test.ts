import { describe, expect, it } from 'vitest';
import {
  computeWeeklyHoursFromConfig,
  horarioBlocksOverlap,
  slotMinutesFromTimes,
  validateHorarioCoherence,
  validateHorarioConfigItem,
  validateHorarioNoOverlaps,
  validateHorasSemanalesValue,
} from './horarioValidation';
import type { ConfiguracionHorario } from '@/types/planificacion';

const baseConfig: ConfiguracionHorario = {
  dia: 'lunes',
  horaInicio: '09:00',
  horaFin: '10:00',
  duracionMinutos: 60,
};

describe('horarioValidation', () => {
  it('computes slot minutes from time range', () => {
    expect(slotMinutesFromTimes('09:00', '10:30')).toBe(90);
    expect(slotMinutesFromTimes('10:00', '09:00')).toBeNull();
  });

  it('rejects invalid weekly hours', () => {
    expect(validateHorasSemanalesValue(undefined)?.type).toBe('required');
    expect(validateHorasSemanalesValue(0)?.type).toBe('range');
    expect(validateHorasSemanalesValue(11)?.message).toContain('10');
    expect(validateHorasSemanalesValue(3)).toBeNull();
  });

  it('flags duration mismatch with time range', () => {
    const errors = validateHorarioConfigItem(
      { ...baseConfig, duracionMinutos: 30 },
      0
    );
    expect(errors.some((e) => e.fieldId.endsWith('duracionMinutos'))).toBe(true);
  });

  it('detects overlapping blocks on the same day', () => {
    expect(horarioBlocksOverlap(baseConfig, { ...baseConfig })).toBe(true);
    expect(
      horarioBlocksOverlap(baseConfig, {
        ...baseConfig,
        horaInicio: '10:00',
        horaFin: '11:00',
      })
    ).toBe(false);
    const errors = validateHorarioNoOverlaps([
      baseConfig,
      { ...baseConfig },
      { ...baseConfig, dia: 'martes' },
    ]);
    expect(errors.length).toBe(2);
    expect(errors.every((e) => e.fieldId.includes('solapamiento'))).toBe(true);
  });

  it('validates coherence between declared and computed weekly hours', () => {
    const configuracion: ConfiguracionHorario[] = [
      { ...baseConfig },
      { ...baseConfig, dia: 'miércoles', horaInicio: '11:00', horaFin: '12:00' },
    ];
    expect(computeWeeklyHoursFromConfig(configuracion)).toBe(2);
    expect(validateHorarioCoherence(3, configuracion)?.type).toBe('custom');
    expect(validateHorarioCoherence(2, configuracion)).toBeNull();
  });
});
