import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlanificacionInsertPayload } from './buildPlanificacionInsert';
import { buildSesionesInsertFromWizard } from './buildSesionesInsert';
import { validateWizardStep } from './wizardValidation';
import type { WizardData } from '@/types/planificacion';

/**
 * End-to-end wizard flow at the pure-function layer (no Supabase / no React).
 * Mirrors PlanificacionWizard handleFinish: validate → insert payload → sesiones rows.
 */
describe('wizard flow integration (pure)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseEnfoque: WizardData['enfoque'] = {
    unidades_didacticas: [
      {
        id: 'u1',
        contenido_id: 'c1',
        contenido_texto: 'Contenido ANEP suficiente',
        competencias_ids: [],
        clases_estimadas: 1,
        orden: 1,
      },
    ],
    requerimientos_docente: '',
    distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
    estrategias_diferenciacion: '',
  };

  it('sin_periodo: validate → planificacion insert → backlog sesiones', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      programa_id: 'prog-1',
      contexto: {
        grupo_id: '9A',
        materia: 'Historia',
        cantidad_sesiones: 4,
        duracion_por_sesion: 50,
      },
      enfoque: baseEnfoque,
    };

    const validation = validateWizardStep(wizard, 3);
    expect(validation.valid).toBe(true);

    const insert = buildPlanificacionInsertPayload({
      userId: 'teacher-1',
      wizardData: wizard,
      nivel: '9',
    });
    expect(insert.programa_id).toBe('prog-1');
    expect(insert.fecha_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(insert.cantidad_sesiones).toBe(4);

    const { mode, rows } = buildSesionesInsertFromWizard('plan-new', wizard);
    expect(mode).toBe('backlog');
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.estado === 'backlog' && r.fecha === null)).toBe(true);
  });

  it('periodo_especifico: validate → planificacion insert → calendar sesiones', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'periodo_especifico',
      contexto: {
        grupo_id: '9A',
        materia: 'Historia',
        fecha_inicio: '2026-06-10',
        fecha_fin: '2026-06-24',
      },
      horario: {
        horas_semanales: 2,
        configuracion: [
          { dia: 'martes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
          { dia: 'jueves', horaInicio: '11:00', horaFin: '12:00', duracionMinutos: 60 },
        ],
      },
      enfoque: baseEnfoque,
    };

    const validation = validateWizardStep(wizard, 3);
    expect(validation.valid).toBe(true);

    const insert = buildPlanificacionInsertPayload({
      userId: 'teacher-1',
      wizardData: wizard,
      nivel: '9',
    });
    expect(insert.fecha_inicio).toBe('2026-06-10');
    expect(insert.fecha_fin).toBe('2026-06-24');
    expect(insert.configuracion_horario).toHaveLength(2);

    const { mode, rows } = buildSesionesInsertFromWizard('plan-new', wizard);
    expect(mode).toBe('calendario');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.estado === 'planificada' && r.fecha !== null)).toBe(true);
  });
});
