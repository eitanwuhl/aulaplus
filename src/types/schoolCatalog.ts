/**
 * School catalog domain types (Postgres-backed).
 * Shared shapes only — no mock arrays. Use services/teacherGroups to load data.
 */

import type {
  DashboardEvolucionData,
  EvaluacionCualitativa,
  EvolucionPeriodo,
  HistorialAcademico,
  InformeTecnico,
  ResultadoEvaluacion,
  TeacherSugerencias,
} from '@/data/mockData';

export type { DashboardEvolucionData, EvolucionPeriodo, ResultadoEvaluacion };

export type SchoolStudent = {
  id: number;
  name: string;
  perfil: string;
  avatar: string;
  contemplaciones: string[];
  anotaciones?: string;
  seguimiento?: string[];
  historialAcademico?: HistorialAcademico[];
  evaluacionesCualitativas?: EvaluacionCualitativa[];
  resultadosEvaluaciones?: ResultadoEvaluacion[];
  evolucionDetallada?: EvolucionPeriodo[];
  dashboardEvolucion?: DashboardEvolucionData;
  informeTecnico?: InformeTecnico;
  ajustes?: string;
  progreso?: number;
  promedio?: number;
  tendencia?: 'up' | 'down' | 'stable';
  alertas?: string[];
  /** `true` when `school_students.profile_data` was seeded (not only catalog columns). */
  hasSeededProfile: boolean;
};

export type TeacherGroup = {
  id: string;
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: SchoolStudent[];
  teacher_sugerencias?: TeacherSugerencias;
};
