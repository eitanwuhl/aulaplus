/**
 * Per-tenant student seeds for profile_data (ids must match school_students rows).
 * Rich payloads are cloned from mockStudents templates in the seed script.
 */
import type { Student } from '@/data/mockData';

/** Liceo Norte — ids 201–204, groups 8vo 1 / 8vo 2 */
export const LICEO_NORTE_STUDENT_SEEDS: Pick<
  Student,
  'id' | 'name' | 'perfil' | 'promedio' | 'progreso' | 'tendencia'
>[] = [
  {
    id: 201,
    name: 'Renata Pérez',
    perfil: 'Visual-Kinestésico',
    promedio: 7.4,
    progreso: 72,
    tendencia: 'up',
  },
  {
    id: 202,
    name: 'Tomás Acosta',
    perfil: 'Auditivo-Lector/escritor',
    promedio: 6.9,
    progreso: 68,
    tendencia: 'stable',
  },
  {
    id: 203,
    name: 'Emilia Ruiz',
    perfil: 'Kinestésico-Visual',
    promedio: 8.1,
    progreso: 81,
    tendencia: 'up',
  },
  {
    id: 204,
    name: 'Benjamín Costa',
    perfil: 'Lector/escritor-Auditivo',
    promedio: 7.0,
    progreso: 65,
    tendencia: 'down',
  },
];

/** Liceo St. Patrick's — ids 301–306 */
export const LICEO_ST_PATRICKS_STUDENT_SEEDS: Pick<
  Student,
  'id' | 'name' | 'perfil' | 'promedio' | 'progreso' | 'tendencia'
>[] = [
  {
    id: 301,
    name: 'Olivia Murphy',
    perfil: 'Visual-Lector/escritor',
    promedio: 8.3,
    progreso: 84,
    tendencia: 'up',
  },
  {
    id: 302,
    name: "James O'Connor",
    perfil: 'Auditivo-Kinestésico',
    promedio: 7.1,
    progreso: 70,
    tendencia: 'stable',
  },
  {
    id: 303,
    name: 'Sophie Walsh',
    perfil: 'Kinestésico-Visual',
    promedio: 7.8,
    progreso: 76,
    tendencia: 'up',
  },
  {
    id: 304,
    name: 'Liam Byrne',
    perfil: 'Lector/escritor-Auditivo',
    promedio: 6.8,
    progreso: 62,
    tendencia: 'down',
  },
  {
    id: 305,
    name: 'Emma Fitzgerald',
    perfil: 'Visual-Auditivo',
    promedio: 8.5,
    progreso: 88,
    tendencia: 'up',
  },
  {
    id: 306,
    name: 'Noah Gallagher',
    perfil: 'Auditivo-Lector/escritor',
    promedio: 7.5,
    progreso: 74,
    tendencia: 'stable',
  },
];
