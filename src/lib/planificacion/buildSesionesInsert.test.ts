import { describe, expect, it } from 'vitest';
import {
  buildBacklogSesionesInsert,
  buildCalendarioSesionesInsert,
  buildSesionesInsertFromWizard,
} from './buildSesionesInsert';
import type { WizardData } from '@/types/planificacion';

const PLAN_ID = 'plan-uuid-1';

describe('buildBacklogSesionesInsert', () => {
  it('creates N backlog rows with null fecha and sequential orden', () => {
    const rows = buildBacklogSesionesInsert({
      planificacionId: PLAN_ID,
      cantidadSesiones: 3,
      duracionPorSesion: 45,
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      planificacion_id: PLAN_ID,
      fecha: null,
      orden: 1,
      estado: 'backlog',
      duracion_minutos: 45,
    });
    expect(rows[2].orden).toBe(3);
    expect(rows.every((r) => r.evaluacion.tipo === 'observacion')).toBe(true);
  });

  it('returns empty array for zero sessions', () => {
    expect(
      buildBacklogSesionesInsert({
        planificacionId: PLAN_ID,
        cantidadSesiones: 0,
        duracionPorSesion: 60,
      })
    ).toEqual([]);
  });
});

describe('buildCalendarioSesionesInsert', () => {
  it('creates planificada rows on matching weekdays with local ISO dates', () => {
    const rows = buildCalendarioSesionesInsert({
      planificacionId: PLAN_ID,
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-15',
      configuracion: [
        { dia: 'lunes', horaInicio: '09:00', horaFin: '10:30', duracionMinutos: 90 },
      ],
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      planificacion_id: PLAN_ID,
      fecha: '2026-06-01',
      estado: 'planificada',
      duracion_minutos: 90,
      orden: 1,
    });
    expect(rows.every((r) => r.fecha !== null)).toBe(true);
  });

  it('uses per-day duration from horario config', () => {
    const rows = buildCalendarioSesionesInsert({
      planificacionId: PLAN_ID,
      fecha_inicio: '2026-06-02',
      fecha_fin: '2026-06-06',
      configuracion: [
        { dia: 'martes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 50 },
        { dia: 'jueves', horaInicio: '11:00', horaFin: '12:30', duracionMinutos: 80 },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].duracion_minutos).toBe(50);
    expect(rows[1].duracion_minutos).toBe(80);
  });
});

describe('buildSesionesInsertFromWizard', () => {
  it('builds backlog sessions for sin_periodo', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        cantidad_sesiones: 2,
        duracion_por_sesion: 55,
      },
    };

    const { mode, rows } = buildSesionesInsertFromWizard(PLAN_ID, wizard);
    expect(mode).toBe('backlog');
    expect(rows).toHaveLength(2);
    expect(rows[0].estado).toBe('backlog');
    expect(rows[0].duracion_minutos).toBe(55);
  });

  it('builds calendar sessions for periodo_especifico', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'periodo_especifico',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        fecha_inicio: '2026-06-01',
        fecha_fin: '2026-06-08',
      },
      horario: {
        horas_semanales: 1,
        configuracion: [
          { dia: 'lunes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
        ],
      },
    };

    const { mode, rows } = buildSesionesInsertFromWizard(PLAN_ID, wizard);
    expect(mode).toBe('calendario');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].estado).toBe('planificada');
    expect(rows[0].fecha).toBe('2026-06-01');
  });

  it('returns empty calendario rows when horario missing', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'periodo_especifico',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        fecha_inicio: '2026-06-01',
        fecha_fin: '2026-06-08',
      },
    };

    const { mode, rows } = buildSesionesInsertFromWizard(PLAN_ID, wizard);
    expect(mode).toBe('calendario');
    expect(rows).toEqual([]);
  });
});
