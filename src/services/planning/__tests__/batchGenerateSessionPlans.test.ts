import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvokeGeneratePlanCompleto = vi.fn();
const mockBuildSanitizedLessonPlanHtml = vi.fn();
const mockLoadGroupContext = vi.fn();
const mockSesionUpdateEq = vi.fn();
const mockPlanificacionUpdateEq = vi.fn();

const planificacionRow = {
  id: 'plan-1',
  unidades_didacticas: [
    {
      id: 'u1',
      contenido_id: 'c1',
      contenido_texto: 'Revolución industrial',
      competencias_ids: ['comp-1'],
      clases_estimadas: 2,
      orden: 1,
    },
  ],
  competencias_seleccionadas: [],
  mapeo_competencias_contenidos: {},
  requerimientos_docente: 'Enfoque docente',
};

const sesionesRows = [
  {
    id: 'sess-1',
    orden: 1,
    planificacion_id: 'plan-1',
    duracion_minutos: 60,
    competencias_anep: [],
    plan_desarrollo: null,
    observaciones: null,
  },
  {
    id: 'sess-2',
    orden: 2,
    planificacion_id: 'plan-1',
    duracion_minutos: 60,
    competencias_anep: [],
    plan_desarrollo: null,
    observaciones: null,
  },
];

let sesionStore: typeof sesionesRows;

function buildSesionFrom(table: string) {
  if (table !== 'sesiones_clase') return null;
  return {
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve({ data: [...sesionStore], error: null }),
        then: (
          onFulfilled: (v: { data: unknown; error: null }) => unknown,
          onRejected?: (e: unknown) => unknown
        ) =>
          Promise.resolve({
            data: sesionStore.map((s) => ({
              id: s.id,
              plan_desarrollo: s.plan_desarrollo,
              observaciones: s.observaciones,
            })),
            error: null,
          }).then(onFulfilled, onRejected),
      }),
    }),
    update: (payload: unknown) => ({
      eq: (_col: string, id: string) => {
        mockSesionUpdateEq(id, payload);
        const row = sesionStore.find((s) => s.id === id);
        if (row && payload && typeof payload === 'object') {
          if ('plan_desarrollo' in (payload as object)) {
            row.plan_desarrollo = (payload as { plan_desarrollo: { html_completo: string } })
              .plan_desarrollo;
          }
          if ('observaciones' in (payload as object)) {
            row.observaciones = (payload as { observaciones: string }).observaciones;
          }
        }
        return Promise.resolve({ error: null });
      },
    }),
  };
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'planificaciones') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: planificacionRow, error: null }),
            }),
          }),
          update: () => ({
            eq: (...args: unknown[]) => mockPlanificacionUpdateEq(...args),
          }),
        };
      }
      const sesionApi = buildSesionFrom(table);
      if (sesionApi) return sesionApi;
      return { select: () => ({ eq: () => ({ single: () => ({}) }) }) };
    },
  },
}));

vi.mock('@/services/planning/generatePlanCompleto', () => ({
  invokeGeneratePlanCompleto: (...args: unknown[]) => mockInvokeGeneratePlanCompleto(...args),
}));

vi.mock('@/lib/planParser', () => ({
  buildSanitizedLessonPlanHtml: (...args: unknown[]) => mockBuildSanitizedLessonPlanHtml(...args),
}));

vi.mock('@/services/groupContext/provider', () => ({
  loadGroupContext: (...args: unknown[]) => mockLoadGroupContext(...args),
}));

vi.mock('@/utils/loadAttachedMaterials', () => ({
  loadAttachedMaterialsForSession: vi.fn().mockResolvedValue([]),
  formatMaterialsForAI: vi.fn().mockReturnValue(''),
}));

vi.mock('@/services/planning/teacherSafeAiReport', () => ({
  sanitizePlanningAiDesignReport: vi.fn().mockReturnValue(null),
}));

import { batchGenerateSessionPlans } from '../batchGenerateSessionPlans';

const validPlanHtml = '<section id="plan"><h1>Clase</h1><h2>Inicio</h2></section>';

describe('batchGenerateSessionPlans', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sesionStore = sesionesRows.map((s) => ({ ...s, plan_desarrollo: null }));
    mockLoadGroupContext.mockResolvedValue({});
    mockBuildSanitizedLessonPlanHtml.mockImplementation(async (html: string) => html);
    mockPlanificacionUpdateEq.mockResolvedValue({ error: null });
    mockInvokeGeneratePlanCompleto.mockResolvedValue({
      data: {
        plan_html: validPlanHtml,
        titulo: 'Clase generada',
        recursos: ['Pizarra'],
        argumento_competencias: 'Argumento',
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function runBatch(sessionBriefs?: (string | undefined)[]) {
    const promise = batchGenerateSessionPlans(
      'plan-1',
      'Historia',
      '9',
      sessionBriefs,
      'grupo-1'
    );
    await vi.runAllTimersAsync();
    return promise;
  }

  it('generates and persists plans for all sessions', async () => {
    const result = await runBatch();

    expect(result).toEqual({ success: true });
    expect(mockInvokeGeneratePlanCompleto).toHaveBeenCalledTimes(2);
    expect(mockSesionUpdateEq).toHaveBeenCalledTimes(2);
    expect(sesionStore.every((s) => s.plan_desarrollo?.html_completo === validPlanHtml)).toBe(true);
  });

  it('returns failedSessions when verification finds missing html', async () => {
    mockInvokeGeneratePlanCompleto.mockResolvedValue({
      data: null,
      error: { message: 'OpenAI down' },
    });

    const result = await runBatch();

    expect(result).toMatchObject({ success: false });
    if (result && typeof result === 'object' && 'failedSessions' in result) {
      expect(result.failedSessions?.length).toBeGreaterThan(0);
    }
  });

  it('returns early when there are no sessions', async () => {
    sesionStore = [];
    const result = await runBatch();
    expect(result).toBeUndefined();
    expect(mockInvokeGeneratePlanCompleto).not.toHaveBeenCalled();
  });

  it('uses sessionBrief from wizard when provided', async () => {
    await runBatch(['Tema sesión 1', 'Tema sesión 2']);

    expect(mockInvokeGeneratePlanCompleto).toHaveBeenCalledWith(
      expect.objectContaining({ sessionBrief: 'Tema sesión 1' })
    );
  });
});
