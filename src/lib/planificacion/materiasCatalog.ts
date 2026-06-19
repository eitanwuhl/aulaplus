/** Shared materia labels for wizard and annual program flows. */
export const PLANNING_MATERIAS = [
  'Historia',
  'Literatura',
  'Educación para la Ciudadanía',
  'Matemática',
  'Lengua Española',
] as const;

export type PlanningMateria = (typeof PLANNING_MATERIAS)[number];
