import type { GrupoPrograma, ProgramaEstado } from '@/types/annualProgram';

export function partitionProgramsForReviewer(programs: GrupoPrograma[]): {
  pendingReview: GrupoPrograma[];
  otherPrograms: GrupoPrograma[];
} {
  const pendingReview = programs.filter((p) => p.estado === 'en_revision');
  // Borradores del docente no se muestran a dirección hasta envío a revisión
  const otherPrograms = programs.filter(
    (p) => p.estado !== 'en_revision' && p.estado !== 'borrador'
  );
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

export function canSubmitProgramForReview(
  estado: ProgramaEstado,
  isOwner: boolean,
  unitCount: number
): boolean {
  return isOwner && estado === 'borrador' && unitCount > 0;
}

export function canMarkProgramEnUso(estado: ProgramaEstado): boolean {
  return estado === 'aprobado';
}

/** Allowed estado transitions by actor (mirrors DB trigger grupo_programas_before_update_guard). */
export function canTransitionProgramEstado(
  from: ProgramaEstado,
  to: ProgramaEstado,
  actor: { isOwner: boolean; isAdmin: boolean }
): boolean {
  if (from === to) return false;

  if (actor.isOwner && !actor.isAdmin) {
    return (
      (from === 'borrador' && to === 'en_revision') ||
      (from === 'aprobado' && to === 'en_uso')
    );
  }

  if (actor.isAdmin) {
    return (
      (from === 'en_revision' && to === 'aprobado') ||
      (from === 'aprobado' && to === 'en_uso')
    );
  }

  return false;
}

export function sortProgramsByYearDesc(programs: GrupoPrograma[]): GrupoPrograma[] {
  return [...programs].sort((a, b) => b.anio_lectivo - a.anio_lectivo);
}
