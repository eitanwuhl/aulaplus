/**
 * Unified Group Context Provider for AI Generation
 * 
 * SINGLE ACCESS POINT for all student/group information used in:
 * - Lesson plan generation (generate-plan-completo)
 * - Evaluation generation (modify-evaluation)
 * 
 * This module abstracts data sources (mock/localStorage today, Supabase tomorrow)
 * to enable seamless migration without changing call sites.
 * 
 * IMPORTANT: This is the ONLY place allowed to touch:
 * - mockData.ts (students)
 * - localStorage (contemplaciones)
 * - Supabase grupos table (teacher_sugerencias)
 * 
 * All generation code must use this provider instead of reading directly.
 */

import { supabase } from '@/integrations/supabase/client';
import { mockGroups, type TeacherSugerencias, type Student } from '@/data/mockData';
import { resolveMockGroup } from '@/utils/resolveMockGroup';
import { readSelected } from '@/lib/contemplaciones/storage';
import type {
  GroupContextForAI,
  StudentForAI,
  GroupProfileForAI,
  TeacherSugerenciasForAI,
  GroupContextOptions
} from '@/types/groupContextForAI';

// ============================================================================
// Data Source Abstraction
// ============================================================================

/**
 * Abstract interface for student data sources
 * Enables easy migration from mock/localStorage to Supabase
 */
interface StudentDataSource {
  /**
   * Get all students for a group
   */
  getGroupStudents(grupoId: string): Promise<Student[]>;
  
  /**
   * Get contemplaciones for a student and category
   */
  getStudentContemplaciones(
    studentId: string | number,
    category: 'clase' | 'evaluaciones'
  ): Promise<string[]>;
}

/**
 * Current implementation: Mock data + localStorage
 */
class MockStudentDataSource implements StudentDataSource {
  async getGroupStudents(grupoId: string): Promise<Student[]> {
    const resolveResult = resolveMockGroup(grupoId, true);
    const mockGroup = resolveResult.group;
    
    if (!mockGroup || !mockGroup.students) {
      return [];
    }
    
    return mockGroup.students;
  }
  
  async getStudentContemplaciones(
    studentId: string | number,
    category: 'clase' | 'evaluaciones'
  ): Promise<string[]> {
    return readSelected(studentId, category);
  }
}

/**
 * Future implementation: Supabase (placeholder with TODOs)
 * 
 * TODO: Implement when students table is added to Supabase
 * - Create students table with RLS
 * - Create student_contemplaciones junction table
 * - Implement getGroupStudents() to query Supabase
 * - Implement getStudentContemplaciones() to query Supabase
 */
class SupabaseStudentDataSource implements StudentDataSource {
  async getGroupStudents(grupoId: string): Promise<Student[]> {
    // TODO: Query Supabase students table
    // const { data, error } = await supabase
    //   .from('students')
    //   .select('*')
    //   .eq('grupo_id', grupoId)
    //   .eq('user_id', user.id);
    // return data || [];
    throw new Error('SupabaseStudentDataSource not yet implemented');
  }
  
  async getStudentContemplaciones(
    studentId: string | number,
    category: 'clase' | 'evaluaciones'
  ): Promise<string[]> {
    // TODO: Query Supabase student_contemplaciones table
    // const { data, error } = await supabase
    //   .from('student_contemplaciones')
    //   .select('contemplacion_id')
    //   .eq('student_id', studentId)
    //   .eq('category', category);
    // return data?.map(d => d.contemplacion_id) || [];
    throw new Error('SupabaseStudentDataSource not yet implemented');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate learning style distribution from students
 */
function calculateLearningStyleDistribution(students: Student[]): Record<string, number> {
  const distribucion: Record<string, number> = {};
  
  students.forEach(student => {
    const perfil = (student.perfil || '').toLowerCase();
    
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
 * Determine dominant learning style
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
 * Anonymize student name (Estudiante A, B, C, ...)
 */
function anonymizeStudentName(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < letters.length) {
    return `Estudiante ${letters[index]}`;
  }
  return `Estudiante ${index + 1}`;
}

/**
 * Check if student requires content adaptation (deterministic, explicit flags only)
 * Returns both the flag and its source
 */
function checkContentAdaptation(student: Student): {
  hasDeclaredContentAdaptation: boolean;
  declaredContentAdaptationSource: 'informe_tecnico' | 'docente' | null;
  declaredContentAdaptationNotes?: string | null;
} {
  // Check localStorage first (teacher override - highest priority)
  try {
    const key = `adecuacionContenido:${student.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const value = JSON.parse(stored);
      if (value === true) {
        return {
          hasDeclaredContentAdaptation: true,
          declaredContentAdaptationSource: 'docente',
          declaredContentAdaptationNotes: 'Marcado explícitamente por docente'
        };
      }
    }
  } catch {
    // Fall through to informeTecnico check
  }
  
  // Check informeTecnico (formal declaration)
  if (student.informeTecnico?.requiereAdecuacionContenido === true) {
    const notes = student.informeTecnico.ajustesProgramaticos
      ?.map(aj => `${aj.materia}: ${aj.ajustes.join(', ')}`)
      .join('; ') || null;
    
    return {
      hasDeclaredContentAdaptation: true,
      declaredContentAdaptationSource: 'informe_tecnico',
      declaredContentAdaptationNotes: notes || undefined
    };
  }
  
  // No explicit declaration found
  return {
    hasDeclaredContentAdaptation: false,
    declaredContentAdaptationSource: null
  };
}

/**
 * Check if student requires content adaptation (backward compatibility)
 */
function requiresContentAdaptation(student: Student): boolean {
  return checkContentAdaptation(student).hasDeclaredContentAdaptation;
}

/**
 * Calculate coverage hints from contemplaciones (deterministic mapping)
 * These hints prepare the system for future PU Family generation logic
 */
function calculateCoverageHints(
  students: StudentForAI[],
  purpose: 'evaluation' | 'planning'
): {
  studentsNeedingAltResponseFormat: string[];
  studentsNeedingExtraTime: string[];
  studentsNeedingBreaks: string[];
  studentsNeedingReadingAssistance: string[];
  studentsWithDeclaredContentAdaptation: string[];
  notes?: string;
} {
  const hints = {
    studentsNeedingAltResponseFormat: [] as string[],
    studentsNeedingExtraTime: [] as string[],
    studentsNeedingBreaks: [] as string[],
    studentsNeedingReadingAssistance: [] as string[],
    studentsWithDeclaredContentAdaptation: [] as string[]
  };
  
  // Use appropriate contemplaciones based on purpose
  const relevantContemplaciones = purpose === 'evaluation' 
    ? students.map(s => ({ studentId: String(s.studentId), contemplaciones: s.contemplacionesEvaluaciones }))
    : students.map(s => ({ studentId: String(s.studentId), contemplaciones: s.contemplacionesClase }));
  
  relevantContemplaciones.forEach(({ studentId, contemplaciones }) => {
    // Map contemplaciones to coverage hints (deterministic mapping)
    contemplaciones.forEach(contemplacionId => {
      // Alternative response format: contemplacion-8 (respuesta oral alternativa)
      if (contemplacionId === 'contemplacion-8' || contemplacionId.includes('contemplacion-8')) {
        if (!hints.studentsNeedingAltResponseFormat.includes(studentId)) {
          hints.studentsNeedingAltResponseFormat.push(studentId);
        }
      }
      
      // Extra time: contemplacion-3 (tiempo adicional y pausas)
      if (contemplacionId === 'contemplacion-3' || contemplacionId.includes('contemplacion-3')) {
        if (!hints.studentsNeedingExtraTime.includes(studentId)) {
          hints.studentsNeedingExtraTime.push(studentId);
        }
      }
      
      // Breaks: contemplacion-3 (includes pausas)
      if (contemplacionId === 'contemplacion-3' || contemplacionId.includes('contemplacion-3')) {
        if (!hints.studentsNeedingBreaks.includes(studentId)) {
          hints.studentsNeedingBreaks.push(studentId);
        }
      }
      
      // Reading assistance: contemplacion-1 (lectura oral de consignas)
      if (contemplacionId === 'contemplacion-1' || contemplacionId.includes('contemplacion-1')) {
        if (!hints.studentsNeedingReadingAssistance.includes(studentId)) {
          hints.studentsNeedingReadingAssistance.push(studentId);
        }
      }
    });
    
    // Content adaptation: explicit flag only
    const student = students.find(s => String(s.studentId) === studentId);
    if (student?.hasDeclaredContentAdaptation) {
      if (!hints.studentsWithDeclaredContentAdaptation.includes(studentId)) {
        hints.studentsWithDeclaredContentAdaptation.push(studentId);
      }
    }
  });
  
  // Add notes if there are any hints
  if (
    hints.studentsNeedingAltResponseFormat.length > 0 ||
    hints.studentsNeedingExtraTime.length > 0 ||
    hints.studentsNeedingBreaks.length > 0 ||
    hints.studentsNeedingReadingAssistance.length > 0 ||
    hints.studentsWithDeclaredContentAdaptation.length > 0
  ) {
    hints.notes = `Coverage hints derived from contemplaciones (category: ${purpose})`;
  }
  
  return hints;
}

/**
 * Load teacher suggestions from Supabase
 */
async function loadTeacherSugerencias(grupoId: string): Promise<TeacherSugerenciasForAI | undefined> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return undefined;
    }
    
    const { data, error } = await supabase
      .from('grupos')
      .select('teacher_sugerencias')
      .eq('id', grupoId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    // Handle 404 gracefully: PGRST116 = no rows returned (expected if group doesn't exist in DB)
    // Also handle 404 from PostgREST if table/column doesn't exist (non-blocking)
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - group doesn't exist in DB, use mock data (expected behavior)
        console.log('[getGroupContextForAI] Group not found in DB, using mock data');
        return undefined;
      }
      // Handle 404 or other errors gracefully without blocking generation
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('404')) {
        // Table or column doesn't exist - non-blocking, just log and continue
        console.warn('[getGroupContextForAI] Table/column teacher_sugerencias not available:', error.message);
        return undefined;
      }
      // Other errors - log but don't block
      console.warn('[getGroupContextForAI] Error fetching teacher_sugerencias (non-blocking):', error);
      return undefined;
    }
    
    if (data?.teacher_sugerencias) {
      return data.teacher_sugerencias as TeacherSugerenciasForAI;
    }
    
    return undefined;
  } catch (error: any) {
    // Catch all errors gracefully - never block generation
    console.warn('[getGroupContextForAI] Error loading teacher_sugerencias (non-blocking):', error);
    return undefined;
  }
}

// ============================================================================
// Main Provider Function
// ============================================================================

/**
 * Get unified group context for AI generation
 * 
 * This is the SINGLE ACCESS POINT for all student/group data used in:
 * - Lesson plan generation
 * - Evaluation generation
 * 
 * @param grupoId - Group identifier
 * @param options - Loading options (purpose, maxStudents)
 * @returns Complete group context for AI prompts
 */
export async function getGroupContextForAI(
  grupoId: string,
  options: GroupContextOptions = {}
): Promise<GroupContextForAI> {
  const { purpose = 'planning', maxStudents = 10 } = options;
  
  console.log('[getGroupContextForAI] Loading context for grupo:', grupoId, 'purpose:', purpose);
  
  // Use current data source (mock + localStorage)
  // TODO: Switch to SupabaseStudentDataSource when students table is ready
  const dataSource: StudentDataSource = new MockStudentDataSource();
  
  try {
    // 1. Load teacher suggestions from Supabase
    const teacherSugerencias = await loadTeacherSugerencias(grupoId);
    
    // 2. Load students from data source
    const students = await dataSource.getGroupStudents(grupoId);
    
    if (students.length === 0) {
      console.log('[getGroupContextForAI] No students found for grupo:', grupoId);
      
      // Return minimal context with teacher suggestions if available
      const resolveResult = resolveMockGroup(grupoId, true);
      const mockGroup = resolveResult.group;
      
      return {
        groupId: grupoId,
        groupName: mockGroup?.name || grupoId,
        gradeLevel: mockGroup?.year,
        teacherSugerencias,
        students: [],
        anonymizedStudentsForPrompt: [],
        hasContentAdaptation: false,
        coverageHints: {
          studentsNeedingAltResponseFormat: [],
          studentsNeedingExtraTime: [],
          studentsNeedingBreaks: [],
          studentsNeedingReadingAssistance: [],
          studentsWithDeclaredContentAdaptation: []
        }
      };
    }
    
    // 3. Load contemplaciones for each student
    const studentsWithContemplaciones: StudentForAI[] = await Promise.all(
      students.slice(0, maxStudents).map(async (student, index) => {
        const contemplacionesClase = await dataSource.getStudentContemplaciones(
          student.id,
          'clase'
        );
        
        const contemplacionesEvaluaciones = await dataSource.getStudentContemplaciones(
          student.id,
          'evaluaciones'
        );
        
        // DIAGNOSTIC: Log contemplaciones loaded from localStorage (DEV only)
        if (import.meta.env.DEV && (contemplacionesClase.length > 0 || contemplacionesEvaluaciones.length > 0)) {
          console.log(`[DIAG:getGroupContextForAI] Student ${student.id} contemplaciones:`, {
            clase: contemplacionesClase,
            evaluaciones: contemplacionesEvaluaciones
          });
        }
        
        // Check content adaptation with explicit source tracking
        const contentAdaptationInfo = checkContentAdaptation(student);
        
        return {
          studentId: student.id,
          displayName: anonymizeStudentName(index),
          learningProfile: student.perfil,
          contemplacionesClase,
          contemplacionesEvaluaciones,
          ajustes: student.ajustes,
          requiresContentAdaptation: contentAdaptationInfo.hasDeclaredContentAdaptation,
          hasDeclaredContentAdaptation: contentAdaptationInfo.hasDeclaredContentAdaptation,
          declaredContentAdaptationSource: contentAdaptationInfo.declaredContentAdaptationSource,
          declaredContentAdaptationNotes: contentAdaptationInfo.declaredContentAdaptationNotes
        };
      })
    );
    
    // 4. Filter students with adjustments/contemplaciones for prompt
    const studentsWithAdjustments = studentsWithContemplaciones.filter(s => 
      s.ajustes || 
      (purpose === 'planning' && s.contemplacionesClase.length > 0) ||
      (purpose === 'evaluation' && s.contemplacionesEvaluaciones.length > 0)
    ).slice(0, maxStudents);
    
    // 5. Build anonymized students array for prompt (matches current edge function contract)
    const anonymizedStudentsForPrompt = studentsWithAdjustments.map(s => ({
      perfil: s.learningProfile,
      ajustes: s.ajustes,
      contemplaciones: purpose === 'planning' 
        ? s.contemplacionesClase 
        : s.contemplacionesEvaluaciones
    }));
    
    // 6. Calculate learning style distribution
    const distribucion = calculateLearningStyleDistribution(students);
    const dominante = calculateDominantStyle(distribucion);
    
    const groupProfile: GroupProfileForAI | undefined = Object.keys(distribucion).length > 0
      ? {
          tamanio: students.length,
          dominante,
          distribucion: Object.keys(distribucion).length > 0 ? distribucion : undefined
        }
      : undefined;
    
    // 7. Check if any student requires content adaptation
    const hasContentAdaptation = studentsWithContemplaciones.some(s => s.requiresContentAdaptation);
    
    // 8. Calculate coverage hints from contemplaciones (for future PU Family generation)
    const coverageHints = calculateCoverageHints(studentsWithContemplaciones, purpose);
    
    // 8. Get group name from mock data
    const resolveResult = resolveMockGroup(grupoId, true);
    const mockGroup = resolveResult.group;
    
    const result: GroupContextForAI = {
      groupId: grupoId,
      groupName: mockGroup?.name || grupoId,
      gradeLevel: mockGroup?.year,
      teacherSugerencias,
      students: studentsWithContemplaciones,
      groupProfile,
      dominantLearningStyle: dominante,
      learningStyleDistribution: distribucion,
      anonymizedStudentsForPrompt,
      hasContentAdaptation,
      coverageHints
    };
    
    console.log('[getGroupContextForAI] Successfully loaded context:', {
      groupName: result.groupName,
      studentsCount: result.students.length,
      studentsWithAdjustments: studentsWithAdjustments.length,
      hasGroupProfile: !!result.groupProfile,
      hasContentAdaptation: result.hasContentAdaptation,
      teacherSugerenciasPresent: !!result.teacherSugerencias
    });
    
    return result;
    
  } catch (error) {
    console.error('[getGroupContextForAI] Error loading group context:', error);
    
    // Return minimal context on error
    const resolveResult = resolveMockGroup(grupoId, true);
    const mockGroup = resolveResult.group;
    
      return {
        groupId: grupoId,
        groupName: mockGroup?.name || grupoId,
        gradeLevel: mockGroup?.year,
        students: [],
        anonymizedStudentsForPrompt: [],
        hasContentAdaptation: false,
        coverageHints: {
          studentsNeedingAltResponseFormat: [],
          studentsNeedingExtraTime: [],
          studentsNeedingBreaks: [],
          studentsNeedingReadingAssistance: [],
          studentsWithDeclaredContentAdaptation: []
        }
      };
  }
}

// ============================================================================
// Backward Compatibility Wrappers
// ============================================================================
// These functions are provided for backward compatibility with legacy UI code.
// New code should use getGroupContextForAI() directly.

/**
 * @deprecated Use getGroupContextForAI() instead
 * Legacy wrapper that converts GroupContextForAI to old GroupContextData format
 */
export interface PerfilGrupo {
  tamanio: number;
  dominante: string;
  distribucion?: Record<string, number>;
}/**
 * @deprecated Use StudentForAI from types instead
 */
export interface EstudianteAjuste {
  perfil?: string;
  ajustes?: string;
  contemplaciones?: string[];
}

/**
 * @deprecated Use GroupContextForAI from types instead
 */
export interface GroupContextData {
  perfilGrupo?: PerfilGrupo;
  estudiantes?: EstudianteAjuste[];
  teacherSugerencias?: TeacherSugerenciasForAI;
}

/**
 * Load group context data (DEPRECATED - wrapper for backward compatibility)
 * 
 * @deprecated Use getGroupContextForAI() from this module instead
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
        ? context.anonymizedStudentsForPrompt.map(s => ({
            perfil: s.learningStyle,
            ajustes: s.adjustments,
            contemplaciones: s.contemplaciones
          }))
        : undefined,
      teacherSugerencias: context.teacherSugerencias
    };
    
    // Only return if there's meaningful data
    const hasData = !!(
      result.perfilGrupo || 
      (result.estudiantes && result.estudiantes.length > 0) ||
      (result.teacherSugerencias && (
        result.teacherSugerencias.aula || 
        result.teacherSugerencias.evaluaciones || 
        result.teacherSugerencias.otras
      ))
    );
    
    if (!hasData) {
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
