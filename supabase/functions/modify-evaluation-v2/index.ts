import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// MODIFY-EVALUATION-V2: Structured JSON Response Edge Function
// ============================================================================
// This is a parallel v2 implementation that returns structured JSON instead
// of HTML blobs. It mirrors the v1 flow but with cleaner output.
// v1 remains unchanged and is the production default.
// ============================================================================

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// ============================================================================
// TIMEOUT CONFIGURATION (Tuned for evaluation generation)
// ============================================================================
// Supabase Edge Functions: Pro plans have ~150s limit, free plans ~60s
// OpenAI gpt-4.1 typically takes 20-50s for complex evaluation generation
// Strategy: Allow long first attempt, retry with reduced payload if timeout

const OPENAI_TIMEOUT_GENERATE_MS = 90000;  // 90s for generate (first attempt) — reduced timeouts causing fallback
const OPENAI_TIMEOUT_RETRY_MS = 24000;     // 24s for fast fallback (gpt-4o-mini, reduced tokens only)
const OPENAI_TIMEOUT_ADJUST_MS = 30000;    // 30s for adjust mode (smaller changes)
const TOTAL_TIMEOUT_MS = 120000;           // 2 minutes total budget

// Debug build stamp — change this when deploying to prove which code is running
const DEBUG_BUILD = 'v2-byVersion-DEPLOY-FINGERPRINT-2026-02-16-01';

// Legacy constant for backward compatibility
const OPENAI_TIMEOUT_MS = OPENAI_TIMEOUT_GENERATE_MS;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
};

// ============================================================================
// TYPE DEFINITIONS: V2 Response Contract
// ============================================================================

// Versioned content for pedagogical adaptation (Version B/C)
interface VersionedContent {
  promptB?: string;  // Simplified/adapted prompt for Version B
  promptC?: string;  // Exceptional adaptation prompt for Version C
  optionsB?: Array<{ id: string; text: string; isCorrect?: boolean }>;  // Simplified options
}

interface RubricLevelV2 {
  key: string;
  label: string;
  descriptor: string;
  minPoints?: number;
  maxPoints?: number;
}

interface ItemRubricV2 {
  levels: RubricLevelV2[];
}

interface EvaluationItemV2 {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'true_false_justify' | 'short_answer' | 'paragraph' | 'essay' | 'source_analysis' | 'table_completion' | 'matching' | 'ordering';
  prompt: string;
  points: number;
  competencyId?: string;
  criterioLogroId?: string;
  // Versioned content for adapted prompts (Version B/C)
  versionedContent?: VersionedContent;
  // Type-specific fields
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  correctAnswer?: boolean | string;
  justificationRequired?: boolean;
  maxLength?: number;
  minLength?: number;
  guidingQuestions?: string[];
  rubric?: ItemRubricV2;
  equivalentResponseOptions?: {
    enabled: boolean;
    options: Array<{ id: string; format: string; description: string }>;
    metacognitionText: string;
  };
  source?: {
    type: 'text' | 'image';
    content?: string;
    url?: string;
    caption?: string;
    attribution?: string;
  };
  subItems?: Array<{
    id: string;
    prompt: string;
    points: number;
    responseFormat?: string;
  }>;
}

interface EvaluationSectionV2 {
  id: string;
  title: string;
  duration?: number;
  instructions?: string;
  items: EvaluationItemV2[];
}

interface EvaluationSpecV2 {
  version: '2.0';
  generatedAt: string;
  meta: {
    subject: string;
    gradeLevel?: string;
    groupName?: string;
    totalStudents?: number;
    duration?: { minutes: number; breakdown?: Record<string, number> };
    totalPoints?: number;
    evaluationType: string;
    contentIds?: string[];
    competencyIds?: string[];
    criteriosLogro?: string[];
  };
  sections: EvaluationSectionV2[];
  versionVariants: {
    A: { label: string; isBase: boolean };
    B?: { label: string; isBase: boolean; reason: string; modifications: unknown[] };
    C?: { label: string; isBase: boolean; reason: string; modifications: unknown[] };
  };
  aiReport?: {
    narrative?: string;  // Global/legacy narrative
    byVersion?: {
      A?: { narrative: string; decisionsApplied?: string[]; warnings?: string[] };
      B?: { narrative: string; decisionsApplied?: string[]; warnings?: string[] };
      C?: { narrative: string; decisionsApplied?: string[]; warnings?: string[] };
    };
  };
}

interface TeacherReminderV2 {
  studentId: string;
  studentName: string;
  admin: string[];
  correction: string[];
}

interface WarningV2 {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

interface AiReportPerVersion {
  narrative: string;
  decisionsApplied?: string[];
  warnings?: string[];
}

interface AIReportV2 {
  narrative?: string;  // Global narrative (fallback when byVersion not used)
  byVersion?: {
    A?: AiReportPerVersion;
    B?: AiReportPerVersion;
    C?: AiReportPerVersion;
  };
  designRationale: string;
  versionsExplanation: {
    generated: string[];
    notGenerated?: Record<string, string>;
  };
  contemplacionesApplied: {
    instrumentDesign: string[];
    adminReminders: number;
    correctionReminders: number;
  };
  responseOptions: {
    included: boolean;
    count?: number;
    reason?: string;
  };
  varkSummary?: string;
}

interface V2Response {
  success: boolean;
  evaluationSpec: EvaluationSpecV2 | null;
  requestedVersions: { A: boolean; B: boolean; C: boolean };
  instrumentDesignRulesApplied: string[];
  teacherRemindersByStudent: TeacherReminderV2[];
  aiReport: AIReportV2 | Record<string, unknown> | null; // Normalized to match AIDesignReportData contract
  warnings: WarningV2[];
  debug?: {
    build?: string;
    model: string;
    promptTokensEstimate: number;
    completionTokensEstimate: number;
    attempt: number;
    extractionMethod: string;
    requestId?: string;
    timings?: Record<string, number>;
    totalDurationMs?: number;
    openaiDurationMs?: number;
    timeoutUsedMs?: number;
    retryReason?: string;
    promptSizeKB?: string;
    attempts?: Array<{
      attempt: number;
      mode: 'full' | 'fast_fallback' | 'emergency_template';
      model: string;
      timeoutMs: number;
      maxTokens: number;
      temperature?: number;
      promptSizeKB: number;
      startedAtMs: number;
      openaiDurationMs?: number;
      outcome: 'success' | 'timeout' | 'openai_error' | 'parse_error' | 'validation_error' | 'unknown_error';
      errorMessage?: string;
    }>;
    narrativeSource?: 'openai' | 'local' | 'none';
    narrativePresent?: boolean;
    specHasAiReportAfterStrip?: boolean;
    aiReportByVersionKeys?: string[];
    aiReportByVersionLens?: { A: number; B: number; C: number };
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `v2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Timing helper for logging durations
 */
class Timer {
  private startTime: number;
  private requestId: string;
  private marks: Map<string, number> = new Map();
  
  constructor(requestId: string) {
    this.startTime = Date.now();
    this.requestId = requestId;
  }
  
  mark(label: string): void {
    this.marks.set(label, Date.now() - this.startTime);
  }
  
  elapsed(): number {
    return Date.now() - this.startTime;
  }
  
  log(message: string): void {
    console.log(`[${this.requestId}] +${this.elapsed()}ms ${message}`);
  }
  
  summary(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  requestId: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[${requestId}] OpenAI request timed out after ${timeoutMs}ms`);
      throw new Error(`TIMEOUT: OpenAI request exceeded ${timeoutMs}ms limit`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build safe minimal response when generation fails
 */
function buildSafeMinimalResponse(
  warnings: WarningV2[],
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  instrumentDesignRules: string[],
  teacherReminders: TeacherReminderV2[]
): V2Response {
  return {
    success: false,
    evaluationSpec: null,
    requestedVersions,
    instrumentDesignRulesApplied: instrumentDesignRules,
    teacherRemindersByStudent: teacherReminders,
    aiReport: null,
    warnings: [
      ...warnings,
      {
        code: 'GENERATION_FAILED',
        message: 'La generación de la evaluación falló. Por favor intente nuevamente.',
        severity: 'error'
      }
    ]
  };
}

// Deterministic fallback narratives when model or secondary call omit byVersion.B/C
const FALLBACK_A_NARRATIVE = 'Reporte de diseño. Contenidos y competencias alineados con la evaluación.';
const FALLBACK_B_NARRATIVE = 'Versión B (adaptación de contenido): esta versión presenta las mismas consignas con vocabulario más accesible, oraciones más cortas y mayor andamiaje (instrucciones paso a paso, ejemplos). Se preserva la misma demanda cognitiva y los objetivos de evaluación que en la Versión A.';
const FALLBACK_C_NARRATIVE = 'Versión C (adaptación excepcional): esta versión ofrece adecuaciones adicionales respecto a A y B (estructura más guiada, plantillas, mayor apoyo visual o textual). Mantiene los mismos objetivos de aprendizaje y criterios de evaluación.';

/**
 * Guarantees byVersion.A always exists and is non-empty; byVersion.B/C when effectiveRequestedVersions.B/C.
 * Uses existing narratives when non-empty, else deterministic fallbacks. Removes B/C when not effective.
 * Sets aiReport.narrative to byVersion.A.narrative when missing/empty.
 * Works on both AIReportV2 and normalized Record (for safety pass before return).
 */
function ensureByVersionNarratives<T extends { byVersion?: Record<string, { narrative?: string }>; narrative?: string }>(
  aiReport: T,
  effectiveRequestedVersions: { A: boolean; B: boolean; C: boolean },
  _meta: { subject?: string; grade?: string; groupName?: string }
): T {
  const bv: Record<string, { narrative: string }> = aiReport.byVersion && typeof aiReport.byVersion === 'object' ? { ...aiReport.byVersion } : {};
  const narrativeA = (bv.A?.narrative && bv.A.narrative.trim().length > 0)
    ? bv.A.narrative.trim()
    : (aiReport.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length > 0)
      ? aiReport.narrative.trim()
      : FALLBACK_A_NARRATIVE;
  bv.A = { narrative: narrativeA };
  if (effectiveRequestedVersions.B) {
    const existingB = bv.B?.narrative?.trim();
    bv.B = { narrative: existingB && existingB.length > 0 ? existingB : FALLBACK_B_NARRATIVE };
  } else {
    delete bv.B;
  }
  if (effectiveRequestedVersions.C) {
    const existingC = bv.C?.narrative?.trim();
    bv.C = { narrative: existingC && existingC.length > 0 ? existingC : FALLBACK_C_NARRATIVE };
  } else {
    delete bv.C;
  }
  const outNarrative = (aiReport.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length > 0)
    ? aiReport.narrative.trim()
    : narrativeA;
  return { ...aiReport, byVersion: bv, narrative: outNarrative } as T;
}

/**
 * Normalize aiReport from backend format to frontend contract (AIDesignReportData)
 * 
 * Maps:
 * - designRationale -> rationale
 * - versionsExplanation -> versions
 * - contemplacionesApplied -> contemplaciones
 * - responseOptions -> response_options
 * 
 * Preserves narrative when backend provides it as a non-empty string.
 * Robust: when requestedVersions.B/C is true but bv.B/bv.C missing/empty, uses FALLBACK_B/C_NARRATIVE.
 */
function normalizeAiReportForFrontend(
  backendReport: AIReportV2,
  spec: EvaluationSpecV2,
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): Record<string, unknown> {
  // Build normalized report matching AIDesignReportData contract
  const normalized: Record<string, unknown> = {};
  
  // CRITICAL: Preserve backend narrative exactly if present and non-empty
  if (typeof backendReport.narrative === 'string') {
    const trimmedNarrative = backendReport.narrative.trim();
    if (trimmedNarrative.length > 0) {
      normalized.narrative = trimmedNarrative;
      console.log(`[AI_REPORT] normalizeAiReportForFrontend: ✓ Narrative included in normalized report (len=${trimmedNarrative.length})`);
    }
  }

  // Per-version report (byVersion) - MUST always be present; ensure A exists; B/C when requested (use fallback if missing/empty)
  const globalFallback = typeof backendReport.narrative === 'string' && backendReport.narrative.trim().length > 0
    ? backendReport.narrative.trim()
    : FALLBACK_A_NARRATIVE;
  const bv = backendReport.byVersion && typeof backendReport.byVersion === 'object' ? (backendReport.byVersion as Record<string, { narrative?: string }>) : {} as Record<string, { narrative?: string }>;
  const out: Record<string, { narrative: string }> = {};
  out.A = (bv.A && typeof bv.A.narrative === 'string' && bv.A.narrative.trim().length > 0)
    ? { narrative: bv.A.narrative.trim() }
    : { narrative: globalFallback };
  if (requestedVersions.B) {
    out.B = (bv.B && typeof bv.B.narrative === 'string' && bv.B.narrative.trim().length > 0)
      ? { narrative: bv.B.narrative.trim() }
      : { narrative: FALLBACK_B_NARRATIVE };
  }
  if (requestedVersions.C) {
    out.C = (bv.C && typeof bv.C.narrative === 'string' && bv.C.narrative.trim().length > 0)
      ? { narrative: bv.C.narrative.trim() }
      : { narrative: FALLBACK_C_NARRATIVE };
  }
  normalized.byVersion = out;

  // rationale (from designRationale)
  if (backendReport.designRationale) {
    normalized.rationale = backendReport.designRationale;
  }
  
  // versions (from versionsExplanation)
  if (backendReport.versionsExplanation) {
    const versions: Record<string, unknown> = {};
    if (backendReport.versionsExplanation.generated) {
      versions.generated = backendReport.versionsExplanation.generated;
      versions.count = backendReport.versionsExplanation.generated.length;
    }
    
    // Build reason from notGenerated or generate default
    if (backendReport.versionsExplanation.notGenerated && Object.keys(backendReport.versionsExplanation.notGenerated).length > 0) {
      const reasons = Object.entries(backendReport.versionsExplanation.notGenerated)
        .map(([version, reason]) => `Versión ${version}: ${reason}`)
        .join('; ');
      versions.reason = reasons;
    } else if (backendReport.versionsExplanation.generated.length > 1) {
      // Generate default reason if multiple versions
      const versionDescriptions: string[] = [];
      if (backendReport.versionsExplanation.generated.includes('B')) {
        versionDescriptions.push('Versión B adapta formato y estructura');
      }
      if (backendReport.versionsExplanation.generated.includes('C')) {
        versionDescriptions.push('Versión C ofrece adecuación excepcional');
      }
      if (versionDescriptions.length > 0) {
        versions.reason = `Versión A es universal; ${versionDescriptions.join('; ')}. Todas mantienen la misma demanda cognitiva.`;
      }
    }
    
    if (Object.keys(versions).length > 0) {
      normalized.versions = versions;
    }
  }
  
  // contemplaciones (from contemplacionesApplied)
  if (backendReport.contemplacionesApplied) {
    const contemplaciones: Record<string, unknown> = {};
    
    if (backendReport.contemplacionesApplied.instrumentDesign && backendReport.contemplacionesApplied.instrumentDesign.length > 0) {
      contemplaciones.instrument_design = backendReport.contemplacionesApplied.instrumentDesign;
    }
    
    // Note: admin_reminders and correction_reminders are counts in backend, not arrays
    // Per user request: omit if only counts exist (don't invent arrays)
    
    if (Object.keys(contemplaciones).length > 0) {
      normalized.contemplaciones = contemplaciones;
    }
  }
  
  // response_options (from responseOptions)
  if (backendReport.responseOptions) {
    const responseOptions: Record<string, unknown> = {};
    
    if (backendReport.responseOptions.included !== undefined) {
      responseOptions.included = backendReport.responseOptions.included;
    }
    
    if (backendReport.responseOptions.count !== undefined) {
      responseOptions.optionCount = backendReport.responseOptions.count;
    }
    
    if (backendReport.responseOptions.reason) {
      responseOptions.rationale = backendReport.responseOptions.reason;
    }
    
    // location: where equivalent response options appear
    if (backendReport.responseOptions.included) {
      responseOptions.location = 'items.equivalentResponseOptions';
    }
    
    if (Object.keys(responseOptions).length > 0) {
      normalized.response_options = responseOptions;
    }
  }
  
  // varkSummary (if exists)
  if (backendReport.varkSummary) {
    normalized.vark = {
      summary: backendReport.varkSummary
    };
  }
  
  return normalized;
}

/**
 * Infer content coverage from available data sources
 * 
 * Extracts 3-6 content focuses and maps them to sections/items.
 * Returns structured data for narrative generation.
 */
function inferContentCoverage(
  spec: EvaluationSpecV2,
  groupContext?: { content?: string[]; competencies?: string[]; criteriosLogro?: string[] },
  modification?: string,
  designPlan?: Record<string, unknown>
): {
  source: 'source' | 'anep' | 'requirements' | 'inferred';
  focuses: Array<{
    focus: string;
    sections: string[];
    itemTypes: string[];
  }>;
  hasSourceMaterial: boolean;
  hasANEP: boolean;
  hasRequirements: boolean;
} {
  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  const contents = spec.meta?.contentIds || groupContext?.content || [];
  const competencies = spec.meta?.competencyIds || groupContext?.competencies || [];
  const criteriosLogro = spec.meta?.criteriosLogro || groupContext?.criteriosLogro || [];
  const hasModification = modification && modification.trim().length > 0;
  
  // Check for source material in design plan or items
  let hasSourceMaterial = false;
  sections.forEach(section => {
    if (Array.isArray(section.items)) {
      section.items.forEach(item => {
        if (item.source && (item.source.content || item.source.url)) {
          hasSourceMaterial = true;
        }
      });
    }
  });
  
  // Check for ANEP data
  const hasANEP = Boolean(competencies.length > 0 || criteriosLogro.length > 0 || 
                  (designPlan && typeof designPlan === 'object' && 
                   (designPlan.anepContents || designPlan.curricularFocus)));
  
  // Check for teacher requirements
  const hasRequirements = Boolean(hasModification || 
                         (designPlan && typeof designPlan === 'object' && 
                          (designPlan.teacherRequirements || designPlan.requirements)));
  
  // Determine source type
  let sourceType: 'source' | 'anep' | 'requirements' | 'inferred' = 'inferred';
  if (hasSourceMaterial) {
    sourceType = 'source';
  } else if (hasANEP) {
    sourceType = 'anep';
  } else if (hasRequirements) {
    sourceType = 'requirements';
  }
  
  // Extract content focuses
  const focuses: Array<{ focus: string; sections: string[]; itemTypes: string[] }> = [];
  
  if (contents.length > 0) {
    // Use provided contents (up to 6)
    const selectedContents = contents.slice(0, 6);
    selectedContents.forEach((content, idx) => {
      // Find sections/items that might relate to this content
      const relatedSections: string[] = [];
      const relatedItemTypes = new Set<string>();
      
      sections.forEach((section, sectionIdx) => {
        if (idx < sections.length && sectionIdx === idx) {
          relatedSections.push(section.title || `Sección ${sectionIdx + 1}`);
          
          if (Array.isArray(section.items)) {
            section.items.forEach(item => {
              if (item.type) {
                relatedItemTypes.add(item.type);
              }
            });
          }
        }
      });
      
      // If no direct mapping, use first sections
      if (relatedSections.length === 0 && sections.length > 0) {
        const sectionIdx = Math.min(idx, sections.length - 1);
        relatedSections.push(sections[sectionIdx].title || `Sección ${sectionIdx + 1}`);
        
        if (Array.isArray(sections[sectionIdx].items)) {
          sections[sectionIdx].items.forEach(item => {
            if (item.type) {
              relatedItemTypes.add(item.type);
            }
          });
        }
      }
      
      focuses.push({
        focus: content,
        sections: relatedSections.length > 0 ? relatedSections : ['Secciones generales'],
        itemTypes: Array.from(relatedItemTypes)
      });
    });
  } else if (sections.length > 0) {
    // Infer from section titles and prompts
    const maxFocuses = Math.min(6, sections.length);
    sections.slice(0, maxFocuses).forEach((section, idx) => {
      const itemTypes = new Set<string>();
      if (Array.isArray(section.items)) {
        section.items.forEach(item => {
          if (item.type) {
            itemTypes.add(item.type);
          }
        });
      }
      
      // Extract focus from section title or first item prompt
      let focusText = section.title || `Contenido ${idx + 1}`;
      if (Array.isArray(section.items) && section.items.length > 0 && section.items[0].prompt) {
        // Use first 50 chars of first item prompt as hint
        const promptHint = section.items[0].prompt.slice(0, 50).trim();
        if (promptHint.length > 0) {
          focusText = `${section.title || 'Contenido'}: ${promptHint}...`;
        }
      }
      
      focuses.push({
        focus: focusText,
        sections: [section.title || `Sección ${idx + 1}`],
        itemTypes: Array.from(itemTypes)
      });
    });
  }
  
  return {
    source: sourceType,
    focuses: focuses.slice(0, 6), // Limit to 6
    hasSourceMaterial,
    hasANEP,
    hasRequirements
  };
}

/**
 * Build teacher-friendly narrative report (LOCAL ONLY, BEST-EFFORT)
 * 
 * Generates narrative deterministically using only global/teacher-safe data.
 * 
 * CRITICAL: This function MUST NOT throw or affect success:true.
 * All errors are caught and returned as warnings.
 */
function buildNarrativeLocal(
  spec: EvaluationSpecV2,
  versionsExplanation: { generated: string[]; notGenerated?: Record<string, string> },
  contemplacionesApplied: { instrumentDesign: string[]; adminReminders: number; correctionReminders: number },
  responseOptions: { included: boolean; count?: number; reason?: string },
  groupContext?: { content?: string[]; competencies?: string[]; criteriosLogro?: string[] },
  modification?: string,
  designPlan?: Record<string, unknown>
): string {
  // Extract teacher-safe global data
  const subject = spec.meta?.subject || 'la materia';
  const gradeLevel = spec.meta?.gradeLevel || '';
  const totalPoints = spec.meta?.totalPoints || 0;
  const durationMinutes = spec.meta?.duration?.minutes || 90;
  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  const sectionCount = sections.length;
  
  // Extract contents to evaluate
  const contents = spec.meta?.contentIds || groupContext?.content || [];
  const competencies = spec.meta?.competencyIds || groupContext?.competencies || [];
  const criteriosLogro = spec.meta?.criteriosLogro || groupContext?.criteriosLogro || [];
  
  // Extract item types used in the evaluation
  const itemTypes = new Set<string>();
  sections.forEach(section => {
    if (Array.isArray(section.items)) {
      section.items.forEach(item => {
        if (item.type) {
          itemTypes.add(item.type);
        }
      });
    }
  });
  const itemTypesArray = Array.from(itemTypes);
  
  // Get section titles (high-level only)
  const sectionTitles = sections
    .slice(0, 5) // Limit to first 5 to keep it concise
    .map(s => s.title || '')
    .filter(t => t.length > 0);
  
  // Build narrative: 1st paragraph - WHAT CONTENTS WERE EVALUATED
  let firstParagraph = `Esta evaluación fue diseñada para ${subject}${gradeLevel ? ` (${gradeLevel})` : ''}. `;
  
  if (contents.length > 0) {
    const contentsText = contents.slice(0, 5).join(', ') + (contents.length > 5 ? ' y otros' : '');
    firstParagraph += `Se enfoca en evaluar los siguientes contenidos: ${contentsText}. `;
  }
  
  firstParagraph += `Consta de ${sectionCount} sección${sectionCount !== 1 ? 'es' : ''} con un total de ${totalPoints} puntos ` +
    `y una duración estimada de ${durationMinutes} minutos.`;
  
  if (sectionTitles.length > 0) {
    firstParagraph += ` La evaluación está organizada en: ${sectionTitles.join(', ')}${sectionTitles.length < sectionCount ? ' y otras secciones' : ''}.`;
  }
  
  // Build second paragraph - WHY THOSE CONTENTS WERE SELECTED
  const selectionReasons: string[] = [];
  
  if (modification && modification.trim().length > 0) {
    selectionReasons.push('los requerimientos específicos del docente fueron considerados en la selección de contenidos');
  }
  
  if (competencies.length > 0) {
    const compsText = competencies.slice(0, 3).join(', ') + (competencies.length > 3 ? ' y otras' : '');
    selectionReasons.push(`las competencias ${compsText} guiaron la priorización de los contenidos`);
  }
  
  if (criteriosLogro.length > 0) {
    selectionReasons.push('los criterios de logro establecidos orientaron la selección');
  }
  
  let secondParagraph = '';
  if (selectionReasons.length > 0) {
    secondParagraph = `Estos contenidos fueron seleccionados porque ${selectionReasons.join(', ')}. `;
  } else if (contents.length > 0) {
    secondParagraph = `La selección de estos contenidos responde a su relevancia pedagógica y alineación con los objetivos de aprendizaje del nivel. `;
  }
  
  // Build third paragraph - HOW CONTENTS WERE EVALUATED (item types / approach)
  let thirdParagraph = '';
  if (itemTypesArray.length > 0) {
    const itemTypeNames: Record<string, string> = {
      'multiple_choice': 'opción múltiple',
      'true_false': 'verdadero/falso',
      'true_false_justify': 'verdadero/falso con justificación',
      'short_answer': 'respuesta corta',
      'paragraph': 'párrafo',
      'essay': 'ensayo',
      'source_analysis': 'análisis de fuentes',
      'table_completion': 'completar tabla',
      'matching': 'relacionar',
      'ordering': 'ordenar'
    };
    
    const itemTypesSpanish = itemTypesArray
      .map(type => itemTypeNames[type] || type)
      .filter(Boolean);
    
    if (itemTypesSpanish.length > 0) {
      thirdParagraph = `La evaluación utiliza una variedad de tipos de items: ${itemTypesSpanish.join(', ')}. `;
      
      if (itemTypesArray.includes('multiple_choice') || itemTypesArray.includes('true_false')) {
        thirdParagraph += 'Los items de selección permiten verificar conocimientos factuales y comprensión básica. ';
      }
      
      if (itemTypesArray.includes('essay') || itemTypesArray.includes('paragraph')) {
        thirdParagraph += 'Los items de desarrollo evalúan la capacidad de síntesis, argumentación y expresión escrita. ';
      }
      
      if (itemTypesArray.includes('source_analysis')) {
        thirdParagraph += 'El análisis de fuentes permite evaluar pensamiento crítico y capacidad de interpretación. ';
      }
      
      thirdParagraph += 'Esta diversidad de formatos permite abordar diferentes dimensiones de los contenidos, desde la memorización hasta la aplicación y el análisis.';
    }
  }
  
  // Build bullet list: "Decisiones de diseño"
  const decisiones: string[] = [];
  
  // Versions
  if (versionsExplanation.generated.length > 1) {
    const versionDescriptions: string[] = [];
    if (versionsExplanation.generated.includes('B')) {
      versionDescriptions.push('Versión B adapta el formato y estructura para mayor claridad');
    }
    if (versionsExplanation.generated.includes('C')) {
      versionDescriptions.push('Versión C ofrece adecuación excepcional de contenido');
    }
    
    if (versionDescriptions.length > 0) {
      decisiones.push(
        `• Se generaron ${versionsExplanation.generated.length} versiones (${versionsExplanation.generated.join(', ')}): ` +
        `Versión A es universal; ${versionDescriptions.join('; ')}. ` +
        `Todas las versiones mantienen la misma demanda cognitiva y evalúan los mismos objetivos de aprendizaje.`
      );
    }
  }
  
  // Response options
  if (responseOptions.included && responseOptions.count) {
    decisiones.push(
      `• Se incluyeron opciones de respuesta equivalentes (${responseOptions.count} formatos por item elegible). ` +
      `Los estudiantes pueden elegir el formato que mejor se adapte a su forma de expresar su comprensión, ` +
      `sin que esto reduzca la dificultad o la evidencia requerida.`
    );
  }
  
  // Instrument design rules
  if (contemplacionesApplied.instrumentDesign.length > 0) {
    const rulesExamples = contemplacionesApplied.instrumentDesign.slice(0, 5).join(', ');
    decisiones.push(
      `• Se aplicaron adaptaciones al instrumento: ${rulesExamples}${contemplacionesApplied.instrumentDesign.length > 5 ? ' y otras' : ''}.`
    );
  }
  
  // Infer content coverage
  let contentCoverageBlock = '';
  try {
    const coverage = inferContentCoverage(spec, groupContext, modification, designPlan);
    
    // Log coverage source (for debugging)
    const DEBUG = false; // Set to true for debugging
    if (DEBUG) {
      console.log(`[CONTENT_COVERAGE] source=${coverage.source}, focuses=${coverage.focuses.length}, hasSource=${coverage.hasSourceMaterial}, hasANEP=${coverage.hasANEP}, hasRequirements=${coverage.hasRequirements}`);
    }
    
    // Build Content Coverage block
    contentCoverageBlock = '\n\nCobertura de Contenidos:\n';
    
    if (coverage.source === 'inferred') {
      contentCoverageBlock += 'No se proporcionaron materiales fuente, enfoques curriculares ANEP o requerimientos específicos del docente, por lo que el foco de contenido se infirió de las secciones y prompts generados.\n\n';
    } else if (coverage.source === 'source') {
      contentCoverageBlock += 'Los contenidos evaluados se basan en los materiales fuente proporcionados. ';
      if (!coverage.hasSourceMaterial) {
        contentCoverageBlock += 'Nota: No se proporcionó texto fuente completo, por lo que se trabajó con la información disponible.\n\n';
      } else {
        contentCoverageBlock += '\n\n';
      }
    } else if (coverage.source === 'anep') {
      contentCoverageBlock += 'Los contenidos evaluados se seleccionaron según los enfoques curriculares ANEP y competencias especificadas.\n\n';
    } else if (coverage.source === 'requirements') {
      contentCoverageBlock += 'Los contenidos evaluados responden a los requerimientos específicos del docente.\n\n';
    }
    
    // List content focuses with mapping
    if (coverage.focuses.length > 0) {
      const itemTypeNames: Record<string, string> = {
        'multiple_choice': 'opción múltiple',
        'true_false': 'verdadero/falso',
        'true_false_justify': 'verdadero/falso con justificación',
        'short_answer': 'respuesta corta',
        'paragraph': 'párrafo',
        'essay': 'ensayo',
        'source_analysis': 'análisis de fuentes',
        'table_completion': 'completar tabla',
        'matching': 'relacionar',
        'ordering': 'ordenar'
      };
      
      coverage.focuses.forEach((focusData, idx) => {
        const itemTypesText = focusData.itemTypes
          .map(type => itemTypeNames[type] || type)
          .filter(Boolean)
          .join(', ');
        
        contentCoverageBlock += `${idx + 1}. ${focusData.focus}: `;
        contentCoverageBlock += `evaluado en ${focusData.sections.join(', ')} `;
        if (itemTypesText) {
          contentCoverageBlock += `mediante items de ${itemTypesText}`;
        }
        contentCoverageBlock += '.\n';
      });
    }
  } catch (error) {
    // Silent fail - don't break narrative generation
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (false) { // DEBUG flag
      console.log(`[CONTENT_COVERAGE] Error generating coverage block: ${errorMsg}`);
    }
    // Add fallback message
    contentCoverageBlock = '\n\nCobertura de Contenidos:\nNo se pudo generar el análisis detallado de cobertura de contenidos. Los contenidos evaluados se infirieron de las secciones y items generados.\n';
  }
  
  // Combine narrative parts
  const narrativeParts: string[] = [firstParagraph];
  
  if (secondParagraph) {
    narrativeParts.push('\n\n' + secondParagraph);
  }
  
  if (thirdParagraph) {
    narrativeParts.push('\n\n' + thirdParagraph);
  }
  
  if (decisiones.length > 0) {
    narrativeParts.push('\n\nDecisiones de diseño:\n' + decisiones.join('\n'));
  }
  
  // Add Content Coverage block AFTER existing content
  if (contentCoverageBlock) {
    narrativeParts.push(contentCoverageBlock);
  }
  
  // Closing sentence: teacher-only, student-specific reminders are delivered separately
  const totalReminders = contemplacionesApplied.adminReminders + contemplacionesApplied.correctionReminders;
  if (totalReminders > 0) {
    narrativeParts.push(
      `\n\nLos recordatorios específicos por estudiante (${totalReminders} totales: ` +
      `${contemplacionesApplied.adminReminders} administrativos, ${contemplacionesApplied.correctionReminders} de corrección) ` +
      `se entregan aparte; este reporte es global.`
    );
  } else {
    narrativeParts.push(
      `\n\nLos recordatorios específicos por estudiante se entregan aparte; este reporte es global.`
    );
  }
  
  let narrative = narrativeParts.join('');
  
  // Ensure word count is reasonable (120-220 words target)
  const wordCount = narrative.split(/\s+/).length;
  if (wordCount < 120) {
    // Add closing note if too short
    narrative += ' Esta evaluación fue generada automáticamente y puede ser editada según las necesidades del grupo.';
  } else if (wordCount > 220) {
    // Truncate if too long (keep first ~200 words)
    const words = narrative.split(/\s+/);
    narrative = words.slice(0, 200).join(' ') + '...';
  }
  
  return narrative;
}

const NARRATIVE_ONLY_TIMEOUT_MS = 15000;
const MIN_NARRATIVE_LENGTH = 200;

/**
 * When local/fallback narrative is too short (<200 chars), call OpenAI once to generate narrative only.
 * Ensures narrative explicitly includes: content evaluated, competencies, teacher requirements, materials/session.
 */
async function generateNarrativeOnlyCall(
  spec: EvaluationSpecV2,
  groupContext: Record<string, unknown>,
  modification: string,
  designPlan: Record<string, unknown> | undefined,
  requestId: string,
  timer: Timer
): Promise<string | null> {
  const subject = spec.meta?.subject || groupContext?.subject || 'la materia';
  const contents = (spec.meta?.contentIds || groupContext?.content || []) as string[];
  const competencies = (spec.meta?.competencyIds || groupContext?.competencies || []) as string[];
  const sectionCount = spec.sections?.length ?? 0;
  const durationMinutes = spec.meta?.duration?.minutes ?? 90;
  const rules = (designPlan?.instrumentDesignRules as string[] | undefined) || [];
  const userPrompt = `Genera un único párrafo narrativo (8-15 líneas) para el docente sobre esta evaluación.

REQUISITOS OBLIGATORIOS (incluir explícitamente):
1. Qué contenidos se evaluaron: ${contents.slice(0, 5).join(', ') || 'contenidos del programa'}
2. Cómo se alinean con las competencias seleccionadas: ${competencies.slice(0, 3).join(', ') || 'competencias del nivel'}
3. Cómo se aplicaron los requerimientos del docente: ${(modification || '').trim().slice(0, 200) || 'sin requerimientos adicionales'}
4. Si hay reglas de diseño del instrumento: ${rules.slice(0, 3).join('; ') || 'ninguna específica'}

Contexto: Materia ${subject}, ${sectionCount} sección(es), duración estimada ${durationMinutes} min.
Responde ÚNICAMENTE con el texto del párrafo narrativo, sin encabezados ni JSON.`;

  try {
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente que escribe reportes narrativos pedagógicos para docentes. Responde solo con el texto solicitado, en español.' },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 800,
          temperature: 0.5
        }),
      },
      NARRATIVE_ONLY_TIMEOUT_MS,
      requestId
    );
    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim?.();
    if (typeof text === 'string' && text.length >= MIN_NARRATIVE_LENGTH) {
      timer.log(`[AI_REPORT] Narrative-only call returned ${text.length} chars`);
      return text;
    }
  } catch (e) {
    timer.log(`[AI_REPORT] Narrative-only call failed: ${e}`);
  }
  return null;
}

const BYVERSION_ONLY_TIMEOUT_MS = 15000;

/**
 * When multiple versions (B/C) exist but parsed output lacks byVersion or has empty B/C narratives,
 * one fast OpenAI call to generate missing byVersion narratives (single JSON response).
 */
async function generateMissingByVersionNarrativesCall(
  spec: EvaluationSpecV2,
  effectiveRequestedVersions: { A: boolean; B: boolean; C: boolean },
  existingNarrativeA: string,
  requestId: string,
  timer: Timer
): Promise<Record<string, { narrative: string }> | null> {
  const needed = ['A' as const, ...(effectiveRequestedVersions.B ? ['B' as const] : []), ...(effectiveRequestedVersions.C ? ['C' as const] : [])];
  if (needed.length <= 1) return null;
  const subject = spec.meta?.subject || 'la materia';
  const sectionCount = spec.sections?.length ?? 0;
  const userPrompt = `Genera un objeto JSON con reportes narrativos por versión para una evaluación de ${subject} (${sectionCount} secciones).

Contexto del reporte global / Versión A (resumen): ${existingNarrativeA.slice(0, 500)}

Requisitos por versión:
- A: Contenidos evaluados, alineación con competencias/criterios, requerimientos del docente, materiales/sesión si hay. Misma demanda cognitiva.
- B: Describir explícitamente cómo los prompts de B difieren de A (simplificación: vocabulario, estructura, andamiaje). Estrategia de simplificación pedagógica. Confirmar misma demanda cognitiva y competencias.
- C: Diferencias con A y B. Estrategia de adaptación excepcional (andamiaje más fuerte, plantillas). Confirmar mismos objetivos de aprendizaje y competencias.

Genera un JSON con esta forma exacta (solo el objeto, sin markdown):
{
  "byVersion": {
    "A": { "narrative": "<6-10 líneas>" }
    ${effectiveRequestedVersions.B ? ', "B": { "narrative": "<5-8 líneas: diferencias con A, simplificación, misma dificultad>" }' : ''}
    ${effectiveRequestedVersions.C ? ', "C": { "narrative": "<5-8 líneas: adaptación excepcional, mismos objetivos>" }' : ''}
  }
}

Responde ÚNICAMENTE con el JSON. Sin explicaciones ni \`\`\`json.`;

  try {
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente que genera reportes pedagógicos en JSON. Responde solo con el objeto JSON solicitado, en español.' },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 1200,
          temperature: 0.4
        }),
      },
      BYVERSION_ONLY_TIMEOUT_MS,
      requestId
    );
    if (!response.ok) return null;
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim?.();
    if (typeof raw !== 'string' || raw.length < 50) return null;
    const parsed = (() => {
      try {
        const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
        return JSON.parse(cleaned) as { byVersion?: Record<string, { narrative?: string }> };
      } catch {
        return null;
      }
    })();
    if (!parsed?.byVersion || typeof parsed.byVersion !== 'object') return null;
    const out: Record<string, { narrative: string }> = {};
    for (const key of needed) {
      const entry = (parsed.byVersion as Record<string, { narrative?: string }>)[key];
      const narrative = typeof entry?.narrative === 'string' ? entry.narrative.trim() : '';
      if (narrative.length >= 100) out[key] = { narrative };
    }
    if (Object.keys(out).length > 0) {
      timer.log(`[AI_REPORT] ByVersion-only call returned: ${Object.keys(out).join(', ')}`);
      return out;
    }
  } catch (e) {
    timer.log(`[AI_REPORT] ByVersion-only call failed: ${e}`);
  }
  return null;
}

function isOpenEndedItemType(type: unknown): boolean {
  if (typeof type !== 'string') return false;
  const t = type.toLowerCase();
  return (
    t === 'essay' ||
    t === 'paragraph' ||
    t === 'short_answer' ||
    t === 'source_analysis' ||
    t === 'true_false_justify' ||
    t === 'justify'
  );
}

function buildFallbackRubric(itemPrompt: string, itemPoints: number): ItemRubricV2 {
  const safePoints = Number.isFinite(itemPoints) && itemPoints > 0 ? itemPoints : 4;
  const rounded = Math.max(1, Math.round(safePoints));
  const highMin = Math.max(0, rounded - 1);
  const midUpper = Math.max(1, highMin - 1);
  const lowUpper = Math.max(0, Math.min(midUpper - 1, Math.round(rounded / 2)));

  const promptHint = (itemPrompt || 'la consigna').trim().slice(0, 100);

  return {
    levels: [
      {
        key: 'excelente',
        label: 'Excelente',
        descriptor: `Responde ${promptHint} con precisión, profundidad y evidencia pertinente.`,
        minPoints: rounded,
        maxPoints: rounded,
      },
      {
        key: 'bueno',
        label: 'Bueno',
        descriptor: `Responde ${promptHint} correctamente con alguna evidencia, pero con menor desarrollo.`,
        minPoints: highMin,
        maxPoints: highMin,
      },
      {
        key: 'en_proceso',
        label: 'En proceso',
        descriptor: `Responde de forma parcial: identifica ideas relevantes, pero con vacíos o imprecisiones.`,
        minPoints: lowUpper + 1,
        maxPoints: midUpper,
      },
      {
        key: 'insuficiente',
        label: 'Insuficiente',
        descriptor: `No logra responder la consigna de forma suficiente o presenta errores conceptuales relevantes.`,
        minPoints: 0,
        maxPoints: lowUpper,
      },
    ],
  };
}

function normalizeAndValidateRubric(
  rubric: unknown,
  itemPrompt: string,
  itemPoints: number
): ItemRubricV2 | null {
  if (!rubric || typeof rubric !== 'object') return null;
  const r = rubric as Record<string, unknown>;
  if (!Array.isArray(r.levels)) return null;

  const levels = r.levels
    .map((level) => {
      if (!level || typeof level !== 'object') return null;
      const l = level as Record<string, unknown>;
      const key = typeof l.key === 'string' ? l.key.trim() : '';
      const label = typeof l.label === 'string' ? l.label.trim() : '';
      const descriptor = typeof l.descriptor === 'string' ? l.descriptor.trim() : '';
      if (!key || !label || !descriptor) return null;
      if (descriptor.length < 12) return null;
      return {
        key,
        label,
        descriptor,
        minPoints: typeof l.minPoints === 'number' ? l.minPoints : undefined,
        maxPoints: typeof l.maxPoints === 'number' ? l.maxPoints : undefined,
      };
    })
    .filter((l): l is RubricLevelV2 => l !== null);

  if (levels.length < 4) return null;

  const points = Number.isFinite(itemPoints) ? itemPoints : 0;
  if (points > 0) {
    for (const level of levels) {
      if (level.minPoints !== undefined && level.minPoints > points) {
        level.minPoints = points;
      }
      if (level.maxPoints !== undefined && level.maxPoints > points) {
        level.maxPoints = points;
      }
      if (
        level.minPoints !== undefined &&
        level.maxPoints !== undefined &&
        level.minPoints > level.maxPoints
      ) {
        const tmp = level.minPoints;
        level.minPoints = level.maxPoints;
        level.maxPoints = tmp;
      }
    }
  }

  return { levels };
}

function ensureOpenEndedRubrics(spec: Record<string, unknown>): WarningV2[] {
  const warnings: WarningV2[] = [];
  const sections = Array.isArray(spec.sections) ? spec.sections : [];

  sections.forEach((section, sectionIdx) => {
    if (!section || typeof section !== 'object') return;
    const s = section as Record<string, unknown>;
    const items = Array.isArray(s.items) ? s.items : [];

    items.forEach((item, itemIdx) => {
      if (!item || typeof item !== 'object') return;
      const i = item as Record<string, unknown>;
      if (!isOpenEndedItemType(i.type)) return;

      const prompt = typeof i.prompt === 'string' ? i.prompt : `ítem ${itemIdx + 1}`;
      const points = typeof i.points === 'number' ? i.points : 4;
      const normalizedRubric = normalizeAndValidateRubric(i.rubric, prompt, points);

      if (normalizedRubric) {
        i.rubric = normalizedRubric;
        return;
      }

      i.rubric = buildFallbackRubric(prompt, points);
      warnings.push({
        code: 'OPEN_ENDED_RUBRIC_FALLBACK_APPLIED',
        message: `Se aplicó rúbrica de respaldo en sección ${sectionIdx + 1}, ítem ${itemIdx + 1} (${String(i.type)}).`,
        severity: 'warning',
      });
    });
  });

  return warnings;
}

/**
 * Build emergency template spec when OpenAI fails completely (non-AI fallback)
 * 
 * Returns a minimal but VALID EvaluationSpecV2 that can be used when both attempts fail.
 * This ensures V2 never falls back to V1 due to OpenAI unavailability.
 */
function buildEmergencyTemplateSpec(
  groupContext: {
    subject?: string;
    gradeLevel?: string;
    groupName?: string;
    students?: Array<{ studentId: string | number; displayName?: string }>;
    content?: string[];
    competencies?: string[];
    criteriosLogro?: string[];
  },
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  designPlan?: {
    instrumentDesignRules?: string[];
    responseOptions?: { include?: boolean; optionCount?: number };
  }
): EvaluationSpecV2 {
  const subject = groupContext?.subject || 'Materia no especificada';
  const gradeLevel = groupContext?.gradeLevel || '';
  const groupName = groupContext?.groupName || 'Grupo';
  const totalStudents = groupContext?.students?.length || 0;
  
  // Build minimal but valid spec
  const spec: EvaluationSpecV2 = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    meta: {
      subject,
      gradeLevel: gradeLevel || undefined,
      groupName,
      totalStudents: totalStudents > 0 ? totalStudents : undefined,
      duration: { minutes: 90 },
      totalPoints: 10,
      evaluationType: 'evaluación',
      contentIds: Array.isArray(groupContext?.content) ? groupContext.content : undefined,
      competencyIds: Array.isArray(groupContext?.competencies) ? groupContext.competencies : undefined,
      criteriosLogro: Array.isArray(groupContext?.criteriosLogro) ? groupContext.criteriosLogro : undefined
    },
    sections: [
      {
        id: 'section-emergency-1',
        title: 'Evaluación - Versión de contingencia',
        duration: 90,
        instructions: 'Esta evaluación fue generada automáticamente debido a problemas de conectividad con el servicio de IA. Por favor, revise y ajuste según sea necesario.',
        items: [
          {
            id: 'item-emergency-1',
            type: 'multiple_choice',
            prompt: `Seleccione la opción correcta sobre ${subject}${gradeLevel ? ` (${gradeLevel})` : ''}.`,
            points: 5,
            options: [
              { id: 'a', text: 'Opción A', isCorrect: true },
              { id: 'b', text: 'Opción B', isCorrect: false },
              { id: 'c', text: 'Opción C', isCorrect: false }
            ]
          },
          {
            id: 'item-emergency-2',
            type: 'essay',
            prompt: `Desarrolle una respuesta sobre ${subject}${gradeLevel ? ` (${gradeLevel})` : ''}.`,
            points: 5,
            guidingQuestions: [
              '¿Qué aspectos considera relevantes?',
              '¿Cómo se relacionan con el tema?'
            ],
            rubric: buildFallbackRubric(
              `Desarrolle una respuesta sobre ${subject}${gradeLevel ? ` (${gradeLevel})` : ''}.`,
              5
            )
          }
        ]
      }
    ],
    versionVariants: {
      A: {
        label: 'Versión A (Universal)',
        isBase: true
      }
    }
  };
  
  // Add B/C variants if requested (but mark as not generated)
  if (requestedVersions.B) {
    spec.versionVariants.B = {
      label: 'Versión B (No generada - servicio de IA no disponible)',
      isBase: false,
      reason: 'No generada debido a problemas de conectividad con el servicio de IA',
      modifications: []
    };
  }
  
  if (requestedVersions.C) {
    spec.versionVariants.C = {
      label: 'Versión C (No generada - servicio de IA no disponible)',
      isBase: false,
      reason: 'No generada debido a problemas de conectividad con el servicio de IA',
      modifications: []
    };
  }
  
  return spec;
}

/**
 * Validate and normalize the AI response
 */
function validateAndNormalizeSpec(
  rawSpec: unknown,
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): { spec: EvaluationSpecV2 | null; warnings: WarningV2[] } {
  const warnings: WarningV2[] = [];
  
  if (!rawSpec || typeof rawSpec !== 'object') {
    warnings.push({
      code: 'INVALID_SPEC_TYPE',
      message: 'La respuesta del modelo no es un objeto válido',
      severity: 'error'
    });
    return { spec: null, warnings };
  }
  
  const spec = rawSpec as Record<string, unknown>;
  
  // Validate required fields
  if (!spec.meta || typeof spec.meta !== 'object') {
    warnings.push({
      code: 'MISSING_META',
      message: 'Falta el campo meta en la especificación',
      severity: 'error'
    });
    return { spec: null, warnings };
  }
  
  if (!Array.isArray(spec.sections)) {
    warnings.push({
      code: 'MISSING_SECTIONS',
      message: 'Falta el campo sections en la especificación',
      severity: 'error'
    });
    return { spec: null, warnings };
  }

  if (spec.sections.length < 1) {
    warnings.push({
      code: 'NO_SECTIONS',
      message: 'La especificación debe tener al menos una sección',
      severity: 'error'
    });
    return { spec: null, warnings };
  }
  
  // Validate sections have items
  for (let i = 0; i < spec.sections.length; i++) {
    const section = spec.sections[i] as Record<string, unknown>;
    if (!Array.isArray(section.items)) {
      warnings.push({
        code: 'SECTION_MISSING_ITEMS',
        message: `La sección ${i + 1} no tiene items`,
        severity: 'warning'
      });
      section.items = [];
    }
  }

  // Ensure open-ended items always have a valid rubric (fallback if missing/malformed)
  warnings.push(...ensureOpenEndedRubrics(spec));
  
  // Count items with versionedContent.promptB and .promptC (for effective-version logic)
  let itemsWithPromptB = 0;
  let itemsWithPromptC = 0;
  let totalItems = 0;
  for (const section of spec.sections as Array<Record<string, unknown>>) {
    const items = section.items as Array<Record<string, unknown>>;
    for (const item of items) {
      totalItems++;
      if (item.versionedContent && typeof item.versionedContent === 'object') {
        const vc = item.versionedContent as Record<string, unknown>;
        if (vc.promptB && typeof vc.promptB === 'string' && vc.promptB.trim().length > 0) itemsWithPromptB++;
        if (vc.promptC && typeof vc.promptC === 'string' && vc.promptC.trim().length > 0) itemsWithPromptC++;
      }
    }
  }
  console.log(`[V2_VALIDATION] versionedContent: ${itemsWithPromptB}/${totalItems} items have promptB, ${itemsWithPromptC}/${totalItems} have promptC`);

  // Normalize versionVariants
  if (!spec.versionVariants || typeof spec.versionVariants !== 'object') {
    spec.versionVariants = {
      A: { label: 'Versión A (Universal)', isBase: true }
    };
  }
  
  const variants = spec.versionVariants as Record<string, unknown>;
  
  // Ensure A exists
  if (!variants.A) {
    variants.A = { label: 'Versión A (Universal)', isBase: true };
  }

  // Effective variants: only keep B/C if at least one item has that content (so UI never claims B/C exist when they don't)
  if (requestedVersions.B && totalItems > 0 && itemsWithPromptB === 0) {
    delete variants.B;
    warnings.push({
      code: 'VERSION_B_NO_CONTENT',
      message: 'Versión B solicitada pero ningún ítem tiene versionedContent.promptB. Se mostrará solo Versión A.',
      severity: 'warning'
    });
  }
  if (requestedVersions.C && totalItems > 0 && itemsWithPromptC === 0) {
    delete variants.C;
    warnings.push({
      code: 'VERSION_C_NO_CONTENT',
      message: 'Versión C solicitada pero ningún ítem tiene versionedContent.promptC. Se mostrará solo Versión A (y B si existe).',
      severity: 'warning'
    });
  }
  if (requestedVersions.B && itemsWithPromptB > 0 && itemsWithPromptB < totalItems) {
    warnings.push({
      code: 'VERSION_B_PARTIAL_CONTENT',
      message: `Solo ${itemsWithPromptB} de ${totalItems} ítems tienen versionedContent.promptB; el resto usa contenido base en B.`,
      severity: 'info'
    });
  }
  
  // Warn when B/C were requested but variant metadata missing (model didn't return variant)
  if (requestedVersions.B && !variants.B) {
    warnings.push({
      code: 'VERSION_B_MISSING',
      message: 'La versión B fue solicitada pero no fue generada.',
      severity: 'warning'
    });
  }
  if (requestedVersions.C && !variants.C) {
    warnings.push({
      code: 'VERSION_C_MISSING',
      message: 'La versión C fue solicitada pero no fue generada.',
      severity: 'warning'
    });
  }
  
  // Set version and timestamp if missing
  if (!spec.version) spec.version = '2.0';
  if (!spec.generatedAt) spec.generatedAt = new Date().toISOString();
  
  // Preserve aiReport if present (optional field, do not fail if missing)
  // Validate aiReport.narrative if present (must be string, non-empty after trim)
  if (spec.aiReport && typeof spec.aiReport === 'object') {
    const aiReport = spec.aiReport as Record<string, unknown>;
    if (aiReport.narrative !== undefined) {
      if (typeof aiReport.narrative !== 'string') {
        // Invalid type - remove it but don't fail
        delete aiReport.narrative;
        warnings.push({
          code: 'AI_REPORT_NARRATIVE_INVALID_TYPE',
          message: 'aiReport.narrative no es un string válido, se omitió',
          severity: 'warning'
        });
      } else {
        const trimmed = aiReport.narrative.trim();
        if (trimmed.length === 0) {
          // Empty after trim - remove it but don't fail
          delete aiReport.narrative;
          warnings.push({
            code: 'AI_REPORT_NARRATIVE_EMPTY',
            message: 'aiReport.narrative está vacío, se omitió',
            severity: 'warning'
          });
        } else {
          // Valid narrative - keep it
          aiReport.narrative = trimmed;
        }
      }
    }
    // Validate and trim byVersion to match actual versionVariants (only A when only A)
    if (aiReport.byVersion !== undefined && typeof aiReport.byVersion === 'object') {
      const byVersion = aiReport.byVersion as Record<string, unknown>;
      const validKeys: ('A' | 'B' | 'C')[] = ['A'];
      if (variants.B) validKeys.push('B');
      if (variants.C) validKeys.push('C');
      const trimmed: Record<string, unknown> = {};
      for (const key of validKeys) {
        const entry = byVersion[key];
        if (entry && typeof entry === 'object') {
          const e = entry as Record<string, unknown>;
          const narrative = typeof e.narrative === 'string' ? e.narrative.trim() : '';
          if (narrative.length > 0) {
            trimmed[key] = {
              narrative,
              ...(Array.isArray(e.decisionsApplied) && e.decisionsApplied.length > 0 ? { decisionsApplied: e.decisionsApplied } : {}),
              ...(Array.isArray(e.warnings) && e.warnings.length > 0 ? { warnings: e.warnings } : {})
            };
          }
        }
      }
      if (Object.keys(trimmed).length > 0) {
        aiReport.byVersion = trimmed;
      } else {
        delete aiReport.byVersion;
      }
    }
    // If aiReport exists but has no valid narrative, keep the object (it might have other fields in future)
  }
  
  return { spec: spec as unknown as EvaluationSpecV2, warnings };
}

/**
 * Derive effective requested versions from actual versionVariants in spec.
 * When only A was generated (e.g. fast fallback), return { A: true, B: false, C: false }
 * so response is coherent and no student is shown as assigned to B/C.
 */
function getEffectiveRequestedVersions(versionVariants: EvaluationSpecV2['versionVariants'] | undefined): { A: boolean; B: boolean; C: boolean } {
  if (!versionVariants || typeof versionVariants !== 'object') {
    return { A: true, B: false, C: false };
  }
  const v = versionVariants as Record<string, unknown>;
  return {
    A: true,
    B: !!v.B,
    C: !!v.C
  };
}

/**
 * Extract teacher reminders from design plan (only admin + correction, NOT allowances)
 */
function extractTeacherReminders(
  perStudentReminders: Array<{
    studentId: string | number;
    admin?: string[];
    correction?: string[];
    allowances?: string[];
  }>,
  students: Array<{ studentId: string | number; displayName?: string }>
): TeacherReminderV2[] {
  const studentMap = new Map(
    students.map(s => [String(s.studentId), s.displayName || `Estudiante ${s.studentId}`])
  );
  
  return perStudentReminders
    .filter(r => (r.admin && r.admin.length > 0) || (r.correction && r.correction.length > 0))
    .map(r => ({
      studentId: String(r.studentId),
      studentName: studentMap.get(String(r.studentId)) || `Estudiante ${r.studentId}`,
      admin: r.admin || [],
      correction: r.correction || []
      // NOTE: allowances are intentionally excluded - they go to instrumentDesignRulesApplied
    }));
}

// ============================================================================
// OPENAI PROMPTS FOR V2
// ============================================================================

function buildV2SystemPrompt(
  responseOptionsInclude: boolean,
  responseOptionCount: number,
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): string {
  const versionBInstructions = requestedVersions.B ? `
## VERSIÓN B - ADAPTACIÓN DE CONTENIDO (CRÍTICO)

Cuando Version B es requerida, CADA item DEBE incluir un campo "versionedContent" con contenido PEDAGÓGICAMENTE DIFERENTE:

\`\`\`json
{
  "id": "item-1",
  "type": "multiple_choice",
  "prompt": "Analiza las causas económicas de la Revolución Industrial y su impacto en la sociedad europea del siglo XVIII.",
  "versionedContent": {
    "promptB": "Lee con atención. La Revolución Industrial cambió cómo vivía la gente.\\n\\n¿Cuál fue una causa importante de la Revolución Industrial?\\n\\nRecuerda: Una 'causa' es algo que hizo que pasara."
  },
  "options": [
    {"id": "a", "text": "El desarrollo de nuevas tecnologías de manufactura", "isCorrect": true},
    {"id": "b", "text": "La caída del Imperio Romano", "isCorrect": false}
  ]
}
\`\`\`

### Estrategias OBLIGATORIAS para versionedContent.promptB:

1. **Vocabulario simplificado**: Reemplazar palabras complejas por equivalentes cotidianos
   - "analiza" → "piensa y responde"
   - "causas económicas" → "razones relacionadas con el dinero"
   - "impacto" → "cambios que provocó"

2. **Oraciones más cortas**: Dividir oraciones largas en pasos claros
   - Máximo 15 palabras por oración
   - Un concepto por oración

3. **Estructura guiada**: Agregar orientación explícita
   - "Lee con atención."
   - "Recuerda que..."
   - "Paso 1: ... Paso 2: ..."

4. **Reducción de carga cognitiva**:
   - En multiple_choice: reducir a 3 opciones si hay 4+
   - En essay: agregar preguntas guía más específicas
   - En source_analysis: resumir textos largos

5. **Ejemplos concretos**: Cuando sea apropiado, incluir un ejemplo breve

IMPORTANTE: El promptB debe evaluar LOS MISMOS OBJETIVOS DE APRENDIZAJE que el prompt base, solo con presentación adaptada.
` : '';

  return `Eres un especialista en evaluación educativa con experiencia en diseño universal para el aprendizaje (DUA). Tu tarea es generar una especificación JSON estructurada para una evaluación escrita.

## REGLAS CRÍTICAS (NO NEGOCIABLES)

1. **Solo JSON**: Tu respuesta debe ser ÚNICAMENTE un objeto JSON válido. Sin comentarios, sin explicaciones, sin markdown, sin code fences.

2. **Sin inferencias de diagnóstico**: NO deduzcas necesidades especiales de texto narrativo. Usa SOLO los datos estructurados proporcionados.

3. **Evidencia siempre escrita**: Todas las respuestas deben ser escritas o seleccionables. NO generar tareas "solo orales".

4. **CE/CL del docente**: Usa SOLO las competencias y criterios de logro proporcionados. NO inventes nuevos.

5. **Versiones**:
   - Siempre generar contenido base en "prompt" (Versión A - universal)
   ${requestedVersions.B ? '- OBLIGATORIO: Generar "versionedContent.promptB" con contenido pedagógicamente adaptado para CADA item' : '- NO incluir versionedContent (Version B no solicitada)'}
   ${requestedVersions.C ? '- Incluir versionedContent.promptC para adaptación excepcional' : ''}
${versionBInstructions}
## OPCIONES DE RESPUESTA EQUIVALENTES
${responseOptionsInclude ? `
- OBLIGATORIO: Items de desarrollo (essay, paragraph) DEBEN incluir equivalentResponseOptions con ${responseOptionCount} opciones.
- Cada opción representa un formato diferente pero equivalente en evidencia y dificultad.
` : '- NO incluir equivalentResponseOptions en ningún item.'}

## RÚBRICA POR ÍTEM (CRÍTICO)

- OBLIGATORIO para items de tipo: essay, paragraph, short_answer, source_analysis, true_false_justify.
- Cada uno de esos ítems DEBE incluir:
  "rubric": {
    "levels": [
      { "key": "...", "label": "...", "descriptor": "...", "minPoints": <n>, "maxPoints": <n> }
    ]
  }
- Mínimo 4 niveles por ítem.
- Los descriptores deben ser específicos a la consigna del ítem (NO genéricos).
- Si incluyes minPoints/maxPoints, deben estar alineados con item.points.

## ESTRUCTURA JSON REQUERIDA

{
  "version": "2.0",
  "generatedAt": "<ISO timestamp>",
  "meta": {
    "subject": "<materia>",
    "gradeLevel": "<grado>",
    "groupName": "<nombre grupo>",
    "totalStudents": <número>,
    "duration": { "minutes": <total> },
    "totalPoints": <puntos>,
    "evaluationType": "written_exam"
  },
  "sections": [
    {
      "id": "<id único>",
      "title": "<título de la parte>",
      "items": [
        {
          "id": "<id único>",
          "type": "<tipo>",
          "prompt": "<consigna versión A>",
          "points": <puntos>,
          "rubric": {
            "levels": [
              { "key": "excelente", "label": "Excelente", "descriptor": "<descriptor específico>", "minPoints": <n>, "maxPoints": <n> }
            ]
          },
          ${requestedVersions.B ? '"versionedContent": { "promptB": "<consigna adaptada versión B>" },' : ''}
          ...campos específicos del tipo...
        }
      ]
    }
  ],
  "versionVariants": {
    "A": { "label": "Versión A (Universal)", "isBase": true }
    ${requestedVersions.B ? ', "B": { "label": "Versión B (Adaptación de Contenido)", "isBase": false, "reason": "Contenido adaptado pedagógicamente para estudiantes que requieren simplificación" }' : ''}
    ${requestedVersions.C ? ', "C": { "label": "Versión C (Adaptación Excepcional)", "isBase": false, "reason": "Adaptación excepcional" }' : ''}
  },
  "aiReport": {
    "narrative": "<texto narrativo global de 6-12 líneas (resumen para el docente)>",
    "byVersion": {
      "A": {
        "narrative": "<6-12 líneas: qué contenidos se evaluaron, cómo se alinean con las competencias seleccionadas, cómo se aplicaron los requerimientos del docente, y cómo se usaron materiales/sesión si están presentes>"
      }
      ${requestedVersions.B ? ', "B": { "narrative": "<6-10 líneas: diferencias con la Versión A (formato, estructura, andamiaje, accesibilidad); por qué se preserva la dificultad y se mejora claridad/apoyo>" }' : ''}
      ${requestedVersions.C ? ', "C": { "narrative": "<6-10 líneas: diferencias con A/B, adaptación excepcional; por qué preserva objetivos de aprendizaje>" }' : ''}
    }
  }
}

## TIPOS DE ITEMS

- multiple_choice: Requiere "options": [{"id": "a", "text": "...", "isCorrect": true/false}]
- true_false: Requiere "correctAnswer": true/false
- true_false_justify: Requiere "correctAnswer", "justificationRequired": true, "rubric" (mínimo 4 niveles)
- short_answer: Puede incluir "maxLength" y DEBE incluir "rubric" (mínimo 4 niveles)
- paragraph: Puede incluir "minLength", "maxLength" y DEBE incluir "rubric" (mínimo 4 niveles)
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions" y DEBE incluir "rubric" (mínimo 4 niveles)
- source_analysis: Requiere "source": {"type": "text"|"image", "content"/"url", "caption"} y DEBE incluir "rubric" (mínimo 4 niveles)
- table_completion: Requiere "table": {"columns": [{"id": "col-1", "header": "Columna 1"}, ...], "rows": [["valor1", "", "valor3"], ["", "", ""]]}
  - columns: array de objetos con id y header (encabezados de columna)
  - rows: array de arrays de strings. Strings vacíos "" indican celdas para completar por el estudiante
  - Ejemplo: tabla de 3 columnas con 2 filas, algunas celdas pre-llenadas y otras vacías
- matching: Requiere "leftColumn": ["item1", "item2"], "rightColumn": ["matchA", "matchB"]
- ordering: Requiere "itemsToOrder": ["paso1", "paso2", "paso3"]

## REPORTE NARRATIVO PARA DOCENTE (aiReport.narrative)

Incluye "aiReport.narrative" como un texto narrativo completo (8-15 líneas) amigable para el docente.

REGLAS DEL NARRATIVO:
- NO menciones estudiantes individuales, IDs de estudiantes, ni recomendaciones por estudiante
- NO incluyas consejos de adaptación para estudiantes específicos
- Tono pedagógico y amigable, como explicando a un colega docente
- 8-15 líneas, párrafos claros y bien estructurados

CONTENIDO REQUERIDO DEL NARRATIVO (en este orden):

1. QUÉ CONTENIDOS SE EVALUARON:
   - Si hay contenidos especificados en el contexto, menciona los conceptos/ideas clave que fueron priorizados
   - Si hay materiales fuente, explica qué ideas principales de esos materiales se abordaron
   - Si hay enfoques curriculares (ANEP), menciona qué focos curriculares se seleccionaron

2. POR QUÉ SE SELECCIONARON ESOS CONTENIDOS:
   - Si hay requerimientos del docente, explica explícitamente cómo se satisfacieron en el diseño
   - Si hay competencias o criterios de logro, explica cómo guiaron la selección de contenidos
   - Justifica la relevancia pedagógica de los contenidos elegidos

3. CÓMO SE EVALUARON (ENFOQUE Y TIPOS DE ITEMS):
   - Describe los tipos de items utilizados (multiple_choice, essay, source_analysis, etc.) y por qué fueron elegidos
   - Explica cómo cada tipo de item aborda diferentes aspectos de los contenidos
   - Menciona la variedad de formatos y cómo esto permite evaluar diferentes habilidades cognitivas

4. DISEÑO Y ADAPTACIONES (si aplica):
   - Por qué se eligieron las secciones y su organización
   - Cómo se mantiene la dificultad entre diferentes formatos de respuesta equivalentes
   - Por qué difieren las versiones A/B/C (desde perspectiva DUA/accesibilidad, sin reducir demanda cognitiva)
   - Dónde se agregaron opciones de respuesta equivalentes y cómo funcionan

5. COBERTURA DE CONTENIDOS (OBLIGATORIO - agregar después del punto 4):
   - Título: "Cobertura de Contenidos:"
   - Lista 3-6 focos de contenido principales que se evalúan
   - Para cada foco, indica:
     * Qué sección/item lo aborda
     * Qué tipo de item se usa para evaluarlo
   - Si hay materiales fuente proporcionados: menciona qué ideas clave de esos materiales se priorizaron
   - Si hay enfoques curriculares ANEP: menciona qué focos curriculares se seleccionaron
   - Si hay requerimientos del docente: explica cómo se satisfacen en la cobertura
   - Si NO hay materiales fuente/ANEP/requerimientos explícitos: indica explícitamente "No se proporcionaron materiales fuente, enfoques curriculares ANEP o requerimientos específicos del docente, por lo que el foco de contenido se infirió de las secciones y prompts generados."

REGLAS CRÍTICAS PARA COBERTURA DE CONTENIDOS:
- NO inventes detalles de materiales fuente que no fueron proporcionados
- Si el texto fuente no está disponible, di explícitamente "No se proporcionó texto fuente completo"
- Usa SOLO la información disponible en el contexto del grupo y requerimientos del docente
- Mapea cada foco de contenido a secciones/items específicos de la evaluación generada

EJEMPLO DE NARRATIVO ENRIQUECIDO:
"Esta evaluación fue diseñada para [materia] y se enfoca en evaluar [contenidos principales específicos, ej: 'los procesos de independencia en América Latina y sus consecuencias socioeconómicas']. Estos contenidos fueron seleccionados porque [justificación basada en requerimientos del docente o competencias, ej: 'permiten evaluar la comprensión de procesos históricos complejos y su impacto en la actualidad, como solicitó el docente']. La evaluación utiliza una variedad de tipos de items: preguntas de opción múltiple para verificar conocimientos factuales, análisis de fuentes para evaluar pensamiento crítico, y ensayos cortos para evaluar la capacidad de síntesis y argumentación. Esta diversidad de formatos permite abordar diferentes dimensiones de los contenidos, desde la memorización hasta la aplicación y el análisis. Se generaron [versiones] para adaptarse a diferentes necesidades del grupo, manteniendo la misma demanda cognitiva. Se incluyeron opciones de respuesta equivalentes en items de desarrollo, permitiendo que los estudiantes elijan el formato que mejor se adapte a su forma de expresar su comprensión, sin reducir la dificultad requerida."

IMPORTANTE: aiReport.narrative es OPCIONAL. Si no puedes generarlo, omítelo pero NO falles la generación por esto.

## REPORTE POR VERSIÓN (aiReport.byVersion) - OBLIGATORIO

Debes incluir "aiReport.byVersion" con un reporte por cada versión que generes. Si generaste B o C, byVersion.B y/o byVersion.C son OBLIGATORIOS (no opcionales).
- byVersion.A: Siempre obligatorio. narrative = qué contenidos se evaluaron, alineación con competencias/criterios, requerimientos del docente aplicados, uso de materiales/sesión si están presentes.
- byVersion.B: OBLIGATORIO si generaste Versión B. narrative = misma cobertura que A más: diferencias explícitas con A (formato, estructura, andamiaje, accesibilidad); por qué estas adaptaciones apoyan a los estudiantes asignados a B sin bajar la dificultad conceptual.
- byVersion.C: OBLIGATORIO si generaste Versión C. narrative = diferencias con A/B; andamiaje más fuerte si aplica; por qué preserva los objetivos de aprendizaje.
No inventes B/C si no generaste esas versiones. Si generaste B o C, no omitas su narrative en byVersion.

RESPONDE ÚNICAMENTE CON JSON VÁLIDO. SIN EXPLICACIONES.`;
}

function buildV2UserPrompt(
  groupContext: {
    subject?: string;
    groupName?: string;
    content?: string[];
    competencies?: string[];
    criteriosLogro?: string[];
    students?: Array<{ studentId: string | number; displayName?: string }>;
  },
  modification: string,
  instrumentDesignRules: string[],
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): string {
  const totalStudents = groupContext.students?.length || 0;
  
  return `## CONTEXTO DEL GRUPO

Materia: ${groupContext.subject || 'No especificada'}
Grupo: ${groupContext.groupName || 'No especificado'} (${totalStudents} estudiantes)
Contenidos a evaluar: ${groupContext.content?.join(', ') || 'No especificados'}
Competencias: ${groupContext.competencies?.join(', ') || 'No provistas'}
Criterios de logro: ${groupContext.criteriosLogro?.join(', ') || 'No provistos'}

## VERSIONES SOLICITADAS

- Versión A: SIEMPRE requerida (evaluación universal base - para estudiantes sin necesidad de adaptaciones)
${requestedVersions.B ? '- Versión B: Requerida (ADAPTACIÓN DE CONTENIDO - vocabulario simplificado, mayor apoyo visual, consignas más claras)' : '- Versión B: NO generar'}
${requestedVersions.C ? '- Versión C: Requerida (ADAPTACIÓN EXCEPCIONAL - modificaciones significativas para casos especiales)' : '- Versión C: NO generar'}

## REGLAS DE DISEÑO DEL INSTRUMENTO

${instrumentDesignRules.length ? instrumentDesignRules.map(rule => `- ${rule}`).join('\n') : '- (Sin reglas adicionales)'}

## REQUERIMIENTOS DEL DOCENTE

${modification || 'No hay requerimientos adicionales'}

## INSTRUCCIONES

Genera una especificación JSON completa siguiendo el schema EvaluationSpecV2.
- La evaluación debe ser apropiada para secundaria.
- Incluye variedad de tipos de items.
- Asegúrate que los puntos sumen un total coherente.
${requestedVersions.B ? `- CRÍTICO: Para CADA item, incluye "versionedContent": { "promptB": "..." } con una versión PEDAGÓGICAMENTE ADAPTADA.
- El promptB debe ser significativamente diferente: vocabulario más simple, oraciones más cortas, estructura más clara.
- Si falta promptB en aunque sea un ítem, la Versión B no se ofrecerá al docente (solo A).
- Ejemplo: Si prompt es "Analiza las consecuencias socioeconómicas...", promptB debe ser "Lee con atención. ¿Qué cambios importantes ocurrieron? Piensa en cómo afectó a las personas."` : '- NO incluyas versionedContent.'}
${requestedVersions.C ? `- CRÍTICO: Para cada ítem que tenga promptB, incluye también "promptC" en versionedContent cuando corresponda a adaptación excepcional. Si falta promptC en ítems, la Versión C no se ofrecerá.` : ''}
- CRÍTICO: Para cada item abierto (essay, paragraph, short_answer, source_analysis, true_false_justify) incluye "rubric.levels" con al menos 4 niveles y descriptores específicos al prompt del ítem.

Responde ÚNICAMENTE con el objeto JSON. Sin explicaciones ni code fences.`;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

async function generateEvaluationV2(
  systemPrompt: string,
  userPrompt: string,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer,
  isAdjustMode: boolean = false
): Promise<{
  spec: EvaluationSpecV2 | null;
  warnings: WarningV2[];
  attempt: number;
  extractionMethod: string;
  attempts: Array<{
    attempt: number;
    mode: 'full' | 'fast_fallback' | 'emergency_template';
    model: string;
    timeoutMs: number;
    maxTokens: number;
    temperature?: number;
    promptSizeKB: number;
    startedAtMs: number;
    openaiDurationMs?: number;
    outcome: 'success' | 'timeout' | 'openai_error' | 'parse_error' | 'validation_error' | 'unknown_error';
    errorMessage?: string;
  }>;
  debug: {
    promptLength: number;
    responseLength: number;
    openaiDurationMs?: number;
    timeoutUsedMs?: number;
    retryReason?: string;
  };
}> {
  // RETRY STRATEGY:
  // Attempt 1: Full prompt with 90s timeout (OPENAI_TIMEOUT_GENERATE_MS), gpt-4.1-2025-04-14
  // Attempt 2: Fast fallback with gpt-4o-mini, reduced prompt, 24s timeout, maxTokens <= 1800
  const MAX_ATTEMPTS = 2;
  const warnings: WarningV2[] = [];
  type AttemptOutcome = 'success' | 'timeout' | 'openai_error' | 'parse_error' | 'validation_error' | 'unknown_error';
  type AttemptMode = 'full' | 'fast_fallback' | 'emergency_template';
  
  const attempts: Array<{
    attempt: number;
    mode: AttemptMode;
    model: string;
    timeoutMs: number;
    maxTokens: number;
    temperature?: number;
    promptSizeKB: number;
    startedAtMs: number;
    openaiDurationMs?: number;
    outcome: AttemptOutcome;
    errorMessage?: string;
  }> = [];
  let attempt = 0;
  let extractionMethod = 'json_parse';
  let lastRawResponse = '';
  let openaiDurationMs = 0;
  let retryReason = '';
  
  // Determine timeouts based on mode
  const firstAttemptTimeout = isAdjustMode ? OPENAI_TIMEOUT_ADJUST_MS : OPENAI_TIMEOUT_GENERATE_MS;
  const retryTimeout = OPENAI_TIMEOUT_RETRY_MS;
  
  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const currentTimeout = attempt === 1 ? firstAttemptTimeout : retryTimeout;
    const isRetryAttempt = attempt > 1;
    
    timer.log(`═══════════════════════════════════════════════════════════════`);
    timer.log(`OpenAI attempt ${attempt}/${MAX_ATTEMPTS} starting`);
    timer.log(`  timeout: ${currentTimeout}ms, isRetry: ${isRetryAttempt}, isAdjustMode: ${isAdjustMode}`);
    timer.log(`═══════════════════════════════════════════════════════════════`);
    
    // Check if we're running out of total time budget
    const remainingBudget = TOTAL_TIMEOUT_MS - timer.elapsed();
    if (remainingBudget < 10000) {
      timer.log(`ABORT: Only ${remainingBudget}ms remaining in total budget, skipping attempt`);
      warnings.push({
        code: 'TIMEOUT_BUDGET_EXCEEDED',
        message: `Se agotó el tiempo disponible antes del intento ${attempt}`,
        severity: 'error'
      });
      break;
    }
    
    // Use actual remaining time if less than planned timeout
    const effectiveTimeout = Math.min(currentTimeout, remainingBudget - 2000);
    
    // Build reduced prompt for retry (FAST FALLBACK: gpt-4o-mini, Version A only, minimal prompt)
    let currentSystemPrompt = systemPrompt;
    let currentUserPrompt = userPrompt;
    let reducedVersions = requestedVersions;
    let modelToUse = 'gpt-4.1-2025-04-14';
    let maxTokensToUse = isRetryAttempt ? 6000 : 6000;
    let temperatureToUse = 0.7;
    const attemptStartTime = timer.elapsed();
    
    if (isRetryAttempt) {
      timer.log(`═══════════════════════════════════════════════════════════════`);
      timer.log(`FAST FALLBACK MODE: gpt-4o-mini, Version A only, full prompt structure preserved`);
      timer.log(`═══════════════════════════════════════════════════════════════`);
      
      // Fast fallback: use gpt-4o-mini, lower temperature; keep full prompt (instrumentDesignRules + narrative requirements)
      modelToUse = 'gpt-4o-mini';
      maxTokensToUse = Math.max(2500, 1800); // At least 2500 to preserve structure and narrative
      temperatureToUse = 0.4; // More deterministic
      
      // On retry: request Version A only to reduce output size; do NOT strip prompt (preserve section/duration/narrative instructions)
      if (requestedVersions.B || requestedVersions.C) {
        reducedVersions = { A: true, B: false, C: false };
        warnings.push({
          code: 'RETRY_FAST_FALLBACK_USED',
          message: 'Usando fast fallback: generando solo Versión A con gpt-4o-mini. Versiones B/C diferidas.',
          severity: 'warning'
        });
        // Keep currentSystemPrompt = systemPrompt and currentUserPrompt = userPrompt (full structure)
        timer.log(`  Full systemPrompt preserved: ${systemPrompt.length} chars`);
        timer.log(`  Full userPrompt preserved: ${userPrompt.length} chars`);
      }
      
      // If previous attempt had a response, build repair prompt
      if (lastRawResponse && retryReason === 'parse_error') {
        const truncated = lastRawResponse.slice(0, 300);
        currentUserPrompt = `JSON parse error. Previous response (truncated):\n${truncated}\n\nREQUIREMENTS: Respond ONLY with valid JSON. No code fences, no comments.\n\n${currentUserPrompt.slice(0, 1500)}`;
      }
    }
    
    // Log request metadata for debugging
    const promptSizeKB = parseFloat(((currentSystemPrompt.length + currentUserPrompt.length) / 1024).toFixed(1));
    timer.log(`OpenAI request details:`);
    timer.log(`  model: ${modelToUse}`);
    timer.log(`  systemPrompt: ${currentSystemPrompt.length} chars`);
    timer.log(`  userPrompt: ${currentUserPrompt.length} chars`);
    timer.log(`  totalPromptSize: ${promptSizeKB} KB`);
    timer.log(`  effectiveTimeout: ${effectiveTimeout}ms`);
    timer.log(`  maxTokens: ${maxTokensToUse}`);
    timer.log(`  temperature: ${temperatureToUse}`);
    timer.log(`  requestedVersions: A=${reducedVersions.A}, B=${reducedVersions.B}, C=${reducedVersions.C}`);
    
    const openaiStartTime = Date.now();
    
    // Record attempt start
    const attemptRecord: {
      attempt: number;
      mode: AttemptMode;
      model: string;
      timeoutMs: number;
      maxTokens: number;
      temperature?: number;
      promptSizeKB: number;
      startedAtMs: number;
      outcome: AttemptOutcome;
      errorMessage?: string;
      openaiDurationMs?: number;
    } = {
      attempt,
      mode: isRetryAttempt ? 'fast_fallback' : 'full',
      model: modelToUse,
      timeoutMs: effectiveTimeout,
      maxTokens: maxTokensToUse,
      temperature: temperatureToUse,
      promptSizeKB,
      startedAtMs: attemptStartTime,
      outcome: 'unknown_error',
      errorMessage: undefined,
      openaiDurationMs: undefined
    };
    
    try {
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              { role: 'system', content: currentSystemPrompt },
              { role: 'user', content: currentUserPrompt }
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: maxTokensToUse,
            temperature: temperatureToUse
          }),
        },
        effectiveTimeout,
        requestId
      );
      
      openaiDurationMs = Date.now() - openaiStartTime;
      timer.log(`✓ OpenAI response received in ${openaiDurationMs}ms`);
      timer.mark(`openai_attempt_${attempt}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        timer.log(`✗ OpenAI API error ${response.status}: ${errorText.slice(0, 200)}`);
        
        // Record API error attempt
        attemptRecord.outcome = 'openai_error';
        attemptRecord.openaiDurationMs = openaiDurationMs;
        attemptRecord.errorMessage = `OpenAI API error ${response.status}: ${errorText.slice(0, 200)}`;
        attempts.push(attemptRecord);
        
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const result = await response.json();
      const rawContent = result.choices[0]?.message?.content || '';
      lastRawResponse = rawContent;
      
      timer.log(`OpenAI response parsed, length=${rawContent.length} chars`);
      
      // Try to parse JSON
      let parsed: unknown;
      try {
        // Remove potential code fences
        let cleanContent = rawContent.trim();
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        
        parsed = JSON.parse(cleanContent);
        extractionMethod = 'json_parse';
        timer.mark('json_parsed');
      } catch (parseError) {
        timer.log(`✗ JSON parse error: ${parseError}`);
        warnings.push({
          code: 'JSON_PARSE_ERROR',
          message: `Intento ${attempt}: Error al parsear respuesta JSON`,
          severity: 'warning',
          context: { parseError: String(parseError) }
        });
        retryReason = 'parse_error';
        
        // Record parse error attempt
        attemptRecord.outcome = 'parse_error' as AttemptOutcome;
        attemptRecord.openaiDurationMs = openaiDurationMs;
        attemptRecord.errorMessage = `JSON parse error: ${parseError}`;
        attempts.push(attemptRecord);
        
        continue; // Retry
      }
      
      // Validate and normalize
      const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, reducedVersions);
      warnings.push(...validationWarnings);
      timer.mark('validation_complete');
      
      if (spec) {
        timer.log(`✓ SUCCESS on attempt ${attempt} (${openaiDurationMs}ms)`);
        if (isRetryAttempt) {
          warnings.push({
            code: 'RETRY_SUCCESS',
            message: `Generación exitosa después de ${attempt} intentos`,
            severity: 'info'
          });
        }
        
        // Record successful attempt
        attemptRecord.outcome = 'success' as AttemptOutcome;
        attemptRecord.openaiDurationMs = openaiDurationMs;
        attempts.push(attemptRecord);
        
        return {
          spec,
          warnings,
          attempt,
          extractionMethod,
          attempts,
          debug: {
            promptLength: currentSystemPrompt.length + currentUserPrompt.length,
            responseLength: rawContent.length,
            openaiDurationMs,
            timeoutUsedMs: effectiveTimeout,
            retryReason: isRetryAttempt ? retryReason : undefined
          }
        };
      }
      
      // Validation failed, retry
      timer.log('Validation failed, will retry if attempts remain');
      retryReason = 'validation_failed';
      
      // Record validation error attempt
      attemptRecord.outcome = 'validation_error' as AttemptOutcome;
      attemptRecord.openaiDurationMs = openaiDurationMs;
      attemptRecord.errorMessage = 'Validation failed: spec is null after normalization';
      attempts.push(attemptRecord);
      
    } catch (apiError) {
      openaiDurationMs = Date.now() - openaiStartTime;
      const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
      timer.log(`✗ API call failed after ${openaiDurationMs}ms: ${errorMsg}`);
      
      // Check if it's a timeout error
      const isTimeout = errorMsg.includes('TIMEOUT') || errorMsg.includes('AbortError') || errorMsg.includes('aborted');
      const outcome: AttemptOutcome = isTimeout ? 'timeout' : (errorMsg.includes('API') || errorMsg.includes('fetch') ? 'openai_error' : 'unknown_error');
      
      warnings.push({
        code: isTimeout ? 'OPENAI_TIMEOUT' : 'API_ERROR',
        message: isTimeout 
          ? `El servicio de IA tardó demasiado (>${effectiveTimeout}ms). ${attempt < MAX_ATTEMPTS ? 'Reintentando con fast fallback...' : 'Intenta de nuevo.'}`
          : `Intento ${attempt}: Error de API - ${errorMsg}`,
        severity: attempt >= MAX_ATTEMPTS ? 'error' : 'warning'
      });
      
      retryReason = isTimeout ? 'timeout' : 'api_error';
      
      // Record failed attempt
      attemptRecord.outcome = outcome;
      attemptRecord.openaiDurationMs = openaiDurationMs;
      attemptRecord.errorMessage = errorMsg;
      attempts.push(attemptRecord);
      
      // On timeout, ALLOW retry with fast fallback
      if (isTimeout && attempt < MAX_ATTEMPTS) {
        timer.log(`Timeout on attempt ${attempt}, will retry with fast fallback (gpt-4o-mini)`);
        continue;
      }
    }
  }
  
  // All attempts failed
  timer.log(`═══════════════════════════════════════════════════════════════`);
  timer.log(`✗ All ${MAX_ATTEMPTS} attempts failed`);
  timer.log(`  lastRetryReason: ${retryReason}`);
  timer.log(`  totalElapsed: ${timer.elapsed()}ms`);
  timer.log(`  attempts recorded: ${attempts.length}`);
  timer.log(`═══════════════════════════════════════════════════════════════`);
  
  return {
    spec: null,
    warnings,
    attempt,
    extractionMethod: 'failed',
    attempts,
    debug: {
      promptLength: systemPrompt.length + userPrompt.length,
      responseLength: lastRawResponse.length,
      openaiDurationMs,
      timeoutUsedMs: attempt === 1 ? firstAttemptTimeout : retryTimeout,
      retryReason
    }
  };
}

// ============================================================================
// ADJUSTMENT MODE: Build section for refining existing evaluation
// ============================================================================

interface AdjustmentDetails {
  targetVersions?: 'A' | 'B' | 'C' | 'all';
  scope?: 'entire' | 'section' | 'item';
  sectionId?: string;
  itemId?: string;
}

function buildAdjustmentSection(
  currentSpec: EvaluationSpecV2,
  details: AdjustmentDetails,
  teacherAdjustmentText: string  // CRITICAL: The teacher's requested changes
): string {
  const parts: string[] = [];
  
  parts.push('## ============================================');
  parts.push('## MODO AJUSTE: Refinamiento de evaluación existente');
  parts.push('## ============================================');
  parts.push('');
  
  // CRITICAL: Teacher adjustment text FIRST and prominently
  parts.push('### 🎯 CAMBIOS SOLICITADOS POR EL DOCENTE (OBLIGATORIO APLICAR)');
  parts.push('');
  parts.push('El docente ha solicitado los siguientes ajustes que DEBES aplicar:');
  parts.push('');
  parts.push('```');
  parts.push(teacherAdjustmentText || '(Sin texto de ajuste proporcionado)');
  parts.push('```');
  parts.push('');
  parts.push('⚠️ IMPORTANTE: La evaluación resultante DEBE reflejar estos cambios.');
  parts.push('Si no aplicas los cambios solicitados, la respuesta será rechazada.');
  parts.push('');
  
  parts.push('### CONTEXTO DEL AJUSTE');
  parts.push('');
  parts.push('Estás REFINANDO una evaluación existente, NO creando una nueva.');
  parts.push('Debes preservar la estructura general y aplicar los ajustes solicitados.');
  parts.push('');
  
  // Scope instructions
  parts.push('### ALCANCE DEL AJUSTE');
  if (details.scope === 'section' && details.sectionId) {
    parts.push(`- Aplica cambios SOLO a la sección con id="${details.sectionId}"`);
    parts.push('- Las demás secciones deben permanecer EXACTAMENTE iguales');
  } else if (details.scope === 'item' && details.itemId) {
    parts.push(`- Aplica cambios SOLO al ítem con id="${details.itemId}"`);
    parts.push('- Los demás ítems deben permanecer EXACTAMENTE iguales');
  } else {
    parts.push('- Puedes modificar cualquier parte de la evaluación');
    parts.push('- Mantén la estructura general (número de secciones, tipos de ítems)');
  }
  parts.push('');
  
  // Version targeting
  parts.push('### VERSIONES A MODIFICAR');
  if (details.targetVersions === 'all') {
    parts.push('- Aplica cambios a TODAS las versiones (A, B, C si existen)');
  } else if (details.targetVersions === 'A') {
    parts.push('- Aplica cambios SOLO al prompt base (Versión A)');
    parts.push('- Mantén versionedContent sin cambios');
  } else if (details.targetVersions === 'B') {
    parts.push('- Aplica cambios SOLO a versionedContent.promptB');
    parts.push('- Mantén el prompt base sin cambios');
  } else if (details.targetVersions === 'C') {
    parts.push('- Aplica cambios SOLO a versionedContent.promptC');
    parts.push('- Mantén prompt base y promptB sin cambios');
  }
  parts.push('');
  
  // Constraints
  parts.push('### RESTRICCIONES CRÍTICAS');
  parts.push('1. NO cambies los contentIds, competencyIds ni criteriosLogro del meta');
  parts.push('2. PRESERVA los IDs de secciones e ítems (section.id, item.id)');
  parts.push('3. NO agregues contenido curricular fuera del tema original');
  parts.push('4. Puedes mejorar: redacción, claridad, instrucciones, scaffolding, formato');
  parts.push('');
  
  // Current spec (truncated for token efficiency)
  parts.push('### EVALUACIÓN ACTUAL A REFINAR');
  parts.push('```json');
  // Include full spec but limit serialization depth
  const specJson = JSON.stringify(currentSpec, null, 2);
  if (specJson.length > 15000) {
    // If spec is too large, include only structure summary
    parts.push(JSON.stringify({
      version: currentSpec.version,
      meta: currentSpec.meta,
      sections: currentSpec.sections.map(s => ({
        id: s.id,
        title: s.title,
        itemCount: s.items.length,
        items: s.items.map(i => ({
          id: i.id,
          type: i.type,
          prompt: i.prompt.slice(0, 100) + (i.prompt.length > 100 ? '...' : ''),
          hasVersionedContent: !!i.versionedContent
        }))
      })),
      versionVariants: currentSpec.versionVariants
    }, null, 2));
    parts.push('```');
    parts.push('(Nota: Spec resumida por tamaño. Preserva el contenido completo de los ítems.)');
  } else {
    parts.push(specJson);
    parts.push('```');
  }
  parts.push('');
  
  parts.push('Genera la evaluación refinada como un objeto JSON completo.');
  parts.push('Responde ÚNICAMENTE con el JSON. Sin explicaciones ni code fences adicionales.');
  
  return parts.join('\n');
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // ════════════════════════════════════════════════════════════════════════════
  // 🚀 MODIFY-EVALUATION-V2 EXECUTED - This log confirms V2 is being called
  // ════════════════════════════════════════════════════════════════════════════
  console.log('[DEPLOY_CHECK] build=DEPLOY_CHECK_2026_02_11 function=modify-evaluation-v2');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 [V2_ENTRY] MODIFY-EVALUATION-V2 EDGE FUNCTION EXECUTED');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`[V2_ENTRY] Timestamp: ${new Date().toISOString()}`);
  console.log(`[V2_ENTRY] Method: ${req.method}`);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Check API key
  if (!openAIApiKey) {
    console.error('[V2_ERROR] OpenAI API key not configured');
    return new Response(JSON.stringify({
      success: false,
      error: 'OpenAI API key not configured',
      warnings: [{
        code: 'CONFIG_ERROR',
        message: 'El servicio no está configurado correctamente',
        severity: 'error'
      }]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Generate request ID and start timer
  const requestId = generateRequestId();
  const timer = new Timer(requestId);
  
  try {
    timer.log('Request received, parsing body');
    
    const requestBody = await req.json();
    
    // PING MODE: Zero-cost probe to verify function is deployed and reachable
    // If __ping is true, return immediately without any OpenAI calls or heavy processing
    if (requestBody && typeof requestBody === 'object' && requestBody.__ping === true) {
      const pingResponse = {
        success: true,
        pong: true,
        debug: {
          build: 'PING_NARRATIVE_DEBUG_2026_02_12',
          now: new Date().toISOString()
        }
      };
      
      return new Response(JSON.stringify(pingResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'x-aulaplus-build-probe': 'PING_NARRATIVE_DEBUG_2026_02_12'
        }
      });
    }
    
    // DEBUG NARRATIVE MODE: Zero-cost probe to verify aiReport.narrative is in response JSON
    // If __debugNarrative is true, return immediately with narrative in aiReport
    if (requestBody && typeof requestBody === 'object' && requestBody.__debugNarrative === true) {
      const debugDate = '2026_02_12';
      const debugResponse = {
        success: true,
        debug: {
          build: `NARRATIVE_DEBUG_${debugDate}`,
          now: new Date().toISOString()
        },
        aiReport: {
          narrative: 'DEBUG_NARRATIVE_OK'
        }
      };
      
      return new Response(JSON.stringify(debugResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'x-aulaplus-build-probe': `NARRATIVE_DEBUG_${debugDate}`
        }
      });
    }
    
    const {
      mode,  // 'generate' (default) or 'adjust'
      modification,
      groupContext,
      evaluation_design_plan,
      currentEvaluationSpec,  // For adjust mode: the current spec to refine
      adjustmentDetails       // For adjust mode: { targetVersions, scope, sectionId?, itemId? }
    } = requestBody;
    
    timer.mark('body_parsed');
    
    // DEBUG: Log received payload summary
    timer.log(`[PAYLOAD] mode=${mode || 'undefined'}, modification.length=${(modification || '').length}`);
    timer.log(`[PAYLOAD] hasGroupContext=${!!groupContext}, hasDesignPlan=${!!evaluation_design_plan}`);
    timer.log(`[PAYLOAD] groupContext.subject=${groupContext?.subject || 'undefined'}`);
    timer.log(`[PAYLOAD] groupContext.students.length=${groupContext?.students?.length || 0}`);
    
    const isAdjustMode = mode === 'adjust' && currentEvaluationSpec;
    
    timer.log(`mode=${isAdjustMode ? 'adjust' : 'generate'}, subject=${groupContext?.subject}, students=${groupContext?.students?.length}`);
    
    // Extract design plan data
    const designPlan = evaluation_design_plan || {};
    const instrumentDesignRules = Array.isArray(designPlan.instrumentDesignRules)
      ? designPlan.instrumentDesignRules
      : [];
    const studentAssignments = designPlan.studentAssignments || designPlan.assignmentByStudentId || {};
    const perStudentReminders = Array.isArray(designPlan.perStudentReminders)
      ? designPlan.perStudentReminders
      : [];
    const responseOptions = designPlan.responseOptions || {};
    const responseOptionsInclude = responseOptions.include === true;
    const responseOptionCount = [2, 3].includes(responseOptions.optionCount)
      ? responseOptions.optionCount
      : 2;
    
    // Compute requested versions (single source of truth)
    // DEV LOG: Student-by-student content adaptation detection
    const assignmentsIncludeB = Object.values(studentAssignments).includes('B');
    const assignmentsIncludeC = Object.values(studentAssignments).includes('C');
    
    // Check students for content adaptation flag
    let hasContentAdaptationStudent = false;
    const studentsForVersioning = Array.isArray(groupContext?.students) ? groupContext.students : [];
    
    timer.log(`Checking ${studentsForVersioning.length} students for content adaptation...`);
    studentsForVersioning.forEach((student: Record<string, unknown>, idx: number) => {
      const hasFlag = student?.hasDeclaredContentAdaptation === true || 
                      student?.requiresContentAdaptation === true;
      if (hasFlag) {
        hasContentAdaptationStudent = true;
        timer.log(`  [CONTENT_ADAPT] Student ${idx} (id=${student.studentId}): hasDeclaredContentAdaptation=true → Version B/C`);
      }
    });
    
    if (!hasContentAdaptationStudent && studentsForVersioning.length > 0) {
      timer.log(`  [CONTENT_ADAPT] No students with declared content adaptation found`);
    }
    
    const requestedVersions = {
      A: true,
      B: designPlan.triggers?.versionB === true || assignmentsIncludeB,
      C: designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent
    };
    
    timer.log(`versions: A=true, B=${requestedVersions.B}, C=${requestedVersions.C} (hasContentAdaptationStudent=${hasContentAdaptationStudent})`);
    timer.mark('versions_computed');
    
    // Extract teacher reminders (admin + correction only, NOT allowances)
    const teacherReminders = extractTeacherReminders(
      perStudentReminders,
      groupContext?.students || []
    );
    
    // Build prompts
    const systemPrompt = buildV2SystemPrompt(
      responseOptionsInclude,
      responseOptionCount,
      requestedVersions
    );
    
    let userPrompt = buildV2UserPrompt(
      groupContext || {},
      modification || '',
      instrumentDesignRules,
      requestedVersions
    );
    
    // ADJUST MODE: Append current spec and adjustment instructions
    if (isAdjustMode) {
      const adjustSection = buildAdjustmentSection(
        currentEvaluationSpec,
        adjustmentDetails || {},
        modification || '' // Teacher's adjustment request text
      );
      userPrompt = `${userPrompt}\n\n${adjustSection}`;
      timer.log(`Adjustment mode: spec appended to prompt (teacherText=${(modification || '').length}chars)`);
    }
    
    timer.mark('prompts_built');
    timer.log(`Prompts built: system=${systemPrompt.length}chars, user=${userPrompt.length}chars`);
    
    // Generate evaluation (pass isAdjustMode for timeout tuning)
    const result = await generateEvaluationV2(
      systemPrompt,
      userPrompt,
      requestedVersions,
      requestId,
      timer,
      isAdjustMode  // Use shorter timeout for adjust mode
    );
    
    timer.mark('generation_complete');
    
    // Build response
    if (result.spec) {
      // Synchronize requestedVersions with actual versionVariants (e.g. fast fallback generated only A)
      const effectiveRequestedVersions = getEffectiveRequestedVersions(result.spec.versionVariants);

      // Structure validation: duration coherence with target (if provided)
      const targetDurationMinutes = (designPlan as Record<string, unknown>)?.targetDurationMinutes as number | undefined;
      const estimatedMinutes = result.spec.meta?.duration?.minutes ?? 90;
      if (targetDurationMinutes != null && targetDurationMinutes > 0) {
        const deviation = Math.abs(estimatedMinutes - targetDurationMinutes) / targetDurationMinutes;
        if (deviation > 0.15) {
          result.warnings.push({
            code: 'DURATION_DEVIATION',
            message: `La duración estimada (${estimatedMinutes} min) se desvía más del 15% del objetivo (${targetDurationMinutes} min). Considere revisar los tiempos por sección.`,
            severity: 'warning'
          });
          // Optionally scale section durations proportionally
          const scale = targetDurationMinutes / estimatedMinutes;
          if (result.spec.sections?.length && scale > 0 && scale !== 1) {
            for (const section of result.spec.sections) {
              if (typeof section.duration === 'number') {
                section.duration = Math.round(section.duration * scale);
              }
            }
            if (result.spec.meta?.duration) {
              result.spec.meta.duration.minutes = targetDurationMinutes;
            }
          }
        }
      }

      // Success - build base aiReport first (use effectiveRequestedVersions for coherence)
      const baseAiReport: AIReportV2 = {
        designRationale: `Evaluación generada para ${groupContext?.subject || 'materia no especificada'} con ${result.spec.sections.length} secciones.`,
        versionsExplanation: {
          generated: ['A', ...(effectiveRequestedVersions.B ? ['B'] : []), ...(effectiveRequestedVersions.C ? ['C'] : [])],
          notGenerated: {
            ...(effectiveRequestedVersions.B ? {} : { B: 'No hay estudiantes con alta necesidad de estructuración' }),
            ...(effectiveRequestedVersions.C ? {} : { C: 'No hay estudiantes con adecuación de contenido declarada' })
          }
        },
        contemplacionesApplied: {
          instrumentDesign: instrumentDesignRules,
          adminReminders: teacherReminders.reduce((sum, r) => sum + r.admin.length, 0),
          correctionReminders: teacherReminders.reduce((sum, r) => sum + r.correction.length, 0)
        },
        responseOptions: {
          included: responseOptionsInclude,
          count: responseOptionsInclude ? responseOptionCount : undefined,
          reason: responseOptionsInclude ? 'Configurado en el plan de diseño' : undefined
        }
      };
      
      // CRITICAL: Extract narrative from spec if present (generated by OpenAI in same call)
      // If missing, fall back to local generation (best-effort)
      let narrativeWarning: WarningV2 | null = null;
      let narrativeSource: 'openai' | 'local' | 'none' = 'none';
      let narrativeText: string | undefined = undefined;
      
      // Priority 1: Use narrative from OpenAI response (if present and valid)
      // Check both result.spec.aiReport.narrative and result.aiReport.narrative (if exists)
      if (result.spec.aiReport?.narrative && typeof result.spec.aiReport.narrative === 'string') {
        const openaiNarrative = result.spec.aiReport.narrative.trim();
        if (openaiNarrative.length > 0) {
          narrativeText = openaiNarrative;
          narrativeSource = 'openai';
          const wordCount = openaiNarrative.split(/\s+/).length;
          timer.log(`[AI_REPORT] narrative_len=${openaiNarrative.length}, narrative_source=openai`);
          console.log(`[AI_REPORT] narrative_len=${openaiNarrative.length}, narrative_source=openai`);
        } else {
          // Empty after trim - fall back to local generation
          timer.log('⚠ OpenAI returned empty narrative, falling back to local generation');
        }
      }
      
      // Priority 2: Generate narrative locally if not present from OpenAI
      // CRITICAL: This MUST always run if OpenAI didn't provide narrative
      if (!narrativeText) {
        try {
          timer.log('[AI_REPORT] Building narrative locally (deterministic fallback)...');
          console.log('[AI_REPORT] Building narrative locally (deterministic fallback)...');
          
          // Ensure we have all required data
          if (!result.spec) {
            throw new Error('result.spec is null');
          }
          
          narrativeText = buildNarrativeLocal(
            result.spec,
            baseAiReport.versionsExplanation,
            baseAiReport.contemplacionesApplied,
            baseAiReport.responseOptions,
            groupContext,
            modification,
            evaluation_design_plan
          );
          
          // Validate generated narrative
          if (narrativeText && typeof narrativeText === 'string') {
            const trimmed = narrativeText.trim();
            if (trimmed.length > 0) {
              narrativeText = trimmed;
              narrativeSource = 'local';
              const wordCount = trimmed.split(/\s+/).length;
              timer.log(`[AI_REPORT] narrative_len=${trimmed.length}, narrative_source=local, words=${wordCount}`);
              console.log(`[AI_REPORT] narrative_len=${trimmed.length}, narrative_source=local, words=${wordCount}`);
            } else {
              timer.log('[AI_REPORT] Local narrative generated but empty after trim');
              console.log('[AI_REPORT] Local narrative generated but empty after trim');
              narrativeText = undefined;
              narrativeSource = 'none';
            }
          } else {
            timer.log(`[AI_REPORT] Local narrative generation returned invalid type: ${typeof narrativeText}`);
            console.log(`[AI_REPORT] Local narrative generation returned invalid type: ${typeof narrativeText}`);
            narrativeText = undefined;
            narrativeSource = 'none';
          }
        } catch (narrativeError) {
          // CRITICAL: Narrative failure must NOT change success:true
          const errorMsg = narrativeError instanceof Error ? narrativeError.message : String(narrativeError);
          const errorStack = narrativeError instanceof Error ? narrativeError.stack : '';
          timer.log(`[AI_REPORT] ✗ Local narrative generation failed (non-blocking): ${errorMsg}`);
          console.log(`[AI_REPORT] ✗ Local narrative generation failed (non-blocking): ${errorMsg}`);
          console.log(`[AI_REPORT] Error stack: ${errorStack?.slice(0, 200)}`);
          narrativeWarning = {
            code: 'AI_REPORT_NARRATIVE_MISSING',
            message: `No se pudo generar el reporte narrativo: ${errorMsg.slice(0, 100)}`,
            severity: 'warning'
          };
          narrativeText = undefined;
          narrativeSource = 'none';
        }
      }
      
      // If narrative is present but too short (<200 chars), try narrative-only OpenAI call (openai or local source)
      if (narrativeText && typeof narrativeText === 'string') {
        const len = narrativeText.trim().length;
        if (len > 0 && len < MIN_NARRATIVE_LENGTH) {
          timer.log('[AI_REPORT] Narrative too short (any source), requesting narrative-only OpenAI call...');
          const enhanced = await generateNarrativeOnlyCall(
            result.spec,
            groupContext || {},
            modification || '',
            evaluation_design_plan,
            requestId,
            timer
          );
          if (enhanced && enhanced.length >= MIN_NARRATIVE_LENGTH) {
            narrativeText = enhanced;
            narrativeSource = 'openai';
            timer.log(`[AI_REPORT] Narrative-only call succeeded: len=${enhanced.length}`);
          }
        }
      }

      // CRITICAL: Set narrative on baseAiReport if we have valid text
      // This ensures it flows through to normalization
      if (narrativeText && typeof narrativeText === 'string' && narrativeText.trim().length > 0) {
        baseAiReport.narrative = narrativeText.trim();
        timer.log(`[AI_REPORT] ✓ Narrative set on baseAiReport: len=${baseAiReport.narrative.length}, source=${narrativeSource}`);
        console.log(`[AI_REPORT] ✓ Narrative set on baseAiReport: len=${baseAiReport.narrative.length}, source=${narrativeSource}`);
      } else {
        timer.log(`[AI_REPORT] ⚠ Narrative NOT set on baseAiReport (text=${narrativeText ? 'present but invalid' : 'undefined'})`);
        console.log(`[AI_REPORT] ⚠ Narrative NOT set on baseAiReport (text=${narrativeText ? 'present but invalid' : 'undefined'})`);
      }

      // Per-version report: use spec.aiReport.byVersion if present (already trimmed to match versionVariants), else build from global narrative. MUST always have byVersion with at least A.
      const specByVersion = result.spec.aiReport?.byVersion && typeof result.spec.aiReport.byVersion === 'object'
        ? result.spec.aiReport.byVersion as Record<string, AiReportPerVersion>
        : null;
      if (specByVersion && Object.keys(specByVersion).length > 0) {
        baseAiReport.byVersion = { ...specByVersion };
        timer.log(`[AI_REPORT] ✓ byVersion from spec: ${Object.keys(specByVersion).join(', ')}`);
      } else {
        const narrativeForA = (baseAiReport.narrative && baseAiReport.narrative.trim().length > 0)
          ? baseAiReport.narrative.trim()
          : FALLBACK_A_NARRATIVE;
        baseAiReport.byVersion = { A: { narrative: narrativeForA } };
        timer.log('[AI_REPORT] ✓ byVersion built from global narrative (A only)');
      }
      if (!baseAiReport.byVersion.A?.narrative?.trim()) {
        baseAiReport.byVersion.A = { narrative: baseAiReport.narrative?.trim() || FALLBACK_A_NARRATIVE };
      }
      // When B/C are effective but narratives missing, attempt one fast secondary OpenAI call (no minimum A length)
      const needsB = effectiveRequestedVersions.B && (!baseAiReport.byVersion?.B?.narrative?.trim());
      const needsC = effectiveRequestedVersions.C && (!baseAiReport.byVersion?.C?.narrative?.trim());
      if ((needsB || needsC) && baseAiReport.byVersion) {
        const existingA = baseAiReport.byVersion.A?.narrative?.trim() || baseAiReport.narrative?.trim() || '';
        const filled = await generateMissingByVersionNarrativesCall(
          result.spec,
          effectiveRequestedVersions,
          existingA.length > 0 ? existingA : FALLBACK_A_NARRATIVE,
          requestId,
          timer
        );
        if (filled) {
          if (filled.A?.narrative && !baseAiReport.byVersion.A?.narrative?.trim()) baseAiReport.byVersion.A = { narrative: filled.A.narrative };
          if (filled.B?.narrative && !baseAiReport.byVersion?.B?.narrative?.trim()) baseAiReport.byVersion!.B = { narrative: filled.B.narrative };
          if (filled.C?.narrative && !baseAiReport.byVersion?.C?.narrative?.trim()) baseAiReport.byVersion!.C = { narrative: filled.C.narrative };
        }
      }
      // Guarantee byVersion.A/B/C for effective versions (deterministic fallbacks if still missing)
      const meta = { subject: result.spec.meta?.subject, grade: result.spec.meta?.gradeLevel, groupName: result.spec.meta?.groupName ?? groupContext?.groupName };
      let reportWithGuaranteedByVersion = ensureByVersionNarratives(baseAiReport, effectiveRequestedVersions, meta);
      
      // CRITICAL: Normalize aiReport to match frontend contract (AIDesignReportData)
      let normalizedAiReport: Record<string, unknown> = normalizeAiReportForFrontend(
        reportWithGuaranteedByVersion,
        result.spec,
        effectiveRequestedVersions
      );
      
      // Safety: hard-ensure byVersion again on normalized output (prevent any later overwrite)
      normalizedAiReport = ensureByVersionNarratives(normalizedAiReport, effectiveRequestedVersions, meta) as Record<string, unknown>;
      
      // Runtime validation: ensure narrative is valid if present
      if (normalizedAiReport.narrative !== undefined) {
        if (typeof normalizedAiReport.narrative !== 'string' || normalizedAiReport.narrative.trim().length === 0) {
          // Invalid narrative - remove it
          delete normalizedAiReport.narrative;
          if (!narrativeWarning) {
            narrativeWarning = {
              code: 'AI_REPORT_NARRATIVE_INVALID',
              message: 'El narrative generado no es válido',
              severity: 'warning'
            };
          }
        }
      }
      
      // CRITICAL: Log final narrative status before returning response
      const finalNarrative = normalizedAiReport.narrative;
      if (finalNarrative && typeof finalNarrative === 'string' && finalNarrative.trim().length > 0) {
        timer.log(`[AI_REPORT] ✓ Final narrative PRESENT in response: len=${finalNarrative.length}, source=${narrativeSource}`);
        console.log(`[AI_REPORT] ✓ Final narrative PRESENT in response: len=${finalNarrative.length}, source=${narrativeSource}`);
        console.log(`[AI_REPORT] Narrative preview: ${finalNarrative.slice(0, 100)}...`);
      } else {
        timer.log(`[AI_REPORT] ✗ Final narrative MISSING in response: source=${narrativeSource}, type=${typeof finalNarrative}`);
        console.log(`[AI_REPORT] ✗ Final narrative MISSING in response: source=${narrativeSource}, type=${typeof finalNarrative}`);
        console.log(`[AI_REPORT] normalizedAiReport keys: ${Object.keys(normalizedAiReport).join(', ')}`);
        if (narrativeWarning) {
          console.log(`[AI_REPORT] Warning present: ${narrativeWarning.code} - ${narrativeWarning.message}`);
        }
      }
      
      // Build final response: root aiReport is canonical; do not duplicate aiReport inside evaluationSpec
      const evaluationSpecForResponse = { ...result.spec } as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(evaluationSpecForResponse, 'aiReport')) {
        delete evaluationSpecForResponse.aiReport;
      }
      const specHasAiReportAfterStrip = Object.prototype.hasOwnProperty.call(evaluationSpecForResponse, 'aiReport');
      const byVersionOut = (normalizedAiReport as Record<string, unknown>).byVersion as Record<string, { narrative?: string }> | undefined;
      const byVersionKeys = Object.keys(byVersionOut || {});
      const aiReportByVersionLens = {
        A: byVersionOut?.A?.narrative?.length ?? 0,
        B: byVersionOut?.B?.narrative?.length ?? 0,
        C: byVersionOut?.C?.narrative?.length ?? 0
      };
      console.log('[AI_REPORT] effective versions', effectiveRequestedVersions, 'byVersion keys', byVersionKeys, 'lens', aiReportByVersionLens);
      if (effectiveRequestedVersions.B && !(byVersionOut?.B?.narrative?.trim?.())) {
        console.warn('[AI_REPORT] effective B but B.narrative missing (should not happen after fixes)');
      }
      if (effectiveRequestedVersions.C && !(byVersionOut?.C?.narrative?.trim?.())) {
        console.warn('[AI_REPORT] effective C but C.narrative missing (should not happen after fixes)');
      }
      console.log('[BUILD_FINGERPRINT]', DEBUG_BUILD, 'requestId=', requestId);
      const response: V2Response = {
        success: true,
        evaluationSpec: evaluationSpecForResponse as typeof result.spec,
        requestedVersions: effectiveRequestedVersions,
        instrumentDesignRulesApplied: instrumentDesignRules,
        teacherRemindersByStudent: teacherReminders,
        aiReport: normalizedAiReport, // Normalized to match AIDesignReportData contract
        warnings: [
          ...result.warnings,
          ...(narrativeWarning ? [narrativeWarning] : [])
        ],
        debug: {
          build: DEBUG_BUILD,
          model: 'gpt-4.1-2025-04-14',
          promptTokensEstimate: Math.ceil(result.debug.promptLength / 4),
          completionTokensEstimate: Math.ceil(result.debug.responseLength / 4),
          attempt: result.attempt,
          extractionMethod: result.extractionMethod,
          requestId,
          timings: timer.summary(),
          totalDurationMs: timer.elapsed(),
          openaiDurationMs: result.debug.openaiDurationMs,
          timeoutUsedMs: result.debug.timeoutUsedMs,
          retryReason: result.debug.retryReason,
          attempts: result.attempts || [],
          narrativeSource: narrativeSource,
          narrativePresent: !!(normalizedAiReport.narrative && typeof normalizedAiReport.narrative === 'string' && normalizedAiReport.narrative.trim().length > 0),
          specHasAiReportAfterStrip,
          aiReportByVersionKeys: byVersionKeys,
          aiReportByVersionLens
        }
      };
      
      timer.log(`[DEPLOY_CHECK] ${DEBUG_BUILD} SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms`);
      
      return new Response(JSON.stringify(response), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        }
      });
    } else {
      // CRITICAL: Both attempts failed - use EMERGENCY TEMPLATE (non-AI fallback)
      // This ensures V2 never falls back to V1 due to OpenAI unavailability
      timer.log('══════════════════════════════════════════════════════════════════');
      timer.log('⚠️ [V2_EMERGENCY] BOTH ATTEMPTS FAILED - Using emergency template');
      timer.log('══════════════════════════════════════════════════════════════════');
      timer.log(`[V2_EMERGENCY] warnings: ${JSON.stringify(result.warnings.map(w => ({code: w.code, message: w.message})))}`);
      timer.log(`[V2_EMERGENCY] attempts: ${result.attempts?.length || 0}`);
      
      try {
        // Build emergency template spec (non-AI, deterministic)
        const emergencySpec = buildEmergencyTemplateSpec(
          groupContext || {},
          requestedVersions,
          evaluation_design_plan
        );
        
        // Record emergency template attempt
        const emergencyAttempt = {
          attempt: 3,
          mode: 'emergency_template' as const,
          model: 'none',
          timeoutMs: 0,
          maxTokens: 0,
          promptSizeKB: 0,
          startedAtMs: timer.elapsed(),
          outcome: 'success' as const,
          errorMessage: undefined as string | undefined,
          openaiDurationMs: undefined as number | undefined
        };
        
        const allAttempts = [...(result.attempts || []), emergencyAttempt];
        
        // Add emergency warning
        const emergencyWarnings = [
          ...result.warnings,
          {
            code: 'OPENAI_UNAVAILABLE_EMERGENCY_FALLBACK',
            message: 'El servicio de IA no está disponible. Se generó una evaluación de contingencia mínima. Por favor, revise y ajuste según sea necesario.',
            severity: 'error' as const
          }
        ];
        
        // Build response with emergency spec (success:true to prevent V1 fallback)
        const response: V2Response = {
          success: true, // CRITICAL: Must be true to prevent V1 fallback
          evaluationSpec: emergencySpec,
          requestedVersions,
          instrumentDesignRulesApplied: instrumentDesignRules,
          teacherRemindersByStudent: teacherReminders,
          aiReport: null, // No AI report for emergency template
          warnings: emergencyWarnings,
          debug: {
            build: DEBUG_BUILD,
            model: 'emergency_template',
            promptTokensEstimate: 0,
            completionTokensEstimate: 0,
            attempt: 3,
            extractionMethod: 'emergency_template',
            requestId,
            timings: timer.summary(),
            totalDurationMs: timer.elapsed(),
            attempts: allAttempts
          }
        };
        
        timer.log(`✓ EMERGENCY TEMPLATE: Generated minimal spec with ${emergencySpec.sections.length} section(s), ${emergencySpec.sections.reduce((sum, s) => sum + s.items.length, 0)} items`);
        
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (emergencyError) {
        // Even emergency template failed - this should never happen, but handle gracefully
        const errorMsg = emergencyError instanceof Error ? emergencyError.message : String(emergencyError);
        timer.log(`✗ EMERGENCY TEMPLATE FAILED: ${errorMsg}`);
        
        const response = buildSafeMinimalResponse(
          [
            ...result.warnings,
            {
              code: 'EMERGENCY_TEMPLATE_FAILED',
              message: `Error crítico: No se pudo generar evaluación de contingencia: ${errorMsg}`,
              severity: 'error' as const
            }
          ],
          requestedVersions,
          instrumentDesignRules,
          teacherReminders
        );
        
        // Add debug info with attempts
        (response as V2Response & { debug?: unknown }).debug = {
          build: DEBUG_BUILD,
          model: 'gpt-4.1-2025-04-14',
          promptTokensEstimate: Math.ceil(result.debug.promptLength / 4),
          completionTokensEstimate: Math.ceil(result.debug.responseLength / 4),
          attempt: result.attempt,
          extractionMethod: result.extractionMethod,
          requestId,
          timings: timer.summary(),
          totalDurationMs: timer.elapsed(),
          openaiDurationMs: result.debug.openaiDurationMs,
          timeoutUsedMs: result.debug.timeoutUsedMs,
          retryReason: result.debug.retryReason,
          promptSizeKB: (result.debug.promptLength / 1024).toFixed(1),
          attempts: result.attempts || []
        };
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('🔥 [V2_UNHANDLED_ERROR] Unhandled exception caught');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(`[V2_UNHANDLED_ERROR] message: ${errorMsg}`);
    console.log(`[V2_UNHANDLED_ERROR] stack: ${errorStack?.slice(0, 500)}`);
    timer.log(`UNHANDLED ERROR: ${errorMsg}`);
    
    const response: V2Response = {
      success: false,
      evaluationSpec: null,
      requestedVersions: { A: true, B: false, C: false },
      instrumentDesignRulesApplied: [],
      teacherRemindersByStudent: [],
      aiReport: null,
      warnings: [{
        code: 'UNHANDLED_ERROR',
        message: `Error interno: ${errorMsg}`,
        severity: 'error'
      }],
      debug: {
        build: DEBUG_BUILD,
        model: 'gpt-4.1-2025-04-14',
        promptTokensEstimate: 0,
        completionTokensEstimate: 0,
        attempt: 0,
        extractionMethod: 'failed',
        requestId,
        timings: timer.summary(),
        totalDurationMs: timer.elapsed()
      }
    };
    
    return new Response(JSON.stringify(response), {
      status: 200, // Return 200 to allow frontend to handle gracefully
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
