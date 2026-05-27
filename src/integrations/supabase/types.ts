export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calendario_eventos: {
        Row: {
          alcance: string
          created_at: string | null
          fecha: string
          id: string
          titulo: string
        }
        Insert: {
          alcance?: string
          created_at?: string | null
          fecha: string
          id?: string
          titulo: string
        }
        Update: {
          alcance?: string
          created_at?: string | null
          fecha?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      comunicaciones: {
        Row: {
          attachment_urls: Json
          created_at: string
          id: string
          message: string
          related_planificacion_id: string | null
          status: string
          subject: string
          to_role: string
          user_id: string
        }
        Insert: {
          attachment_urls?: Json
          created_at?: string
          id?: string
          message: string
          related_planificacion_id?: string | null
          status?: string
          subject: string
          to_role: string
          user_id: string
        }
        Update: {
          attachment_urls?: Json
          created_at?: string
          id?: string
          message?: string
          related_planificacion_id?: string | null
          status?: string
          subject?: string
          to_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicaciones_related_planificacion_id_fkey"
            columns: ["related_planificacion_id"]
            isOneToOne: false
            referencedRelation: "planificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_catalog_items: {
        Row: {
          catalog_id: string
          codigo: string | null
          created_at: string
          descripcion: string | null
          id: string
          materia: string | null
          metadata: Json
          nivel: string | null
          nombre: string
          orden: number
          parent_id: string | null
          tipo: Database["public"]["Enums"]["catalog_item_type"]
        }
        Insert: {
          catalog_id: string
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          materia?: string | null
          metadata?: Json
          nivel?: string | null
          nombre: string
          orden?: number
          parent_id?: string | null
          tipo: Database["public"]["Enums"]["catalog_item_type"]
        }
        Update: {
          catalog_id?: string
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          materia?: string | null
          metadata?: Json
          nivel?: string | null
          nombre?: string
          orden?: number
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["catalog_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_catalog_items_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "curriculum_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_catalog_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "curriculum_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_catalogs: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["catalog_status"]
          framework: Database["public"]["Enums"]["curriculum_framework"]
          id: string
          metadata: Json
          nombre: string
          school_id: string | null
          version: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["catalog_status"]
          framework: Database["public"]["Enums"]["curriculum_framework"]
          id?: string
          metadata?: Json
          nombre: string
          school_id?: string | null
          version?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["catalog_status"]
          framework?: Database["public"]["Enums"]["curriculum_framework"]
          id?: string
          metadata?: Json
          nombre?: string
          school_id?: string | null
          version?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_catalogs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "dashboard_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_notifications: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          message: string
          notification_type: string
          recipient_user_id: string | null
          school_id: string | null
          student_id: number | null
          title: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          message: string
          notification_type: string
          recipient_user_id?: string | null
          school_id?: string | null
          student_id?: number | null
          title: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          message?: string
          notification_type?: string
          recipient_user_id?: string | null
          school_id?: string | null
          student_id?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_notifications_group_fkey"
            columns: ["school_id", "group_id"]
            isOneToOne: false
            referencedRelation: "school_groups"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "dashboard_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "school_students"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_teacher_credentials: {
        Row: {
          auth_email: string
          login_code: string
        }
        Insert: {
          auth_email: string
          login_code: string
        }
        Update: {
          auth_email?: string
          login_code?: string
        }
        Relationships: []
      }
      evaluaciones: {
        Row: {
          ai_design_report: Json | null
          competencias_anep: string[] | null
          configuracion: Json | null
          contenidos: string[] | null
          created_at: string | null
          criterios_logro: string[] | null
          deleted_at: string | null
          direct_material_ids: string[] | null
          evaluacion_generada: Json | null
          evaluation_focus: string | null
          fecha: string | null
          grupo_id: string
          id: string
          include_session_materials: boolean | null
          is_saved: boolean | null
          materia: string
          nivel: string | null
          nombre: string | null
          requerimientos: string | null
          rubrica: Json | null
          saved_at: string | null
          source_planificacion_id: string | null
          source_session_ids: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_design_report?: Json | null
          competencias_anep?: string[] | null
          configuracion?: Json | null
          contenidos?: string[] | null
          created_at?: string | null
          criterios_logro?: string[] | null
          deleted_at?: string | null
          direct_material_ids?: string[] | null
          evaluacion_generada?: Json | null
          evaluation_focus?: string | null
          fecha?: string | null
          grupo_id: string
          id?: string
          include_session_materials?: boolean | null
          is_saved?: boolean | null
          materia: string
          nivel?: string | null
          nombre?: string | null
          requerimientos?: string | null
          rubrica?: Json | null
          saved_at?: string | null
          source_planificacion_id?: string | null
          source_session_ids?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_design_report?: Json | null
          competencias_anep?: string[] | null
          configuracion?: Json | null
          contenidos?: string[] | null
          created_at?: string | null
          criterios_logro?: string[] | null
          deleted_at?: string | null
          direct_material_ids?: string[] | null
          evaluacion_generada?: Json | null
          evaluation_focus?: string | null
          fecha?: string | null
          grupo_id?: string
          id?: string
          include_session_materials?: boolean | null
          is_saved?: boolean | null
          materia?: string
          nivel?: string | null
          nombre?: string | null
          requerimientos?: string | null
          rubrica?: Json | null
          saved_at?: string | null
          source_planificacion_id?: string | null
          source_session_ids?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluaciones_source_planificacion_id_fkey"
            columns: ["source_planificacion_id"]
            isOneToOne: false
            referencedRelation: "planificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          created_at: string
          id: string
          name: string
          section: string | null
          teacher_sugerencias: Json | null
          updated_at: string
          user_id: string
          year: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          section?: string | null
          teacher_sugerencias?: Json | null
          updated_at?: string
          user_id: string
          year?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          section?: string | null
          teacher_sugerencias?: Json | null
          updated_at?: string
          user_id?: string
          year?: string | null
        }
        Relationships: []
      }
      material_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          focus_text: string | null
          id: string
          material_id: string
          priority: number | null
          target_id: string
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          focus_text?: string | null
          id?: string
          material_id: string
          priority?: number | null
          target_id: string
          target_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          focus_text?: string | null
          id?: string
          material_id?: string
          priority?: number | null
          target_id?: string
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_attachments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "teacher_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      planificaciones: {
        Row: {
          ai_design_report: Json | null
          bloques_preferidos: Json | null
          cadencia_deseada: string | null
          cantidad_sesiones: number | null
          carpeta: string | null
          compartido_direccion: boolean | null
          compartido_equipo: boolean | null
          competencias_seleccionadas: string[]
          configuracion_horario: Json
          contenidos_programa: string[]
          created_at: string
          deleted_at: string | null
          distribucion_modalidades: Json | null
          estrategias_diferenciacion: string | null
          fecha_fin: string
          fecha_inicio: string
          grupo_id: string
          horas_semanales: number
          id: string
          is_saved: boolean
          mapeo_competencias_contenidos: Json
          materia: string
          metas_aprendizaje: string | null
          modalidad_preferida: string | null
          nivel: string
          nivel_diferenciacion: string | null
          nombre: string | null
          requerimientos_docente: string | null
          saved_at: string | null
          unidades_didacticas: Json | null
          unit_material_plan: Json
          updated_at: string
          user_id: string
          ventana_sugerida: string | null
        }
        Insert: {
          ai_design_report?: Json | null
          bloques_preferidos?: Json | null
          cadencia_deseada?: string | null
          cantidad_sesiones?: number | null
          carpeta?: string | null
          compartido_direccion?: boolean | null
          compartido_equipo?: boolean | null
          competencias_seleccionadas?: string[]
          configuracion_horario?: Json
          contenidos_programa?: string[]
          created_at?: string
          deleted_at?: string | null
          distribucion_modalidades?: Json | null
          estrategias_diferenciacion?: string | null
          fecha_fin: string
          fecha_inicio: string
          grupo_id: string
          horas_semanales?: number
          id?: string
          is_saved?: boolean
          mapeo_competencias_contenidos?: Json
          materia: string
          metas_aprendizaje?: string | null
          modalidad_preferida?: string | null
          nivel: string
          nivel_diferenciacion?: string | null
          nombre?: string | null
          requerimientos_docente?: string | null
          saved_at?: string | null
          unidades_didacticas?: Json | null
          unit_material_plan?: Json
          updated_at?: string
          user_id: string
          ventana_sugerida?: string | null
        }
        Update: {
          ai_design_report?: Json | null
          bloques_preferidos?: Json | null
          cadencia_deseada?: string | null
          cantidad_sesiones?: number | null
          carpeta?: string | null
          compartido_direccion?: boolean | null
          compartido_equipo?: boolean | null
          competencias_seleccionadas?: string[]
          configuracion_horario?: Json
          contenidos_programa?: string[]
          created_at?: string
          deleted_at?: string | null
          distribucion_modalidades?: Json | null
          estrategias_diferenciacion?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          grupo_id?: string
          horas_semanales?: number
          id?: string
          is_saved?: boolean
          mapeo_competencias_contenidos?: Json
          materia?: string
          metas_aprendizaje?: string | null
          modalidad_preferida?: string | null
          nivel?: string
          nivel_diferenciacion?: string | null
          nombre?: string | null
          requerimientos_docente?: string | null
          saved_at?: string | null
          unidades_didacticas?: Json | null
          unit_material_plan?: Json
          updated_at?: string
          user_id?: string
          ventana_sugerida?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: string | null
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_curriculum_frameworks: {
        Row: {
          activo: boolean
          catalog_id: string | null
          configuracion: Json
          created_at: string
          fecha_activacion: string
          framework: Database["public"]["Enums"]["curriculum_framework"]
          id: string
          idioma_generacion: string
          school_id: string
        }
        Insert: {
          activo?: boolean
          catalog_id?: string | null
          configuracion?: Json
          created_at?: string
          fecha_activacion?: string
          framework: Database["public"]["Enums"]["curriculum_framework"]
          id?: string
          idioma_generacion?: string
          school_id: string
        }
        Update: {
          activo?: boolean
          catalog_id?: string | null
          configuracion?: Json
          created_at?: string
          fecha_activacion?: string
          framework?: Database["public"]["Enums"]["curriculum_framework"]
          id?: string
          idioma_generacion?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_curriculum_frameworks_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "curriculum_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_curriculum_frameworks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_groups: {
        Row: {
          created_at: string
          group_settings: Json
          id: string
          name: string
          primary_framework:
            | Database["public"]["Enums"]["curriculum_framework"]
            | null
          school_id: string
          secondary_framework:
            | Database["public"]["Enums"]["curriculum_framework"]
            | null
          section: string | null
          year: string | null
        }
        Insert: {
          created_at?: string
          group_settings?: Json
          id: string
          name: string
          primary_framework?:
            | Database["public"]["Enums"]["curriculum_framework"]
            | null
          school_id: string
          secondary_framework?:
            | Database["public"]["Enums"]["curriculum_framework"]
            | null
          section?: string | null
          year?: string | null
        }
        Update: {
          created_at?: string
          group_settings?: Json
          id?: string
          name?: string
          primary_framework?:
            | Database["public"]["Enums"]["curriculum_framework"]
            | null
          school_id?: string
          secondary_framework?:
            | Database["public"]["Enums"]["curriculum_framework"]
            | null
          section?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_students: {
        Row: {
          created_at: string
          display_name: string
          id: number
          perfil: string | null
          profile_data: Json
          school_group_id: string
          school_id: string
          student_frameworks: Json
        }
        Insert: {
          created_at?: string
          display_name: string
          id: number
          perfil?: string | null
          profile_data?: Json
          school_group_id: string
          school_id: string
          student_frameworks?: Json
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: number
          perfil?: string | null
          profile_data?: Json
          school_group_id?: string
          school_id?: string
          student_frameworks?: Json
        }
        Relationships: [
          {
            foreignKeyName: "school_students_school_group_fkey"
            columns: ["school_id", "school_group_id"]
            isOneToOne: false
            referencedRelation: "school_groups"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "school_students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          institution_settings: Json
          name: string
          onboarding_completed_at: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          institution_settings?: Json
          name: string
          onboarding_completed_at?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_settings?: Json
          name?: string
          onboarding_completed_at?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      sesiones_clase: {
        Row: {
          ai_design_report: Json | null
          argumento_competencias: string | null
          bloque_preferido: Json | null
          bloqueo_reserva: boolean
          competencias_anep: string[] | null
          contenidos_anep: string[] | null
          created_at: string
          criterios_logro_anep: string[] | null
          diferenciacion: string | null
          duracion_minutos: number
          es_feriado: boolean | null
          estado: Database["public"]["Enums"]["sesion_estado"]
          evaluacion: Json | null
          fecha: string | null
          id: string
          motivo_cambio: string | null
          motivo_excepcion: string | null
          observaciones: string | null
          orden: number | null
          plan_desarrollo: Json | null
          planificacion_id: string
          recursos: string[] | null
          semana_objetivo: number | null
          session_brief: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          ai_design_report?: Json | null
          argumento_competencias?: string | null
          bloque_preferido?: Json | null
          bloqueo_reserva?: boolean
          competencias_anep?: string[] | null
          contenidos_anep?: string[] | null
          created_at?: string
          criterios_logro_anep?: string[] | null
          diferenciacion?: string | null
          duracion_minutos?: number
          es_feriado?: boolean | null
          estado?: Database["public"]["Enums"]["sesion_estado"]
          evaluacion?: Json | null
          fecha?: string | null
          id?: string
          motivo_cambio?: string | null
          motivo_excepcion?: string | null
          observaciones?: string | null
          orden?: number | null
          plan_desarrollo?: Json | null
          planificacion_id: string
          recursos?: string[] | null
          semana_objetivo?: number | null
          session_brief?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          ai_design_report?: Json | null
          argumento_competencias?: string | null
          bloque_preferido?: Json | null
          bloqueo_reserva?: boolean
          competencias_anep?: string[] | null
          contenidos_anep?: string[] | null
          created_at?: string
          criterios_logro_anep?: string[] | null
          diferenciacion?: string | null
          duracion_minutos?: number
          es_feriado?: boolean | null
          estado?: Database["public"]["Enums"]["sesion_estado"]
          evaluacion?: Json | null
          fecha?: string | null
          id?: string
          motivo_cambio?: string | null
          motivo_excepcion?: string | null
          observaciones?: string | null
          orden?: number | null
          plan_desarrollo?: Json | null
          planificacion_id?: string
          recursos?: string[] | null
          semana_objetivo?: number | null
          session_brief?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_clase_planificacion_id_fkey"
            columns: ["planificacion_id"]
            isOneToOne: false
            referencedRelation: "planificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      student_accounts: {
        Row: {
          catalog_student_id: number | null
          created_at: string
          display_name: string | null
          id: string
          password_hash: string
          student_code: string
        }
        Insert: {
          catalog_student_id?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          password_hash: string
          student_code: string
        }
        Update: {
          catalog_student_id?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          password_hash?: string
          student_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_accounts_catalog_student_id_fkey"
            columns: ["catalog_student_id"]
            isOneToOne: false
            referencedRelation: "school_students"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_materials: {
        Row: {
          created_at: string
          deleted_at: string | null
          extracted_text: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          extracted_text?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          extracted_text?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_teacher_material: { Args: { material_id: string }; Returns: Json }
      current_user_school_id: { Args: never; Returns: string }
      debug_teacher_material_ownership: {
        Args: { material_id: string }
        Returns: {
          current_user_id: string
          deleted_at: string
          error_message: string
          material_id_out: string
          material_user_id: string
          ownership_matches: boolean
        }[]
      }
      get_teacher_login_email: { Args: { p_code: string }; Returns: string }
      profile_role_is_institution_admin: { Args: never; Returns: boolean }
      profile_role_is_institution_staff: { Args: never; Returns: boolean }
      profile_role_is_notification_publisher: { Args: never; Returns: boolean }
      profile_role_is_notification_staff: { Args: never; Returns: boolean }
      profile_role_is_teacher: { Args: never; Returns: boolean }
      verify_student_login: {
        Args: { p_password: string; p_student_code: string }
        Returns: Json
      }
    }
    Enums: {
      catalog_item_type:
        | "competencia_general"
        | "espacio_curricular"
        | "materia"
        | "tramo"
        | "contenido"
        | "progresion"
        | "learning_objective"
        | "strand"
        | "criterio"
        | "descriptor"
        | "key_concept"
        | "global_context"
        | "other"
      catalog_status: "borrador" | "activa" | "deprecada"
      curriculum_framework:
        | "anep_ebi"
        | "anep_bach"
        | "cambridge_primary"
        | "cambridge_lower"
        | "cambridge_igcse"
        | "cambridge_al"
        | "ib_pyp"
        | "ib_myp"
        | "ib_dp"
        | "ib_cp"
      sesion_estado:
        | "backlog"
        | "planificada"
        | "dictada"
        | "omitida"
        | "pausada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      catalog_item_type: [
        "competencia_general",
        "espacio_curricular",
        "materia",
        "tramo",
        "contenido",
        "progresion",
        "learning_objective",
        "strand",
        "criterio",
        "descriptor",
        "key_concept",
        "global_context",
        "other",
      ],
      catalog_status: ["borrador", "activa", "deprecada"],
      curriculum_framework: [
        "anep_ebi",
        "anep_bach",
        "cambridge_primary",
        "cambridge_lower",
        "cambridge_igcse",
        "cambridge_al",
        "ib_pyp",
        "ib_myp",
        "ib_dp",
        "ib_cp",
      ],
      sesion_estado: [
        "backlog",
        "planificada",
        "dictada",
        "omitida",
        "pausada",
      ],
    },
  },
} as const
