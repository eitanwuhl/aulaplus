import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WizardData } from '@/types/planificacion';

const mockInsert = vi.fn();
const mockSesionesInsert = vi.fn();
const mockMarkPrograma = vi.fn();
const mockPersistBriefs = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'school_groups') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { year: '9º Año' }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'planificaciones') {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => mockInsert(),
            }),
          }),
        };
      }
      if (table === 'sesiones_clase') {
        return { insert: (...args: unknown[]) => mockSesionesInsert(...args) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => ({}) }) }) };
    },
  },
}));

vi.mock('@/services/planning/planificacionLifecycle.service', () => ({
  markProgramaEnUsoIfApproved: (...args: unknown[]) => mockMarkPrograma(...args),
}));

vi.mock('@/lib/planificacion/sessionBriefPersistence', () => ({
  persistSessionBriefs: (...args: unknown[]) => mockPersistBriefs(...args),
}));

import { createPlanificacionFromWizard } from '../createPlanificacionFromWizard';

const baseWizard: WizardData = {
  paso: 3,
  tipo_planificacion: 'sin_periodo',
  programa_id: 'prog-1',
  contexto: {
    grupo_id: '9A',
    materia: 'Historia',
    cantidad_sesiones: 2,
    duracion_por_sesion: 60,
  },
  enfoque: {
    unidades_didacticas: [
      {
        id: 'u1',
        contenido_id: 'c1',
        contenido_texto: 'Contenido',
        competencias_ids: [],
        clases_estimadas: 1,
        orden: 1,
      },
    ],
    requerimientos_docente: 'Texto suficientemente largo para validación',
    distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
    estrategias_diferenciacion: '',
    sessionBriefs: ['Tema sesión 1', 'Tema sesión 2'],
  },
};

describe('createPlanificacionFromWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: { id: 'plan-1' }, error: null });
    mockSesionesInsert.mockResolvedValue({ error: null });
    mockMarkPrograma.mockResolvedValue({});
    mockPersistBriefs.mockResolvedValue({ ok: true, attempted: 2, failures: 0 });
  });

  it('creates plan, sessions, marks programa and persists briefs', async () => {
    const result = await createPlanificacionFromWizard({
      userId: 'teacher-1',
      schoolId: 'school-1',
      wizardData: baseWizard,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.planificacionId).toBe('plan-1');
      expect(result.materia).toBe('Historia');
      expect(result.nivel).toBeTruthy();
      expect(result.sesionesMode).toBe('backlog');
      expect(result.sesionesCount).toBe(2);
    }
    expect(mockMarkPrograma).toHaveBeenCalledWith('prog-1');
    expect(mockSesionesInsert).toHaveBeenCalled();
    expect(mockPersistBriefs).toHaveBeenCalledWith('plan-1', baseWizard.enfoque?.sessionBriefs);
  });

  it('returns error when plan insert fails', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'RLS' } });
    const result = await createPlanificacionFromWizard({
      userId: 'teacher-1',
      wizardData: baseWizard,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('RLS');
  });
});
