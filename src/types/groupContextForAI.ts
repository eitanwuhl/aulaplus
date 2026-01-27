/**
 * Types for unified group context provider for AI generation
 * 
 * This module defines the contract for group/student data used in:
 * - Lesson plan generation (generate-plan-completo)
 * - Evaluation generation (modify-evaluation)
 * 
 * The provider abstracts data sources (mock/localStorage today, Supabase tomorrow)
 * to enable seamless migration.
 */

/**
 * Student data structure for AI prompts
 * Matches the shape expected by edge functions
 */
export interface StudentForAI {
  /** Stable student identifier */
  studentId: string | number;
  
  /** Display name or anonymized label (e.g., "Estudiante A") */
  displayName: string;
  
  /** Learning profile (e.g., "Visual-Kinestésico") */
  learningProfile?: string;
  
  /** Contemplaciones for class context (clase) */
  contemplacionesClase: string[];
  
  /** Contemplaciones for evaluation context (evaluaciones) */
  contemplacionesEvaluaciones: string[];
  
  /** Student adjustments/accommodations text */
  ajustes?: string;
  
  /** Whether student requires content adaptation (V3 evaluation level) */
  requiresContentAdaptation: boolean;
  
  /** Explicit flag: student has declared content adaptation (deterministic, no inference) */
  hasDeclaredContentAdaptation: boolean;
  
  /** Source of content adaptation declaration */
  declaredContentAdaptationSource: 'informe_tecnico' | 'docente' | null;
  
  /** Optional notes about content adaptation declaration */
  declaredContentAdaptationNotes?: string | null;
}

/**
 * Group profile data for AI prompts
 */
export interface GroupProfileForAI {
  /** Group size */
  tamanio: number;
  
  /** Dominant learning style */
  dominante: string;
  
  /** Learning style distribution (optional) */
  distribucion?: Record<string, number>;
}

/**
 * Teacher suggestions from Supabase (grupos table)
 */
export interface TeacherSugerenciasForAI {
  aula?: string;
  evaluaciones?: string;
  otras?: string;
}

/**
 * Complete group context for AI generation
 */
export interface GroupContextForAI {
  /** Group identifier */
  groupId: string;
  
  /** Group display name */
  groupName: string;
  
  /** Grade level (if available) */
  gradeLevel?: string;
  
  /** Teacher suggestions from Supabase */
  teacherSugerencias?: TeacherSugerenciasForAI;
  
  /** Full student list with all metadata */
  students: StudentForAI[];
  
  /** Group profile (learning style distribution) */
  groupProfile?: GroupProfileForAI;
  
  /** Dominant learning style (convenience field) */
  dominantLearningStyle?: string;
  
  /** Learning style distribution (convenience field) */
  learningStyleDistribution?: Record<string, number>;
  
  /** Anonymized students array for prompts (matches current edge function contract) */
  anonymizedStudentsForPrompt: Array<{
    perfil?: string;
    ajustes?: string;
    contemplaciones?: string[];
  }>;
  
  /** Whether any student requires content adaptation */
  hasContentAdaptation: boolean;
  
  /** Structured coverage hints for future PU Family generation */
  coverageHints: {
    /** Student IDs needing alternative response format */
    studentsNeedingAltResponseFormat: string[];
    
    /** Student IDs needing extra time */
    studentsNeedingExtraTime: string[];
    
    /** Student IDs needing breaks */
    studentsNeedingBreaks: string[];
    
    /** Student IDs needing reading assistance */
    studentsNeedingReadingAssistance: string[];
    
    /** Student IDs with declared content adaptation */
    studentsWithDeclaredContentAdaptation: string[];
    
    /** Optional notes */
    notes?: string;
  };
}

/**
 * Options for context loading
 */
export interface GroupContextOptions {
  /** Purpose: determines which contemplaciones category to load */
  purpose?: 'evaluation' | 'planning';
  
  /** Maximum number of students to include (default: 10) */
  maxStudents?: number;
}

