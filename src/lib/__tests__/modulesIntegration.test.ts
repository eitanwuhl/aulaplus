import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { programUnitsToWizardUnits } from '@/lib/annualProgram/programUnitsMapper';
import { canImportProgramToWizard } from '@/lib/annualProgram/annualProgramWorkflow';
import { computeProgramCoverage } from '@/lib/annualProgram/coverage';
import { buildPlanificacionInsertPayload } from '@/lib/planificacion/buildPlanificacionInsert';
import { validateWizardStep } from '@/lib/planificacion/wizardValidation';
import { buildUnitContextForSession } from '@/services/planning/sessionUnitContext';
import type { CatalogItemForPlanning, ProgramaUnidad } from '@/types/annualProgram';
import type { WizardData } from '@/types/planificacion';

/** M2 → M3: approved program units importable and usable in wizard + session mapping */
describe('modules M2 → M3 integration', () => {
  const catalogItem: CatalogItemForPlanning = {
    id: 'cat-1',
    tipo: 'contenido',
    codigo: 'H1',
    nombre: 'Revolución industrial',
    descripcion: null,
    nivel: null,
    materia: 'Historia',
  };

  const programaUnit: ProgramaUnidad = {
    id: 'pu-1',
    programa_id: 'prog-1',
    nombre: 'Unidad 1',
    descripcion: 'Tema central',
    orden: 1,
    fecha_inicio: null,
    fecha_fin: null,
    duracion_semanas: null,
    clases_estimadas: 2,
    estado: 'planificada',
    catalog_item_ids: ['cat-1'],
    competencias_ids: ['comp-1'],
    metadata: {},
    created_at: '',
    updated_at: '',
  };

  it('maps program units to wizard units then to session contexts', () => {
    expect(canImportProgramToWizard('aprobado', 1)).toBe(true);

    const wizardUnits = programUnitsToWizardUnits([programaUnit], new Map([['cat-1', catalogItem]]));
    expect(wizardUnits[0].contenido_texto).toContain('Tema central');
    expect(wizardUnits[0].clases_estimadas).toBe(2);

    const session1 = buildUnitContextForSession({
      unidades: wizardUnits,
      orden: 1,
      totalSlots: 2,
    });
    const session2 = buildUnitContextForSession({
      unidades: wizardUnits,
      orden: 2,
      totalSlots: 2,
    });
    expect(session1.unidadId).toBe('pu-1');
    expect(session1.claseEnUnidad).toBe(1);
    expect(session2.claseEnUnidad).toBe(2);
  });

  it('builds planificacion insert from wizard with programa_id', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'sin_periodo',
      programa_id: 'prog-1',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        cantidad_sesiones: 2,
        duracion_por_sesion: 60,
      },
      enfoque: {
        unidades_didacticas: programUnitsToWizardUnits([programaUnit], new Map([['cat-1', catalogItem]])),
        requerimientos_docente: 'Enfoque docente suficientemente largo',
        distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
        estrategias_diferenciacion: '',
      },
    };

    const payload = buildPlanificacionInsertPayload({
      userId: 'teacher-1',
      wizardData: wizard,
      nivel: '9',
    });
    expect(payload.programa_id).toBe('prog-1');
    expect(payload.unidades_didacticas).toHaveLength(1);
    expect(validateWizardStep(wizard, 3).valid).toBe(true);
  });
});

/** M1 catalog coverage feeds M2 program editor metrics */
describe('modules M1 → M2 integration', () => {
  it('computes coverage for historia catalog pool', () => {
    const catalog: CatalogItemForPlanning[] = [
      { id: 'a', tipo: 'contenido', codigo: '1', nombre: 'A', descripcion: null, nivel: null, materia: 'Historia' },
      { id: 'b', tipo: 'progresion', codigo: '2', nombre: 'B', descripcion: null, nivel: null, materia: 'Historia' },
      { id: 'x', tipo: 'materia', codigo: 'M', nombre: 'M', descripcion: null, nivel: null, materia: 'Historia' },
    ];
    const unidades: ProgramaUnidad[] = [
      {
        id: 'u1',
        programa_id: 'p',
        nombre: 'U',
        descripcion: null,
        orden: 1,
        fecha_inicio: null,
        fecha_fin: null,
        duracion_semanas: null,
        clases_estimadas: 1,
        estado: 'planificada',
        catalog_item_ids: ['a', 'b'],
        competencias_ids: [],
        metadata: {},
        created_at: '',
        updated_at: '',
      },
    ];
    const cov = computeProgramCoverage(catalog, unidades, 'Historia');
    expect(cov.percent).toBe(100);
    expect(cov.uncoveredItemIds).toEqual([]);
  });
});

describe('wizard edge: periodo completo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates periodo_especifico end-to-end at step 3', () => {
    const wizard: WizardData = {
      paso: 3,
      tipo_planificacion: 'periodo_especifico',
      contexto: {
        grupo_id: '1',
        materia: 'Historia',
        fecha_inicio: '2026-06-10',
        fecha_fin: '2026-08-01',
      },
      horario: {
        horas_semanales: 1,
        configuracion: [
          { dia: 'lunes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
        ],
      },
      enfoque: {
        unidades_didacticas: [
          {
            id: 'u1',
            contenido_id: 'c1',
            contenido_texto: 'Contenido ANEP',
            competencias_ids: [],
            clases_estimadas: 1,
            orden: 1,
          },
        ],
        requerimientos_docente: '',
        distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
        estrategias_diferenciacion: '',
      },
    };
    expect(validateWizardStep(wizard, 3).valid).toBe(true);
  });
});
