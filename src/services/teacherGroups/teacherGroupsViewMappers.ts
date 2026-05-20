import type { SchoolStudent, TeacherGroup } from '@/types/schoolCatalog';

/** Shape expected by `StudentProfile` (supports accordion or string synthesis at runtime). */
export type StudentProfileViewModel = {
  id: number;
  name: string;
  perfil: string;
  avatar: string;
  contemplaciones: string[];
  anotaciones: string;
  seguimiento: string[];
  historialAcademico: NonNullable<SchoolStudent['historialAcademico']>;
  evaluacionesCualitativas: NonNullable<SchoolStudent['evaluacionesCualitativas']>;
  resultadosEvaluaciones: NonNullable<SchoolStudent['resultadosEvaluaciones']>;
  evolucionDetallada: NonNullable<SchoolStudent['evolucionDetallada']>;
  /** Present when seeded; UI shows empty state if `metricas` is missing. */
  dashboardEvolucion: SchoolStudent['dashboardEvolucion'];
  informeTecnico?: SchoolStudent['informeTecnico'];
};

export type GroupProfileViewModel = {
  id: string;
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: {
    id: number;
    name: string;
    perfil: string;
    ajustes: string;
    progreso: number;
    avatar: string;
  }[];
};

export function toStudentProfileViewModel(student: SchoolStudent): StudentProfileViewModel {
  return {
    id: student.id,
    name: student.name,
    perfil: student.perfil,
    avatar: student.avatar,
    contemplaciones: student.contemplaciones,
    anotaciones: student.anotaciones ?? '',
    seguimiento: student.seguimiento ?? [],
    historialAcademico: student.historialAcademico ?? [],
    evaluacionesCualitativas: student.evaluacionesCualitativas ?? [],
    resultadosEvaluaciones: student.resultadosEvaluaciones ?? [],
    evolucionDetallada: student.evolucionDetallada ?? [],
    dashboardEvolucion: student.dashboardEvolucion,
    informeTecnico: student.informeTecnico,
  };
}

export function toGroupProfileViewModel(group: TeacherGroup): GroupProfileViewModel {
  return {
    id: group.id,
    name: group.name,
    studentCount: group.studentCount,
    year: group.year,
    section: group.section,
    students: group.students.map((student) => ({
      id: student.id,
      name: student.name,
      perfil: student.perfil,
      ajustes: student.ajustes ?? '',
      progreso: student.progreso ?? 0,
      avatar: student.avatar,
    })),
  };
}
