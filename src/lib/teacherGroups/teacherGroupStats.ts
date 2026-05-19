import type { SchoolStudent, TeacherGroup } from '@/types/schoolCatalog';

export type GroupCardStats = {
  avgGrade: number | null;
  adjustmentsNeeded: number;
  sufficientGrades: number;
  insufficientGrades: number;
  studentsWithGrades: number;
};

function progressToGrade(progreso: number): number {
  return (progreso / 100) * 11 + 1;
}

export function studentRequiresAdjustments(student: SchoolStudent): boolean {
  if (!student.hasSeededProfile) return false;

  try {
    const accesoKey = `adecuacionAcceso:${student.id}`;
    const contenidoKey = `adecuacionContenido:${student.id}`;
    const accesoFromStorage = localStorage.getItem(accesoKey);
    const contenidoFromStorage = localStorage.getItem(contenidoKey);
    if (accesoFromStorage !== null && JSON.parse(accesoFromStorage) === true) return true;
    if (contenidoFromStorage !== null && JSON.parse(contenidoFromStorage) === true) return true;
  } catch {
    // localStorage parse errors are non-fatal
  }
  if (student.informeTecnico?.requiereAdecuacionAcceso === true) return true;
  if (student.informeTecnico?.requiereAdecuacionContenido === true) return true;
  return false;
}

export function getGroupCardStats(group: TeacherGroup): GroupCardStats {
  const students = group.students;
  const withGrades = students.filter((s) => typeof s.progreso === 'number');
  const avgGrade =
    withGrades.length > 0
      ? withGrades.reduce((sum, student) => sum + progressToGrade(student.progreso!), 0) /
        withGrades.length
      : null;

  return {
    avgGrade: avgGrade !== null ? Math.round(avgGrade * 10) / 10 : null,
    adjustmentsNeeded: students.filter(studentRequiresAdjustments).length,
    sufficientGrades: withGrades.filter((s) => progressToGrade(s.progreso!) >= 6).length,
    insufficientGrades: withGrades.filter((s) => progressToGrade(s.progreso!) < 6).length,
    studentsWithGrades: withGrades.length,
  };
}
