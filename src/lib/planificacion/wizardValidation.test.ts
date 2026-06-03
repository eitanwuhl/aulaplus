import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateWizardStep } from './wizardValidation';
import type { WizardData } from '@/types/planificacion';

const baseHorario = {
  horas_semanales: 1,
  configuracion: [
    {
      dia: 'lunes' as const,
      horaInicio: '09:00',
      horaFin: '10:00',
      duracionMinutos: 60,
    },
  ],
};

function validPeriodoWizard(overrides?: Partial<WizardData>): WizardData {
  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 7);
  const futureEnd = new Date(futureStart);
  futureEnd.setDate(futureEnd.getDate() + 30);

  return {
    paso: 3,
    tipo_planificacion: 'periodo_especifico',
    contexto: {
      grupo_id: '1',
      materia: 'Historia',
      fecha_inicio: futureStart.toISOString().slice(0, 10),
      fecha_fin: futureEnd.toISOString().slice(0, 10),
    },
    horario: baseHorario,
    enfoque: {
      unidades_didacticas: [
        {
          id: 'u1',
          contenido_id: 'c1',
          contenido_texto: 'Revolución industrial',
          competencias_ids: [],
          clases_estimadas: 2,
          orden: 1,
        },
      ],
      distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
      requerimientos_docente: '',
      estrategias_diferenciacion: '',
    },
    ...overrides,
  };
}

function validSinPeriodoWizard(overrides?: Partial<WizardData>): WizardData {
  return {
    paso: 3,
    tipo_planificacion: 'sin_periodo',
    contexto: {
      grupo_id: '1',
      materia: 'Historia',
      cantidad_sesiones: 5,
      duracion_por_sesion: 60,
    },
    enfoque: {
      unidades_didacticas: [],
      requerimientos_docente: 'a'.repeat(25),
      distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
      estrategias_diferenciacion: '',
      attachedPlanMaterialIds: [],
    },
    ...overrides,
  };
}

describe('validateWizardStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('step 0', () => {
    it('requires grupo, materia and tipo', () => {
      const r = validateWizardStep({ paso: 0 }, 0);
      expect(r.valid).toBe(false);
      expect(r.errors.map((e) => e.fieldId)).toEqual(
        expect.arrayContaining(['grupo_id', 'materia', 'tipo_planificacion'])
      );
    });

    it('requires dates for periodo_especifico', () => {
      const r = validateWizardStep(
        {
          paso: 0,
          tipo_planificacion: 'periodo_especifico',
          contexto: { grupo_id: '1', materia: 'Historia' },
        },
        0
      );
      expect(r.errors.some((e) => e.fieldId === 'fecha_inicio')).toBe(true);
      expect(r.errors.some((e) => e.fieldId === 'fecha_fin')).toBe(true);
    });

    it('rejects start date before today', () => {
      const r = validateWizardStep(
        {
          paso: 0,
          tipo_planificacion: 'periodo_especifico',
          contexto: {
            grupo_id: '1',
            materia: 'Historia',
            fecha_inicio: '2026-06-01',
            fecha_fin: '2026-07-01',
          },
        },
        0
      );
      expect(r.errors.some((e) => e.fieldId === 'fecha_inicio')).toBe(true);
    });

    it('rejects end date not after start', () => {
      const r = validateWizardStep(
        {
          paso: 0,
          tipo_planificacion: 'periodo_especifico',
          contexto: {
            grupo_id: '1',
            materia: 'Historia',
            fecha_inicio: '2026-06-10',
            fecha_fin: '2026-06-10',
          },
        },
        0
      );
      expect(r.errors.some((e) => e.fieldId === 'fecha_fin')).toBe(true);
    });

    it('requires session count and duration for sin_periodo', () => {
      const r = validateWizardStep(
        {
          paso: 0,
          tipo_planificacion: 'sin_periodo',
          contexto: { grupo_id: '1', materia: 'Historia' },
        },
        0
      );
      expect(r.errors.some((e) => e.fieldId === 'cantidad_sesiones')).toBe(true);
      expect(r.errors.some((e) => e.fieldId === 'duracion_por_sesion')).toBe(true);
    });

    it('passes valid sin_periodo context', () => {
      const r = validateWizardStep(validSinPeriodoWizard(), 0);
      expect(r.valid).toBe(true);
    });
  });

  describe('step 1', () => {
    it('requires horario configuration', () => {
      const r = validateWizardStep({ paso: 1, horario: { horas_semanales: 2, configuracion: [] } }, 1);
      expect(r.errors.some((e) => e.fieldId === 'configuracion')).toBe(true);
    });

    it('passes valid horario', () => {
      const r = validateWizardStep({ paso: 1, horario: baseHorario }, 1);
      expect(r.valid).toBe(true);
    });
  });

  describe('step 2', () => {
    it('requires A, B or C for generation', () => {
      const r = validateWizardStep(
        {
          paso: 2,
          enfoque: {
            unidades_didacticas: [],
            requerimientos_docente: 'corto',
            distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
          },
        },
        2
      );
      expect(r.errors.some((e) => e.fieldId === 'generation_requirements')).toBe(true);
    });

    it('accepts plan materials only', () => {
      const r = validateWizardStep(
        {
          paso: 2,
          enfoque: {
            unidades_didacticas: [],
            requerimientos_docente: '',
            attachedPlanMaterialIds: ['mat-1'],
            distribucion_modalidades: { individual: 25, pareja: 25, grupos: 25, toda_clase: 25 },
          },
        },
        2
      );
      expect(r.valid).toBe(true);
    });

    it('rejects modalidades not summing to 100', () => {
      const w = validPeriodoWizard();
      w.enfoque!.distribucion_modalidades = { individual: 50, pareja: 25, grupos: 25, toda_clase: 25 };
      const r = validateWizardStep(w, 2);
      expect(r.errors.some((e) => e.fieldId === 'distribucion_modalidades')).toBe(true);
    });
  });

  describe('step 3 (final)', () => {
    it('validates full periodo_especifico flow', () => {
      expect(validateWizardStep(validPeriodoWizard(), 3).valid).toBe(true);
    });

    it('validates full sin_periodo without horario step', () => {
      const w = validSinPeriodoWizard();
      expect(validateWizardStep(w, 3).valid).toBe(true);
      expect(validateWizardStep({ ...w, horario: undefined }, 3).valid).toBe(true);
    });

    it('fails sin_periodo when step 0 invalid', () => {
      const w = validSinPeriodoWizard();
      w.contexto!.cantidad_sesiones = 0;
      expect(validateWizardStep(w, 3).valid).toBe(false);
    });

    it('fails periodo when horario missing at step 3', () => {
      const w = validPeriodoWizard({ horario: undefined });
      expect(validateWizardStep(w, 3).valid).toBe(false);
    });
  });
});
