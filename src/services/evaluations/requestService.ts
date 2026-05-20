/**
 * Evaluation Request Service
 * 
 * Provides a unified interface for requesting evaluations from either v1 or v2 backend.
 * Handles automatic fallback from v2 to v1 when v2 fails.
 * 
 * Phase 3: Beta toggle + fallback logic
 */

import { invokeEdgeFunctionAuthed } from '@/lib/edgeFunctionAuth';

// ============================================================================
// TYPES
// ============================================================================

export interface EvaluationRequestPayload {
  modification: string;
  groupContext: {
    subject?: string;
    groupName?: string;
    content?: string[];
    competencies?: string[];
    criteriosLogro?: string[];
    students?: unknown[]; // Accept any student shape - v1 handles internally
    dominantLearningStyle?: string;
    dominantProfile?: string;
    [key: string]: unknown; // Allow additional fields
  };
  evaluation_design_plan?: {
    triggers?: { versionB?: boolean; versionC?: boolean };
    instrumentDesignRules?: string[];
    studentAssignments?: Record<string, 'A' | 'B' | 'C'>;
    assignmentByStudentId?: Record<string, 'A' | 'B' | 'C'>;
    perStudentReminders?: Array<{
      studentId: string | number;
      admin?: string[];
      correction?: string[];
      allowances?: string[];
    }>;
    responseOptions?: {
      include?: boolean;
      optionCount?: 1 | 2 | 3;
    };
    varkDistribution?: Record<string, number>;
    highStructureNeed?: { percent: number };
    designComplexityCount?: number;
    [key: string]: unknown; // Allow additional fields
  };
  generation_mode?: 'universal' | 'legacy';
  type?: string;
  adaptationLevel?: string;
}

export interface EvaluationBundle {
  baseHtml?: string;
  versionBHtml?: string | null;
  versionCHtml?: string | null;
  versions?: { A: string; B?: string | null; C?: string | null };
  responseOptionsIncluded?: boolean;
  responseOptionCount?: number;
  finalAssignmentCounts?: { A: number; B: number; C: number };
}

export interface EvaluationResult {
  success: boolean;
  evaluationBundle: EvaluationBundle | null;
  aiReport: unknown | null;
  studentAssignments: Record<string, 'A' | 'B' | 'C'>;
  warnings: Array<{ code: string; message: string; severity: string }>;
  meta: {
    endpoint: 'v1' | 'v2';
    fallbackUsed: boolean;
    fallbackReason?: string;
    requestId?: string;
  };
  /** 
   * Phase 4: Raw v2 response for JSON-based rendering.
   * Only present when endpoint='v2' and validation passed.
   * Use this with EvaluationRendererV2 component.
   */
  v2RawResponse?: import('./v2Types').V2Response;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'aulaplus:eval-beta-toggle';
const DEBUG_MODE = import.meta.env.DEV || import.meta.env.VITE_DEBUG_EVAL_PIPELINE === 'true';

// ============================================================================
// TOGGLE PERSISTENCE
// ============================================================================

export function getBetaToggleState(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    // Default ON in dev so generation uses deployed modify-evaluation-v2.
    return import.meta.env.DEV;
  } catch {
    return false;
  }
}

export function setBetaToggleState(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// V2 RESPONSE VALIDATION
// ============================================================================

interface V2Response {
  success: boolean;
  evaluationSpec: {
    version: string;
    meta: Record<string, unknown>;
    sections: Array<{
      id: string;
      title: string;
      items: Array<{
        id: string;
        type: string;
        prompt: string;
        points: number;
      }>;
    }>;
    versionVariants: Record<string, unknown>;
  } | null;
  requestedVersions: { A: boolean; B: boolean; C: boolean };
  instrumentDesignRulesApplied: string[];
  teacherRemindersByStudent: Array<{
    studentId: string;
    studentName: string;
    admin: string[];
    correction: string[];
  }>;
  aiReport: unknown | null;
  warnings: Array<{ code: string; message: string; severity: string }>;
  debug?: {
    model: string;
    attempt: number;
    extractionMethod: string;
  };
}

interface ValidationResult {
  valid: boolean;
  missingFields: string[];
  errors: string[];
}

function validateV2Response(data: unknown): ValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];

  // Must be an object
  if (!data || typeof data !== 'object') {
    errors.push('Response is not an object');
    return { valid: false, missingFields, errors };
  }

  const response = data as Record<string, unknown>;

  // Must have success field
  if (typeof response.success !== 'boolean') {
    missingFields.push('success');
  }

  // If success is true, must have evaluationSpec
  if (response.success === true) {
    if (!response.evaluationSpec || typeof response.evaluationSpec !== 'object') {
      missingFields.push('evaluationSpec');
    } else {
      const spec = response.evaluationSpec as Record<string, unknown>;
      
      // evaluationSpec.sections must be an array
      if (!Array.isArray(spec.sections)) {
        missingFields.push('evaluationSpec.sections');
      } else if (spec.sections.length === 0) {
        errors.push('evaluationSpec.sections is empty');
      } else {
        // Each section must have items
        for (let i = 0; i < spec.sections.length; i++) {
          const section = spec.sections[i] as Record<string, unknown>;
          if (!Array.isArray(section.items)) {
            missingFields.push(`evaluationSpec.sections[${i}].items`);
          }
        }
      }
      
      // Must have versionVariants
      if (!spec.versionVariants || typeof spec.versionVariants !== 'object') {
        missingFields.push('evaluationSpec.versionVariants');
      }
    }
  }

  // Must have requestedVersions
  if (!response.requestedVersions || typeof response.requestedVersions !== 'object') {
    missingFields.push('requestedVersions');
  }

  // Must have warnings array (can be empty)
  if (!Array.isArray(response.warnings)) {
    missingFields.push('warnings');
  }

  const valid = missingFields.length === 0 && errors.length === 0;
  return { valid, missingFields, errors };
}

// ============================================================================
// V2 TO V1 FORMAT CONVERTER
// ============================================================================

/**
 * Convert v2 structured response to v1-compatible EvaluationBundle format.
 * This allows the existing UI to render v2 responses without changes.
 */
function convertV2ToV1Format(v2Response: V2Response): {
  evaluationBundle: EvaluationBundle;
  studentAssignments: Record<string, 'A' | 'B' | 'C'>;
} {
  const spec = v2Response.evaluationSpec;
  
  if (!spec) {
    return {
      evaluationBundle: {
        baseHtml: '',
        versionBHtml: null,
        versionCHtml: null,
        versions: { A: '', B: null, C: null },
        responseOptionsIncluded: false,
        responseOptionCount: 2
      },
      studentAssignments: {}
    };
  }

  // Render sections to HTML
  const renderSectionsToHtml = (sections: V2Response['evaluationSpec']['sections']): string => {
    if (!sections || sections.length === 0) return '';
    
    let html = '<div class="evaluation">';
    
    for (const section of sections) {
      html += `<h2>${section.title}</h2>`;
      if (section.items) {
        for (const item of section.items) {
          html += `<div class="item">`;
          html += `<p><strong>${item.prompt}</strong></p>`;
          if (item.points) {
            html += `<p class="points">(${item.points} puntos)</p>`;
          }
          html += `</div>`;
        }
      }
    }
    
    html += '</div>';
    return html;
  };

  const baseHtml = renderSectionsToHtml(spec.sections);
  
  // For now, B and C use the same content (modifications would need more complex handling)
  const hasB = spec.versionVariants && 'B' in spec.versionVariants;
  const hasC = spec.versionVariants && 'C' in spec.versionVariants;

  return {
    evaluationBundle: {
      baseHtml,
      versionBHtml: hasB ? baseHtml : null,
      versionCHtml: hasC ? baseHtml : null,
      versions: {
        A: baseHtml,
        B: hasB ? baseHtml : null,
        C: hasC ? baseHtml : null
      },
      responseOptionsIncluded: false,
      responseOptionCount: 2
    },
    studentAssignments: {}
  };
}

// ============================================================================
// REQUEST FUNCTIONS
// ============================================================================

async function requestV1(payload: EvaluationRequestPayload): Promise<EvaluationResult> {
  const requestBody = {
    ...payload,
    generation_mode: payload.generation_mode || 'universal',
    type: payload.type || 'modification',
    adaptationLevel: payload.adaptationLevel || 'standard'
  };

  if (DEBUG_MODE) {
    console.log('[EVAL_SERVICE] Calling v1 endpoint');
  }

  const { data, error } = await invokeEdgeFunctionAuthed('modify-evaluation', {
    body: requestBody
  });

  if (error) {
    throw new Error(`v1 API error: ${error.message}`);
  }

  if (!data) {
    throw new Error('v1 returned empty response');
  }

  // Validate v1 has version A
  const hasVersionA = Boolean(
    data?.evaluationBundle?.versions?.A || 
    data?.evaluationBundle?.baseHtml
  );

  if (!hasVersionA) {
    throw new Error('v1 response missing version A');
  }

  return {
    success: true,
    evaluationBundle: data.evaluationBundle,
    aiReport: data.aiReport || null,
    studentAssignments: data.studentAssignments || {},
    warnings: data.warnings || [],
    meta: {
      endpoint: 'v1',
      fallbackUsed: false
    }
  };
}

async function requestV2(payload: EvaluationRequestPayload): Promise<EvaluationResult> {
  const requestBody = {
    modification: payload.modification,
    groupContext: payload.groupContext,
    evaluation_design_plan: payload.evaluation_design_plan
  };

  if (DEBUG_MODE) {
    console.log('[EVAL_SERVICE] Calling v2 endpoint');
  }

  const { data, error } = await invokeEdgeFunctionAuthed('modify-evaluation-v2', {
    body: requestBody
  });

  if (error) {
    throw new Error(`v2 API error: ${error.message}`);
  }

  if (!data) {
    throw new Error('v2 returned empty response');
  }

  // Validate v2 response structure
  const validation = validateV2Response(data);
  
  if (!validation.valid) {
    const details = [
      ...validation.missingFields.map(f => `missing: ${f}`),
      ...validation.errors
    ].join(', ');
    throw new Error(`v2 validation failed: ${details}`);
  }

  const v2Response = data as V2Response;

  // If v2 returned success: false, treat as failure
  if (!v2Response.success) {
    const errorWarning = v2Response.warnings.find(w => w.severity === 'error');
    throw new Error(errorWarning?.message || 'v2 generation failed');
  }

  // Convert v2 format to v1-compatible format for UI (backward compatibility)
  const { evaluationBundle, studentAssignments } = convertV2ToV1Format(v2Response);

  return {
    success: true,
    evaluationBundle,
    aiReport: v2Response.aiReport,
    studentAssignments,
    warnings: v2Response.warnings,
    meta: {
      endpoint: 'v2',
      fallbackUsed: false
    },
    // Phase 4: Include raw v2 response for JSON-based rendering
    v2RawResponse: v2Response
  };
}

// ============================================================================
// MAIN REQUEST FUNCTION
// ============================================================================

export async function requestEvaluation(
  payload: EvaluationRequestPayload,
  useBeta: boolean
): Promise<EvaluationResult> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  if (DEBUG_MODE) {
    console.log('[EVAL_SERVICE] ========== REQUEST START ==========');
    console.log('[EVAL_SERVICE] requestId:', requestId);
    console.log('[EVAL_SERVICE] useBeta:', useBeta);
    console.log('[EVAL_SERVICE] payload.groupContext.subject:', payload.groupContext?.subject);
  }

  // If not using beta, go straight to v1
  if (!useBeta) {
    try {
      const result = await requestV1(payload);
      result.meta.requestId = requestId;
      
      if (DEBUG_MODE) {
        console.log('[EVAL_SERVICE] v1 success');
        console.log('[EVAL_SERVICE] ========== REQUEST END ==========');
      }
      
      return result;
    } catch (error) {
      if (DEBUG_MODE) {
        console.error('[EVAL_SERVICE] v1 failed:', error);
      }
      throw error;
    }
  }

  // Using beta: try v2 first, fallback to v1
  try {
    const result = await requestV2(payload);
    result.meta.requestId = requestId;
    
    if (DEBUG_MODE) {
      console.log('[EVAL_SERVICE] v2 success (no fallback needed)');
      console.log('[EVAL_SERVICE] ========== REQUEST END ==========');
    }
    
    return result;
  } catch (v2Error) {
    const v2ErrorMessage = v2Error instanceof Error ? v2Error.message : String(v2Error);
    
    if (DEBUG_MODE) {
      console.warn('[EVAL_SERVICE] v2 failed, falling back to v1:', v2ErrorMessage);
    }

    // Fallback to v1
    try {
      const result = await requestV1(payload);
      result.meta.requestId = requestId;
      result.meta.fallbackUsed = true;
      result.meta.fallbackReason = v2ErrorMessage;
      
      if (DEBUG_MODE) {
        console.log('[EVAL_SERVICE] v1 fallback success');
        console.log('[EVAL_SERVICE] ========== REQUEST END ==========');
      }
      
      return result;
    } catch (v1Error) {
      if (DEBUG_MODE) {
        console.error('[EVAL_SERVICE] Both v1 and v2 failed');
        console.log('[EVAL_SERVICE] ========== REQUEST END ==========');
      }
      
      // Both failed - throw the v1 error since it's the stable one
      throw v1Error;
    }
  }
}
