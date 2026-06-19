import { describe, expect, it } from 'vitest';
import {
  aggregateUnitMaterialPlan,
  buildPlanificacionInsertPayload,
} from './buildPlanificacionInsert';
import type { WizardData } from '@/types/planificacion';

describe('buildPlanificacionInsert', () => {
  const baseWizard: WizardData = {
    paso: 3,
    tipo_planificacion: 'sin_periodo',
    contexto: {
      grupo_id: '1',
      materia: 'Historia',
      cantidad_sesiones: 4,
      duracion_por_sesion: 60,
    },
    enfoque: {
      unidades_didacticas: [
        {
          id: 'u1',
          contenido_id: 'c1',
          contenido_texto: 'Tema',
          competencias_ids: [],
          clases_estimadas: 2,
          orden: 1,
          unit_material_plan: [
            {
              materialId: 'm1',
              materialTitle: 'Guía',
              classCount: 2,
              perClassGuidance: ['', ''],
            },
          ],
        },
      ],
      requerimientos_docente: 'Texto docente',
      distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
      estrategias_diferenciacion: '',
    },
    programa_id: 'prog-1',
  };

  it('builds insert with dates, nivel and programa_id', () => {
    const payload = buildPlanificacionInsertPayload({
      userId: 'user-1',
      wizardData: baseWizard,
      nivel: '9',
    });
    expect(payload.user_id).toBe('user-1');
    expect(payload.grupo_id).toBe('1');
    expect(payload.nivel).toBe('9');
    expect(payload.programa_id).toBe('prog-1');
    expect(payload.fecha_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.fecha_fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.is_saved).toBe(false);
    expect(payload.horas_semanales).toBe(0);
    expect(payload.configuracion_horario).toEqual([]);
  });

  it('aggregates unit material plan', () => {
    const agg = aggregateUnitMaterialPlan(baseWizard.enfoque!.unidades_didacticas);
    expect(agg).toHaveLength(1);
    expect(agg[0].unitId).toBe('u1');
    expect(agg[0].materialId).toBe('m1');
  });

  it('builds periodo_especifico with explicit dates', () => {
    const payload = buildPlanificacionInsertPayload({
      userId: 'user-1',
      wizardData: {
        paso: 3,
        tipo_planificacion: 'periodo_especifico',
        contexto: {
          grupo_id: '1',
          materia: 'Historia',
          fecha_inicio: '2026-03-01',
          fecha_fin: '2026-06-01',
        },
        enfoque: baseWizard.enfoque!,
      },
      nivel: '9',
    });
    expect(payload.fecha_inicio).toBe('2026-03-01');
    expect(payload.fecha_fin).toBe('2026-06-01');
    expect(payload.programa_id).toBeUndefined();
  });
});
