import type { CurriculumFramework } from '@/types/institution';

export type ProgramaEstado = 'borrador' | 'en_revision' | 'aprobado' | 'en_uso';

export type ProgramaUnidadEstado = 'planificada' | 'en_curso' | 'completada';

export interface GrupoPrograma {
  id: string;
  school_id: string;
  grupo_id: string;
  materia: string;
  user_id: string;
  anio_lectivo: number;
  marco_planificacion: CurriculumFramework;
  estado: ProgramaEstado;
  nombre: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  grupo_name?: string;
  unidades?: ProgramaUnidad[];
}

export interface ProgramaUnidad {
  id: string;
  programa_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_semanas: number | null;
  clases_estimadas: number;
  estado: ProgramaUnidadEstado;
  catalog_item_ids: string[];
  competencias_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CatalogItemForPlanning {
  id: string;
  tipo: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  nivel: string | null;
  materia: string | null;
}

export interface ProgramCoverageSummary {
  totalCatalogItems: number;
  assignedCatalogItems: number;
  percent: number;
  uncoveredItemIds: string[];
}
