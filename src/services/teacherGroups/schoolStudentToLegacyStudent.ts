import type { Student, Group } from '@/data/mockData';
import type { SchoolStudent, TeacherGroup } from '@/types/schoolCatalog';

/** Maps catalog student to legacy `Student` shape (groupContext, eval pipeline). */
export function schoolStudentToLegacyStudent(student: SchoolStudent): Student {
  return {
    id: student.id,
    name: student.name,
    perfil: student.perfil,
    avatar: student.avatar,
    contemplaciones: student.contemplaciones,
    anotaciones: student.anotaciones,
    seguimiento: student.seguimiento,
    historialAcademico: student.historialAcademico,
    evaluacionesCualitativas: student.evaluacionesCualitativas,
    resultadosEvaluaciones: student.resultadosEvaluaciones,
    evolucionDetallada: student.evolucionDetallada,
    dashboardEvolucion: student.dashboardEvolucion,
    informeTecnico: student.informeTecnico,
    ajustes: student.ajustes,
    progreso: student.progreso,
    promedio: student.promedio,
    tendencia: student.tendencia,
    alertas: student.alertas,
  };
}

export function teacherGroupToLegacyGroup(group: TeacherGroup): Group {
  return {
    id: group.id,
    name: group.name,
    year: group.year,
    section: group.section,
    studentCount: group.studentCount,
    students: group.students.map(schoolStudentToLegacyStudent),
    teacher_sugerencias: group.teacher_sugerencias,
  };
}
