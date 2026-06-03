import { describe, expect, it } from 'vitest';
import {
  canApproveProgram,
  canImportProgramToWizard,
  canSubmitProgramForReview,
  partitionProgramsForReviewer,
  sortProgramsByYearDesc,
} from '../annualProgramWorkflow';
import type { GrupoPrograma } from '@/types/annualProgram';

function program(partial: Partial<GrupoPrograma> & Pick<GrupoPrograma, 'id' | 'estado'>): GrupoPrograma {
  return {
    school_id: 'liceo-demo',
    grupo_id: '1',
    materia: 'Historia',
    user_id: 'u1',
    anio_lectivo: 2026,
    marco_planificacion: 'anep_ebi',
    nombre: null,
    metadata: {},
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('annualProgramWorkflow', () => {
  it('partitions pending review for direccion', () => {
    const programs = [
      program({ id: 'a', estado: 'en_revision' }),
      program({ id: 'b', estado: 'borrador' }),
      program({ id: 'c', estado: 'aprobado' }),
    ];
    const { pendingReview, otherPrograms } = partitionProgramsForReviewer(programs);
    expect(pendingReview.map((p) => p.id)).toEqual(['a']);
    expect(otherPrograms.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('sorts by anio lectivo descending', () => {
    const sorted = sortProgramsByYearDesc([
      program({ id: 'a', estado: 'borrador', anio_lectivo: 2025 }),
      program({ id: 'b', estado: 'borrador', anio_lectivo: 2026 }),
    ]);
    expect(sorted.map((p) => p.anio_lectivo)).toEqual([2026, 2025]);
  });

  it('gates wizard import by estado and units', () => {
    expect(canImportProgramToWizard('aprobado', 2)).toBe(true);
    expect(canImportProgramToWizard('en_uso', 1)).toBe(true);
    expect(canImportProgramToWizard('en_revision', 3)).toBe(false);
    expect(canImportProgramToWizard('aprobado', 0)).toBe(false);
    expect(canImportProgramToWizard('borrador', 5)).toBe(false);
  });

  it('gates approval and submit actions', () => {
    expect(canApproveProgram('en_revision')).toBe(true);
    expect(canApproveProgram('borrador')).toBe(false);
    expect(canSubmitProgramForReview('borrador', true)).toBe(true);
    expect(canSubmitProgramForReview('borrador', false)).toBe(false);
    expect(canSubmitProgramForReview('en_revision', true)).toBe(false);
  });
});
