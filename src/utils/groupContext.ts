/**
 * PHASE 4: Shared helper for loading group profile + student adjustments
 * 
 * DEPRECATED: This function is now a wrapper around the new unified provider.
 * Use `getGroupContextForAI()` from `@/services/groupContext/provider` instead.
 * 
 * This wrapper is kept for backward compatibility during migration.
 * 
 * IMPORTANT: Legacy UI only — do NOT use for AI generation.
 * All AI generation flows must use `getGroupContextForAI()` directly.
 * 
 * @deprecated Use `getGroupContextForAI()` from `@/services/groupContext/provider`
 */

import { getGroupContextForAI } from '@/services/groupContext/provider';
import type { GroupContextForAI } from '@/types/groupContextForAI';

// ============================================================================
// Types
// ============================================================================

export interface PerfilGrupo {
  tamanio: number;
  dominante: string;
  distribucion?: Record<string, number>;
}

export interface EstudianteAjuste {
  perfil?: string;
  ajustes?: string;
  contemplaciones?: string[];
}

export interface GroupContextData {
  perfilGrupo?: PerfilGrupo;
  estudiantes?: EstudianteAjuste[];
  teacherSugerencias?: TeacherSugerencias;
}

// ============================================================================
// Configuration
// ============================================================================

const MAX_STUDENTS_WITH_ADJUSTMENTS = 10; // Cap to avoid huge prompts

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate learning style distribution from students
 * Handles composite profiles like "Visual-Kinestésico"
 */
function calculateLearningStyleDistribution(students: any[]): Record<string, number> {
  const distribucion: Record<string, number> = {};
  
  students.forEach(student => {
    const perfil = (student.perfil || '').toLowerCase();
    
    // Extract primary learning styles
    if (perfil.includes("visual")) {
      distribucion["Visual"] = (distribucion["Visual"] || 0) + 1;
    }
    if (perfil.includes("kinestésico") || perfil.includes("kinesthetic")) {
      distribucion["Kinestésico"] = (distribucion["Kinestésico"] || 0) + 1;
    }
    if (perfil.includes("auditivo")) {
      distribucion["Auditivo"] = (distribucion["Auditivo"] || 0) + 1;
    }
    if (perfil.includes("lecto") || perfil.includes("escritor")) {
      distribucion["Lector/escritor"] = (distribucion["Lector/escritor"] || 0) + 1;
    }
  });
  
  return distribucion;
}

/**
 * Determine dominant learning style (most frequent)
 */
function calculateDominantStyle(distribucion: Record<string, number>): string {
  if (Object.keys(distribucion).length === 0) {
    return "mixto";
  }
  
  const dominant = Object.entries(distribucion).reduce((a, b) => 
    a[1] > b[1] ? a : b, ["mixto", 0] as [string, number]
  )[0];
  
  return dominant;
}

/**
 * Anonymize and filter students (only those with adjustments/contemplaciones)
 * Caps to MAX_STUDENTS_WITH_ADJUSTMENTS to avoid huge prompts
 */
function anonymizeAndFilterStudents(students: any[]): EstudianteAjuste[] | undefined {
  const filtered = students
    .filter(s => s.ajustes || (s.contemplaciones && s.contemplaciones.length > 0))
    .slice(0, MAX_STUDENTS_WITH_ADJUSTMENTS) // Cap
    .map(s => ({
      perfil: s.perfil,
      ajustes: s.ajustes,
      contemplaciones: s.contemplaciones
    }));
  
  // Only return if there's meaningful data
  return filtered.length > 0 ? filtered : undefined;
}

/**
 * Check if there's meaningful data to send (avoid empty structures)
 */
function hasMeaningfulData(data: GroupContextData): boolean {
  return !!(
    data.perfilGrupo || 
    (data.estudiantes && data.estudiantes.length > 0) ||
    (data.teacherSugerencias && (
      data.teacherSugerencias.aula || 
      data.teacherSugerencias.evaluaciones || 
      data.teacherSugerencias.otras
    ))
  );
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Load group context data (DEPRECATED - wrapper for backward compatibility)
 * 
 * @deprecated Use `getGroupContextForAI()` from `@/services/groupContext/provider` instead
 * 
 * This function wraps the new unified provider and converts the response
 * to the old GroupContextData format for backward compatibility.
 */
export async function loadGroupContext(grupoId: string | undefined): Promise<GroupContextData> {
  // Backward compatibility: if no grupoId, return empty
  if (!grupoId) {
    console.log('[loadGroupContext] No grupoId provided, returning empty context');
    return {};
  }
  
  console.log('[loadGroupContext] DEPRECATED: Use getGroupContextForAI() instead');
  
  try {
    // Use new unified provider
    const context = await getGroupContextForAI(grupoId, { purpose: 'planning' });
    
    // Convert to old format for backward compatibility
    const result: GroupContextData = {
      perfilGrupo: context.groupProfile ? {
        tamanio: context.groupProfile.tamanio,
        dominante: context.groupProfile.dominante,
        distribucion: context.groupProfile.distribucion
      } : undefined,
      estudiantes: context.anonymizedStudentsForPrompt.length > 0
        ? context.anonymizedStudentsForPrompt
        : undefined,
      teacherSugerencias: context.teacherSugerencias
    };
    
    // Only return if there's meaningful data
    if (!hasMeaningfulData(result)) {
      return {};
    }
    
    return result;
    
  } catch (error) {
    console.error('[loadGroupContext] Error loading group context:', error);
    return {};
  }
}

/**
 * Helper to extract grupo_id from a planificacion
 * Useful for components that only have planificacionId
 */
export async function getGrupoIdFromPlanificacion(planificacionId: string | undefined): Promise<string | undefined> {
  if (!planificacionId) {
    return undefined;
  }
  
  try {
    const { data, error } = await supabase
      .from('planificaciones')
      .select('grupo_id')
      .eq('id', planificacionId)
      .maybeSingle();
    
    if (error) {
      console.error('[getGrupoIdFromPlanificacion] Error fetching planificacion:', error);
      return undefined;
    }
    
    return data?.grupo_id;
  } catch (error) {
    console.error('[getGrupoIdFromPlanificacion] Unexpected error:', error);
    return undefined;
  }
}












