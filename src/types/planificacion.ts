export interface ConfiguracionHorario {
  dia: 'lunes' | 'martes' | 'miércoles' | 'jueves' | 'viernes';
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  [key: string]: any; // Para compatibilidad con Json
}

export interface DistribucionModalidades {
  individual: number;
  pareja: number;
  grupos: number;
  toda_clase: number;
}

export interface Planificacion {
  id: string;
  user_id: string;
  grupo_id: string;
  materia: string;
  nivel?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  competencias_seleccionadas: string[];
  contenidos_programa?: string;
  mapeo_competencias_contenidos: Record<string, string[]>;
  requerimientos_docente?: string;
  distribucion_modalidades: DistribucionModalidades;
  estrategias_diferenciacion?: string;
  horas_semanales: number;
  configuracion_horario: ConfiguracionHorario[];
  carpeta?: string;
  objetivos_unidad?: string;
  cantidad_sesiones?: number;
  cadencia_deseada?: string;
  bloques_preferidos?: any;
  ventana_sugerida?: string;
  // Explicit save and soft delete fields
  nombre?: string | null; // Custom display name (overrides materia - grupo_id)
  is_saved?: boolean; // If explicitly saved by teacher (shows in "Mis Planificaciones")
  saved_at?: string | null; // When saved (ISO timestamp)
  deleted_at?: string | null; // Soft delete (ISO timestamp)
  // FIX: AI design report (evidence of AI generation decisions)
  ai_design_report?: any | null; // JSONB field with AI generation rationale
  created_at: string;
  updated_at: string;
}

export interface PlanDesarrollo {
  inicio?: { descripcion: string; duracion: number };
  desarrollo?: { descripcion: string; duracion: number };
  cierre?: { descripcion: string; duracion: number };
  [key: string]: any; // Para compatibilidad con Json
}

export interface Evaluacion {
  tipo: 'rubrica' | 'lista_cotejo' | 'observacion' | 'prueba_breve' | 'texto';
  configuracion?: any;
  contenido?: string; // Para evaluaciones de tipo texto
  instrumento_generado?: boolean;
  [key: string]: any; // Para compatibilidad con Json
}

export interface SesionClase {
  id: string;
  planificacion_id: string;
  fecha: string | null;
  duracion_minutos: number;
  competencias_anep: string[];
  contenidos_anep: string[];
  criterios_logro_anep: string[];
  plan_desarrollo: PlanDesarrollo;
  diferenciacion?: string;
  evaluacion: Evaluacion;
  recursos: string[];
  observaciones?: string;
  estado: 'backlog' | 'planificada' | 'dictada' | 'omitida' | 'pausada';
  es_feriado: boolean;
  motivo_excepcion?: string;
  orden: number;
  semana_objetivo?: number;
  bloque_preferido?: any;
  bloqueo_reserva: boolean;
  motivo_cambio?: string;
  argumento_competencias?: string;
  titulo?: string;
  evaluacion_docente?: string;
  // PHASE 3.2: Optional teacher-provided topic/focus for this session
  session_brief?: string | null;
  // AI design report (evidence of AI generation decisions for this session)
  ai_design_report?: any | null; // JSONB field with AI generation rationale (PlanningAIDesignReportData)
  created_at: string;
  updated_at: string;
}

export interface UnidadDidactica {
  id: string;
  contenido_id: string;
  contenido_texto: string;
  competencias_ids: string[];
  clases_estimadas: number;
  orden: number;
  // PHASE A: Unit material plan (optional)
  unit_material_plan?: Array<{
    materialId: string;
    materialTitle: string;
    classCount: number;
    perClassGuidance: string[];
  }>;
}

// Metadata de asignación de unidad a sesión (Phase 1 - en memoria)
export interface UnitAssignmentMetadata {
  unidadIndex: number;        // Índice en array original de unidades
  unidadId: string;           // ID de la unidad
  contenido_texto: string;
  competencias_ids: string[];
  claseEnUnidad: number;      // 1..N (número de clase dentro de esta unidad)
  totalClasesUnidad: number;  // N (total de clases estimadas para esta unidad)
  isExtraSlot?: boolean;      // true si es sesión adicional (slots > expanded)
}

export interface WizardData {
  paso: 0 | 1 | 2 | 3;
  tipo_planificacion?: 'periodo_especifico' | 'sin_periodo';
  contexto?: {
    grupo_id: string;
    materia: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    cantidad_sesiones?: number;
    duracion_por_sesion?: number;
    cadencia_deseada?: string;
    bloques_preferidos?: any;
    ventana_sugerida?: string;
    objetivos_unidad?: string;
  };
  horario?: {
    horas_semanales: number;
    configuracion: ConfiguracionHorario[];
  };
  enfoque?: {
    unidades_didacticas: UnidadDidactica[];
    requerimientos_docente: string;
    distribucion_modalidades: DistribucionModalidades;
    estrategias_diferenciacion: string;
    objetivos_unidad?: string;
    // PHASE 3.1: Optional per-session focus/title overrides
    sessionBriefs?: (string | undefined)[];
    // PHASE 4: Plan-level material attachments (for A/B/C validation)
    attachedPlanMaterialIds?: string[];
  };
  planificacionId?: string;
}

export interface AlertaGrupo {
  tipo: 'apoyo_lector' | 'alta_motivacion' | 'atencion_baja' | 'barrera_nee';
  porcentaje: number;
  descripcion: string;
  sugerencias: string[];
}

export interface KPIGrupo {
  competencia: string;
  nivel: 'basico' | 'intermedio' | 'avanzado';
  tendencia: 'mejorando' | 'estable' | 'necesita_atencion';
  porcentaje: number;
}

export interface CalendarioEvento {
  id: string;
  fecha: string;
  titulo: string;
  alcance: 'institucional' | 'grupo' | 'personal';
  created_at: string;
}
