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
// MODEL CONFIGURATION (env overrides for stability / cost)
// ============================================================================
const OPENAI_MODEL_PRIMARY = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-4o';
const OPENAI_MODEL_FALLBACK = Deno.env.get('OPENAI_MODEL_FALLBACK') || 'gpt-4o-mini';

// ============================================================================
// TIMEOUT CONFIGURATION (Robust: 120s per attempt, deterministic retries)
// ============================================================================
const OPENAI_TIMEOUT_PER_ATTEMPT_MS = 120000;  // 120s per attempt (user requirement)
const OPENAI_TIMEOUT_GENERATE_MS = OPENAI_TIMEOUT_PER_ATTEMPT_MS;
const OPENAI_TIMEOUT_RETRY_MS = OPENAI_TIMEOUT_PER_ATTEMPT_MS;
const OPENAI_TIMEOUT_ADJUST_MS = 60000;       // 60s for adjust mode (smaller payload)
const TOTAL_TIMEOUT_MS = 400000;              // ~6.5 min total budget for 3 attempts of 120s

// Debug build stamp — change this when deploying to prove which code is running
const DEBUG_BUILD = 'v3-timeout-fix-DEPLOY-FP-2026-02-17-05';

/** Fingerprint for contingency responses (debuggable, non-destructive) */
const CONTINGENCY_FINGERPRINT = 'v3-contingency-debug-DEPLOY-FP-2026-02-17-04';

type ContingencyReason = 'openai_error' | 'openai_timeout' | 'invalid_payload' | 'spec_build_error' | 'unknown';

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
  promptB?: string;  // Content-adapted prompt for Version B (declared, non-equivalent)
  promptC?: string;  // Equivalent accessibility prompt for Version C
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
    aiReportByVersionHasEvidence?: { A: boolean; B: boolean; C: boolean };
    versionCDecision?: { shouldCreateC: boolean; explanation: string; triggersUsed: string[] };
    declaredContentAdaptationCount?: number;
    semanticMap?: { A: 'universal'; B: 'content_adaptation_declared'; C: 'equivalent_accessibility' };
    contingency?: boolean;
    contingencyReason?: string;
    contingencyFingerprint?: string;
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
    if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
      console.error(`[${requestId}] OpenAI request timed out after ${timeoutMs}ms`);
      throw new Error(`TIMEOUT: OpenAI request exceeded ${timeoutMs}ms limit`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Transient: retry. Non-transient: do not retry. */
function isTransientError(statusCode: number | undefined, errorMessage: string): boolean {
  if (statusCode === 408 || statusCode === 429) return true;
  if (statusCode != null && statusCode >= 500) return true;
  const msg = (errorMessage || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('abort') || msg.includes('econnreset') || msg.includes('network')) return true;
  return false;
}

/**
 * Call OpenAI with deterministic retries. Only retries on timeout / 408 / 429 / 5xx / transient network.
 */
async function callOpenAIWithRetries(
  purpose: string,
  requestId: string,
  buildRequest: (attempt: number, model: string) => { body: Record<string, unknown>; timeoutMs: number }
): Promise<{ ok: true; rawContent: string; attempt: number; model: string; ms: number } | { ok: false; error: string; attempt: number; statusCode?: number }> {
  const models = [OPENAI_MODEL_PRIMARY, OPENAI_MODEL_PRIMARY, OPENAI_MODEL_FALLBACK];
  let lastError = '';
  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const model = models[attempt - 1];
    const { body, timeoutMs } = buildRequest(attempt, model);
    const startMs = Date.now();
    console.log(`[OPENAI_CALL] start purpose=${purpose} model=${model} attempt=${attempt}`);
    try {
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
        requestId
      );
      const ms = Date.now() - startMs;
      console.log(`[OPENAI_CALL] end purpose=${purpose} model=${model} attempt=${attempt} ms=${ms}`);
      if (!response.ok) {
        const text = await response.text();
        lastError = `OpenAI API ${response.status}: ${text.slice(0, 200)}`;
        lastStatus = response.status;
        if (isTransientError(response.status, lastError) && attempt < 3) {
          console.log(`[OPENAI_RETRY] purpose=${purpose} reason=${response.status}`);
          continue;
        }
        return { ok: false, error: lastError, attempt, statusCode: response.status };
      }
      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content ?? '';
      return { ok: true, rawContent: typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent), attempt, model, ms };
    } catch (e) {
      const ms = Date.now() - startMs;
      lastError = e instanceof Error ? e.message : String(e);
      if (lastError.includes('TIMEOUT') || lastError.includes('Abort')) {
        console.log(`[OPENAI_TIMEOUT] purpose=${purpose} model=${model} attempt=${attempt}`);
      }
      if (isTransientError(undefined, lastError) && attempt < 3) {
        console.log(`[OPENAI_RETRY] purpose=${purpose} reason=${lastError.slice(0, 80)}`);
        continue;
      }
      console.log(`[OPENAI_FAIL_FINAL] purpose=${purpose} lastError=${lastError.slice(0, 120)}`);
      return { ok: false, error: lastError, attempt };
    }
  }
  console.log(`[OPENAI_FAIL_FINAL] purpose=${purpose} lastError=${lastError.slice(0, 120)}`);
  return { ok: false, error: lastError || 'All attempts failed', attempt: 3, statusCode: lastStatus };
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

function inferContingencyReason(attempts: Array<{ outcome?: string; errorMessage?: string }> | undefined): ContingencyReason {
  if (!attempts || attempts.length === 0) return 'unknown';
  const last = attempts[attempts.length - 1];
  const outcome = last?.outcome ?? 'unknown_error';
  const msg = (last?.errorMessage ?? '').toLowerCase();
  if (outcome === 'timeout') return 'openai_timeout';
  if (outcome === 'openai_error') return 'openai_error';
  if (outcome === 'parse_error' || outcome === 'validation_error') return 'spec_build_error';
  if (msg.includes('payload') || msg.includes('body') || msg.includes('invalid request')) return 'invalid_payload';
  return 'unknown';
}

function buildMinimalAiReportForContingency(
  reason: ContingencyReason,
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): AIReportV2 {
  const reasonText: Record<ContingencyReason, string> = {
    openai_error: 'El servicio de IA no respondió correctamente.',
    openai_timeout: 'El servicio de IA no respondió a tiempo.',
    invalid_payload: 'Los datos enviados no son válidos.',
    spec_build_error: 'No se pudo interpretar o validar la especificación generada.',
    unknown: 'Ocurrió un problema durante la generación.'
  };
  const actionText =
    'Puede reintentar la operación en unos momentos. Si el problema persiste, revise los materiales y el plan de diseño, o contacte soporte.';
  const narrativeA =
    `Se utilizó una evaluación de contingencia porque ${reasonText[reason]} ${actionText}`;
  const byVersion: AIReportV2['byVersion'] = {
    A: { narrative: narrativeA }
  };
  if (requestedVersions.B) byVersion.B = { narrative: narrativeA };
  if (requestedVersions.C) byVersion.C = { narrative: narrativeA };
  return {
    narrative: narrativeA,
    byVersion,
    designRationale: 'Evaluación de contingencia generada por fallo del servicio de IA.',
    versionsExplanation: {
      generated: ['A', ...(requestedVersions.B ? ['B'] : []), ...(requestedVersions.C ? ['C'] : [])],
      notGenerated: {}
    },
    contemplacionesApplied: {
      instrumentDesign: [],
      adminReminders: 0,
      correctionReminders: 0
    },
    responseOptions: { included: false }
  };
}

// Deterministic fallback narratives when model or secondary call omit byVersion.B/C
const FALLBACK_A_NARRATIVE = 'Reporte de diseño. Contenidos y competencias alineados con la evaluación.';
/** When evaluationSpec exists but narrative generation timed out or failed */
const NARRATIVE_TIMEOUT_MESSAGE = 'La generación de narrativas por IA no estuvo disponible; la evaluación está lista. Ver evidencia a continuación.';
const FALLBACK_B_NARRATIVE = 'Versión B (adaptación de contenido declarada): esta versión no es comparable con A/C porque ajusta objetivos o contenidos, manteniendo accesibilidad con diseño, administración y corrección.';
const FALLBACK_C_NARRATIVE = 'Versión C (adaptación equivalente de accesibilidad): mantiene los mismos objetivos, criterios, rúbrica y demanda cognitiva que A, cambiando solo formato/andamiaje para remover barreras.';

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
        versionDescriptions.push('Versión B aplica adaptación de contenido declarada (no comparable)');
      }
      if (backendReport.versionsExplanation.generated.includes('C')) {
        versionDescriptions.push('Versión C aplica accesibilidad equivalente de formato');
      }
      if (versionDescriptions.length > 0) {
        versions.reason = `Versión A es universal; ${versionDescriptions.join('; ')}. A y C mantienen la misma demanda cognitiva.`;
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

type VersionKey = 'A' | 'B' | 'C';

interface VersionTriggerCount {
  key: string;
  count: number;
}

interface VersionRationalePackItem {
  version: VersionKey;
  assignedStudents: string[];
  topTriggers: VersionTriggerCount[];
  whySummary: string;
  designChanges: string[];
  adminCorrectionReminders: string[];
}

type VersionRationalePack = Record<VersionKey, VersionRationalePackItem>;

type ContemplacionesByStudent = Record<string, Array<string | Record<string, unknown>>>;

interface SpecEvidenceItemSummary {
  id: string;
  sectionId: string;
  type: string;
  points: number;
  hasB: boolean;
  hasC: boolean;
  hasOptionsB: boolean;
  hasEquivalentResponseOptions: boolean;
}

interface SpecEvidenceSectionSummary {
  id: string;
  title: string;
  itemCount: number;
  /** Material or dossier fragment reference, if present in spec metadata */
  materialRef?: string;
}

interface SpecEvidenceSummary {
  sections: SpecEvidenceSectionSummary[];
  items: SpecEvidenceItemSummary[];
  changedItemsB: string[];
  changedItemsC: string[];
}

type ContemplationCategory = 'design' | 'admin' | 'correction' | 'content_adaptation';

interface ContemplationMeta {
  category: ContemplationCategory;
  label: string;
  canonicalKey: string;
}

const CONTEMPLATION_REGISTRY: Record<string, ContemplationMeta> = {
  '1': { category: 'admin', label: 'Tiempo adicional para completar la evaluación', canonicalKey: 'más tiempo' },
  '2': { category: 'design', label: 'Consignas en lectura fácil', canonicalKey: 'consignas lectura fácil' },
  '3': { category: 'admin', label: 'Pausas breves durante la prueba', canonicalKey: 'pausas breves' },
  '4': { category: 'design', label: 'Apoyos visuales en consignas', canonicalKey: 'apoyos visuales' },
  '5': { category: 'design', label: 'Plantillas de respuesta', canonicalKey: 'plantillas de respuesta' },
  '6': { category: 'admin', label: 'Lectura oral de consignas por docente', canonicalKey: 'lectura oral de consignas' },
  '7': { category: 'admin', label: 'Ubicación con baja distracción', canonicalKey: 'entorno de baja distracción' },
  '8': { category: 'admin', label: 'Seguimiento frecuente de avance', canonicalKey: 'seguimiento frecuente' },
  '9': { category: 'correction', label: 'No penalizar ortografía cuando no es objetivo', canonicalKey: 'no penalizar ortografía' },
  '10': { category: 'admin', label: 'Recordatorios de tiempo intermedio', canonicalKey: 'recordatorios de tiempo' },
  '11': { category: 'admin', label: 'Reforzar comprensión de consigna al inicio', canonicalKey: 'refuerzo de comprensión de consigna' },
  '12': { category: 'design', label: 'Segmentación de consignas en pasos claros', canonicalKey: 'consignas en pasos' },
  '13': { category: 'design', label: 'Formato de respuesta estructurado', canonicalKey: 'formato de respuesta estructurado' },
  '14': { category: 'design', label: 'Vocabulario más accesible', canonicalKey: 'vocabulario más accesible' },
  '15': { category: 'admin', label: 'Recordatorio de estrategia antes de responder', canonicalKey: 'recordatorio de estrategia' },
  '16': { category: 'design', label: 'Ejemplos breves de formato esperado', canonicalKey: 'ejemplos de formato esperado' },
  '17': { category: 'design', label: 'Resaltar palabras clave en consignas', canonicalKey: 'resaltar palabras clave' },
  '18': { category: 'design', label: 'Andamiaje con preguntas guía', canonicalKey: 'preguntas guía' },
  '19': { category: 'design', label: 'División de tareas extensas en subpasos', canonicalKey: 'subpasos de tarea' },
  '20': { category: 'admin', label: 'Control de ritmo por bloques', canonicalKey: 'control de ritmo por bloques' },
  '21': { category: 'admin', label: 'Chequeos de comprensión durante la administración', canonicalKey: 'chequeos de comprensión' },
  '22': { category: 'correction', label: 'Priorizar contenido sobre presentación formal', canonicalKey: 'priorizar contenido sobre forma' },
  '23': { category: 'design', label: 'Opciones equivalentes de respuesta escrita', canonicalKey: 'opciones equivalentes de respuesta escrita' },
  '24': { category: 'admin', label: 'Apoyo para organizar tiempos de resolución', canonicalKey: 'apoyo de organización temporal' },
  '25': { category: 'admin', label: 'Permitir breves clarificaciones de procedimiento', canonicalKey: 'clarificación de procedimiento' },
  '26': { category: 'admin', label: 'Monitoreo individual de avance', canonicalKey: 'monitoreo individual' },
  '27': { category: 'design', label: 'Mnemonic starter cues (anchors/guide words)', canonicalKey: 'apoyos mnemotécnicos iniciales' },
};

const KNOWN_CONTEMPLATION_LABELS = new Set(
  Object.values(CONTEMPLATION_REGISTRY).map(meta => meta.label.toLowerCase())
);
const KNOWN_CONTEMPLATION_LABELS_MATCH = new Set(
  [...KNOWN_CONTEMPLATION_LABELS].map(label => label.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
);
const CANONICAL_KEY_TO_LABEL = new Map(
  Object.values(CONTEMPLATION_REGISTRY).map(meta => [meta.canonicalKey, meta.label])
);
const DESIGN_CANONICAL_KEYS = new Set(
  Object.values(CONTEMPLATION_REGISTRY)
    .filter(meta => meta.category === 'design')
    .map(meta => meta.canonicalKey)
);

/** Short functional effect in plain language (for pedagogical narrative only) */
function contemplationFunctionalEffect(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('pasos') || lower.includes('segmentación')) return 'reduce la carga de tener que planificar todo de una vez.';
  if (lower.includes('plantilla') || lower.includes('estructurado')) return 'ayuda a organizar la respuesta sin cambiar qué se pide.';
  if (lower.includes('lectura fácil') || lower.includes('vocabulario')) return 'facilita entender la consigna, no la tarea.';
  if (lower.includes('visual') || lower.includes('palabras clave')) return 'dirige la atención a lo importante.';
  if (lower.includes('preguntas guía') || lower.includes('andamiaje')) return 'ofrece puntos de apoyo sin dar la respuesta.';
  if (lower.includes('subpasos') || lower.includes('división')) return 'reparte la tarea en partes manejables.';
  if (lower.includes('opciones equivalentes')) return 'permite elegir el formato de respuesta manteniendo la misma evidencia.';
  if (lower.includes('ejemplo')) return 'aclara el formato esperado.';
  return 'facilita el acceso sin bajar lo que se exige.';
}

function normalizeTriggerLabel(raw: string): string {
  const compact = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const cleaned = compact.replace(/[.;,:]+$/g, '').trim();
  if (!cleaned) return '';
  const replacements: Array<{ from: RegExp; to: string }> = [
    { from: /\bbrindar\s+m[aá]s\s+tiempo\b/g, to: 'más tiempo' },
    { from: /\bdar\s+m[aá]s\s+tiempo\b/g, to: 'más tiempo' },
    { from: /\bconsignas?\s+paso\s+a\s+paso\b/g, to: 'consignas en pasos' },
    { from: /\bvocabulario\s+simplificado\b/g, to: 'vocabulario más accesible' },
  ];
  let normalized = cleaned;
  for (const rule of replacements) normalized = normalized.replace(rule.from, rule.to);
  return normalized;
}

function getContemplationMetaByToken(token: unknown): ContemplationMeta | null {
  if (typeof token === 'number') return CONTEMPLATION_REGISTRY[String(token)] || null;
  if (typeof token === 'string') {
    const trimmed = token.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return CONTEMPLATION_REGISTRY[trimmed] || null;
  }
  if (token && typeof token === 'object') {
    const obj = token as Record<string, unknown>;
    if (typeof obj.id === 'number' || typeof obj.id === 'string') {
      const key = String(obj.id).trim();
      if (/^\d+$/.test(key)) return CONTEMPLATION_REGISTRY[key] || null;
    }
    if (typeof obj.contemplacionId === 'number' || typeof obj.contemplacionId === 'string') {
      const key = String(obj.contemplacionId).trim();
      if (/^\d+$/.test(key)) return CONTEMPLATION_REGISTRY[key] || null;
    }
  }
  return null;
}

function extractStringSignals(value: unknown, depth = 0): string[] {
  if (depth > 2 || value == null) return [];
  const meta = getContemplationMetaByToken(value);
  if (meta) return [meta.canonicalKey];
  if (typeof value === 'string') {
    const normalized = normalizeTriggerLabel(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(v => extractStringSignals(v, depth + 1));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: string[] = [];
    const directKeys = ['label', 'name', 'reason', 'trigger', 'description', 'text'];
    for (const key of directKeys) {
      if (obj[key] !== undefined) out.push(...extractStringSignals(obj[key], depth + 1));
    }
    return out;
  }
  return [];
}

function hasKnownContemplationLabel(narrative: string): boolean {
  const lower = narrative
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const label of KNOWN_CONTEMPLATION_LABELS_MATCH) {
    if (lower.includes(label)) return true;
  }
  return false;
}

function toHumanTriggerLabel(key: string): string {
  const fromRegistry = CANONICAL_KEY_TO_LABEL.get(key);
  if (fromRegistry) return fromRegistry;
  const contemplacionMatch = /^contemplacion-(\d+)$/i.exec(key.trim());
  if (contemplacionMatch) {
    const meta = CONTEMPLATION_REGISTRY[contemplacionMatch[1]];
    if (meta) return meta.label;
  }
  return key;
}

function fallbackTriggerLabelForVersion(version: VersionKey): string {
  if (version === 'A') return 'Versión base común para el grupo';
  if (version === 'B') return 'Adecuaciones de acceso y andamiaje (Versión B)';
  return 'Adecuaciones excepcionales de contenido/estructura (Versión C)';
}

function summarizeTopTriggers(topTriggers: VersionTriggerCount[], version: VersionKey): string {
  if (topTriggers.length === 0) {
    if (version === 'A') return 'Versión A se mantiene como base común para todo el grupo.';
    if (version === 'B') return 'Versión B se activa por necesidades de acceso y andamiaje declaradas en el plan.';
    return 'Versión C se activa por adecuaciones excepcionales de contenido/estructura declaradas en el plan.';
  }
  const top = topTriggers.slice(0, 3).map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`).join('; ');
  if (version === 'A') return `Predominan señales comunes del grupo: ${top}.`;
  return `Se priorizan estas señales para la versión ${version}: ${top}.`;
}

function toVersionKey(value: unknown): VersionKey {
  return value === 'B' ? 'B' : value === 'C' ? 'C' : 'A';
}

function buildStudentMaps(students: Array<Record<string, unknown>>): {
  studentById: Map<string, Record<string, unknown>>;
  nameById: Map<string, string>;
  idByNameLower: Map<string, string>;
  orderedStudentIds: string[];
} {
  const studentById = new Map<string, Record<string, unknown>>();
  const nameById = new Map<string, string>();
  const idByNameLower = new Map<string, string>();
  const orderedStudentIds: string[] = [];
  for (const student of students) {
    const rawId = student?.studentId;
    if (rawId == null) continue;
    const sid = String(rawId);
    const displayName = typeof student?.displayName === 'string' && student.displayName.trim().length > 0
      ? student.displayName.trim()
      : `Estudiante ${sid}`;
    studentById.set(sid, student);
    nameById.set(sid, displayName);
    idByNameLower.set(displayName.toLowerCase(), sid);
    orderedStudentIds.push(sid);
  }
  return { studentById, nameById, idByNameLower, orderedStudentIds };
}

function resolveAssignedStudentsByVersion(
  studentAssignmentsPrimary: Record<string, unknown>,
  studentAssignmentsFallback: Record<string, unknown>,
  students: Array<Record<string, unknown>>,
  declaredContentAdaptationByStudent?: Record<string, boolean>
): { A: string[]; B: string[]; C: string[] } {
  const { nameById, idByNameLower, orderedStudentIds } = buildStudentMaps(students);
  const assignments = Object.keys(studentAssignmentsPrimary || {}).length > 0
    ? studentAssignmentsPrimary
    : studentAssignmentsFallback;

  const assignedVersionById = new Map<string, VersionKey>();
  for (const [sid, rawVersion] of Object.entries(assignments || {})) {
    assignedVersionById.set(String(sid), toVersionKey(rawVersion));
  }
  for (const sid of orderedStudentIds) {
    if (!assignedVersionById.has(sid)) assignedVersionById.set(sid, 'A');
  }

  // Explicit content adaptation always routes to B when available.
  if (declaredContentAdaptationByStudent && typeof declaredContentAdaptationByStudent === 'object') {
    for (const [studentKey, isDeclared] of Object.entries(declaredContentAdaptationByStudent)) {
      if (!isDeclared) continue;
      const byId = orderedStudentIds.includes(studentKey) ? studentKey : undefined;
      const byName = idByNameLower.get(studentKey.toLowerCase().trim());
      const resolvedId = byId || byName;
      if (resolvedId) assignedVersionById.set(resolvedId, 'B');
    }
  }

  const result: { A: string[]; B: string[]; C: string[] } = { A: [], B: [], C: [] };
  for (const [sid, version] of assignedVersionById.entries()) {
    const name = nameById.get(sid) || `Estudiante ${sid}`;
    result[version].push(name);
  }
  return result;
}

function resolveDeclaredContentAdaptationByStudent(
  designPlan: Record<string, unknown>,
  students: Array<Record<string, unknown>>
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const explicit = designPlan?.declaredContentAdaptationByStudent;
  if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
    for (const [key, value] of Object.entries(explicit as Record<string, unknown>)) {
      out[String(key)] = value === true;
    }
  }
  for (const student of students) {
    const sidRaw = student?.studentId;
    if (sidRaw == null) continue;
    const sid = String(sidRaw);
    if (student?.hasDeclaredContentAdaptation === true) out[sid] = true;
  }
  return out;
}

interface VersionCDecision {
  shouldCreateC: boolean;
  explanation: string;
  triggersUsed: string[];
}

function buildContemplacionesByStudentFromRequest(
  designPlan: Record<string, unknown>,
  students: Array<Record<string, unknown>>
): ContemplacionesByStudent {
  const out: ContemplacionesByStudent = {};
  const direct = designPlan?.contemplacionesByStudent;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    for (const [sid, raw] of Object.entries(direct as Record<string, unknown>)) {
      const values = Array.isArray(raw) ? raw : extractStringSignals(raw);
      if (values.length > 0) out[String(sid)] = values as Array<string | Record<string, unknown>>;
    }
  }
  for (const student of students) {
    const sidRaw = student?.studentId;
    if (sidRaw == null) continue;
    const sid = String(sidRaw);
    if (out[sid]?.length) continue;
    const signals = extractStringSignals((student as Record<string, unknown>).contemplaciones);
    if (signals.length > 0) out[sid] = signals;
  }
  return out;
}

function evaluateDesignPackageNeedForC(
  students: Array<Record<string, unknown>>,
  contemplacionesByStudent: ContemplacionesByStudent,
  teacherRemindersByStudent: TeacherReminderV2[]
): VersionCDecision {
  const { idByNameLower, orderedStudentIds } = buildStudentMaps(students);
  const reminderByName = new Map<string, TeacherReminderV2>();
  for (const r of teacherRemindersByStudent || []) {
    if (r.studentName) reminderByName.set(r.studentName.trim().toLowerCase(), r);
  }

  const designKeysCounter = new Map<string, number>();
  let designStudents = 0;
  let adminCorrectionOnlyStudents = 0;

  for (const sid of orderedStudentIds) {
    const structured = contemplacionesByStudent?.[sid] || [];
    const designKeys = extractStringSignals(structured).filter(key => DESIGN_CANONICAL_KEYS.has(key));
    if (designKeys.length > 0) {
      designStudents += 1;
      for (const key of designKeys) {
        designKeysCounter.set(key, (designKeysCounter.get(key) || 0) + 1);
      }
      continue;
    }

    const studentName = students.find(s => String(s.studentId) === sid)?.displayName;
    const reminder = typeof studentName === 'string'
      ? reminderByName.get(studentName.trim().toLowerCase())
      : undefined;
    const fallbackSignals = [
      ...(Array.isArray(reminder?.admin) ? reminder.admin : []),
      ...(Array.isArray(reminder?.correction) ? reminder.correction : [])
    ].flatMap(text => extractStringSignals(text));
    if (fallbackSignals.length > 0) adminCorrectionOnlyStudents += 1;
  }

  const totalStudents = Math.max(1, orderedStudentIds.length);
  const uniqueDesignKeys = [...designKeysCounter.keys()];
  const strongBarrierKeys = new Set([
    'consignas en pasos',
    'plantillas de respuesta',
    'opciones equivalentes de respuesta escrita',
    'apoyos mnemotécnicos iniciales',
  ]);
  const hasStrongBarrierSignal = uniqueDesignKeys.some(key => strongBarrierKeys.has(key));
  const requiresFormatSplit =
    designStudents > 0 &&
    (
      uniqueDesignKeys.length >= 2 ||
      (designStudents / totalStudents) >= 0.25 ||
      hasStrongBarrierSignal
    ) &&
    designStudents >= adminCorrectionOnlyStudents;

  const triggersUsed = [...designKeysCounter.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, 5)
    .map(([key, count]) => `${toHumanTriggerLabel(key)} (${count})`);

  const explanation = requiresFormatSplit
    ? `Se crea versión C: paquete de diseño equivalente detectado (estudiantes con diseño=${designStudents}/${totalStudents}; claves=${uniqueDesignKeys.length}).`
    : `No se crea versión C: administración/corrección alcanza o no hay paquete de diseño suficiente (diseño=${designStudents}/${totalStudents}; claves=${uniqueDesignKeys.length}).`;

  return {
    shouldCreateC: requiresFormatSplit,
    explanation,
    triggersUsed
  };
}

function extractTriggersForStudents(
  assignedStudents: string[],
  students: Array<Record<string, unknown>>,
  teacherRemindersByStudent: TeacherReminderV2[],
  contemplacionesByStudent?: ContemplacionesByStudent
): Array<{ key: string; count: number }> {
  const { studentById, idByNameLower } = buildStudentMaps(students);
  const reminderByName = new Map<string, TeacherReminderV2>();
  for (const r of teacherRemindersByStudent || []) {
    if (r.studentName) reminderByName.set(r.studentName.trim().toLowerCase(), r);
  }

  const counts = new Map<string, number>();
  const addSignal = (value: unknown) => {
    const signals = extractStringSignals(value);
    for (const signal of signals) {
      const key = normalizeTriggerLabel(signal);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  };

  for (const name of assignedStudents) {
    const nameKey = name.trim().toLowerCase();
    const sid = idByNameLower.get(nameKey);
    let usedHigherPrioritySource = false;
    if (sid) {
      const structured = contemplacionesByStudent?.[sid];
      if (structured && structured.length > 0) {
        addSignal(structured);
        usedHigherPrioritySource = true;
      } else {
        const studentSignals = extractStringSignals(studentById.get(sid)?.contemplaciones);
        if (studentSignals.length > 0) {
          addSignal(studentSignals);
          usedHigherPrioritySource = true;
        }
      }
      const student = studentById.get(sid) || {};
      if (student?.hasDeclaredContentAdaptation === true || student?.requiresContentAdaptation === true) {
        addSignal('adecuación de contenido declarada');
      }
    }
    // Priority 3 fallback only if 1) and 2) are not available for this student.
    if (!usedHigherPrioritySource) {
      const reminder = reminderByName.get(nameKey);
      if (reminder) {
        addSignal(reminder.admin || []);
        addSignal(reminder.correction || []);
      }
    }
  }

  if (counts.size === 0) {
    return [{ key: '(sin datos)', count: Math.max(1, assignedStudents.length) }];
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'es'))
    .slice(0, 5);
}

function buildVersionRationalePack(
  selectedVersion: VersionKey,
  effectiveRequestedVersions: { A: boolean; B: boolean; C: boolean },
  assignedStudents: string[],
  students: Array<Record<string, unknown>>,
  teacherRemindersByStudent: TeacherReminderV2[],
  contemplacionesByStudent?: ContemplacionesByStudent,
  instrumentDesignRules: string[] = []
): VersionRationalePackItem {
  if (selectedVersion === 'B' && !effectiveRequestedVersions.B) {
    return { version: 'B', assignedStudents: [], topTriggers: [], whySummary: 'Versión B no está efectiva en esta evaluación.', designChanges: [], adminCorrectionReminders: [] };
  }
  if (selectedVersion === 'C' && !effectiveRequestedVersions.C) {
    return { version: 'C', assignedStudents: [], topTriggers: [], whySummary: 'Versión C no está efectiva en esta evaluación.', designChanges: [], adminCorrectionReminders: [] };
  }

  const topTriggers = extractTriggersForStudents(
    assignedStudents,
    students,
    teacherRemindersByStudent,
    contemplacionesByStudent
  );

  const whySummary = topTriggers.some(t => t.key === '(sin datos)')
    ? `No hubo datos estructurados suficientes para la versión ${selectedVersion}; se infirió con recordatorios docentes o se marcó ausencia de datos.`
    : selectedVersion === 'A'
      ? `Versión A funciona como base universal del grupo. Disparadores observados: ${topTriggers.slice(0, 3).map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`).join('; ')}.`
      : selectedVersion === 'B'
        ? `La versión B es de adaptación de contenido declarada (no comparable con A/C) y mantiene accesibilidad por diseño/administración/corrección. Disparadores predominantes: ${topTriggers.slice(0, 3).map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`).join('; ')}.`
        : `La versión C se genera como adaptación equivalente de accesibilidad. Disparadores predominantes: ${topTriggers.slice(0, 3).map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`).join('; ')}.`;

  const designChangesFromTriggers = topTriggers
    .map(t => t.key)
    .filter(k => DESIGN_CANONICAL_KEYS.has(k))
    .map(k => toHumanTriggerLabel(k));
  const designChanges = [...new Set([...instrumentDesignRules, ...designChangesFromTriggers])].slice(0, 4);

  const reminderByStudent = new Map<string, TeacherReminderV2>();
  for (const reminder of teacherRemindersByStudent || []) {
    reminderByStudent.set(reminder.studentName.trim().toLowerCase(), reminder);
  }
  const adminCorrectionReminders: string[] = [];
  for (const studentName of assignedStudents) {
    const reminder = reminderByStudent.get(studentName.trim().toLowerCase());
    if (!reminder) continue;
    adminCorrectionReminders.push(...(reminder.admin || []), ...(reminder.correction || []));
  }
  const normalizedReminders = [...new Set(adminCorrectionReminders.map(r => r.trim()).filter(Boolean))].slice(0, 4);

  return {
    version: selectedVersion,
    assignedStudents,
    topTriggers,
    whySummary,
    designChanges,
    adminCorrectionReminders: normalizedReminders
  };
}

function buildAllVersionRationalePacks(
  effectiveRequestedVersions: { A: boolean; B: boolean; C: boolean },
  assignedByVersion: { A: string[]; B: string[]; C: string[] },
  students: Array<Record<string, unknown>>,
  teacherRemindersByStudent: TeacherReminderV2[],
  contemplacionesByStudent?: ContemplacionesByStudent,
  instrumentDesignRules: string[] = []
): VersionRationalePack {
  return {
    A: buildVersionRationalePack('A', effectiveRequestedVersions, assignedByVersion.A, students, teacherRemindersByStudent, contemplacionesByStudent, instrumentDesignRules),
    B: buildVersionRationalePack('B', effectiveRequestedVersions, assignedByVersion.B, students, teacherRemindersByStudent, contemplacionesByStudent, instrumentDesignRules),
    C: buildVersionRationalePack('C', effectiveRequestedVersions, assignedByVersion.C, students, teacherRemindersByStudent, contemplacionesByStudent, instrumentDesignRules),
  };
}

function buildSpecEvidenceSummary(spec: EvaluationSpecV2): SpecEvidenceSummary {
  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  const summary: SpecEvidenceSummary = { sections: [], items: [], changedItemsB: [], changedItemsC: [] };
  let totalItems = 0;
  const MAX_ITEMS = 40; // Keep prompt compact while preserving concrete references.

  for (const section of sections) {
    if (totalItems >= MAX_ITEMS) break;
    const sectionMeta = (section as unknown) as Record<string, unknown>;
    const sectionSummary: SpecEvidenceSectionSummary = {
      id: section.id || '',
      title: section.title || '',
      itemCount: Array.isArray(section.items) ? section.items.length : 0,
      materialRef: typeof sectionMeta.materialRef === 'string' && sectionMeta.materialRef.trim()
        ? sectionMeta.materialRef.trim()
        : typeof sectionMeta.dossierFragment === 'string' && sectionMeta.dossierFragment.trim()
          ? sectionMeta.dossierFragment.trim()
          : undefined
    };
    for (const item of section.items || []) {
      if (totalItems >= MAX_ITEMS) break;
      const vc = item.versionedContent || {};
      const eqRaw = (item as unknown as Record<string, unknown>).equivalentResponseOptions;
      const hasEquivalentResponseOptions = (() => {
        if (Array.isArray(eqRaw)) return eqRaw.length > 0;
        if (!eqRaw || typeof eqRaw !== 'object') return false;
        const o = eqRaw as Record<string, unknown>;
        if (Array.isArray(o.options)) return o.options.length > 0;
        if (Array.isArray(o.formats)) return o.formats.length > 0;
        return o.enabled === true;
      })();
      const itemSummary: SpecEvidenceItemSummary = {
        id: item.id,
        sectionId: section.id || '',
        type: item.type,
        points: item.points,
        hasB: typeof vc.promptB === 'string' && vc.promptB.trim().length > 0,
        hasC: typeof vc.promptC === 'string' && vc.promptC.trim().length > 0,
        hasOptionsB: Array.isArray(vc.optionsB) && vc.optionsB.length > 0,
        hasEquivalentResponseOptions
      };
      summary.items.push(itemSummary);
      if (itemSummary.hasB) summary.changedItemsB.push(itemSummary.id);
      if (itemSummary.hasC) summary.changedItemsC.push(itemSummary.id);
      totalItems += 1;
    }
    summary.sections.push(sectionSummary);
  }

  return summary;
}

function formatStudentListForNarrative(names: string[], maxVisible = 10): string {
  if (names.length === 0) return 'Sin asignaciones explícitas; versión definida por reglas del plan.';
  const normalized = names.map(n => (typeof n === 'string' && n.trim() ? n.trim() : 'Sin nombre'));
  if (normalized.length <= maxVisible) return normalized.join(', ');
  const visible = normalized.slice(0, maxVisible).join(', ');
  return `${visible}, +${normalized.length - maxVisible} más`;
}

function selectEvidenceReferences(
  version: VersionKey,
  specEvidenceSummary: SpecEvidenceSummary,
  maxRefs = 3
): SpecEvidenceItemSummary[] {
  const byId = new Map(specEvidenceSummary.items.map(item => [item.id, item]));
  const preferredIds = version === 'B'
    ? specEvidenceSummary.changedItemsB
    : version === 'C'
      ? specEvidenceSummary.changedItemsC
      : [];
  const preferredItems = preferredIds
    .map(id => byId.get(id))
    .filter((x): x is SpecEvidenceItemSummary => Boolean(x));
  const fallbackItems = specEvidenceSummary.items.filter(item => !preferredIds.includes(item.id));
  const selected = [...preferredItems, ...fallbackItems].slice(0, maxRefs);

  return selected;
}

function itemTypeTeacherLabel(type: string): string {
  const map: Record<string, string> = {
    multiple_choice: 'opción múltiple',
    true_false: 'verdadero/falso',
    true_false_justify: 'verdadero/falso con justificación',
    short_answer: 'respuesta corta',
    paragraph: 'párrafo',
    essay: 'texto argumentativo',
    source_analysis: 'análisis de fuente',
    table_completion: 'completar tabla',
    matching: 'relación de conceptos',
    ordering: 'ordenamiento'
  };
  return map[type] || type;
}

/** Section openings to avoid repetitive "Esta sección evalúa..." */
const SECTION_OPENINGS = [
  (t: string) => `En la primera parte, el estudiante trabaja sobre "${t}".`,
  (t: string) => `En la siguiente, el foco es "${t}".`,
  (t: string) => `Aquí el instrumento aborda "${t}".`,
  (t: string) => `Esta parte del cuadernillo se centra en "${t}".`
];

/** Natural section narrative: what students do, task type, alignment; contemplations only when relevant, with functional effect. No item ids, no template repetition. */
function buildSectionNarrative(
  version: VersionKey,
  section: SpecEvidenceSectionSummary,
  itemsInSection: SpecEvidenceItemSummary[],
  sectionIndex: number,
  designLabels: string[]
): string {
  const title = section.title || 'contenidos de la evaluación';
  const types = [...new Set(itemsInSection.map(i => itemTypeTeacherLabel(i.type)))];
  const taskDesc = types.length > 0
    ? (types.length === 1 ? types[0] : `combinación de ${types.slice(0, 2).join(' y ')}`)
    : 'respuesta escrita';
  const open = SECTION_OPENINGS[sectionIndex % SECTION_OPENINGS.length](title);
  const parts: string[] = [open];
  const materialLine = section.materialRef
    ? ` Se apoya en: ${section.materialRef}.`
    : '';
  const taskLine = ` La tarea pide interpretar, justificar o argumentar según el tipo de ítem (${taskDesc}), de modo que se pueda valorar si el estudiante alcanzó el objetivo.`;
  parts.push(materialLine + taskLine);
  if (designLabels.length > 0 && designLabels[0]) {
    const firstLabel = designLabels[0];
    const effect = contemplationFunctionalEffect(firstLabel);
    parts.push(` Las consignas incorporan ${firstLabel.toLowerCase()}, lo que ${effect}`);
  }
  const hasEquivalentInSection = itemsInSection.some(i => i.hasEquivalentResponseOptions);
  if (hasEquivalentInSection) {
    parts.push(' Donde hay varias formas de responder (por ejemplo casillero o párrafo), se valora lo mismo: la calidad del contenido y la coherencia con la evidencia.');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function trimLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n');
}

function buildDeterministicEvidenceAppendix(
  selectedVersion: VersionKey,
  pack: VersionRationalePackItem,
  specEvidenceSummary: SpecEvidenceSummary
): string {
  const studentsText = formatStudentListForNarrative(pack.assignedStudents);
  const triggersTop3 = pack.topTriggers.slice(0, 3);
  const designLabels = pack.designChanges.length > 0 ? pack.designChanges.slice(0, 3) : [];

  const sectionTitles = specEvidenceSummary.sections.map((s, i) =>
    (s.title && s.title.trim() ? s.title.trim() : `Sección ${i + 1}`)
  );
  const contentFocus = sectionTitles.length > 0 ? sectionTitles.join(', ') : 'los contenidos y habilidades definidos en el instrumento';

  // —— Opening paragraph (natural summary) ——
  let opening = '';
  if (selectedVersion === 'A') {
    opening = `Esta versión refleja los objetivos comunes del grupo y lo que se trabajó en clase. Evalúa los mismos contenidos y competencias para todos, en línea con el material y las prioridades del docente. Es la versión de referencia con la que se pueden comparar resultados cuando existan otras versiones.`;
  } else if (selectedVersion === 'B') {
    opening = `Esta versión corresponde a una adaptación explícita de contenidos u objetivos. No es comparable con la versión universal ni con la versión equivalente de accesibilidad: lo que se evalúa y la profundidad esperada pueden ser distintos. Las expectativas siguen siendo claras dentro de esos objetivos adaptados.`;
  } else {
    opening = `Esta versión mantiene exactamente los mismos objetivos y el mismo nivel de exigencia que la versión A. Solo cambia la forma de presentar las consignas y el formato de respuesta para facilitar el acceso. Los resultados son comparables entre A y C.`;
  }

  // —— 1. What is evaluated and why ——
  let block1 = '';
  if (selectedVersion === 'A') {
    block1 = `Qué se evalúa y por qué: ${contentFocus}. Esos contenidos se eligieron a partir del material de clase, las indicaciones del docente y, cuando aplica, los lineamientos curriculares. Se espera que el estudiante interprete, compare, argumente o justifique según el tipo de ítem, en coherencia con lo trabajado.`;
  } else if (selectedVersion === 'B') {
    block1 = `Qué se evalúa y por qué: en esta versión se priorizan ${contentFocus}, con alcance y profundidad adaptados por declaración. No se evalúan los mismos contenidos ni al mismo nivel que la versión A o C. La elección responde a las necesidades pedagógicas del estudiante dentro del plan de adecuación. Se espera que demuestre logro en esos objetivos adaptados (interpretar, relacionar, argumentar según lo acordado).`;
  } else {
    block1 = `Qué se evalúa y por qué: los mismos contenidos que la versión A (${contentFocus}), con la misma profundidad. La selección de contenidos y habilidades es idéntica; solo cambian consignas y formato para reducir barreras. Se espera interpretar, argumentar y justificar igual que en A.`;
  }

  // —— 2. How this appears in the instrument (by section, natural prose) ——
  const itemsBySectionId = new Map<string, SpecEvidenceItemSummary[]>();
  for (const item of specEvidenceSummary.items) {
    const sid = item.sectionId || '';
    if (!itemsBySectionId.has(sid)) itemsBySectionId.set(sid, []);
    itemsBySectionId.get(sid)!.push(item);
  }
  const sectionNarratives = specEvidenceSummary.sections.map((sec, idx) => {
    const itemsInSection = itemsBySectionId.get(sec.id) || [];
    return buildSectionNarrative(selectedVersion, sec, itemsInSection, idx, designLabels);
  });
  const instrumentProse = sectionNarratives.length > 0
    ? sectionNarratives.join(' ')
    : 'No se dispone de detalle por sección en este resumen.';

  // —— 3. Metacognitive options (only when present) ——
  const hasEquivalentOptions = specEvidenceSummary.items.some(i => i.hasEquivalentResponseOptions);
  let block3 = '';
  if (hasEquivalentOptions) {
    block3 = `Opciones de respuesta equivalentes: en algunos ítems el estudiante puede elegir entre más de un formato (por ejemplo casillero breve o párrafo). Lo que se valora es la misma evidencia de aprendizaje: que use fuentes o ideas de forma coherente y que justifique. La rúbrica aplica igual a todos los formatos; no se baja la exigencia por elegir uno u otro.`;
  }

  // —— 4. Interpretation guidance for the teacher ——
  let interpretation = '';
  if (selectedVersion === 'A') {
    interpretation = `Cómo interpretar los resultados de esta versión: los puntajes y niveles de logro reflejan el desempeño frente a los objetivos comunes del grupo. Puede comparar entre estudiantes que usaron esta versión. Si luego usa versiones B o C con otros estudiantes, no compare puntajes entre versiones distintas.`;
  } else if (selectedVersion === 'B') {
    interpretation = `Cómo interpretar los resultados de esta versión: los resultados reflejan el logro respecto de los objetivos adaptados declarados, no respecto de la versión A o C. No use esta versión para comparar con estudiantes que rindieron A o C. Interprete en función de qué se acordó evaluar para este estudiante.`;
  } else {
    interpretation = `Cómo interpretar los resultados de esta versión: los resultados son comparables con los de la versión A. Mismo estándar y misma interpretación de niveles de logro; la diferencia es solo de formato para el acceso.`;
  }

  const mainParts = [
    'Informe pedagógico para el docente',
    '',
    opening,
    '',
    block1,
    '',
    'Cómo se ve en el instrumento',
    instrumentProse,
    '',
    ...(block3 ? [block3, ''] : []),
    interpretation
  ];
  const pedagogicalBlock = mainParts.join('\n');

  const referencedSectionTitles = specEvidenceSummary.sections
    .slice(0, 10)
    .map((s, i) => (s.title && s.title.trim() ? s.title.trim() : `Sección ${i + 1}`));
  const referencedItemIds = specEvidenceSummary.items.slice(0, 15).map(i => i.id);
  const internalTrace = [
    'Evidencia interna (para trazabilidad):',
    `- estudiantes asignados: ${pack.assignedStudents.length > 0 ? pack.assignedStudents.join(', ') : '(sin asignaciones)'}`,
    `- top 3 disparadores con conteo: ${triggersTop3.length > 0 ? triggersTop3.map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`).join('; ') : '(sin datos)'}`,
    `- secciones referenciadas: ${referencedSectionTitles.length > 0 ? referencedSectionTitles.join('; ') : '(ninguna)'}`,
    `- ítems (ids): ${referencedItemIds.length > 0 ? referencedItemIds.join('; ') : '(ninguno)'}`
  ].join('\n');

  return [pedagogicalBlock, '', internalTrace].join('\n');
}

function hasNarrativeEvidenceMarkers(narrative: string): boolean {
  const normalized = narrative
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const hasOldStructure =
    /item-[a-z0-9_-]+/i.test(narrative) &&
    /quienes\s+usan\s+esta\s+version|who\s+uses\s+this\s+version/.test(normalized);
  const hasNewStructure =
    /informe\s+pedagogico\s+para\s+el\s+docente/.test(normalized) &&
    (/como\s+se\s+ve\s+en\s+el\s+instrumento|evidencia\s+interna\s+\(para\s+trazabilidad\)|como\s+interpretar\s+los\s+resultados|que\s+se\s+evalua\s+y\s+por\s+que/.test(normalized));
  return (hasOldStructure || hasNewStructure) && hasKnownContemplationLabel(narrative);
}

function ensureNarrativeHasEvidence(
  narrative: string,
  pack: VersionRationalePackItem,
  specEvidenceSummary: SpecEvidenceSummary
): string {
  const trimmed = narrative.trim();
  if (hasNarrativeEvidenceMarkers(trimmed)) return trimmed;
  const appendix = buildDeterministicEvidenceAppendix(pack.version, pack, specEvidenceSummary);
  return `${trimmed}\n\n${appendix}`.trim();
}

function applyNarrativeEvidenceByVersion<T extends { byVersion?: Record<string, { narrative?: string }>; narrative?: string }>(
  aiReport: T,
  effectiveRequestedVersions: { A: boolean; B: boolean; C: boolean },
  versionRationalePack: VersionRationalePack,
  specEvidenceSummary: SpecEvidenceSummary
): T {
  const existingByVersion: Record<string, { narrative?: string }> =
    aiReport.byVersion && typeof aiReport.byVersion === 'object' ? { ...aiReport.byVersion } : {};
  const versions: VersionKey[] = ['A', 'B', 'C'];

  for (const version of versions) {
    if (version === 'B' && !effectiveRequestedVersions.B) continue;
    if (version === 'C' && !effectiveRequestedVersions.C) continue;
    const current = typeof existingByVersion[version]?.narrative === 'string'
      ? existingByVersion[version]!.narrative!.trim()
      : '';
    const base = current.length > 0 ? current : (version === 'A' ? FALLBACK_A_NARRATIVE : version === 'B' ? FALLBACK_B_NARRATIVE : FALLBACK_C_NARRATIVE);
    const narrative = ensureNarrativeHasEvidence(base, versionRationalePack[version], specEvidenceSummary);
    existingByVersion[version] = { ...existingByVersion[version], narrative };
  }

  const out = { ...aiReport, byVersion: existingByVersion } as T;
  if (!out.narrative && typeof out.byVersion?.A?.narrative === 'string') {
    out.narrative = out.byVersion.A.narrative;
  }
  return out;
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
      versionDescriptions.push('Versión B aplica adaptación de contenido declarada (no comparable con A/C)');
    }
    if (versionsExplanation.generated.includes('C')) {
      versionDescriptions.push('Versión C aplica adaptación equivalente de accesibilidad (misma exigencia que A)');
    }
    
    if (versionDescriptions.length > 0) {
      decisiones.push(
        `• Se generaron ${versionsExplanation.generated.length} versiones (${versionsExplanation.generated.join(', ')}): ` +
        `Versión A es universal; ${versionDescriptions.join('; ')}. ` +
        `A y C mantienen la misma demanda cognitiva; B puede ajustar objetivos/contenidos por declaración explícita.`
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
  versionRationalePack: VersionRationalePack,
  specEvidenceSummary: SpecEvidenceSummary,
  requestId: string,
  timer: Timer
): Promise<Record<string, { narrative: string }> | null> {
  const needed = ['A' as const, ...(effectiveRequestedVersions.B ? ['B' as const] : []), ...(effectiveRequestedVersions.C ? ['C' as const] : [])];
  if (needed.length <= 1) return null;
  const subject = spec.meta?.subject || 'la materia';
  const sectionCount = spec.sections?.length ?? 0;
  const userPrompt = `Genera un objeto JSON con reportes narrativos por versión para una evaluación de ${subject} (${sectionCount} secciones).

Contexto del reporte global / Versión A (resumen): ${existingNarrativeA.slice(0, 500)}

VERSION_RATIONALE_PACK (usar literalmente para estudiantes y triggers):
${JSON.stringify(versionRationalePack, null, 2)}

SPEC_EVIDENCE_SUMMARY (citar referencias concretas de este bloque):
${JSON.stringify(specEvidenceSummary, null, 2)}

Requisitos por versión:
- A: Contenidos evaluados, alineación con competencias/criterios, requerimientos del docente, materiales/sesión si hay. Misma demanda cognitiva.
- B: Versión de adaptación de contenido declarada (NO comparable con A/C). Explicar objetivos/contenidos ajustados y cómo se mantiene accesibilidad (diseño/admin/corrección).
- C: Versión equivalente de accesibilidad (mismos objetivos, misma rúbrica y misma demanda cognitiva que A). Solo cambia formato/andamiaje.

Estructura OBLIGATORIA dentro de CADA narrative:
1) "Quiénes usan esta versión:": incluir assignedStudents (máximo 10 nombres y luego "+N más" si aplica). Si no hay nombres, usar "Grupo asignado a versión X".
2) "Por qué existe esta versión (causas):": incluir topTriggers con conteos y usar etiquetas humanas de contemplaciones (no IDs numéricos).
3) "Cómo se refleja en la evaluación (ejemplos concretos):": citar al menos 3 referencias concretas con id de ítem (item-...), tipo y descripción pedagógica.
4) "Equivalencia y exigencia:": para A/C afirmar equivalencia completa; para B afirmar no comparabilidad por adaptación declarada.

Genera un JSON con esta forma exacta (solo el objeto, sin markdown):
{
  "byVersion": {
    "A": { "narrative": "<6-10 líneas>" }
    ${effectiveRequestedVersions.B ? ', "B": { "narrative": "<5-8 líneas: adaptación de contenido declarada, no comparable con A/C, accesibilidad aplicada>" }' : ''}
    ${effectiveRequestedVersions.C ? ', "C": { "narrative": "<5-8 líneas: equivalente a A en objetivos/rúbrica/demanda, con andamiaje de acceso>" }' : ''}
  }
}

Responde ÚNICAMENTE con el JSON. Sin explicaciones ni \`\`\`json.
No omitas las 4 secciones dentro de cada narrative.`;

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

/** Stopwords cortos en español para no usarlos como palabras clave del prompt */
const RUBRIC_PROMPT_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'y', 'o', 'pero', 'si', 'no',
  'que', 'qué', 'con', 'por', 'para', 'su', 'sus', 'se', 'lo', 'le', 'es', 'son', 'esta', 'este', 'estos', 'estas',
  'las', 'los', 'como', 'más', 'muy', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'cuál', 'cuales', 'cómo', 'cuando',
]);

/**
 * Extrae 3–5 palabras significativas del prompt para heurística de calidad de rúbrica.
 * Filtra stopwords y palabras muy cortas; normaliza a minúsculas para comparación.
 */
function extractPromptKeywords(prompt: string): string[] {
  if (!prompt || typeof prompt !== 'string') return [];
  const normalized = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !RUBRIC_PROMPT_STOPWORDS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of normalized) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 5) break;
  }
  return out.slice(0, 5);
}

/**
 * Mapeo de formas verbales (imperativo/infinitivo) a verbo normalizado en infinitivo.
 * Se buscan en el prompt en minúsculas con límite de palabra.
 */
const PROMPT_ACTION_MAP: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /\b(analiza|analice|analizar|analizando)\b/, action: 'analizar' },
  { pattern: /\b(compara|compare|comparar|comparando)\b/, action: 'comparar' },
  { pattern: /\b(justifica|justifique|justificar|justificando)\b/, action: 'justificar' },
  { pattern: /\b(explica|explique|explicar|explicando)\b/, action: 'explicar' },
  { pattern: /\b(interpreta|interprete|interpretar|interpretando)\b/, action: 'interpretar' },
  { pattern: /\b(argumenta|argumente|argumentar|argumentando)\b/, action: 'argumentar' },
  { pattern: /\b(relaciona|relacione|relacionar|relacionando)\b/, action: 'relacionar' },
  { pattern: /\b(describe|describa|describir|describiendo)\b/, action: 'describir' },
  { pattern: /\b(evalúa|evalue|evalua|evaluar|evaluando)\b/, action: 'evaluar' },
];

/**
 * Extrae el verbo de acción cognitiva principal del prompt y lo devuelve en infinitivo.
 * Si no se detecta ninguno, devuelve null.
 */
function extractPromptAction(prompt: string): string | null {
  if (!prompt || typeof prompt !== 'string') return null;
  const lower = prompt.toLowerCase().trim();
  for (const { pattern, action } of PROMPT_ACTION_MAP) {
    if (pattern.test(lower)) return action;
  }
  return null;
}

/** Conectores que introducen el tema/contenido; texto después se usa como frase de contenido */
const CONTENT_CONNECTORS: Array<{ pattern: RegExp; maxLen: number }> = [
  { pattern: /sobre\s+([^.?!]+)/i, maxLen: 70 },
  { pattern: /acerca\s+de\s+([^.?!]+)/i, maxLen: 70 },
  { pattern: /respecto\s+a\s+([^.?!]+)/i, maxLen: 70 },
  { pattern: /en\s+relación\s+con\s+([^.?!]+)/i, maxLen: 70 },
  { pattern: /causas\s+de\s+([^.?!]+)/i, maxLen: 60 },
  { pattern: /consecuencias\s+de\s+([^.?!]+)/i, maxLen: 60 },
  { pattern: /rol\s+de\s+([^.?!]+)/i, maxLen: 60 },
  { pattern: /impacto\s+de\s+([^.?!]+)/i, maxLen: 60 },
];

/**
 * Extrae una frase de contenido legible a partir del prompt (tema evaluado).
 * Prioriza texto tras conectores; si no hay, usa un trozo del prompt sin el verbo inicial.
 */
function extractContentPhrase(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return 'el contenido de la consigna';
  const trimmed = prompt.trim();
  if (!trimmed) return 'el contenido de la consigna';

  for (const { pattern, maxLen } of CONTENT_CONNECTORS) {
    const m = trimmed.match(pattern);
    if (m && m[1]) {
      const phrase = m[1].trim().replace(/\s+/g, ' ').slice(0, maxLen);
      if (phrase.length >= 5) return phrase;
    }
  }

  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 3) return trimmed.slice(0, 60);

  let start = 0;
  for (const { pattern } of PROMPT_ACTION_MAP) {
    const idx = lower.search(pattern);
    if (idx !== -1) {
      const before = trimmed.slice(0, idx);
      const beforeWords = before.split(/\s+/).filter((w) => w.length > 0);
      start = Math.min(beforeWords.length + 1, words.length);
      break;
    }
  }
  if (start === 0) start = 1;
  const slice = words.slice(start, start + 12).join(' ').trim();
  return slice.length >= 3 ? slice.slice(0, 80) : trimmed.slice(0, 80);
}

/**
 * Resultado del chequeo de calidad: si falta contenido y/o acción se considera baja calidad.
 */
type RubricQualityResult = { lowQuality: boolean; missingContent: boolean; missingAction: boolean };

/**
 * Comprueba si la rúbrica es de baja calidad: falta contenido específico y/o acción cognitiva.
 * (A) Contenido: al menos una palabra clave O la frase de contenido (coincidencia parcial) en descriptores.
 * (B) Acción: el verbo de acción (o familia cercana) aparece en al menos 1–2 descriptores.
 */
function checkRubricQuality(
  rubric: ItemRubricV2,
  keywords: string[],
  contentPhrase: string,
  action: string | null
): RubricQualityResult {
  const descriptors = (rubric.levels || []).map((l) => (l.descriptor || '').toLowerCase());
  const allText = descriptors.join(' ');

  const hasContentKeyword = keywords.length > 0 && keywords.some((k) => allText.includes(k.toLowerCase()));
  const contentPhraseWords = contentPhrase.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const phraseWordsInDescriptors = contentPhraseWords.filter((w) => allText.includes(w)).length;
  const hasContentPhrase = contentPhraseWords.length >= 2 && phraseWordsInDescriptors >= 2;
  const missingContent = !hasContentKeyword && !hasContentPhrase;

  const actionStems = action ? [action, action.replace(/ar$/, 'a'), action.replace(/er$/, 'e'), action.replace(/ir$/, 'e')] : [];
  const descriptorWithAction = action
    ? descriptors.filter((d) => actionStems.some((stem) => d.includes(stem)))
    : [];
  const missingAction = action !== null && descriptorWithAction.length < 1;

  return {
    lowQuality: missingContent || missingAction,
    missingContent,
    missingAction,
  };
}

/**
 * Comprueba si los descriptores de la rúbrica son demasiado genéricos:
 * ninguno contiene al menos una de las palabras clave extraídas del prompt.
 * @deprecated Prefer checkRubricQuality for action+content checks.
 */
function areDescriptorsGeneric(rubric: ItemRubricV2, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const text = (rubric.levels || [])
    .map((l) => (l.descriptor || '').toLowerCase())
    .join(' ');
  return !keywords.some((k) => text.includes(k.toLowerCase()));
}

/**
 * Fallback de rúbrica con acción y contenido: cada descriptor incluye el verbo de acción
 * (o "explicar") y la frase de contenido extraída del prompt. Redacción natural en español.
 */
function buildContentSpecificFallbackRubric(itemPrompt: string, itemPoints: number): ItemRubricV2 {
  const safePoints = Number.isFinite(itemPoints) && itemPoints > 0 ? itemPoints : 4;
  const rounded = Math.max(1, Math.round(safePoints));
  const highMin = Math.max(0, rounded - 1);
  const midUpper = Math.max(1, highMin - 1);
  const lowUpper = Math.max(0, Math.min(midUpper - 1, Math.round(rounded / 2)));

  const action = extractPromptAction(itemPrompt) ?? 'explicar';
  const tema = extractContentPhrase(itemPrompt);

  const imperative: Record<string, string> = {
    analizar: 'Analiza', explicar: 'Explica', comparar: 'Compara', justificar: 'Justifica',
    interpretar: 'Interpreta', argumentar: 'Argumenta', relacionar: 'Relaciona', describir: 'Describe', evaluar: 'Evalúa',
  };
  const verbCap = imperative[action] ?? `Realiza la acción de ${action}`;
  const verbLower = imperative[action] ? imperative[action].charAt(0).toLowerCase() + imperative[action].slice(1) : action;

  return {
    levels: [
      {
        key: 'excelente',
        label: 'Excelente',
        descriptor: `${verbCap} ${tema} con precisión, evidencia pertinente y desarrollo claro.`,
        minPoints: rounded,
        maxPoints: rounded,
      },
      {
        key: 'bueno',
        label: 'Bueno',
        descriptor: `${verbLower} ${tema} adecuadamente, con alguna evidencia o desarrollo, pero con menor profundidad.`,
        minPoints: highMin,
        maxPoints: highMin,
      },
      {
        key: 'en_proceso',
        label: 'En proceso',
        descriptor: `Aborda parcialmente ${tema}: identifica ideas relacionadas, pero con vacíos o imprecisiones en la ${action}.`,
        minPoints: lowUpper + 1,
        maxPoints: midUpper,
      },
      {
        key: 'insuficiente',
        label: 'Insuficiente',
        descriptor: `No logra ${action} de forma suficiente ${tema}, o presenta errores conceptuales relevantes.`,
        minPoints: 0,
        maxPoints: lowUpper,
      },
    ],
  };
}

function buildFallbackRubric(itemPrompt: string, itemPoints: number): ItemRubricV2 {
  return buildContentSpecificFallbackRubric(itemPrompt, itemPoints);
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
        const keywords = extractPromptKeywords(prompt);
        const contentPhrase = extractContentPhrase(prompt);
        const action = extractPromptAction(prompt);
        const quality = checkRubricQuality(normalizedRubric, keywords, contentPhrase, action);
        if (quality.lowQuality) {
          i.rubric = buildContentSpecificFallbackRubric(prompt, points);
          const reasons: string[] = [];
          if (quality.missingContent) reasons.push('falta de contenido específico');
          if (quality.missingAction) reasons.push('falta de acción cognitiva');
          const reasonText = reasons.join(' y ');
          warnings.push({
            code: 'RUBRIC_LOW_QUALITY_REPLACED',
            message: `Rúbrica de baja calidad reemplazada (${reasonText}) en sección ${sectionIdx + 1}, ítem ${itemIdx + 1} (${String(i.type)}).`,
            severity: 'warning',
          });
        }
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
      label: 'Version B (Content Adaptation - Declared, no generada)',
      isBase: false,
      reason: 'No generada debido a problemas de conectividad con el servicio de IA',
      modifications: []
    };
  }
  
  if (requestedVersions.C) {
    spec.versionVariants.C = {
      label: 'Version C (Equivalent Accessibility Adaptation, no generada)',
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

/** Open-ended item types that should have equivalentResponseOptions when the feature is enabled. */
const OPEN_ENDED_ITEM_TYPES = new Set<string>(['essay', 'paragraph', 'short_answer', 'source_analysis', 'true_false_justify']);

function isOpenEndedItemType(type: unknown): type is string {
  return typeof type === 'string' && OPEN_ENDED_ITEM_TYPES.has(type);
}

/** Get current equivalentResponseOptions option count from an item (raw spec shape). */
function getEquivalentOptionsCount(item: Record<string, unknown>): number {
  const ero = item.equivalentResponseOptions;
  if (!ero) return 0;
  if (Array.isArray(ero)) return ero.length;
  if (typeof ero === 'object' && ero !== null) {
    const opts = (ero as Record<string, unknown>).options;
    return Array.isArray(opts) ? opts.length : 0;
  }
  return 0;
}

/** Deterministic fallback options by open-ended type (2–3 options). */
function getFallbackEquivalentOptions(itemType: string, minCount: number): Array<{ id: string; format: string; description: string }> {
  const optionsByType: Record<string, Array<{ format: string; description: string }>> = {
    essay: [
      { format: 'texto argumentativo', description: 'desarrollado' },
      { format: 'esquema o mapa conceptual', description: 'con ideas principales y secundarias' },
      { format: 'lista numerada de ideas', description: 'con argumentos claros' }
    ],
    paragraph: [
      { format: 'párrafo desarrollado', description: 'conectado' },
      { format: 'esquema claro', description: 'con ideas ordenadas' },
      { format: 'lista de ideas', description: 'con desarrollo breve' }
    ],
    short_answer: [
      { format: 'texto breve', description: 'directo' },
      { format: 'esquema o lista', description: 'de puntos clave' }
    ],
    source_analysis: [
      { format: 'texto analítico', description: 'breve' },
      { format: 'esquema o tabla', description: 'con citas o referencias' },
      { format: 'lista de ideas', description: 'fundamentadas en la fuente' }
    ],
    true_false_justify: [
      { format: 'texto breve', description: 'justificando tu respuesta' },
      { format: 'esquema o lista', description: 'de razones' }
    ]
  };
  const templates = optionsByType[itemType] ?? optionsByType.short_answer;
  const take = Math.min(Math.max(2, minCount), templates.length);
  return templates.slice(0, take).map((t, i) => ({
    id: `fallback-${itemType}-${i + 1}`,
    format: t.format,
    description: t.description
  }));
}

/**
 * When response options are enabled, ensure every open-ended item has at least 2 equivalentResponseOptions.
 * Fills missing or insufficient options with a deterministic fallback and adds RESPONSE_OPTIONS_FALLBACK_APPLIED warning.
 */
function ensureEquivalentResponseOptionsForOpenEnded(
  spec: EvaluationSpecV2,
  responseOptionsInclude: boolean,
  responseOptionCount: number,
  warnings: WarningV2[]
): void {
  if (!responseOptionsInclude || !spec.sections?.length) return;
  const minOptions = Math.max(2, responseOptionCount);
  let fallbackCount = 0;
  for (const section of spec.sections) {
    const items = section.items ?? [];
    for (const item of items) {
      const type = item.type as string;
      if (!isOpenEndedItemType(type)) continue;
      const itemRecord = item as unknown as Record<string, unknown>;
      const count = getEquivalentOptionsCount(itemRecord);
      if (count >= minOptions) continue;
      const fallback = getFallbackEquivalentOptions(type, minOptions);
      itemRecord.equivalentResponseOptions = {
        enabled: true,
        options: fallback,
        metacognitionText: 'Elegí el formato que mejor te ayude a mostrar lo que aprendiste.'
      };
      fallbackCount++;
    }
  }
  if (fallbackCount > 0) {
    warnings.push({
      code: 'RESPONSE_OPTIONS_FALLBACK_APPLIED',
      message: `Se completaron opciones de respuesta equivalentes en ${fallbackCount} ítem(s) abierto(s) que no las tenían.`,
      severity: 'info'
    });
    console.log(`[V2_RESPONSE_OPTIONS] fallback applied to ${fallbackCount} open-ended items`);
  }
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
    students.map(s => [
      String(s.studentId),
      (typeof s.displayName === 'string' && s.displayName.trim()) ? s.displayName.trim() : `Estudiante ${s.studentId}`
    ])
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
## VERSIÓN B - ADAPTACIÓN DE CONTENIDO DECLARADA (CRÍTICO)

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

### Estrategias OBLIGATORIAS para versionedContent.promptB (no equivalente):

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

IMPORTANTE: El promptB puede ajustar objetivos/contenidos solo cuando hay adaptación declarada. Aun así, debe conservar evidencia escrita y contemplaciones de accesibilidad (diseño/admin/corrección).
` : '';

  return `Eres un especialista en evaluación educativa con experiencia en diseño universal para el aprendizaje (DUA). Tu tarea es generar una especificación JSON estructurada para una evaluación escrita.

## REGLAS CRÍTICAS (NO NEGOCIABLES)

1. **Solo JSON**: Tu respuesta debe ser ÚNICAMENTE un objeto JSON válido. Sin comentarios, sin explicaciones, sin markdown, sin code fences.

2. **Sin inferencias de diagnóstico**: NO deduzcas necesidades especiales de texto narrativo. Usa SOLO los datos estructurados proporcionados.

3. **Evidencia siempre escrita**: Todas las respuestas deben ser escritas o seleccionables. NO generar tareas "solo orales".

4. **CE/CL del docente**: Usa SOLO las competencias y criterios de logro proporcionados. NO inventes nuevos.

5. **Versiones**:
   - Siempre generar contenido base en "prompt" (Versión A - universal)
   ${requestedVersions.B ? '- OBLIGATORIO: Generar "versionedContent.promptB" para adaptación de contenido declarada (NO comparable con A/C)' : '- NO incluir versionedContent (Version B no solicitada)'}
   ${requestedVersions.C ? '- Incluir versionedContent.promptC para adaptación equivalente de accesibilidad (mismos objetivos/criterios que A)' : ''}
${versionBInstructions}
## OPCIONES DE RESPUESTA EQUIVALENTES
${responseOptionsInclude ? `
- OBLIGATORIO: Todos los ítems ABIERTOS (essay, paragraph, short_answer, source_analysis, true_false_justify) DEBEN incluir equivalentResponseOptions con al menos ${responseOptionCount} opciones.
- Cada opción representa un formato diferente pero equivalente en evidencia y dificultad (ej.: texto, esquema, lista).
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
- Si incluyes minPoints/maxPoints, deben estar alineados con item.points.

REGLAS OBLIGATORIAS PARA CADA DESCRIPTOR DE RÚBRICA:
1) Extrae el verbo de acción principal de la consigna del ítem (ej.: explicar, justificar, analizar, comparar, argumentar, interpretar).
2) Identifica los conceptos o contenidos clave mencionados en la consigna (ej.: causas económicas de la PGM, rol de las potencias centrales, reformas batllistas).
3) Cada descriptor de nivel DEBE mencionar explícitamente:
   - La acción requerida (ej.: "analiza", "justifica con evidencia", "explica de forma clara").
   - El contenido concreto evaluado (ej.: "causas de la Primera Guerra Mundial", "consecuencias sociales del proceso").
- PROHIBIDO usar frases genéricas o intercambiables entre ítems, por ejemplo:
  - "responde correctamente", "desarrolla una respuesta adecuada", "argumenta de forma clara"
  - "responde la consigna", "identifica ideas relevantes" sin mencionar el tema de la pregunta
- Cada descriptor de nivel debe referirse claramente al tema/contenido evaluado en la pregunta y a la acción requerida. No se permite redacción genérica ni reutilizable entre ítems.
- Rule (English): Each level descriptor must clearly mention the specific topic/content evaluated in the question and the action required. Generic, reusable wording is not allowed.

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
    ${requestedVersions.B ? ', "B": { "label": "Version B (Content Adaptation - Declared)", "isBase": false, "reason": "No comparable con A/C: adaptación explícita de objetivos o contenidos" }' : ''}
    ${requestedVersions.C ? ', "C": { "label": "Version C (Equivalent Accessibility Adaptation)", "isBase": false, "reason": "Mismos objetivos/criterios y demanda cognitiva; cambia formato/andamiaje" }' : ''}
  },
  "aiReport": {
    "narrative": "<texto narrativo global de 6-12 líneas (resumen para el docente)>",
    "byVersion": {
      "A": {
        "narrative": "<6-12 líneas: qué contenidos se evaluaron, cómo se alinean con las competencias seleccionadas, cómo se aplicaron los requerimientos del docente, y cómo se usaron materiales/sesión si están presentes>"
      }
      ${requestedVersions.B ? ', "B": { "narrative": "<6-10 líneas: adaptación de contenido declarada, no comparable con A/C, y accesibilidad aplicada>" }' : ''}
      ${requestedVersions.C ? ', "C": { "narrative": "<6-10 líneas: adaptación equivalente de accesibilidad, mismos objetivos/rúbrica/demanda que A>" }' : ''}
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
${requestedVersions.B ? '- Versión B: Requerida (ADAPTACIÓN DE CONTENIDO DECLARADA: no equivalente/comparable con A/C)' : '- Versión B: NO generar'}
${requestedVersions.C ? '- Versión C: Requerida (EQUIVALENTE: mismos objetivos/criterios y misma demanda cognitiva; cambia solo formato/andamiaje)' : '- Versión C: NO generar'}

## REGLAS DE DISEÑO DEL INSTRUMENTO

${instrumentDesignRules.length ? instrumentDesignRules.map(rule => `- ${rule}`).join('\n') : '- (Sin reglas adicionales)'}

## REQUERIMIENTOS DEL DOCENTE

${modification || 'No hay requerimientos adicionales'}

## INSTRUCCIONES

Genera una especificación JSON completa siguiendo el schema EvaluationSpecV2.
- La evaluación debe ser apropiada para secundaria.
- Incluye variedad de tipos de items.
- Asegúrate que los puntos sumen un total coherente.
${requestedVersions.B ? `- CRÍTICO: Para CADA item de adaptación declarada, incluye "versionedContent": { "promptB": "..." } para ajuste de contenido/objetivos (no equivalente).
- El promptB debe mantener evidencia escrita y contemplaciones de accesibilidad aplicables.
- Si falta promptB en aunque sea un ítem, la Versión B no se ofrecerá al docente (solo A).
- Ejemplo: Si prompt es "Analiza las consecuencias socioeconómicas...", promptB debe ser "Lee con atención. ¿Qué cambios importantes ocurrieron? Piensa en cómo afectó a las personas."` : '- NO incluyas versionedContent.'}
${requestedVersions.C ? `- CRÍTICO: Para ítems con adaptación equivalente de accesibilidad, incluye "promptC" en versionedContent. Version C conserva objetivos/rúbrica/demanda de A y cambia solo formato/andamiaje.` : ''}
- CRÍTICO: Para cada item abierto (essay, paragraph, short_answer, source_analysis, true_false_justify) incluye "rubric.levels" con al menos 4 niveles. Cada descriptor debe mencionar explícitamente la acción pedida en la consigna (analizar, justificar, explicar, etc.) y el contenido específico del ítem; está prohibido usar descriptores genéricos reutilizables.

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
  const MAX_ATTEMPTS = 3;
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
  const timeoutMs = isAdjustMode ? OPENAI_TIMEOUT_ADJUST_MS : OPENAI_TIMEOUT_PER_ATTEMPT_MS;
  const promptLength = systemPrompt.length + userPrompt.length;
  const promptSizeKB = parseFloat((promptLength / 1024).toFixed(1));

  const result = await callOpenAIWithRetries('spec', requestId, (attemptNum, model) => ({
    body: {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 6000,
      temperature: attemptNum === 3 ? 0.4 : 0.7
    },
    timeoutMs
  }));

  if (result.ok) {
    let parsed: unknown;
    try {
      let cleanContent = result.rawContent.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      timer.log(`✗ JSON parse error after ${result.attempt} attempt(s)`);
      warnings.push({ code: 'JSON_PARSE_ERROR', message: 'Error al parsear respuesta JSON', severity: 'warning' });
      attempts.push({
        attempt: result.attempt,
        mode: result.attempt === 3 ? 'fast_fallback' : 'full',
        model: result.model,
        timeoutMs,
        maxTokens: 6000,
        promptSizeKB,
        startedAtMs: timer.elapsed(),
        outcome: 'parse_error',
        errorMessage: String(parseError)
      });
      return {
        spec: null,
        warnings,
        attempt: result.attempt,
        extractionMethod: 'failed',
        attempts,
        debug: { promptLength, responseLength: result.rawContent.length, timeoutUsedMs: timeoutMs }
      };
    }
    const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, requestedVersions);
    warnings.push(...validationWarnings);
    if (spec) {
      timer.log(`✓ SUCCESS on attempt ${result.attempt} (${result.ms}ms)`);
      if (result.attempt > 1) {
        warnings.push({ code: 'RETRY_SUCCESS', message: `Generación exitosa después de ${result.attempt} intentos`, severity: 'info' });
      }
      attempts.push({
        attempt: result.attempt,
        mode: result.attempt === 3 ? 'fast_fallback' : 'full',
        model: result.model,
        timeoutMs,
        maxTokens: 6000,
        promptSizeKB,
        startedAtMs: 0,
        outcome: 'success',
        openaiDurationMs: result.ms
      });
      return {
        spec,
        warnings,
        attempt: result.attempt,
        extractionMethod: 'json_parse',
        attempts,
        debug: {
          promptLength,
          responseLength: result.rawContent.length,
          openaiDurationMs: result.ms,
          timeoutUsedMs: timeoutMs,
          retryReason: result.attempt > 1 ? 'retry_used' : undefined
        }
      };
    }
    attempts.push({
      attempt: result.attempt,
      mode: result.attempt === 3 ? 'fast_fallback' : 'full',
      model: result.model,
      timeoutMs,
      maxTokens: 6000,
      promptSizeKB,
      startedAtMs: 0,
      outcome: 'validation_error',
      errorMessage: 'Validation failed: spec is null after normalization'
    });
  }

  let lastResponseLength = 0;
  if (result.ok) lastResponseLength = result.rawContent.length;

  if (!result.ok) {
    attempts.push({
      attempt: result.attempt,
      mode: result.attempt === 3 ? 'fast_fallback' : 'full',
      model: result.attempt === 3 ? OPENAI_MODEL_FALLBACK : OPENAI_MODEL_PRIMARY,
      timeoutMs,
      maxTokens: 6000,
      promptSizeKB,
      startedAtMs: 0,
      outcome: result.error.includes('TIMEOUT') ? 'timeout' : 'openai_error',
      errorMessage: result.error
    });
    warnings.push({
      code: 'OPENAI_FAIL_FINAL',
      message: result.error.slice(0, 200),
      severity: 'error'
    });
  }

  const lastAttempt = result.attempt;
  timer.log(`✗ All ${MAX_ATTEMPTS} attempts exhausted; spec=null`);
  return {
    spec: null,
    warnings,
    attempt: lastAttempt,
    extractionMethod: 'failed',
    attempts,
    debug: {
      promptLength,
      responseLength: lastResponseLength,
      timeoutUsedMs: timeoutMs
    }
  };
}

// ============================================================================
// DURATION COHERENCE: deterministic estimate + optional auto-extend
// ============================================================================

/** Minutes per item type (heuristic for exam-like pacing). Used for estimate and auto-extend. */
const DURATION_MINUTES_BY_ITEM_TYPE: Record<string, number> = {
  multiple_choice: 2,
  true_false: 1,
  true_false_justify: 4,
  short_answer: 4,
  paragraph: 9,
  essay: 14,
  source_analysis: 14,
  table_completion: 5,
  matching: 5,
  ordering: 5,
};

const DEFAULT_MINUTES_PER_ITEM = 5;
const SECTION_OVERHEAD_MINUTES = 1;

/**
 * Deterministic estimate of total duration (minutes) from a V2 spec.
 * Sums per-item estimates by type plus optional section overhead.
 */
function estimateDurationFromSpec(spec: EvaluationSpecV2): number {
  let total = 0;
  for (const section of spec.sections || []) {
    total += SECTION_OVERHEAD_MINUTES;
    for (const item of section.items || []) {
      const t = item.type as string;
      total += DURATION_MINUTES_BY_ITEM_TYPE[t] ?? DEFAULT_MINUTES_PER_ITEM;
    }
  }
  return Math.max(0, total);
}

/**
 * One-shot auto-extend: call OpenAI to add/expand items so estimated duration reaches target (±10%).
 * Returns extended spec + warnings, or null spec on parse/validation failure.
 */
async function runDurationAutoExtend(
  currentSpec: EvaluationSpecV2,
  targetDurationMinutes: number,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer
): Promise<{ spec: EvaluationSpecV2 | null; warnings: WarningV2[] }> {
  const warnings: WarningV2[] = [];
  const low = Math.round(targetDurationMinutes * 0.9);
  const high = Math.round(targetDurationMinutes * 1.1);
  const systemPrompt = `Eres un asistente que solo devuelve JSON válido.
Tu ÚNICA tarea: extender la evaluación proporcionada para que su duración estimada total esté entre ${low} y ${high} minutos.
Reglas:
- Añade ítems nuevos o expande ítems existentes (más sub-ítems, preguntas guía, etc.).
- Mantén meta (contentIds, competencyIds, criteriosLogro), versionVariants y versionedContent donde existan.
- No cambies los IDs de secciones/ítems existentes; los nuevos ítems deben tener IDs únicos.
- Responde ÚNICAMENTE con el objeto JSON de la evaluación completa. Sin explicaciones ni code fences.`;

  const specJson = JSON.stringify(currentSpec);
  const userPrompt = `Evaluación actual (duración objetivo: ${targetDurationMinutes} min, rango aceptable: ${low}-${high} min):

${specJson}

Devuelve la evaluación extendida en JSON completo para alcanzar entre ${low} y ${high} minutos de duración estimada.`;

  timer.log(`[DURATION_AUTO_EXTEND] calling OpenAI target=${targetDurationMinutes} low=${low} high=${high}`);
  console.log(`[DURATION_AUTO_EXTEND] target=${targetDurationMinutes} requestId=${requestId}`);

  const openaiResult = await callOpenAIWithRetries('duration_extend', requestId, () => ({
    body: {
      model: OPENAI_MODEL_PRIMARY,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 6000,
      temperature: 0.4
    },
    timeoutMs: Math.min(OPENAI_TIMEOUT_PER_ATTEMPT_MS, 90000)
  }));

  if (!openaiResult.ok) {
    warnings.push({
      code: 'DURATION_EXTEND_OPENAI_ERROR',
      message: `No se pudo extender la evaluación: ${openaiResult.error.slice(0, 120)}`,
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  let parsed: unknown;
  try {
    let cleanContent = openaiResult.rawContent.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    warnings.push({
      code: 'DURATION_EXTEND_PARSE_ERROR',
      message: 'Error al parsear la evaluación extendida',
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, requestedVersions);
  warnings.push(...validationWarnings);
  if (!spec) {
    warnings.push({
      code: 'DURATION_EXTEND_VALIDATION_FAILED',
      message: 'La evaluación extendida no pasó la validación',
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  const newEst = estimateDurationFromSpec(spec);
  timer.log(`[DURATION_AUTO_EXTEND] extended estimate=${newEst} target=${targetDurationMinutes}`);
  console.log(`[DURATION_AUTO_EXTEND] extended estimate=${newEst} target=${targetDurationMinutes}`);
  return { spec, warnings };
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
    
    const studentsForVersioning = Array.isArray(groupContext?.students) ? groupContext.students : [];
    const declaredContentAdaptationByStudent = resolveDeclaredContentAdaptationByStudent(
      designPlan as Record<string, unknown>,
      studentsForVersioning as Array<Record<string, unknown>>
    );
    const declaredContentAdaptationCount = Object.values(declaredContentAdaptationByStudent).filter(Boolean).length;

    // Extract teacher reminders (admin + correction only, NOT allowances)
    const teacherReminders = extractTeacherReminders(
      perStudentReminders,
      groupContext?.students || []
    );
    const contemplacionesForDecision = buildContemplacionesByStudentFromRequest(
      designPlan as Record<string, unknown>,
      studentsForVersioning as Array<Record<string, unknown>>
    );
    const versionCDecision = evaluateDesignPackageNeedForC(
      studentsForVersioning as Array<Record<string, unknown>>,
      contemplacionesForDecision,
      teacherReminders
    );
    const requestedVersions = {
      A: true,
      B: declaredContentAdaptationCount > 0,
      C: versionCDecision.shouldCreateC || designPlan?.triggers?.versionC === true
    };
    timer.log(`[REGULATION_V3] versionCDecision shouldCreateC=${versionCDecision.shouldCreateC} explanation=${versionCDecision.explanation}`);
    timer.log(`[REGULATION_V3] declaredContentAdaptationCount=${declaredContentAdaptationCount}`);
    timer.log(`versions: A=true, B=${requestedVersions.B}, C=${requestedVersions.C}`);
    timer.mark('versions_computed');
    
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
      const studentsForRationale = Array.isArray(groupContext?.students) ? groupContext.students as Array<Record<string, unknown>> : [];
      const assignedByVersion = resolveAssignedStudentsByVersion(
        (designPlan.studentAssignments || {}) as Record<string, unknown>,
        (designPlan.assignmentByStudentId || {}) as Record<string, unknown>,
        studentsForRationale,
        declaredContentAdaptationByStudent
      );
      const contemplacionesByStudent = contemplacionesForDecision;
      const rationalePack = buildAllVersionRationalePacks(
        effectiveRequestedVersions,
        assignedByVersion,
        studentsForRationale,
        teacherReminders,
        contemplacionesByStudent,
        instrumentDesignRules
      );
      const specEvidenceSummary = buildSpecEvidenceSummary(result.spec);

      // Ensure open-ended items have equivalentResponseOptions when feature is enabled (fallback if missing)
      ensureEquivalentResponseOptionsForOpenEnded(
        result.spec,
        responseOptionsInclude,
        responseOptionCount,
        result.warnings
      );

      // Duration coherence: canonical target from designPlan, deterministic estimate from spec
      const targetDurationMinutes = (designPlan as Record<string, unknown>)?.targetDurationMinutes as number | undefined;
      let estimatedMinutes = estimateDurationFromSpec(result.spec);
      if (!result.spec.meta.duration) result.spec.meta.duration = { minutes: 90 };
      result.spec.meta.duration.minutes = estimatedMinutes;
      timer.log(`[DURATION] target=${targetDurationMinutes ?? 'none'} estimated=${estimatedMinutes}`);
      console.log(`[DURATION] target=${targetDurationMinutes ?? 'none'} estimated=${estimatedMinutes}`);

      // Auto-extend: one attempt if generated evaluation is materially shorter than target
      if (targetDurationMinutes != null && targetDurationMinutes > 0 && estimatedMinutes < targetDurationMinutes * 0.85) {
        const extended = await runDurationAutoExtend(
          result.spec,
          targetDurationMinutes,
          requestedVersions,
          requestId,
          timer
        );
        result.warnings.push(...extended.warnings);
        if (extended.spec) {
          const newEst = estimateDurationFromSpec(extended.spec);
          if (newEst >= targetDurationMinutes * 0.9) {
            result.spec = extended.spec;
            estimatedMinutes = newEst;
            if (!result.spec.meta.duration) result.spec.meta.duration = { minutes: 90 };
            result.spec.meta.duration.minutes = estimatedMinutes;
            timer.log(`[DURATION] auto-extend applied new_estimated=${estimatedMinutes}`);
            console.log(`[DURATION] auto-extend applied new_estimated=${estimatedMinutes}`);
          } else {
            result.warnings.push({
              code: 'DURATION_EXTEND_FAILED',
              message: `Tras extender, la duración estimada (${newEst} min) no alcanzó el objetivo (${targetDurationMinutes} min).`,
              severity: 'warning'
            });
          }
        } else {
          result.warnings.push({
            code: 'DURATION_EXTEND_FAILED',
            message: `No se pudo extender la evaluación para alcanzar ${targetDurationMinutes} min.`,
            severity: 'warning'
          });
        }
      }

      // Structure validation: deviation warning and optional section scaling (using final spec + estimate)
      if (targetDurationMinutes != null && targetDurationMinutes > 0) {
        const deviation = Math.abs(estimatedMinutes - targetDurationMinutes) / targetDurationMinutes;
        if (estimatedMinutes > targetDurationMinutes * 1.2) {
          result.warnings.push({
            code: 'DURATION_TOO_LONG',
            message: `La duración estimada (${estimatedMinutes} min) supera el 120% del objetivo (${targetDurationMinutes} min). Puede considerar acortar o simplificar ítems.`,
            severity: 'warning'
          });
        }
        if (deviation > 0.15) {
          result.warnings.push({
            code: 'DURATION_DEVIATION',
            message: `La duración estimada (${estimatedMinutes} min) se desvía más del 15% del objetivo (${targetDurationMinutes} min). Considere revisar los tiempos por sección.`,
            severity: 'warning'
          });
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
            ...(effectiveRequestedVersions.B ? {} : { B: 'No hay estudiantes con adaptación de contenido declarada' }),
            ...(effectiveRequestedVersions.C ? {} : { C: 'No se requiere un segundo instrumento equivalente de accesibilidad' })
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
        baseAiReport.narrative = NARRATIVE_TIMEOUT_MESSAGE;
        timer.log(`[AI_REPORT] ⚠ Narrative fallback: evaluation ready; see evidence below`);
        console.log(`[AI_REPORT] ⚠ Narrative NOT set on baseAiReport (text=${narrativeText ? 'present but invalid' : 'undefined'}) - using timeout message`);
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
          rationalePack,
          specEvidenceSummary,
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
      reportWithGuaranteedByVersion = applyNarrativeEvidenceByVersion(
        reportWithGuaranteedByVersion,
        effectiveRequestedVersions,
        rationalePack,
        specEvidenceSummary
      );
      
      // CRITICAL: Normalize aiReport to match frontend contract (AIDesignReportData)
      let normalizedAiReport: Record<string, unknown> = normalizeAiReportForFrontend(
        reportWithGuaranteedByVersion,
        result.spec,
        effectiveRequestedVersions
      );
      
      // Safety: hard-ensure byVersion again on normalized output (prevent any later overwrite)
      normalizedAiReport = ensureByVersionNarratives(normalizedAiReport, effectiveRequestedVersions, meta) as Record<string, unknown>;
      normalizedAiReport = applyNarrativeEvidenceByVersion(
        normalizedAiReport,
        effectiveRequestedVersions,
        rationalePack,
        specEvidenceSummary
      ) as Record<string, unknown>;
      
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
      const aiReportByVersionHasEvidence = {
        A: hasNarrativeEvidenceMarkers(byVersionOut?.A?.narrative || ''),
        B: hasNarrativeEvidenceMarkers(byVersionOut?.B?.narrative || ''),
        C: hasNarrativeEvidenceMarkers(byVersionOut?.C?.narrative || '')
      };
      console.log('[AI_REPORT_EVIDENCE_CHECK]', {
        requestId,
        effectiveRequestedVersions,
        byVersionKeys,
        hasEvidence: aiReportByVersionHasEvidence,
        assignedCounts: {
          A: assignedByVersion.A.length,
          B: assignedByVersion.B.length,
          C: assignedByVersion.C.length
        },
        topTriggers: {
          A: rationalePack.A.topTriggers.map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`),
          B: rationalePack.B.topTriggers.map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`),
          C: rationalePack.C.topTriggers.map(t => `${toHumanTriggerLabel(t.key)} (${t.count})`)
        }
      });
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
          model: result.attempts?.[result.attempts.length - 1]?.model ?? OPENAI_MODEL_PRIMARY,
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
          aiReportByVersionLens,
          aiReportByVersionHasEvidence,
          versionCDecision: {
            shouldCreateC: versionCDecision.shouldCreateC,
            explanation: versionCDecision.explanation,
            triggersUsed: versionCDecision.triggersUsed
          },
          declaredContentAdaptationCount,
          semanticMap: { A: 'universal', B: 'content_adaptation_declared', C: 'equivalent_accessibility' }
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
        
        // Contingency: debuggable and non-destructive — always return minimal aiReport
        const isContingencySpec = emergencySpec.sections?.some(
          (s: { title?: string }) => (s.title || '').includes('Versión de contingencia')
        );
        const reason = inferContingencyReason(result.attempts);
        const lastAttempt = result.attempts?.length ? result.attempts[result.attempts.length - 1] : undefined;
        const errorMessage = lastAttempt?.errorMessage;
        if (isContingencySpec) {
          console.error('[V2_CONTINGENCY]', {
            reason,
            errorMessage: errorMessage ?? null,
            stack: undefined,
            fingerprint: CONTINGENCY_FINGERPRINT
          });
        }
        const contingencyAiReport = buildMinimalAiReportForContingency(reason, requestedVersions);
        
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
        
        // Build response with emergency spec (success:true to prevent V1 fallback); always include aiReport
        const response: V2Response = {
          success: true, // CRITICAL: Must be true to prevent V1 fallback
          evaluationSpec: emergencySpec,
          requestedVersions,
          instrumentDesignRulesApplied: instrumentDesignRules,
          teacherRemindersByStudent: teacherReminders,
          aiReport: contingencyAiReport,
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
            attempts: allAttempts,
            contingency: true,
            contingencyReason: reason,
            contingencyFingerprint: CONTINGENCY_FINGERPRINT
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
