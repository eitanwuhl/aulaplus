/**
 * PHASE 4: Shared helper for loading group profile + student adjustments
 * 
 * Single source of truth for group context data across all generation entry points.
 * Uses hybrid approach: Supabase (for teacher_sugerencias) + mockGroups (for student data).
 */

import { supabase } from '@/integrations/supabase/client';
import { mockGroups, type TeacherSugerencias } from '@/data/mockData';

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
 * Load group context data from Supabase (teacher_sugerencias) + mockGroups (students)
 * 
 * @param grupoId - Group ID (e.g. "9no 1") or undefined
 * @returns GroupContextData object with perfilGrupo, estudiantes, teacherSugerencias
 * 
 * Behavior:
 * - If grupoId is undefined, returns empty object (backward compatibility)
 * - Attempts to load teacher_sugerencias from Supabase (table grupos)
 * - Falls back to mockGroups for student data
 * - Calculates learning style distribution and dominant style
 * - Anonymizes student data (no names)
 * - Caps to MAX_STUDENTS_WITH_ADJUSTMENTS (10)
 * - Returns empty object if no meaningful data found
 * 
 * Future-proof: If a students table is added to Supabase, only this function
 * needs to be updated (transparent to consumers).
 */
export async function loadGroupContext(grupoId: string | undefined): Promise<GroupContextData> {
  // Backward compatibility: if no grupoId, return empty
  if (!grupoId) {
    console.log('[loadGroupContext] No grupoId provided, returning empty context');
    return {};
  }
  
  console.log('[loadGroupContext] Loading context for grupo:', grupoId);
  
  try {
    // ========================================================================
    // 1. Try to load from Supabase (teacher_sugerencias only for now)
    // ========================================================================
    let teacherSugerencias: TeacherSugerencias | undefined;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('grupos')
          .select('teacher_sugerencias')
          .eq('id', grupoId)
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle to avoid error if not found
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.warn('[loadGroupContext] Error fetching from Supabase grupos:', error);
        } else if (data?.teacher_sugerencias) {
          teacherSugerencias = data.teacher_sugerencias as TeacherSugerencias;
          console.log('[loadGroupContext] Loaded teacher_sugerencias from Supabase');
        }
      }
    } catch (supabaseError) {
      console.warn('[loadGroupContext] Supabase fetch failed, continuing with mock fallback:', supabaseError);
    }
    
    // ========================================================================
    // 2. Fallback to mockGroups for student data
    // ========================================================================
    // Normalize function for consistent grupoId matching
    const norm = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    
    console.log('[loadGroupContext] grupoId raw=', grupoId, 'normalized=', norm(grupoId));
    console.log('[loadGroupContext] mockGroups ids (first 20)=', mockGroups.slice(0, 20).map(g => g.id));
    
    const mockGroup = mockGroups.find(g => norm(g.id) === norm(grupoId));
    
    console.log('[loadGroupContext] mockGroup found?', !!mockGroup, 'studentsCount=', mockGroup?.students?.length ?? 0);
    
    if (!mockGroup || !mockGroup.students || mockGroup.students.length === 0) {
      console.log('[loadGroupContext] No mock group found or no students, returning teacher_sugerencias only');
      
      // Return teacher_sugerencias if available, even without student data
      if (teacherSugerencias) {
        return { teacherSugerencias };
      }
      
      return {}; // No data available
    }
    
    console.log('[loadGroupContext] Found mock group with', mockGroup.students.length, 'students');
    
    // ========================================================================
    // 3. Calculate learning style distribution
    // ========================================================================
    const distribucion = calculateLearningStyleDistribution(mockGroup.students);
    const dominante = calculateDominantStyle(distribucion);
    
    const perfilGrupo: PerfilGrupo = {
      tamanio: mockGroup.students.length,
      dominante,
      distribucion: Object.keys(distribucion).length > 0 ? distribucion : undefined
    };
    
    // ========================================================================
    // 4. Anonymize and filter students (only with adjustments)
    // ========================================================================
    const estudiantes = anonymizeAndFilterStudents(mockGroup.students);
    
    // ========================================================================
    // 5. Build result object
    // ========================================================================
    const result: GroupContextData = {
      perfilGrupo,
      estudiantes,
      teacherSugerencias
    };
    
    // Only return if there's meaningful data
    if (!hasMeaningfulData(result)) {
      console.log('[loadGroupContext] No meaningful data found, returning empty context');
      return {};
    }
    
    console.log('[loadGroupContext] Successfully loaded context:', {
      perfilGrupo: { tamanio: perfilGrupo.tamanio, dominante: perfilGrupo.dominante },
      estudiantesConAjustes: estudiantes?.length || 0,
      teacherSugerenciasPresent: !!teacherSugerencias
    });
    
    return result;
    
  } catch (error) {
    console.error('[loadGroupContext] Unexpected error loading group context:', error);
    // Return empty on error (fail gracefully)
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












