import type { GrupoPrograma, ProgramaEstado } from '@/types/annualProgram';

export function partitionProgramsForReviewer(programs: GrupoPrograma[]): {
  pendingReview: GrupoPrograma[];
  otherPrograms: GrupoPrograma[];
} {
  const pendingReview = programs.filter((p) => p.estado === 'en_revision');
  const otherPrograms = programs.filter((p) => p.estado !== 'en_revision');
  return { pendingReview, otherPrograms };
}

export function canImportProgramToWizard(
  estado: ProgramaEstado,
  unitCount: number
): boolean {
  return (
    (estado === 'aprobado' || estado === 'en_uso') && unitCount > 0
  );
}

export function canApproveProgram(estado: ProgramaEstado): boolean {
  return estado === 'en_revision';
}

export function canSubmitProgramForReview(estado: ProgramaEstado, isOwner: boolean): boolean {
  return isOwner && estado === 'borrador';
}

export function sortProgramsByYearDesc(programs: GrupoPrograma[]): GrupoPrograma[] {
  return [...programs].sort((a, b) => b.anio_lectivo - a.anio_lectivo);
}
