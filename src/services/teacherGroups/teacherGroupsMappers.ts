import type { Json } from '@/integrations/supabase/types';
import type { TeacherSugerencias } from '@/data/mockData';
import type { SchoolStudent, TeacherGroup } from '@/types/schoolCatalog';

export type GrupoRow = {
  id: string;
  name: string;
  year: string | null;
  section: string | null;
  teacher_sugerencias?: Json | null;
};

export type SchoolStudentRow = {
  id: number;
  display_name: string;
  perfil: string | null;
  school_group_id: string;
  profile_data?: Json | null;
};

function isProfileRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function rowHasSeededProfile(row: SchoolStudentRow): boolean {
  return isProfileRecord(row.profile_data) && Object.keys(row.profile_data).length > 0;
}

export function mapSchoolStudentRowToStudent(row: SchoolStudentRow): SchoolStudent {
  const hasSeededProfile = rowHasSeededProfile(row);
  const profile = hasSeededProfile ? (row.profile_data as Record<string, unknown>) : {};

  const readString = (key: string, fallback = ''): string =>
    typeof profile[key] === 'string' ? (profile[key] as string) : fallback;

  const readStringArray = (key: string): string[] =>
    Array.isArray(profile[key]) ? (profile[key] as string[]) : [];

  return {
    id: row.id,
    name: row.display_name,
    perfil: row.perfil ?? readString('perfil'),
    avatar: hasSeededProfile ? readString('avatar', '👤') : '👤',
    contemplaciones: hasSeededProfile ? readStringArray('contemplaciones') : [],
    anotaciones: hasSeededProfile ? readString('anotaciones') || undefined : undefined,
    seguimiento: hasSeededProfile ? (profile.seguimiento as string[] | undefined) : undefined,
    historialAcademico: hasSeededProfile
      ? (profile.historialAcademico as SchoolStudent['historialAcademico'])
      : undefined,
    evaluacionesCualitativas: hasSeededProfile
      ? (profile.evaluacionesCualitativas as SchoolStudent['evaluacionesCualitativas'])
      : undefined,
    informeTecnico: hasSeededProfile
      ? (profile.informeTecnico as SchoolStudent['informeTecnico'])
      : undefined,
    ajustes: hasSeededProfile ? readString('ajustes') || undefined : undefined,
    progreso: hasSeededProfile && typeof profile.progreso === 'number' ? profile.progreso : undefined,
    promedio: hasSeededProfile && typeof profile.promedio === 'number' ? profile.promedio : undefined,
    tendencia: hasSeededProfile ? (profile.tendencia as SchoolStudent['tendencia']) : undefined,
    alertas: hasSeededProfile ? (profile.alertas as string[] | undefined) : undefined,
    hasSeededProfile,
  };
}

export function mapGrupoRowsToGroups(
  grupos: GrupoRow[],
  studentsByGroupId: Map<string, SchoolStudentRow[]>
): TeacherGroup[] {
  return grupos.map((grupo) => {
    const studentRows = studentsByGroupId.get(grupo.id) ?? [];
    const students = studentRows.map(mapSchoolStudentRowToStudent);
    const sugerencias =
      grupo.teacher_sugerencias &&
      typeof grupo.teacher_sugerencias === 'object' &&
      !Array.isArray(grupo.teacher_sugerencias)
        ? (grupo.teacher_sugerencias as TeacherSugerencias)
        : undefined;

    return {
      id: grupo.id,
      name: grupo.name,
      year: grupo.year ?? '',
      section: grupo.section ?? '',
      studentCount: students.length,
      students,
      teacher_sugerencias: sugerencias,
    };
  });
}
