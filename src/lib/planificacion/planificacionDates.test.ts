import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ANIO_LECTIVO } from '@/lib/annualProgram/constants';
import { resolvePlanificacionFechas } from './planificacionDates';
import type { WizardData } from '@/types/planificacion';

describe('resolvePlanificacionFechas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns wizard dates for periodo_especifico', () => {
    const data: WizardData = {
      paso: 3,
      tipo_planificacion: 'periodo_especifico',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        fecha_inicio: '2026-03-10',
        fecha_fin: '2026-06-20',
      },
    };
    expect(resolvePlanificacionFechas(data)).toEqual({
      fecha_inicio: '2026-03-10',
      fecha_fin: '2026-06-20',
    });
  });

  it('throws when periodo_especifico lacks dates', () => {
    expect(() =>
      resolvePlanificacionFechas({
        paso: 3,
        tipo_planificacion: 'periodo_especifico',
        contexto: { grupo_id: '1', materia: 'Historia' },
      })
    ).toThrow(/fechas/i);
  });

  it('throws when only fecha_inicio provided', () => {
    expect(() =>
      resolvePlanificacionFechas({
        paso: 3,
        tipo_planificacion: 'periodo_especifico',
        contexto: {
          grupo_id: '1',
          materia: 'Historia',
          fecha_inicio: '2026-03-10',
        },
      })
    ).toThrow(/fechas/i);
  });

  it('uses today as start for sin_periodo in 2026', () => {
    const { fecha_inicio, fecha_fin } = resolvePlanificacionFechas({
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        cantidad_sesiones: 4,
        duracion_por_sesion: 60,
      },
    });
    expect(fecha_inicio).toBe('2026-06-02');
    expect(fecha_fin >= fecha_inicio).toBe(true);
  });

  it('extends end by session count (min 7 days)', () => {
    const few = resolvePlanificacionFechas({
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: { grupo_id: '1', materia: 'H', cantidad_sesiones: 1, duracion_por_sesion: 60 },
    });
    const many = resolvePlanificacionFechas({
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: { grupo_id: '1', materia: 'H', cantidad_sesiones: 20, duracion_por_sesion: 60 },
    });
    expect(new Date(many.fecha_fin).getTime()).toBeGreaterThan(new Date(few.fecha_fin).getTime());
  });

  it('caps fecha_fin at end of default school year', () => {
    vi.setSystemTime(new Date('2026-12-01T12:00:00'));
    const { fecha_fin } = resolvePlanificacionFechas({
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        cantidad_sesiones: 50,
        duracion_por_sesion: 60,
      },
    });
    expect(fecha_fin).toBe(`${DEFAULT_ANIO_LECTIVO}-12-31`);
  });

  it('uses year start when system date is before default year', () => {
    vi.setSystemTime(new Date('2025-11-15T12:00:00'));
    const { fecha_inicio } = resolvePlanificacionFechas({
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        cantidad_sesiones: 3,
        duracion_por_sesion: 60,
      },
    });
    expect(fecha_inicio).toBe(`${DEFAULT_ANIO_LECTIVO}-01-01`);
  });

  it('defaults missing session count to at least 6-day window', () => {
    const { fecha_inicio, fecha_fin } = resolvePlanificacionFechas({
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: { grupo_id: '1', materia: 'Historia', duracion_por_sesion: 60 },
    });
    expect(fecha_fin >= fecha_inicio).toBe(true);
    const start = new Date(`${fecha_inicio}T12:00:00`);
    const end = new Date(`${fecha_fin}T12:00:00`);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6);
  });
});
