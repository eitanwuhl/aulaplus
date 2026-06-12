import { describe, expect, it } from 'vitest';
import {
  canApproveProgram,
  canImportProgramToWizard,
  canMarkProgramEnUso,
  canSubmitProgramForReview,
  canTransitionProgramEstado,
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
    expect(otherPrograms.map((p) => p.id)).toEqual(['c']);
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
    expect(canApproveProgram('aprobado')).toBe(false);
    expect(canApproveProgram('en_uso')).toBe(false);
    expect(canSubmitProgramForReview('borrador', true, 2)).toBe(true);
    expect(canSubmitProgramForReview('borrador', true, 0)).toBe(false);
    expect(canSubmitProgramForReview('borrador', false, 2)).toBe(false);
    expect(canSubmitProgramForReview('en_revision', true, 2)).toBe(false);
    expect(canMarkProgramEnUso('aprobado')).toBe(true);
    expect(canMarkProgramEnUso('en_revision')).toBe(false);
  });

  it('validates estado transitions by actor', () => {
    expect(
      canTransitionProgramEstado('borrador', 'en_revision', { isOwner: true, isAdmin: false })
    ).toBe(true);
    expect(
      canTransitionProgramEstado('aprobado', 'en_uso', { isOwner: true, isAdmin: false })
    ).toBe(true);
    expect(
      canTransitionProgramEstado('en_revision', 'aprobado', { isOwner: false, isAdmin: true })
    ).toBe(true);
    expect(
      canTransitionProgramEstado('en_revision', 'en_uso', { isOwner: false, isAdmin: true })
    ).toBe(false);
    expect(
      canTransitionProgramEstado('borrador', 'aprobado', { isOwner: true, isAdmin: false })
    ).toBe(false);
  });

  it('partition handles empty list', () => {
    const { pendingReview, otherPrograms } = partitionProgramsForReviewer([]);
    expect(pendingReview).toEqual([]);
    expect(otherPrograms).toEqual([]);
  });

  it('canImport rejects en_uso with zero units', () => {
    expect(canImportProgramToWizard('en_uso', 0)).toBe(false);
  });

  it('sort is stable for same year', () => {
    const a = program({ id: 'a', estado: 'borrador', anio_lectivo: 2026 });
    const b = program({ id: 'b', estado: 'aprobado', anio_lectivo: 2026 });
    const sorted = sortProgramsByYearDesc([a, b]);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
