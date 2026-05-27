/** Module 1 — institutional configuration (aligned with product doc v2.0) */

export type CurriculumFramework =
  | 'anep_ebi'
  | 'anep_bach'
  | 'cambridge_primary'
  | 'cambridge_lower'
  | 'cambridge_igcse'
  | 'cambridge_al'
  | 'ib_pyp'
  | 'ib_myp'
  | 'ib_dp'
  | 'ib_cp';

export type CatalogStatus = 'borrador' | 'activa' | 'deprecada';

export type InstitutionStaffRole = 'direccion' | 'psicopedagogico' | 'admin';

export type AnepLevelHabilitacion = 'habilitado' | 'autorizado' | 'no_aplica';

export type InstitutionSettings = {
  niveles_ofrecidos?: string[];
  idiomas_instruccion?: string[];
  idioma_principal?: string;
  ciclo_lectivo_inicio?: string;
  ciclo_lectivo_fin?: string;
  periodos_evaluacion?: ('semestres' | 'trimestres' | 'terms')[];
  logo_url?: string;
  habilitacion_anep_por_nivel?: Record<string, AnepLevelHabilitacion>;
};

export type SchoolCurriculumFrameworkRow = {
  id: string;
  school_id: string;
  framework: CurriculumFramework;
  activo: boolean;
  fecha_activacion: string;
  configuracion: Record<string, unknown>;
  catalog_id: string | null;
  idioma_generacion: string;
};

export type InstitutionSnapshot = {
  schoolId: string;
  schoolName: string;
  settings: InstitutionSettings;
  onboardingCompleted: boolean;
  activeFrameworks: SchoolCurriculumFrameworkRow[];
};

export type GroupFrameworkAssignment = {
  groupId: string;
  groupName: string;
  year: string;
  section: string;
  primary_framework: CurriculumFramework | null;
  secondary_framework: CurriculumFramework | null;
};

export type CatalogItemType =
  | 'competencia_general'
  | 'espacio_curricular'
  | 'materia'
  | 'tramo'
  | 'contenido'
  | 'progresion'
  | 'learning_objective'
  | 'strand'
  | 'criterio'
  | 'descriptor'
  | 'key_concept'
  | 'global_context'
  | 'other';

export type InstitutionContextForAI = {
  schoolName: string;
  primaryLanguage: string;
  activeFrameworkLabels: string[];
  groupPrimaryFramework?: string;
  groupSecondaryFramework?: string;
  evaluationPeriods?: string[];
};
