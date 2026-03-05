import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  DURATION_MINUTES_BY_ITEM_TYPE,
  DEFAULT_MINUTES_PER_ITEM,
  SECTION_OVERHEAD_MINUTES,
  estimateDurationFromSpec,
  buildDurationBreakdownFromSpec,
  computeDeltaMinutesNeeded,
  formatHeuristicTableForPrompt
} from "./durationMath.ts";
import { validateExcerpts, MIN_EXCERPT_LENGTH_CHARS, MAX_EXCERPT_LENGTH_CHARS } from "./excerptValidation.ts";
import { cleanAndSelectExcerpt, looksLikeMetadata, cleanMaterialTextForPrompt, filterPassagesByQuality, filterPassageByQuality, looksLikeTOC, type PassageRejectReason } from "./excerptCleaning.ts";
import {
  validateSpecItems,
  isAnswerLeakingExcerpt,
  getDegradationType,
  type InvalidItem,
  type ItemValidityResult
} from "./itemValidity.ts";

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

/** Single build ID for deploy verification. debug.build = BUILD_ID + "-new" | BUILD_ID + "-legacy". Change when deploying. */
const BUILD_ID = 'v2-guided-deploy-2026-02';

/** When false, skip LLM repair cascades (excerpt, rubric+promptB, item validity). Only deterministic safeguards run. Reduces WORKER_LIMIT. */
const USE_LLM_REPAIRS = (Deno.env.get('MODIFY_EVALUATION_V2_USE_LLM_REPAIRS') || 'false').toLowerCase() === 'true';
/** When false, skip duration auto-extend/trim LLM calls. Single-call flow; delta filler + deterministic fill only. */
const USE_DURATION_AUTO_EXTEND = (Deno.env.get('MODIFY_EVALUATION_V2_USE_DURATION_AUTO_EXTEND') || 'false').toLowerCase() === 'true';
/** When false, skip narrative-only and by-version narrative LLM calls. Use deterministic fallbacks only. */
const USE_NARRATIVE_LLM_CALLS = (Deno.env.get('MODIFY_EVALUATION_V2_USE_NARRATIVE_LLM_CALLS') || 'false').toLowerCase() === 'true';

/** Fingerprint for contingency responses (debuggable, non-destructive) */
const CONTINGENCY_FINGERPRINT = 'v3-contingency-debug-DEPLOY-FP-2026-02-17-04';

type ContingencyReason = 'openai_error' | 'openai_timeout' | 'invalid_payload' | 'spec_build_error' | 'unknown';

// Legacy constant for backward compatibility
const OPENAI_TIMEOUT_MS = OPENAI_TIMEOUT_GENERATE_MS;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-aulaplus-env',
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
  // Matching: left/right columns with display text (string[] or { id, text }[])
  leftColumn?: string[] | Array<{ id: string; text: string }>;
  rightColumn?: string[] | Array<{ id: string; text: string }>;
  // Ordering: list of elements to order with display text
  itemsToOrder?: string[] | Array<{ id: string; text: string }>;
  // Table completion structure
  table?: {
    columns: Array<{ id: string; header: string }>;
    rows: string[][];
    cellType?: 'text' | 'numeric';
  };
}

interface EvaluationSectionV2 {
  id: string;
  title: string;
  duration?: number;
  instructions?: string;
  items: EvaluationItemV2[];
}

interface DurationBreakdownSectionV2 {
  sectionId: string;
  itemType: string;
  estimatedMinutes: number;
  description: string;
  itemCount: number;
}

interface DurationBreakdownV2 {
  sections: DurationBreakdownSectionV2[];
  heuristicAssumptions: string;
  totalEstimatedMinutes?: number;
}

export interface EvaluationSpecV2 {
  version: '2.0';
  generatedAt: string;
  meta: {
    subject: string;
    gradeLevel?: string;
    groupName?: string;
    totalStudents?: number;
    duration?: { minutes: number; targetMinutes?: number; breakdown?: DurationBreakdownV2 | Record<string, number> };
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

/** Emit each warning code only once per request (keeps first occurrence). */
function dedupeWarningsByCode(warnings: WarningV2[]): WarningV2[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    if (seen.has(w.code)) return false;
    seen.add(w.code);
    return true;
  });
}

/**
 * Ensure versionVariants.B exists when Version B was requested and at least one item has promptB.
 * Prevents "Version B was requested but not generated" when repair has filled promptB.
 */
function ensureVersionBVariantWhenRequested(
  spec: EvaluationSpecV2,
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): void {
  if (!requestedVersions.B) return;
  let itemsWithPromptB = 0;
  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      const vc = item.versionedContent;
      if (typeof vc?.promptB === 'string' && vc.promptB.trim().length > 0) itemsWithPromptB++;
    }
  }
  if (itemsWithPromptB === 0) return;
  if (!spec.versionVariants) spec.versionVariants = { A: { label: 'Versión A (Universal)', isBase: true } };
  const v = spec.versionVariants as Record<string, unknown>;
  if (!v.B) {
    v.B = {
      label: 'Versión B (Adaptación de contenido declarada)',
      isBase: false,
      reason: 'Adaptación de contenido para estudiantes con adecuaciones declaradas',
      modifications: []
    };
  }
}

/** Count items with promptB and total items in spec (for single VERSION_B_PARTIAL_CONTENT warning). */
function countPromptBCoverage(spec: EvaluationSpecV2): { itemsWithPromptB: number; totalItems: number } {
  let itemsWithPromptB = 0;
  let totalItems = 0;
  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      totalItems++;
      const vc = item.versionedContent;
      if (typeof vc?.promptB === 'string' && vc.promptB.trim().length > 0) itemsWithPromptB++;
    }
  }
  return { itemsWithPromptB, totalItems };
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
  targetDurationMinutes?: number | null;
  estimatedTotalMinutes: number;
  timeBreakdown?: DurationBreakdownV2 | null;
  requestedVersions: { A: boolean; B: boolean; C: boolean };
  instrumentDesignRulesApplied: string[];
  teacherRemindersByStudent: TeacherReminderV2[];
  aiReport: AIReportV2 | Record<string, unknown> | null; // Normalized to match AIDesignReportData contract
  warnings: WarningV2[];
  debug?: {
    build?: string;
    mode?: 'new' | 'legacy';
    model: string;
    llmCallCount?: number;
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
    materialsIndexCount?: number;
    passagesSelectedCount?: number;
    materialsCharsSent?: number;
    passagesRejectedCount?: Record<PassageRejectReason, number>;
    keptBlocksCount?: number;
    usableBlocksCount?: number;
    finalK?: number;
    finalChars?: number;
    bundleShortfallReason?: string;
    materialsPromptPath?: 'bundle' | 'legacy';
    materialQuality?: {
      usableBlocksCount?: number;
      rejectedByReason?: Record<PassageRejectReason, number>;
      selectedPassagesCount?: number;
      selectedChars?: number;
      shortfallReason?: string;
    };
    metrics?: {
      promptChars?: number;
      selectionMs?: number;
      postProcessMs?: number;
      openaiMs?: number | null;
      totalMs?: number;
      skippedNonEssentialDebug?: boolean;
    };
    topKeywordsUsedForSelection?: string[];
    excerptStats?: ExcerptDebugStat[];
    invalidItemCountsByType?: Record<string, number>;
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
    targetDurationMinutes: null,
    estimatedTotalMinutes: 0,
    timeBreakdown: null,
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
  // VERSION_B_PARTIAL_CONTENT is emitted once with final counts from the main flow (after repair), not here.

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

## AGRUPACIÓN POR TEXTO/PASAGE (OBLIGATORIO)

- Cuando un ítem se basa en un texto/pasaje/fuente proporcionado:
  - multiple_choice: genera un CONJUNTO de 4 a 6 ítems de opción múltiple sobre ese mismo texto (no una sola pregunta). Cada ítem con id único. La duración se calcula por ítem (2 min por cada MC).
  - source_analysis: genera al menos 2–3 subpreguntas o ítems claramente separados sobre la misma fuente (subItems o ítems consecutivos con la misma source). Cada uno con id único. 14 min por ítem en la estimación.
- No generes un solo ítem MC por pasaje; se requieren 4–6 ítems cuando hay texto base. No generes un solo ítem source_analysis sin subpreguntas; mínimo 2–3.
- La duración estimada sigue la tabla heurística (MC=2 min por ítem, source_analysis=14 min por ítem, etc.).

## BLOQUE DE COMPRENSIÓN LECTORA (OBLIGATORIO cuando hay pasajes utilizables)

Cuando en el prompt del usuario se incluyen PASAJES RELEVANTES (sección "PASAJES RELEVANTES" con fragmentos de material):

1. DEBES incluir al menos UNA sección dedicada a comprensión basada en un excerpt concreto:
   - (a) Un ítem **source_analysis** con el fragmento adjunto en \`source.content\` (1–3 párrafos coherentes del material, no Índice ni Prólogo).
   - (b) Entre **4 y 6** ítems **multiple_choice** que se refieran explícitamente a ese mismo fragmento (mismo \`source\` o mismo pasaje citado).
   - (c) Un ítem **short_answer** que pida citar o parafrasear evidencia del fragmento (con rúbrica que valore uso de evidencia).

2. PROHIBIDO escribir en el prompt de ningún ítem frases como "según el fragmento anterior", "según el texto proporcionado" o "de la fuente anterior" si NO hay un \`source\` adjunto a ese ítem o a la sección. Si el ítem referencia un fragmento, ese fragmento DEBE estar en \`source.content\` del ítem (source_analysis) o disponible en la misma sección para los MC/short_answer.

3. Las opciones de los MC de comprensión deben ser específicas del contenido del pasaje (no placeholders genéricos "Opción A/B/C").

## TIPOS DE ITEMS

- multiple_choice: Requiere "options": [{"id": "a", "text": "...", "isCorrect": true/false}]
- true_false: Requiere "correctAnswer": true/false
- true_false_justify: Requiere "correctAnswer", "justificationRequired": true, "rubric" (mínimo 4 niveles)
- short_answer: Puede incluir "maxLength" y DEBE incluir "rubric" (mínimo 4 niveles)
- paragraph: Puede incluir "minLength", "maxLength" y DEBE incluir "rubric" (mínimo 4 niveles)
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions" y DEBE incluir "rubric" (mínimo 4 niveles)
- source_analysis: Requiere "source": {"type": "text"|"image", "content"/"url", "caption"} con "content" siendo el fragmento real del material (no solo el título). DEBE incluir "rubric" (mínimo 4 niveles). Incluir al menos 2–3 subpreguntas o ítems sobre la misma fuente.
- table_completion: Requiere "table": {"columns": [{"id": "col-1", "header": "Columna 1"}, ...], "rows": [["valor1", "", "valor3"], ["", "", ""]]}
  - columns: array de objetos con id y header (encabezados de columna)
  - rows: array de arrays de strings. Strings vacíos "" indican celdas para completar por el estudiante
  - Ejemplo: tabla de 3 columnas con 2 filas, algunas celdas pre-llenadas y otras vacías
- matching: Requiere "leftColumn": ["item1", "item2"], "rightColumn": ["matchA", "matchB"]
- ordering: Requiere "itemsToOrder": ["paso1", "paso2", "paso3"]

## VALIDEZ POR CONSTRUCCIÓN (OBLIGATORIO - cada ítem debe ser renderizable y válido)

1) **ordering**: Incluye SIEMPRE "itemsToOrder" como array de al menos 2 elementos con texto visible (eventos, pasos, conceptos a ordenar). Ejemplo: ["Primer evento", "Segundo evento", "Tercero"].
2) **matching**: Incluye SIEMPRE "leftColumn" y "rightColumn" con al menos 2 elementos cada uno y texto visible. Sin estas columnas el ítem no se puede mostrar.
3) **multiple_choice**: Incluye al menos 3 opciones en "options", cada una con "id" y "text" no vacío.
4) **source_analysis**: El campo "source.content" debe ser un fragmento de 1–3 párrafos coherentes del material (no portada ni metadatos). PROHIBIDO usar resúmenes o abstract que den la respuesta (evita frases como "en este trabajo se analiza…", "las ideas principales son…", "se examinan las características…"). El fragmento debe aportar evidencia sin enunciar la conclusión esperada.
5) **Versión B**: Si se solicita Versión B, CADA ítem debe incluir "versionedContent": { "promptB": "..." } con consigna adaptada. Sin promptB en todos los ítems, la Versión B no estará disponible.
6) **Rúbricas**: En ítems abiertos (essay, paragraph, short_answer, source_analysis, true_false_justify) cada descriptor de rúbrica debe referirse al contenido concreto del ítem y a la acción pedida; no uses frases genéricas reutilizables.

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
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  targetDurationMinutes?: number | null
): string {
  const totalStudents = groupContext.students?.length || 0;
  const normalizedTarget = typeof targetDurationMinutes === 'number' && targetDurationMinutes > 0
    ? Math.round(targetDurationMinutes)
    : null;
  // Target-centered band: aim for >=95% of target, up to 105% (not 90–110%)
  const low = normalizedTarget !== null ? Math.round(normalizedTarget * 0.95) : null;
  const high = normalizedTarget !== null ? Math.round(normalizedTarget * 1.05) : null;
  // Simple operational floor to avoid ultra-short specs:
  // average 6 min/item gives practical minimum item count for requested duration.
  const suggestedMinItems = normalizedTarget !== null
    ? Math.max(6, Math.ceil(normalizedTarget / 6))
    : null;
  const heuristicGuide = [
    '- opción múltiple: 2 min por ítem',
    '- verdadero/falso: 1 min por ítem',
    '- verdadero/falso con justificación: 4 min por ítem',
    '- respuesta corta: 4 min por ítem',
    '- párrafo: 9 min por ítem',
    '- ensayo: 14 min por ítem',
    '- análisis de fuente: 14 min por ítem',
    '- completar tabla: 5 min por ítem',
    '- relacionar: 5 min por ítem',
    '- ordenar: 5 min por ítem',
    `- tipo no listado: ${DEFAULT_MINUTES_PER_ITEM} min por ítem`,
    `- sobrecarga por sección: ${SECTION_OVERHEAD_MINUTES} min por sección`,
  ].join('\n');
  const durationInstructions = normalizedTarget !== null ? `
## DURACIÓN OBJETIVO (OBLIGATORIO)

- Duración objetivo solicitada por el docente: ${normalizedTarget} minutos.
- Rango aceptable para la duración estimada total: ${low}–${high} minutos (95%–105% del objetivo).

## GUÍA OPERATIVA DE TIEMPO (usa esta tabla para planificar estructura)

${heuristicGuide}

## REGLAS OPERATIVAS PARA CUMPLIR LA DURACIÓN

- Diseña la evaluación con suficientes secciones/ítems para alcanzar el rango ${low}–${high} usando la guía de tiempo anterior.
- Sugerencia estructural mínima: al menos ${suggestedMinItems} ítems totales (pueden combinarse con ítems largos/cortos según necesidad).
- Si usas más ítems de respuesta corta/selección, aumenta el número total de ítems; si usas más ensayos/análisis, puedes usar menos.
- En el JSON final, **meta.duration.minutes** debe reflejar la duración estimada según esta tabla (NO copiar mecánicamente el objetivo).
` : '';
  
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
${durationInstructions}

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
// SOURCE EXCERPT: validation + repair for text-based items
// ============================================================================

type MaterialWindow = {
  materialIdx: number;
  materialTitle: string;
  focusText?: string;
  passage: string;
  score: number;
  matchedKeywords: string[];
};

type MaterialsPromptBundle = {
  promptSection: string;
  materialsIndexCount: number;
  passagesSelectedCount: number;
  materialsCharsSent: number;
  topKeywordsUsedForSelection: string[];
  passagesRejectedCount?: Record<PassageRejectReason, number>;
  keptBlocksCount?: number;
  finalK?: number;
  finalChars?: number;
  bundleShortfallReason?: string;
  usableBlocksCount?: number;
};

const MATERIAL_SELECTION_TOP_K = 10;
const MATERIAL_SELECTION_MIN_K = 6;
const MATERIAL_SELECTION_CHAR_BUDGET = 28000; // 20k–30k target; use ~28k as default
const MATERIAL_SELECTION_CHAR_BUDGET_MIN = 20000;
const MIN_PARAGRAPH_LEN = 60; // paragraph floor for coherent evidence blocks
const LONG_BLOCK_CHUNK_SIZE = 700; // ~700-char windows for long blocks
const LONG_BLOCK_CHUNK_SIZE_AGGRESSIVE = 620;
const MATERIAL_LONG_TEXT_THRESHOLD = 20000;

function summarizePassageForIndex(passage: string, maxLen = 220): string {
  const normalized = passage.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Sin resumen disponible.';
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const twoSentences = sentences.slice(0, 2).join(' ');
  const base = twoSentences || normalized;
  return base.length > maxLen ? `${base.slice(0, maxLen).trim()}...` : base;
}

function guessPassageLabel(passage: string, fallback: string): string {
  const firstLine = (passage.split(/\n/).map((l) => l.trim()).find(Boolean) || '').replace(/^[\-*#\d.\)\s]+/, '');
  if (!firstLine) return fallback;
  if (firstLine.length <= 80) return firstLine;
  const sentence = firstLine.split(/[.!?]/)[0].trim();
  if (sentence.length >= 12 && sentence.length <= 80) return sentence;
  return `${firstLine.slice(0, 80).trim()}...`;
}

function tokenizeKeywords(input: string, max = 32): string[] {
  const stop = new Set([
    'para','como','donde','desde','hasta','sobre','entre','porque','cuando','este','esta','estos','estas',
    'that','with','from','have','were','will','your','para','debe','deben','item','items','evaluacion','evaluación',
    'grupo','materia','contenido','competencias','criterios','logro','version','versión','teacher','request'
  ]);
  const words = (input || '')
    .toLowerCase()
    .split(/\P{L}+/u)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

function splitParagraphs(rawText: string): string[] {
  return (rawText || '')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 90 && !looksLikeMetadata(p));
}

/** Split a long block into smaller chunks at sentence boundaries to produce more candidates. */
function chunkLongBlock(block: string, maxChunkChars: number): string[] {
  const t = block.trim();
  if (t.length <= maxChunkChars) return [t];
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const out: string[] = [];
    for (let i = 0; i < t.length; i += maxChunkChars) out.push(t.slice(i, i + maxChunkChars).trim());
    return out.filter((p) => p.length >= MIN_PARAGRAPH_LEN);
  }
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    const next = current ? `${current} ${s}` : s;
    if (next.length >= maxChunkChars && current.length >= MIN_PARAGRAPH_LEN) {
      chunks.push(current);
      current = s;
    } else {
      current = next;
    }
  }
  if (current.trim().length >= MIN_PARAGRAPH_LEN) chunks.push(current.trim());
  return chunks;
}

/** Build candidate windows from materials; ensures enough blocks (chunking + relaxed filter when kept < 6). */
function buildMaterialWindows(
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  keywords: string[],
  options?: { aggressiveChunking?: boolean }
): { windows: MaterialWindow[]; rejectedByReason: Record<PassageRejectReason, number>; keptBlocksCount: number; usableBlocksCount: number } {
  const windows: MaterialWindow[] = [];
  const aggregatedRejected: Record<PassageRejectReason, number> = { toc: 0, biblio: 0, prologue: 0, metadata: 0 };
  let totalKeptBlocks = 0;
  let totalUsableBlocks = 0;
  const chunkSize = options?.aggressiveChunking ? LONG_BLOCK_CHUNK_SIZE_AGGRESSIVE : LONG_BLOCK_CHUNK_SIZE;
  const maxWindowChars = options?.aggressiveChunking ? 5200 : 4200;
  for (let mIdx = 0; mIdx < materials.length; mIdx++) {
    const material = materials[mIdx];
    const raw = (material.extractedText || '').trim();
    if (!raw) continue;
    let rawBlocks = (raw || '')
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length >= MIN_PARAGRAPH_LEN);
    const expanded: string[] = [];
    for (const b of rawBlocks) {
      if (b.length > chunkSize) {
        expanded.push(...chunkLongBlock(b, chunkSize));
      } else {
        expanded.push(b);
      }
    }
    rawBlocks = expanded.filter((p) => p.length >= MIN_PARAGRAPH_LEN);
    const { kept: paragraphsStrict, rejected, rejectedByReason } = filterPassagesByQuality(rawBlocks);
    (['toc', 'biblio', 'prologue', 'metadata'] as const).forEach((r) => {
      aggregatedRejected[r] = (aggregatedRejected[r] || 0) + (rejectedByReason[r] || 0);
    });
    let paragraphs = paragraphsStrict;
    totalUsableBlocks += paragraphsStrict.length;
    if (paragraphs.length < MATERIAL_SELECTION_MIN_K && rejected.length > 0) {
      const relaxed: string[] = [];
      for (const block of rejected) {
        if (block.length < MIN_EXCERPT_LENGTH_CHARS) continue;
        const quality = filterPassageByQuality(block, { isFromStartOfDocument: false });
        // Controlled fallback: keep strict rejection for metadata and TOC always.
        if (!quality.keep && (quality.reason === 'metadata' || quality.reason === 'toc')) continue;
        if (looksLikeTOC(block) || looksLikeMetadata(block)) continue;
        relaxed.push(block);
      }
      paragraphs = [...paragraphs, ...relaxed].slice(0, options?.aggressiveChunking ? 80 : 40);
    }
    totalKeptBlocks += paragraphs.length;
    if (paragraphs.length === 0) continue;
    for (let i = 0; i < paragraphs.length; i++) {
      let block = '';
      for (let n = 1; n <= 5 && i + n <= paragraphs.length; n++) {
        block = block ? `${block}\n\n${paragraphs[i + n - 1]}` : paragraphs[i + n - 1];
        if (block.length > maxWindowChars) break;
        if (block.length < MIN_EXCERPT_LENGTH_CHARS) continue;
        if (isAnswerLeakingExcerpt(block)) continue;
        const lower = block.toLowerCase();
        const matched = keywords.filter((k) => lower.includes(k));
        const score = matched.length + Math.min(2, n) + (material.focusText ? 1 : 0);
        windows.push({
          materialIdx: mIdx,
          materialTitle: material.title || `Material ${mIdx + 1}`,
          focusText: material.focusText,
          passage: block,
          score,
          matchedKeywords: matched.slice(0, 10)
        });
      }
    }
  }
  windows.sort((a, b) => b.score - a.score || b.passage.length - a.passage.length);
  return { windows, rejectedByReason: aggregatedRejected, keptBlocksCount: totalKeptBlocks, usableBlocksCount: totalUsableBlocks };
}

/** Build lightweight index + curated relevant passages for the main prompt. */
function buildMaterialsPromptBundle(
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  selectionContext: string
): MaterialsPromptBundle {
  if (!materials?.length) {
    return {
      promptSection: '',
      materialsIndexCount: 0,
      passagesSelectedCount: 0,
      materialsCharsSent: 0,
      topKeywordsUsedForSelection: [],
      passagesRejectedCount: { toc: 0, biblio: 0, prologue: 0, metadata: 0 },
      keptBlocksCount: 0,
      finalK: 0,
      finalChars: 0,
      bundleShortfallReason: 'NO_MATERIALS',
      usableBlocksCount: 0
    };
  }

  const keywords = tokenizeKeywords(selectionContext, 30);
  const totalExtractedChars = materials.reduce((acc, m) => acc + ((m.extractedText || '').trim().length), 0);
  const hasLongMaterial = totalExtractedChars >= MATERIAL_LONG_TEXT_THRESHOLD;
  let { windows: ranked, rejectedByReason, keptBlocksCount, usableBlocksCount } = buildMaterialWindows(materials, keywords);
  const selected: MaterialWindow[] = [];
  let charBudgetUsed = 0;
  const budgetMax = MATERIAL_SELECTION_CHAR_BUDGET;
  for (const window of ranked) {
    const extra = window.passage.length + 200;
    const wouldExceed = charBudgetUsed + extra > budgetMax;
    if (selected.length >= MATERIAL_SELECTION_TOP_K) break;
    if (wouldExceed && selected.length >= MATERIAL_SELECTION_MIN_K) continue;
    const dup = selected.some((s) => s.materialIdx === window.materialIdx && s.passage === window.passage);
    if (dup) continue;
    selected.push(window);
    charBudgetUsed += extra;
    if (selected.length >= MATERIAL_SELECTION_MIN_K && charBudgetUsed >= MATERIAL_SELECTION_CHAR_BUDGET_MIN) break;
  }
  for (let i = selected.length; i < ranked.length && selected.length < MATERIAL_SELECTION_MIN_K; i++) {
    const next = ranked[i];
    const dup = selected.some((s) => s.materialIdx === next.materialIdx && s.passage === next.passage);
    if (dup) continue;
    const extra = next.passage.length + 200;
    if (charBudgetUsed + extra > budgetMax && selected.length >= 3) continue;
    selected.push(next);
    charBudgetUsed += extra;
  }
  if (selected.length === 0) {
    for (let i = 0; i < materials.length && selected.length < MATERIAL_SELECTION_MIN_K; i++) {
      const raw = (materials[i].extractedText || '').trim();
      if (!raw) continue;
      const seed = cleanMaterialTextForPrompt(raw, 3200);
      if (seed.length < MIN_EXCERPT_LENGTH_CHARS || isAnswerLeakingExcerpt(seed)) continue;
      selected.push({
        materialIdx: i,
        materialTitle: materials[i].title || `Material ${i + 1}`,
        focusText: materials[i].focusText,
        passage: seed,
        score: 0,
        matchedKeywords: []
      });
      charBudgetUsed += seed.length + 120;
    }
  }

  let finalChars = selected.reduce((acc, s) => acc + s.passage.length, 0);
  let bundleShortfallReason = '';
  // If materials are long but selected chars are still too low, rerank with aggressive chunking and top up.
  if (hasLongMaterial && finalChars < MATERIAL_SELECTION_CHAR_BUDGET_MIN) {
    const aggressive = buildMaterialWindows(materials, keywords, { aggressiveChunking: true });
    ranked = aggressive.windows;
    keptBlocksCount = Math.max(keptBlocksCount, aggressive.keptBlocksCount);
    usableBlocksCount = Math.max(usableBlocksCount, aggressive.usableBlocksCount);
    (['toc', 'biblio', 'prologue', 'metadata'] as const).forEach((r) => {
      rejectedByReason[r] = Math.max(rejectedByReason[r] || 0, aggressive.rejectedByReason[r] || 0);
    });
    for (const window of ranked) {
      if (selected.length >= MATERIAL_SELECTION_TOP_K) break;
      const dup = selected.some((s) => s.materialIdx === window.materialIdx && s.passage === window.passage);
      if (dup) continue;
      if (isAnswerLeakingExcerpt(window.passage)) continue;
      selected.push(window);
      finalChars += window.passage.length;
      if (finalChars >= MATERIAL_SELECTION_CHAR_BUDGET_MIN && selected.length >= MATERIAL_SELECTION_MIN_K) break;
    }
    if (finalChars < MATERIAL_SELECTION_CHAR_BUDGET_MIN) {
      bundleShortfallReason = usableBlocksCount <= 0
        ? 'INSUFFICIENT_USABLE_TEXT'
        : 'MIN_CHARS_NOT_REACHED_AFTER_TOPUP';
    }
  } else if (!hasLongMaterial && finalChars < MATERIAL_SELECTION_CHAR_BUDGET_MIN) {
    bundleShortfallReason = 'INSUFFICIENT_USABLE_TEXT';
  }

  const indexLines = [
    '',
    '## INDICE DE MATERIALES (ALCANCE GLOBAL)',
    'Resumen de bloques disponibles para que conozcas el alcance del corpus antes de redactar ítems.'
  ];
  selected.forEach((s, idx) => {
    const label = guessPassageLabel(s.passage, `Bloque ${idx + 1}`);
    const summary = summarizePassageForIndex(s.passage);
    const kw = s.matchedKeywords.length ? ` | keywords: ${s.matchedKeywords.slice(0, 6).join(', ')}` : '';
    const focus = s.focusText ? ` | enfoque docente: ${s.focusText}` : '';
    indexLines.push(`- [M${s.materialIdx + 1}-B${idx + 1}] ${s.materialTitle} - ${label}${focus}${kw}`);
    indexLines.push(`  resumen: ${summary}`);
  });

  const passagesLines = [
    '',
    '## PASAJES RELEVANTES (EVIDENCIA VERBATIM CURADA)',
    `Usa estos pasajes para construir ítems rigurosos. Son fragmentos coherentes (1-3 párrafos), limpios de portada/metadatos y seleccionados por relevancia.`,
    `Presupuesto total aprox: ${MATERIAL_SELECTION_CHAR_BUDGET} caracteres; pasajes incluidos: ${selected.length}.`
  ];
  selected.forEach((s, idx) => {
    passagesLines.push(`\n### [M${s.materialIdx + 1}-B${idx + 1}] ${s.materialTitle}`);
    if (s.focusText) passagesLines.push(`Enfoque sugerido por docente: ${s.focusText}`);
    passagesLines.push(s.passage);
    passagesLines.push('\n---');
  });

  return {
    promptSection: [...indexLines, ...passagesLines].join('\n'),
    materialsIndexCount: selected.length,
    passagesSelectedCount: selected.length,
    materialsCharsSent: finalChars,
    topKeywordsUsedForSelection: keywords.slice(0, 12),
    passagesRejectedCount: rejectedByReason,
    keptBlocksCount,
    usableBlocksCount,
    finalK: selected.length,
    finalChars,
    bundleShortfallReason: bundleShortfallReason || undefined
  };
}

/** Backward-compatible helper used by legacy repair code paths. */
function buildMaterialsExcerptSection(materials: Array<{ title?: string; focusText?: string; extractedText?: string }>): string {
  return buildMaterialsPromptBundle(materials, '').promptSection;
}

/**
 * One-shot repair: fill missing/short source.content only from provided materials. No hallucination.
 * Returns repaired spec and warnings; if repair fails or no materials, returns original spec and adds SOURCE_EXCERPT_MISSING.
 */
async function runExcerptRepair(
  currentSpec: EvaluationSpecV2,
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer
): Promise<{ spec: EvaluationSpecV2; warnings: WarningV2[] }> {
  const warnings: WarningV2[] = [];
  if (!materials?.length) {
    warnings.push({
      code: 'SOURCE_EXCERPT_MISSING',
      message: 'No se proporcionaron materiales con texto para rellenar ítems source_analysis; algunos ítems pueden tener solo título.',
      severity: 'warning'
    });
    return { spec: currentSpec, warnings };
  }
  const systemPrompt = [
    'Eres un asistente que solo devuelve JSON válido.',
    'Tu ÚNICA tarea: en la evaluación JSON proporcionada, rellenar el campo source.content de cada ítem de tipo source_analysis usando ÚNICAMENTE los textos de materiales que te doy.',
    'Reglas: NO inventes textos. Usa solo fragmentos copiados o resumidos de los materiales proporcionados. Mantén el resto del JSON igual (IDs, prompts, opciones, rúbricas).',
    'Responde ÚNICAMENTE con el objeto JSON completo de la evaluación. Sin explicaciones ni code fences.'
  ].join('\n');
  const materialsBlock = buildMaterialsExcerptSection(materials);
  const userPrompt = `Evaluación actual (algunos ítems source_analysis tienen source.content vacío o muy corto):\n\n${JSON.stringify(currentSpec)}\n\nMateriales con texto a usar:\n${materialsBlock}\n\nDevuelve la evaluación con source.content rellenado en cada source_analysis usando solo los textos de arriba.`;

  timer.log('[EXCERPT_REPAIR] calling OpenAI');
  console.log('[EXCERPT_REPAIR] requestId=' + requestId);

  const openaiResult = await callOpenAIWithRetries('excerpt_repair', requestId, () => ({
    body: {
      model: OPENAI_MODEL_PRIMARY,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 6000,
      temperature: 0.2
    },
    timeoutMs: Math.min(OPENAI_TIMEOUT_PER_ATTEMPT_MS, 60000)
  }));

  if (!openaiResult.ok) {
    warnings.push({
      code: 'SOURCE_EXCERPT_MISSING',
      message: `No se pudo rellenar excerpts: ${openaiResult.error.slice(0, 100)}`,
      severity: 'warning'
    });
    return { spec: currentSpec, warnings };
  }
  let parsed: unknown;
  try {
    let clean = openaiResult.rawContent.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    parsed = JSON.parse(clean);
  } catch {
    warnings.push({ code: 'SOURCE_EXCERPT_MISSING', message: 'Error al parsear la evaluación tras reparar excerpts.', severity: 'warning' });
    return { spec: currentSpec, warnings };
  }
  const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, requestedVersions);
  warnings.push(...validationWarnings);
  if (!spec) {
    warnings.push({ code: 'SOURCE_EXCERPT_MISSING', message: 'La evaluación tras reparar excerpts no pasó validación.', severity: 'warning' });
    return { spec: currentSpec, warnings };
  }
  const after = validateExcerpts(spec);
  if (after.valid) {
    warnings.push({ code: 'SOURCE_EXCERPT_REPAIRED', message: 'Se rellenaron excerpts faltantes en ítems source_analysis con los materiales proporcionados.', severity: 'info' });
    timer.log('[EXCERPT_REPAIR] success');
    console.log('[EXCERPT_REPAIR] success');
  } else {
    timer.log(`[EXCERPT_REPAIR] still invalid after repair: ${after.failures.length} items`);
    console.log(`[EXCERPT_REPAIR] still invalid: itemIds=${after.failures.map(f => f.itemId).join(', ')}`);
    warnings.push({
      code: 'SOURCE_EXCERPT_MISSING',
      message: `Tras reparar, ${after.failures.length} ítem(s) source_analysis siguen sin excerpt suficiente; se mantiene la evaluación.`,
      severity: 'warning'
    });
  }
  return { spec, warnings };
}

/** Excerpt debug stats (only attached to response.debug when present). */
export type ExcerptDebugStat = {
  itemId: string;
  excerptSource: 'cleaned_selection' | 'fallback' | 'degraded';
  excerptLengthChars: number;
  topMatchedKeywords?: string[];
  excerptRejectReason?: string;
};

/**
 * Apply coherent excerpt selection/cleaning to all source_analysis items: replace raw/metadata-like
 * content with 1–3 contiguous substantive paragraphs matched to the item prompt. Pushes
 * SOURCE_EXCERPT_CLEANED (info) and/or SOURCE_EXCERPT_LOW_RELEVANCE (warning) into warnings.
 * Optionally returns excerptStats for debug.
 */
function applyExcerptCleaningToSpec(
  spec: EvaluationSpecV2,
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  warnings: WarningV2[],
  options?: { collectDebugStats?: boolean }
): { excerptStats: ExcerptDebugStat[] } {
  const excerptStats: ExcerptDebugStat[] = [];
  const materialsWithText = materials.filter((m) => (m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS);
  if (materialsWithText.length === 0) return { excerptStats };

  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      if (item.type !== 'source_analysis' || !item.source) continue;
      const itemId = item.id || '';
      const prompt = (item.prompt || '').trim();
      const currentContent = (item.source.content || '').trim();
      const currentQuality = filterPassageByQuality(currentContent, { isFromStartOfDocument: false });
      const candidates: Array<{
        excerpt: string;
        source: 'cleaned_selection' | 'fallback';
        excerptLengthChars: number;
        topMatchedKeywords?: string[];
        wasCleaned?: boolean;
        lowRelevance?: boolean;
        excerptRejectReason?: PassageRejectReason;
      }> = [];
      for (const m of materialsWithText) {
        const raw = (m.extractedText || '').trim();
        const result = cleanAndSelectExcerpt(raw, prompt);
        const excerpt = (result.excerpt || '').trim();
        const quality = filterPassageByQuality(excerpt, { isFromStartOfDocument: false });
        if (excerpt.length >= MIN_EXCERPT_LENGTH_CHARS && quality.keep && !looksLikeTOC(excerpt) && !looksLikeMetadata(excerpt)) {
          candidates.push({
            excerpt,
            source: result.source,
            excerptLengthChars: result.excerptLengthChars,
            topMatchedKeywords: result.topMatchedKeywords,
            wasCleaned: result.wasCleaned,
            lowRelevance: result.lowRelevance,
            excerptRejectReason: result.excerptRejectReason,
          });
        }
      }
      const best = (() => {
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => {
          if (a.source !== b.source) return a.source === 'cleaned_selection' ? -1 : 1;
          const aKw = a.topMatchedKeywords?.length ?? 0;
          const bKw = b.topMatchedKeywords?.length ?? 0;
          if (bKw !== aKw) return bKw - aKw;
          return (a.lowRelevance === false ? 1 : 0) - (b.lowRelevance === false ? 1 : 0);
        });
        return candidates[0];
      })();
      if (best && best.excerpt.length >= MIN_EXCERPT_LENGTH_CHARS) {
        item.source.content = best.excerpt;
        if (best.wasCleaned && (looksLikeMetadata(currentContent) || looksLikeTOC(currentContent) || currentContent !== best.excerpt)) {
          warnings.push({
            code: 'SOURCE_EXCERPT_CLEANED',
            message: `Fragmento de fuente reemplazado por párrafos coherentes en ítem ${itemId}.`,
            severity: 'info',
          });
        }
        if (best.lowRelevance) {
          warnings.push({
            code: 'SOURCE_EXCERPT_LOW_RELEVANCE',
            message: `No se encontró un pasaje óptimo para el ítem ${itemId}; se usó el mejor disponible.`,
            severity: 'warning',
          });
        }
        if (options?.collectDebugStats) {
          excerptStats.push({
            itemId,
            excerptSource: best.source,
            excerptLengthChars: best.excerptLengthChars,
            topMatchedKeywords: best.topMatchedKeywords,
            excerptRejectReason: best.excerptRejectReason,
          });
        }
        continue;
      }

      // No acceptable excerpt was found (or existing one is low quality): deterministically degrade.
      item.type = 'short_answer';
      item.prompt = containsFragmentReference(prompt)
        ? fixPromptFragmentReference(prompt)
        : (prompt || `Explique un aspecto relevante de la temática trabajada.`);
      (item as Record<string, unknown>).source = undefined;
      warnings.push({
        code: 'SOURCE_EXCERPT_LOW_QUALITY_DEGRADED',
        message: `Ítem ${itemId} degradado a short_answer por falta de excerpt analizable de calidad.`,
        severity: 'warning',
      });
      if (options?.collectDebugStats) {
        excerptStats.push({
          itemId,
          excerptSource: 'degraded',
          excerptLengthChars: 0,
          excerptRejectReason: currentQuality.keep ? 'no_clean_candidate' : (currentQuality.reason || 'no_clean_candidate'),
        });
      }
    }
  }
  return { excerptStats };
}

/**
 * Degrade items that require source but have no/short excerpt: convert to short_answer or remove and add a short compensatory item.
 * Does not change existing item IDs; new items get new unique IDs.
 */
function degradeItemsWithMissingExcerpt(
  spec: EvaluationSpecV2,
  failures: Array<{ sectionId: string; itemId: string; itemType: string }>,
  warnings: WarningV2[]
): void {
  for (const failure of failures) {
    for (const section of spec.sections || []) {
      if (section.id !== failure.sectionId) continue;
      const items = section.items || [];
      const idx = items.findIndex((i: EvaluationItemV2) => i.id === failure.itemId);
      if (idx < 0) continue;
      const item = items[idx] as EvaluationItemV2;
      item.type = 'short_answer';
      if (item.source) {
        (item as Record<string, unknown>).source = undefined;
      }
      warnings.push({
        code: 'SOURCE_EXCERPT_MISSING',
        message: `Ítem ${failure.itemId} (source_analysis) sin excerpt suficiente; convertido a short_answer.`,
        severity: 'warning'
      });
      break;
    }
  }
}

// ============================================================================
// DURATION COHERENCE: deterministic estimate + optional auto-extend
// ============================================================================

/**
 * One-shot auto-extend: call OpenAI to add/change items so heuristic estimated duration reaches target (±10%).
 * Returns extended spec + warnings, or null spec on parse/validation failure.
 * The estimate is computed by item TYPE (and section count), NOT by text length—so the model must add items or convert types.
 */
async function runDurationAutoExtend(
  currentSpec: EvaluationSpecV2,
  targetDurationMinutes: number,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer,
  currentEstimateMinutes: number,
  previousAttemptDidNotIncreaseHeuristic?: boolean
): Promise<{ spec: EvaluationSpecV2 | null; warnings: WarningV2[] }> {
  const warnings: WarningV2[] = [];
  // Target-centered: aim for 95%–105% of target (not 90–110%)
  const low = Math.round(targetDurationMinutes * 0.95);
  const high = Math.round(targetDurationMinutes * 1.05);
  const deltaMinutesNeeded = computeDeltaMinutesNeeded(currentEstimateMinutes, low);
  const heuristicTable = formatHeuristicTableForPrompt();

  const systemParts = [
    "Eres un asistente que solo devuelve JSON válido.",
    "Tu ÚNICA tarea: extender la evaluación para que su duración ESTIMADA (heurística) total esté entre " + low + " y " + high + " minutos.",
    "",
    "CÓMO SE CALCULA LA DURACIÓN ESTIMADA (importante):",
    "La duración se calcula como SUMA por tipo de ítem y por sección. La cantidad de texto o explicaciones NO cuenta.",
    "Regla explícita: Añadir más texto o explicaciones más largas NO aumenta la duración estimada en este sistema.",
    "Para AUMENTAR la duración estimada DEBES añadir ítems nuevos y/o convertir tipos de ítem a tipos de más minutos según la tabla siguiente.",
    "",
    "Tabla de minutos por tipo de ítem (y por sección):",
    heuristicTable,
    "",
    "Reglas de salida:",
    "- Debes añadir al menos " + deltaMinutesNeeded + " minutos en valor heurístico (sumando ítems nuevos o tipos de más minutos).",
    "  Preferir ítems nuevos con IDs únicos; no modificar los IDs de ítems existentes.",
    "- Puedes añadir 1–2 secciones nuevas si hace falta; la sobrecarga por sección es solo 1 minuto, así que enfócate en ítems.",
    "- Mantén meta (contentIds, competencyIds, criteriosLogro), versionVariants y versionedContent donde existan.",
    "- Responde ÚNICAMENTE con el objeto JSON de la evaluación completa. Sin explicaciones ni code fences."
  ];
  if (previousAttemptDidNotIncreaseHeuristic) {
    systemParts.push("");
    systemParts.push("IMPORTANTE: Tu intento anterior no aumentó los minutos heurísticos estimados. Expandir solo texto no basta. Debes añadir ítems nuevos o cambiar tipos de ítem a tipos de más minutos.");
  }
  const systemPrompt = systemParts.join("\n");

  const specJson = JSON.stringify(currentSpec);
  const userParts = [
    "Evaluación actual.",
    "Duración estimada actual (heurística): " + currentEstimateMinutes + " min.",
    "Objetivo: " + targetDurationMinutes + " min. Rango aceptable: " + low + "–" + high + " min.",
    "Minutos heurísticos que debes añadir como mínimo para llegar al menos a " + low + " min: " + deltaMinutesNeeded + " (deltaMinutesNeeded).",
    "",
    "Debes añadir al menos " + deltaMinutesNeeded + " minutos en ítems (nuevos ítems o conversión a tipos de más minutos). No basta con ampliar texto.",
    "",
    specJson
  ];
  const userPrompt = userParts.join("\n");

  timer.log(`[DURATION_AUTO_EXTEND] calling OpenAI currentEst=${currentEstimateMinutes} target=${targetDurationMinutes} low=${low} high=${high} deltaMinutesNeeded=${deltaMinutesNeeded}`);
  console.log(`[DURATION_AUTO_EXTEND] currentEst=${currentEstimateMinutes} target=${targetDurationMinutes} deltaMinutesNeeded=${deltaMinutesNeeded} requestId=${requestId}`);

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
  timer.log(`[DURATION_AUTO_EXTEND] oldEst=${currentEstimateMinutes} -> newEst=${newEst} target=${targetDurationMinutes}`);
  console.log(`[DURATION_AUTO_EXTEND] oldEst=${currentEstimateMinutes} -> newEst=${newEst} target=${targetDurationMinutes}`);
  return { spec, warnings };
}

/**
 * One-shot auto-trim: call OpenAI to remove items or convert to lower-minute types so heuristic estimate falls within target band (90–110%).
 * Shortening text does NOT reduce the heuristic estimate; only fewer items or lower-minute types do.
 */
async function runDurationAutoTrim(
  currentSpec: EvaluationSpecV2,
  targetDurationMinutes: number,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer,
  currentEstimateMinutes: number
): Promise<{ spec: EvaluationSpecV2 | null; warnings: WarningV2[] }> {
  const warnings: WarningV2[] = [];
  // Target-centered: 95%–105% band
  const low = Math.round(targetDurationMinutes * 0.95);
  const high = Math.round(targetDurationMinutes * 1.05);
  const heuristicTable = formatHeuristicTableForPrompt();
  const minutesToRemove = Math.max(0, currentEstimateMinutes - high);

  const systemPrompt = [
    "Eres un asistente que solo devuelve JSON válido.",
    "Tu ÚNICA tarea: acortar la evaluación para que su duración ESTIMADA (heurística) total esté entre " + low + " y " + high + " minutos.",
    "",
    "CÓMO SE CALCULA LA DURACIÓN ESTIMADA:",
    "La duración es SUMA por tipo de ítem y por sección. Acortar solo el texto NO reduce la estimación.",
    "Regla: Para REDUCIR la duración estimada DEBES quitar ítems o convertir tipos a tipos de menos minutos (según la tabla).",
    "",
    "Tabla de minutos por tipo:",
    heuristicTable,
    "",
    "Reglas:",
    "- Reduce la estimación heurística en al menos " + minutesToRemove + " minutos (quitando ítems o pasando a tipos de menos minutos). Mantén la cobertura esencial.",
    "- No cambies los IDs de los ítems que conserves; los ítems que elimines simplemente desaparecen.",
    "- Mantén meta (contentIds, competencyIds, criteriosLogro), versionVariants y versionedContent donde existan.",
    "- Responde ÚNICAMENTE con el objeto JSON de la evaluación completa. Sin explicaciones ni code fences."
  ].join("\n");

  const specJson = JSON.stringify(currentSpec);
  const userPrompt = [
    "Evaluación actual. Duración estimada actual: " + currentEstimateMinutes + " min.",
    "Objetivo: entre " + low + " y " + high + " min. Debes reducir al menos " + minutesToRemove + " minutos heurísticos (quitando ítems o cambiando tipos).",
    "",
    specJson
  ].join("\n");

  timer.log(`[DURATION_AUTO_TRIM] calling OpenAI currentEst=${currentEstimateMinutes} target=${targetDurationMinutes} low=${low} high=${high} minutesToRemove=${minutesToRemove}`);
  console.log(`[DURATION_AUTO_TRIM] currentEst=${currentEstimateMinutes} target=${targetDurationMinutes} minutesToRemove=${minutesToRemove} requestId=${requestId}`);

  const openaiResult = await callOpenAIWithRetries('duration_trim', requestId, () => ({
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
      code: 'DURATION_TRIM_OPENAI_ERROR',
      message: `No se pudo acortar la evaluación: ${openaiResult.error.slice(0, 120)}`,
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
  } catch {
    warnings.push({
      code: 'DURATION_TRIM_PARSE_ERROR',
      message: 'Error al parsear la evaluación recortada',
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, requestedVersions);
  warnings.push(...validationWarnings);
  if (!spec) {
    warnings.push({
      code: 'DURATION_TRIM_VALIDATION_FAILED',
      message: 'La evaluación recortada no pasó la validación',
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  const newEst = estimateDurationFromSpec(spec);
  timer.log(`[DURATION_AUTO_TRIM] oldEst=${currentEstimateMinutes} -> newEst=${newEst} target=${targetDurationMinutes}`);
  console.log(`[DURATION_AUTO_TRIM] oldEst=${currentEstimateMinutes} -> newEst=${newEst} target=${targetDurationMinutes}`);
  return { spec, warnings };
}

// ============================================================================
// RUBRIC + VERSION B COMPLETION: single post-processing repair pass
// ============================================================================

/**
 * Detect items that need rubric improvement (open-ended with fallback/low-quality rubric)
 * or missing versionedContent.promptB when Version B is requested.
 * Returns { rubricRepairIds, promptBRepairIds }. Exported for unit tests.
 */
export function detectRubricAndPromptBRepairCandidates(
  spec: EvaluationSpecV2,
  requestedVersions: { A: boolean; B: boolean; C: boolean }
): { rubricRepairIds: string[]; promptBRepairIds: string[] } {
  const rubricRepairIds: string[] = [];
  const promptBRepairIds: string[] = [];
  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      const id = item.id || '';
      if (!id) continue;
      if (isOpenEndedItemType(item.type)) {
        const prompt = (item.prompt || '').trim();
        const points = typeof item.points === 'number' ? item.points : 4;
        const normalized = normalizeAndValidateRubric(item.rubric, prompt, points);
        let needsRubricRepair = !normalized;
        if (normalized) {
          const keywords = extractPromptKeywords(prompt);
          const contentPhrase = extractContentPhrase(prompt);
          const action = extractPromptAction(prompt);
          needsRubricRepair = checkRubricQuality(normalized, keywords, contentPhrase, action).lowQuality;
        }
        if (needsRubricRepair) rubricRepairIds.push(id);
      }
      if (requestedVersions.B) {
        const vc = item.versionedContent;
        const hasPromptB = typeof vc?.promptB === 'string' && vc.promptB.trim().length > 0;
        if (!hasPromptB) promptBRepairIds.push(id);
      }
    }
  }
  return { rubricRepairIds, promptBRepairIds };
}

/**
 * One-shot LLM repair: improve rubrics with content-specific descriptors and fill missing promptB.
 * Keeps item IDs and evaluated content/objective unchanged. If repair fails, returns original spec + single warning.
 */
async function runRubricAndPromptBRepair(
  currentSpec: EvaluationSpecV2,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer
): Promise<{ spec: EvaluationSpecV2 | null; warnings: WarningV2[] }> {
  const warnings: WarningV2[] = [];
  const { rubricRepairIds, promptBRepairIds } = detectRubricAndPromptBRepairCandidates(currentSpec, requestedVersions);
  const needsRepair = rubricRepairIds.length > 0 || promptBRepairIds.length > 0;
  if (!needsRepair) {
    return { spec: currentSpec, warnings };
  }

  const systemParts = [
    'Eres un asistente que solo devuelve JSON válido.',
    'Tu ÚNICA tarea: en la evaluación JSON proporcionada, hacer SOLO los siguientes cambios (sin modificar IDs ni contenido evaluado):',
    rubricRepairIds.length > 0
      ? `1) RÚBRICAS: Para los ítems con id en [${rubricRepairIds.join(', ')}], mejora "rubric.levels" con descriptores específicos al contenido del ítem y a la acción pedida (analizar, justificar, explicar, etc.). Mínimo 4 niveles. Prohibido descriptores genéricos reutilizables.`
      : '',
    promptBRepairIds.length > 0
      ? `2) VERSIÓN B (OBLIGATORIO): Para CADA ítem con id en [${promptBRepairIds.join(', ')}] debes añadir "versionedContent": { "promptB": "..." } con una consigna pedagógicamente adaptada (no equivalente a A), manteniendo evidencia escrita y contemplaciones de accesibilidad. Es OBLIGATORIO rellenar promptB en todos estos ítems; la Versión B solo se ofrecerá si todos tienen promptB.`
      : '',
    'No cambies los id de ítems ni secciones. No alteres prompt, options, correctAnswer ni objetivos de los ítems. Responde ÚNICAMENTE con el objeto JSON completo. Sin explicaciones ni code fences.'
  ].filter(Boolean);

  const systemPrompt = systemParts.join('\n');
  const userPrompt = `Evaluación actual:\n\n${JSON.stringify(currentSpec)}\n\nAplica solo los cambios indicados (rúbricas y/o promptB) y devuelve el JSON completo.`;

  timer.log('[RUBRIC_PROMPTB_REPAIR] calling OpenAI');
  const openaiResult = await callOpenAIWithRetries('rubric_promptb_repair', requestId, () => ({
    body: {
      model: OPENAI_MODEL_PRIMARY,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 8000,
      temperature: 0.3
    },
    timeoutMs: Math.min(OPENAI_TIMEOUT_PER_ATTEMPT_MS, 60000)
  }));

  if (!openaiResult.ok) {
    warnings.push({
      code: 'RUBRIC_PROMPTB_REPAIR_FAILED',
      message: 'No se pudo completar la reparación de rúbricas y/o promptB; se mantiene la especificación original.',
      severity: 'warning'
    });
    return { spec: currentSpec, warnings };
  }

  let parsed: unknown;
  try {
    let clean = openaiResult.rawContent.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    parsed = JSON.parse(clean);
  } catch {
    warnings.push({
      code: 'RUBRIC_PROMPTB_REPAIR_FAILED',
      message: 'Error al parsear la evaluación tras reparar rúbricas/promptB; se mantiene la especificación original.',
      severity: 'warning'
    });
    return { spec: currentSpec, warnings };
  }

  const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, requestedVersions);
  if (!spec) {
    warnings.push({
      code: 'RUBRIC_PROMPTB_REPAIR_FAILED',
      message: 'La evaluación tras reparar rúbricas/promptB no pasó validación; se mantiene la especificación original.',
      severity: 'warning'
    });
    return { spec: currentSpec, warnings };
  }
  warnings.push(...validationWarnings);
  const repairedCount = rubricRepairIds.length + promptBRepairIds.length;
  warnings.push({
    code: 'RUBRIC_PROMPTB_REPAIRED',
    message: `Se completaron rúbricas y/o versionedContent.promptB para ${repairedCount} ítem(s).`,
    severity: 'info'
  });
  timer.log('[RUBRIC_PROMPTB_REPAIR] success');
  return { spec, warnings };
}

// ============================================================================
// DURATION DELTA FILLER: deterministic guardrail when LLM extend falls short
// ============================================================================

const DELTA_FILLER_SECTION_ID = 'duration-filler-section';
const DELTA_FILLER_SECTION_TITLE = 'Complemento de duración';
const DELTA_FILLER_ITEM_ID_PREFIX = 'filler-';
const MAX_DELTA_FILLER_ITEMS_TOTAL = 4; // hard cap: avoid low-quality item spam

/**
 * Collect all existing item and section IDs in the spec (to generate unique new IDs).
 */
function collectExistingIds(spec: EvaluationSpecV2): { itemIds: Set<string>; sectionIds: Set<string> } {
  const itemIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const section of spec.sections || []) {
    if (section.id) sectionIds.add(section.id);
    for (const item of section.items || []) {
      if (item.id) itemIds.add(item.id);
    }
  }
  return { itemIds, sectionIds };
}

/**
 * Generate a unique item ID that does not exist in the spec. Uses prefix and numeric suffix.
 */
function nextFillerItemId(existingItemIds: Set<string>, prefix: string, startIndex: number): string {
  let n = startIndex;
  let id: string;
  do {
    id = `${prefix}${n}`;
    n++;
  } while (existingItemIds.has(id));
  return id;
}

/**
 * Deterministic delta filler: add items until heuristic estimate >= low (95% of target).
 * Policy: prefer fewer high-value items (essay/paragraph); MC only when high-quality excerpt exists.
 * Never modifies existing item IDs; adds only new items in a dedicated section.
 * Documented in 24-delta-filler-and-version-b-fix.md. Exported for unit tests.
 */
export function applyDeltaFiller(
  spec: EvaluationSpecV2,
  targetMinutes: number,
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  warnings: WarningV2[],
  subjectLabel?: string
): { spec: EvaluationSpecV2; itemsAdded: number } {
  const low = Math.round(targetMinutes * 0.95);
  const currentEstimate = estimateDurationFromSpec(spec);
  let remainingDelta = Math.max(0, low - currentEstimate);
  if (remainingDelta <= 0) return { spec, itemsAdded: 0 };

  const { itemIds, sectionIds } = collectExistingIds(spec);
  const subject = (subjectLabel || 'el tema').trim();
  const materialsWithExcerpt = materials.filter(
    (m) => (m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS
  );
  let usableExcerpt = '';
  if (materialsWithExcerpt.length > 0) {
    for (const material of materialsWithExcerpt) {
      const selected = cleanAndSelectExcerpt(
        (material.extractedText || '').trim(),
        `análisis de ${subject}`
      );
      const excerpt = (selected.excerpt || '').trim();
      const quality = filterPassageByQuality(excerpt, { isFromStartOfDocument: false });
      if (
        excerpt.length >= MIN_EXCERPT_LENGTH_CHARS &&
        quality.keep &&
        !looksLikeTOC(excerpt) &&
        !looksLikeMetadata(excerpt) &&
        !isAnswerLeakingExcerpt(excerpt)
      ) {
        usableExcerpt = excerpt.slice(0, MAX_EXCERPT_LENGTH_CHARS);
        break;
      }
    }
  }

  const newItems: EvaluationItemV2[] = [];
  let itemIndex = 0;
  const normalizedExistingStems = new Set<string>();
  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      const stem = (item.prompt || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (stem) normalizedExistingStems.add(stem);
    }
  }
  const minutesPerMC = DURATION_MINUTES_BY_ITEM_TYPE['multiple_choice'] ?? 2;
  const minutesPerShort = DURATION_MINUTES_BY_ITEM_TYPE['short_answer'] ?? 4;
  const minutesPerParagraph = DURATION_MINUTES_BY_ITEM_TYPE['paragraph'] ?? 9;
  const minutesPerEssay = DURATION_MINUTES_BY_ITEM_TYPE['essay'] ?? 14;
  const hasHighQualityExcerpt = usableExcerpt.length >= MIN_EXCERPT_LENGTH_CHARS;

  const passageKeywords = hasHighQualityExcerpt ? tokenizeKeywords(usableExcerpt, 10) : [];
  const fillerTerms = expandDeterministicTerms(passageKeywords.length > 0 ? passageKeywords : [subject], subject);
  const isDuplicateStem = (prompt: string): boolean => {
    const stem = prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!stem) return true;
    if (normalizedExistingStems.has(stem)) return true;
    const stemTokens = new Set(stem.split(' ').filter((t) => t.length >= 4));
    for (const existing of normalizedExistingStems) {
      const existingTokens = existing.split(' ').filter((t) => t.length >= 4);
      const shared = existingTokens.filter((t) => stemTokens.has(t)).length;
      if (shared >= 5) return true;
    }
    return false;
  };
  while (remainingDelta > 0 && newItems.length < MAX_DELTA_FILLER_ITEMS_TOTAL) {
    if (remainingDelta >= minutesPerEssay) {
      const id = nextFillerItemId(itemIds, DELTA_FILLER_ITEM_ID_PREFIX, itemIndex);
      itemIds.add(id);
      itemIndex++;
      const prompt = `Desarrolle una respuesta argumentada sobre ${subject}, incorporando conceptos clave y evidencia trabajada en clase.`;
      if (isDuplicateStem(prompt)) {
        remainingDelta -= 1;
        continue;
      }
      newItems.push({
        id,
        type: 'essay',
        prompt,
        points: 4,
        rubric: buildFallbackRubric(prompt, 4)
      } as EvaluationItemV2);
      remainingDelta -= minutesPerEssay;
      normalizedExistingStems.add(prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
    } else if (remainingDelta >= minutesPerParagraph) {
      const id = nextFillerItemId(itemIds, DELTA_FILLER_ITEM_ID_PREFIX, itemIndex);
      itemIds.add(id);
      itemIndex++;
      const prompt = `Elabore un párrafo explicativo sobre ${subject} destacando una relación causa-consecuencia o evidencia concreta.`;
      if (isDuplicateStem(prompt)) {
        remainingDelta -= 1;
        continue;
      }
      newItems.push({
        id,
        type: 'paragraph',
        prompt,
        points: 3,
        rubric: buildFallbackRubric(prompt, 3)
      } as EvaluationItemV2);
      remainingDelta -= minutesPerParagraph;
      normalizedExistingStems.add(prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
    } else if (hasHighQualityExcerpt && remainingDelta >= minutesPerMC) {
      const id = nextFillerItemId(itemIds, DELTA_FILLER_ITEM_ID_PREFIX, itemIndex);
      itemIds.add(id);
      itemIndex++;
      const options = buildDeterministicMcOptions(fillerTerms, subject).map((opt, idx) => ({
        ...opt,
        id: `${id}-opt-${idx + 1}`
      }));
      const mcPrompt = 'A partir del fragmento adjunto, seleccione la opción que mejor responde.';
      if (isDuplicateStem(mcPrompt)) {
        remainingDelta -= 1;
        continue;
      }
      newItems.push({
        id,
        type: 'multiple_choice',
        prompt: mcPrompt,
        points: 1,
        options,
        source: {
          type: 'text',
          content: usableExcerpt,
          caption: materialsWithExcerpt[0]?.title || 'Fragmento'
        }
      } as EvaluationItemV2);
      remainingDelta -= minutesPerMC;
      normalizedExistingStems.add(mcPrompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
    } else if (remainingDelta >= minutesPerShort) {
      const id = nextFillerItemId(itemIds, DELTA_FILLER_ITEM_ID_PREFIX, itemIndex);
      itemIds.add(id);
      itemIndex++;
      const prompt = `Indique brevemente un aspecto relevante sobre ${subject}.`;
      if (isDuplicateStem(prompt)) {
        remainingDelta -= 1;
        continue;
      }
      newItems.push({
        id,
        type: 'short_answer',
        prompt,
        points: 2,
        rubric: buildFallbackRubric(prompt, 2)
      } as EvaluationItemV2);
      remainingDelta -= minutesPerShort;
      normalizedExistingStems.add(prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
    } else if (hasHighQualityExcerpt && remainingDelta >= minutesPerMC) {
      // last resort small step only when excerpt exists and remains high-quality
      const id = nextFillerItemId(itemIds, DELTA_FILLER_ITEM_ID_PREFIX, itemIndex);
      itemIds.add(id);
      itemIndex++;
      const options = buildDeterministicMcOptions(fillerTerms, subject).map((opt, idx) => ({ ...opt, id: `${id}-opt-${idx + 1}` }));
      const mcPrompt = 'A partir del fragmento adjunto, seleccione la opción que mejor responde.';
      if (isDuplicateStem(mcPrompt)) {
        remainingDelta -= 1;
        continue;
      }
      newItems.push({
        id,
        type: 'multiple_choice',
        prompt: mcPrompt,
        points: 1,
        options,
        source: { type: 'text', content: usableExcerpt, caption: materialsWithExcerpt[0]?.title || 'Fragmento' }
      } as EvaluationItemV2);
      remainingDelta -= minutesPerMC;
      normalizedExistingStems.add(mcPrompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
    } else {
      break;
    }
  }

  if (newItems.length === 0) return { spec, itemsAdded: 0 };

  const targetSection = (spec.sections || []).find((s) => Array.isArray(s.items)) || (spec.sections || [])[0];
  if (targetSection) {
    targetSection.items = [...(targetSection.items || []), ...newItems];
  } else {
    const sectionId = sectionIds.has(DELTA_FILLER_SECTION_ID)
      ? `${DELTA_FILLER_SECTION_ID}-${Date.now()}`
      : DELTA_FILLER_SECTION_ID;
    spec.sections = [...(spec.sections || []), { id: sectionId, title: DELTA_FILLER_SECTION_TITLE, items: newItems }];
  }
  const newSpec: EvaluationSpecV2 = { ...spec, sections: [...(spec.sections || [])] };
  warnings.push({
    code: 'DURATION_DELTA_FILLER_APPLIED',
    message: `Se añadieron ${newItems.length} ítem(s) de complemento para alcanzar la duración objetivo (estimado anterior ${currentEstimate} min, objetivo ≥${low} min).`,
    severity: 'info',
    context: { itemsAdded: newItems.length, previousEstimate: currentEstimate, targetLow: low, usedHighQualityExcerpt: hasHighQualityExcerpt, maxItemsCap: MAX_DELTA_FILLER_ITEMS_TOTAL }
  });
  if (remainingDelta > 0) {
    warnings.push({
      code: 'DURATION_REALISM_CAP_REACHED',
      message: `Se detuvo el complemento de duración para preservar realismo pedagógico (delta pendiente aprox. ${remainingDelta} min).`,
      severity: 'warning'
    });
  }
  return { spec: newSpec, itemsAdded: newItems.length };
}

// ============================================================================
// ITEM VALIDITY: validation, one-shot repair, fallback degradation
// ============================================================================

/**
 * One-shot LLM repair for invalid items: fill ordering/matching/MC/source_analysis,
 * replace answer-leaking excerpts. Keeps all IDs unchanged. Returns repaired spec or null.
 */
async function runItemValidityRepair(
  currentSpec: EvaluationSpecV2,
  invalidItems: InvalidItem[],
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  _groupContext: { subject?: string; groupName?: string },
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  requestId: string,
  timer: Timer
): Promise<{ spec: EvaluationSpecV2 | null; warnings: WarningV2[] }> {
  const warnings: WarningV2[] = [];
  const invalidIds = invalidItems.map((i) => i.itemId).join(', ');
  const materialsBlock = materials.length > 0
    ? materials
        .map((m, i) => `### Material ${i + 1} (${m.title || 'Sin título'}):\n${(m.extractedText || '').trim().slice(0, 3000)}`)
        .join('\n\n')
    : '';

  const systemParts = [
    'Eres un asistente que solo devuelve JSON válido.',
    'Tu ÚNICA tarea: corregir los ítems inválidos en la evaluación JSON sin cambiar ningún id de ítem ni sección.',
    'Reglas:',
    '- ordering: incluir "itemsToOrder" como array de strings (o { id, text }) con al menos 2 elementos con texto visible (eventos, pasos, etc.).',
    '- matching: incluir "leftColumn" y "rightColumn" como arrays con al menos 2 elementos cada uno y texto visible.',
    '- multiple_choice: incluir "options" con al menos 3 opciones, cada una con "id" y "text".',
    '- source_analysis: si el fragmento en source.content es un resumen/abstract que da la respuesta, reemplazarlo por un pasaje de 1–3 párrafos que aporte evidencia sin enunciar la conclusión esperada. Usar solo texto de los materiales proporcionados.',
    'No alteres objetivos de aprendizaje ni ids. Responde ÚNICAMENTE con el objeto JSON completo. Sin explicaciones ni code fences.'
  ];
  const userPrompt = `Evaluación actual. Los siguientes ítems deben corregirse (ids: ${invalidIds}):\n\n${JSON.stringify(currentSpec)}\n\nMateriales (para rellenar o reemplazar source.content cuando aplique):\n${materialsBlock}\n\nDevuelve la evaluación completa con los ítems corregidos.`;

  timer.log('[ITEM_VALIDITY_REPAIR] calling OpenAI');
  const openaiResult = await callOpenAIWithRetries('item_validity_repair', requestId, () => ({
    body: {
      model: OPENAI_MODEL_PRIMARY,
      messages: [{ role: 'system', content: systemParts.join('\n') }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 8000,
      temperature: 0.2
    },
    timeoutMs: Math.min(OPENAI_TIMEOUT_PER_ATTEMPT_MS, 60000)
  }));

  if (!openaiResult.ok) {
    warnings.push({
      code: 'ITEM_SCHEMA_REPAIR_FAILED',
      message: `No se pudo reparar ítems inválidos: ${openaiResult.error.slice(0, 80)}`,
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  let parsed: unknown;
  try {
    let clean = openaiResult.rawContent.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    parsed = JSON.parse(clean);
  } catch {
    warnings.push({
      code: 'ITEM_SCHEMA_REPAIR_FAILED',
      message: 'Error al parsear la evaluación tras reparar ítems inválidos.',
      severity: 'warning'
    });
    return { spec: null, warnings };
  }

  const { spec, warnings: validationWarnings } = validateAndNormalizeSpec(parsed, requestedVersions);
  if (!spec) {
    warnings.push({
      code: 'ITEM_SCHEMA_REPAIR_FAILED',
      message: 'La evaluación tras reparar ítems no pasó validación.',
      severity: 'warning'
    });
    return { spec: null, warnings };
  }
  warnings.push(...validationWarnings);
  const after = validateSpecItems(spec);
  if (after.invalid.length > 0) {
    warnings.push({
      code: 'ITEM_SCHEMA_REPAIR_FAILED',
      message: `Tras la reparación siguen ${after.invalid.length} ítem(s) inválidos; se aplicará degradación.`,
      severity: 'warning'
    });
    return { spec: null, warnings };
  }
  warnings.push({
    code: 'ITEM_SCHEMA_REPAIRED',
    message: `Se corrigieron ${invalidItems.length} ítem(s) (ordenamiento, relación, opciones o fragmento de fuente).`,
    severity: 'info'
  });
  timer.log('[ITEM_VALIDITY_REPAIR] success');
  return { spec, warnings };
}

function toTextArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const e of input) {
    if (typeof e === 'string' && e.trim().length > 0) out.push(e.trim());
    else if (e && typeof e === 'object') {
      const text = typeof (e as Record<string, unknown>).text === 'string' ? (e as Record<string, unknown>).text as string : '';
      if (text.trim().length > 0) out.push(text.trim());
    }
  }
  return out;
}

function expandDeterministicTerms(baseKeywords: string[], subject?: string): string[] {
  const seed = [
    ...(baseKeywords || []),
    ...(subject ? tokenizeKeywords(subject, 8) : []),
    'contexto', 'proceso', 'actor', 'medida', 'impacto', 'evidencia'
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of seed) {
    const clean = (t || '').trim().toLowerCase();
    if (!clean || clean.length < 4 || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 8) break;
  }
  return out.length > 0 ? out : ['concepto', 'contexto', 'evidencia', 'impacto'];
}

function buildDeterministicTable(terms: string[]): { columns: Array<{ id: string; header: string }>; rows: string[][] } {
  const colA = terms[0] ? `Concepto (${terms[0]})` : 'Concepto';
  const colB = terms[1] ? `Evidencia / ejemplo (${terms[1]})` : 'Evidencia / ejemplo';
  const colC = 'Explicación breve';
  const columns = [
    { id: 'col-1', header: colA },
    { id: 'col-2', header: colB },
    { id: 'col-3', header: colC }
  ];
  const rows = [
    [terms[0] || 'Concepto 1', '', ''],
    [terms[1] || 'Concepto 2', '', ''],
    [terms[2] || 'Concepto 3', '', ''],
    ['', '', '']
  ];
  return { columns, rows };
}

function buildDeterministicPairs(terms: string[]): { left: string[]; right: string[] } {
  const left = [
    terms[0] ? `Concepto: ${terms[0]}` : 'Concepto: base',
    terms[1] ? `Proceso: ${terms[1]}` : 'Proceso: desarrollo',
    terms[2] ? `Actor/medida: ${terms[2]}` : 'Actor/medida: referencia'
  ];
  const right = [
    terms[3] ? `Impacto: ${terms[3]}` : 'Impacto: consecuencia observada',
    terms[4] ? `Evidencia: ${terms[4]}` : 'Evidencia: dato del texto',
    terms[5] ? `Contexto: ${terms[5]}` : 'Contexto: marco temporal/social'
  ];
  return { left, right };
}

function buildDeterministicOrdering(terms: string[]): string[] {
  const t1 = terms[0] || 'contexto inicial';
  const t2 = terms[1] || 'medidas iniciales';
  const t3 = terms[2] || 'consolidación del proceso';
  const t4 = terms[3] || 'impactos posteriores';
  return [
    `Contexto previo y surgimiento de ${t1}`,
    `Implementación temprana de ${t2}`,
    `Desarrollo y consolidación de ${t3}`,
    `Resultados e impactos de ${t4}`
  ];
}

function buildFallbackSourcePassage(terms: string[], subject?: string): string {
  const topic = subject || 'la temática trabajada';
  const a = terms[0] || 'contexto';
  const b = terms[1] || 'proceso';
  const c = terms[2] || 'evidencia';
  return [
    `En ${topic}, el texto presenta un ${a} que permite comprender cómo se organiza el ${b} en un marco histórico y social concreto. Se describen actores, decisiones y condiciones que explican por qué ciertos cambios ocurren en este momento y no en otro.`,
    `A partir de esa descripción, aparecen ejemplos y datos que funcionan como ${c}: permiten comparar posturas, identificar relaciones causa-consecuencia y distinguir entre hechos y opiniones. El fragmento aporta información suficiente para sostener un análisis con argumentos, sin adelantar una conclusión única.`
  ].join('\n\n');
}

function hasGenericMcOptions(options: Array<{ text?: string }>): boolean {
  const generic = /^(opci[oó]n|option)\s*[a-d1-4]$/i;
  if (options.length === 0) return true;
  const texts = options.map((o) => (o.text || '').trim()).filter(Boolean);
  if (texts.length < 3) return true;
  const genericCount = texts.filter((t) => generic.test(t)).length;
  return genericCount >= Math.min(3, texts.length);
}

function buildDeterministicMcOptions(terms: string[], subject?: string): Array<{ id: string; text: string; isCorrect?: boolean }> {
  const topic = subject || 'la temática';
  const t0 = terms[0] || 'concepto central';
  const t1 = terms[1] || 'evidencia textual';
  const t2 = terms[2] || 'contexto histórico';
  const t3 = terms[3] || 'impacto social';
  const nearMiss = terms[4] || t2;
  return [
    { id: 'opt-a', text: `Identifica y relaciona ${t0} con ${t1} dentro de ${topic}.`, isCorrect: true },
    { id: 'opt-b', text: `Confunde ${t0} con ${nearMiss} y presenta esa relación como si fueran equivalentes.` },
    { id: 'opt-c', text: `Enumera datos aislados sin justificar con ${t1}.` },
    { id: 'opt-d', text: `Se enfoca en ${t3} pero omite el proceso principal.` }
  ];
}

function containsFragmentReference(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return [
    'según el fragmento',
    'segun el fragmento',
    'fragmento anterior',
    'texto proporcionado',
    'fuente proporcionada',
    'a partir del fragmento',
    'del texto anterior',
    'de la fuente anterior'
  ].some((marker) => p.includes(marker));
}

function fixPromptFragmentReference(prompt: string): string {
  const replaced = prompt
    .replace(/seg[uú]n\s+el\s+fragmento\s+anterior/gi, 'según la temática trabajada')
    .replace(/seg[uú]n\s+el\s+fragmento/gi, 'según la temática trabajada')
    .replace(/a\s+partir\s+del\s+fragmento/gi, 'a partir del tema trabajado')
    .replace(/texto\s+proporcionado/gi, 'tema trabajado')
    .replace(/fuente\s+proporcionada/gi, 'tema trabajado')
    .replace(/del\s+texto\s+anterior/gi, 'del tema trabajado')
    .replace(/de\s+la\s+fuente\s+anterior/gi, 'del tema trabajado');
  return replaced.replace(/\s+/g, ' ').trim();
}

function hasHighQualityExcerptContent(content: string): boolean {
  const excerpt = (content || '').trim();
  if (excerpt.length < MIN_EXCERPT_LENGTH_CHARS) return false;
  const quality = filterPassageByQuality(excerpt, { isFromStartOfDocument: false });
  if (!quality.keep) return false;
  if (looksLikeTOC(excerpt) || looksLikeMetadata(excerpt)) return false;
  return true;
}

function enforceFinalItemInvariants(
  spec: EvaluationSpecV2,
  warnings: WarningV2[],
  subject?: string
): void {
  let fixedCount = 0;
  for (const section of spec.sections || []) {
    const sectionHasHighQualitySource = (section.items || []).some(
      (i) => hasHighQualityExcerptContent((i.source?.content || '').trim())
    );
    for (const item of section.items || []) {
      if (item.type === 'multiple_choice') {
        const options = Array.isArray(item.options) ? item.options : [];
        const validOptions = options.filter((o) => typeof o?.text === 'string' && o.text.trim().length > 0);
        if (validOptions.length < 3 || hasGenericMcOptions(validOptions)) {
          item.options = buildDeterministicMcOptions(expandDeterministicTerms([subject || 'tema'], subject), subject).map((opt, idx) => ({
            ...opt,
            id: `${item.id}-opt-${idx + 1}`
          }));
          fixedCount += 1;
        } else if (!validOptions.some((o) => o.isCorrect === true)) {
          validOptions[0].isCorrect = true;
          item.options = validOptions;
          fixedCount += 1;
        }
      }

      if (item.type === 'source_analysis') {
        const excerpt = (item.source?.content || '').trim();
        if (!hasHighQualityExcerptContent(excerpt)) {
          item.type = 'short_answer';
          item.prompt = fixPromptFragmentReference((item.prompt || '').trim() || `Explique una idea clave de ${subject || 'la temática trabajada'}.`);
          (item as Record<string, unknown>).source = undefined;
          fixedCount += 1;
        }
      }

      const prompt = (item.prompt || '').trim();
      if (prompt && containsFragmentReference(prompt)) {
        const hasOwnSource = hasHighQualityExcerptContent((item.source?.content || '').trim());
        if (!hasOwnSource && !sectionHasHighQualitySource) {
          item.prompt = fixPromptFragmentReference(prompt);
          fixedCount += 1;
        }
      }
    }
  }
  if (fixedCount > 0) {
    warnings.push({
      code: 'ITEM_INVARIANT_FIXED',
      message: `Se aplicaron ${fixedCount} correcciones deterministas para cumplir invariantes de calidad de ítems.`,
      severity: 'info'
    });
  }
}

function ensureComprehensionBundleDeterministically(
  spec: EvaluationSpecV2,
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  baseKeywords: string[],
  subject: string | undefined,
  warnings: WarningV2[]
): void {
  if (hasSectionWithComprehensionBundle(spec)) return;
  const terms = expandDeterministicTerms(baseKeywords, subject);
  const materialsWithText = (materials || []).filter((m) => (m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS);
  if (!materialsWithText.length) return;
  const excerpt = selectDeterministicSourcePassage(materialsWithText, `comprensión de ${subject || 'la temática'}`, terms, subject);
  const targetSection = spec.sections?.[0];
  if (!targetSection) return;
  if (hasHighQualityExcerptContent(excerpt)) {
    const existingIds = new Set((targetSection.items || []).map((i) => i.id));
    const sourceId = nextFillerItemId(existingIds, 'cmp-source-', 1);
    targetSection.items = targetSection.items || [];
    targetSection.items.push({
      id: sourceId,
      type: 'source_analysis',
      prompt: `Analice el fragmento y explique dos ideas centrales vinculadas con ${subject || 'la temática trabajada'}.`,
      points: 3,
      source: { type: 'text', content: excerpt, caption: materialsWithText[0]?.title || 'Fragmento de referencia' }
    } as EvaluationItemV2);
    for (let i = 0; i < 4; i++) {
      const id = nextFillerItemId(existingIds, 'cmp-mc-', i + 1);
      const mcTerms = expandDeterministicTerms([terms[i % Math.max(1, terms.length)] || subject || 'tema'], subject);
      targetSection.items.push({
        id,
        type: 'multiple_choice',
        prompt: 'A partir del fragmento adjunto, seleccione la opción más adecuada.',
        points: 1,
        options: buildDeterministicMcOptions(mcTerms, subject).map((opt, idx) => ({ ...opt, id: `${id}-opt-${idx + 1}` })),
        source: { type: 'text', content: excerpt, caption: materialsWithText[0]?.title || 'Fragmento de referencia' }
      } as EvaluationItemV2);
    }
    const shortId = nextFillerItemId(existingIds, 'cmp-sa-', 1);
    targetSection.items.push({
      id: shortId,
      type: 'short_answer',
      prompt: 'Cite o parafrasee una evidencia del fragmento para justificar su respuesta.',
      points: 2,
      source: { type: 'text', content: excerpt, caption: materialsWithText[0]?.title || 'Fragmento de referencia' },
      rubric: buildFallbackRubric('Cite o parafrasee una evidencia del fragmento para justificar su respuesta.', 2)
    } as EvaluationItemV2);
    warnings.push({
      code: 'COMPREHENSION_BUNDLE_ADDED',
      message: 'Se añadió un bloque de comprensión lectora determinista con excerpt de calidad.',
      severity: 'info'
    });
    return;
  }

  // No usable excerpt -> fallback to open-ended grounded items without excerpt dependency.
  targetSection.items = targetSection.items || [];
  const existingIds = new Set(targetSection.items.map((i) => i.id));
  const openPrompt = `Explique un aspecto clave de ${subject || 'la temática trabajada'} utilizando vocabulario disciplinar pertinente.`;
  targetSection.items.push({
    id: nextFillerItemId(existingIds, 'cmp-open-', 1),
    type: 'paragraph',
    prompt: openPrompt,
    points: 3,
    rubric: buildFallbackRubric(openPrompt, 3)
  } as EvaluationItemV2);
  targetSection.items.push({
    id: nextFillerItemId(existingIds, 'cmp-open-', 2),
    type: 'short_answer',
    prompt: `Mencione una evidencia o ejemplo concreto relacionado con ${subject || 'la temática trabajada'}.`,
    points: 2,
    rubric: buildFallbackRubric(`Mencione una evidencia o ejemplo concreto relacionado con ${subject || 'la temática trabajada'}.`, 2)
  } as EvaluationItemV2);
  warnings.push({
    code: 'COMPREHENSION_BUNDLE_FALLBACK_OPEN_ITEMS',
    message: 'No se encontró excerpt de calidad para comprensión; se usaron ítems abiertos coherentes sin dependencia de fragmento.',
    severity: 'warning'
  });
}

function selectDeterministicSourcePassage(
  materialsWithText: Array<{ extractedText?: string }>,
  prompt: string,
  terms: string[],
  subject?: string
): string {
  for (const m of materialsWithText) {
    const result = cleanAndSelectExcerpt((m.extractedText || '').trim(), prompt || terms.join(' '));
    const excerpt = (result.excerpt || '').trim();
    const quality = filterPassageByQuality(excerpt, { isFromStartOfDocument: false });
    if (
      excerpt.length >= MIN_EXCERPT_LENGTH_CHARS &&
      quality.keep &&
      !looksLikeTOC(excerpt) &&
      !looksLikeMetadata(excerpt) &&
      !isAnswerLeakingExcerpt(excerpt)
    ) {
      return excerpt;
    }
  }
  return '';
}

/**
 * Deterministic post-processor: fills missing render-critical item data without extra LLM calls.
 * Keeps IDs stable and emits one info warning per item type applied.
 */
export function fillMissingItemDataDeterministically(
  spec: EvaluationSpecV2,
  materials: Array<{ title?: string; focusText?: string; extractedText?: string }>,
  baseKeywords: string[],
  subject: string | undefined,
  warnings: WarningV2[]
): void {
  const materialsWithText = (materials || []).filter((m) => (m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS);
  const terms = expandDeterministicTerms(baseKeywords, subject);
  let filledSource = 0;
  let filledTable = 0;
  let filledMatching = 0;
  let filledOrdering = 0;
  let filledMultipleChoice = 0;
  let fixedFragmentReference = 0;

  for (const section of spec.sections || []) {
    let sectionHasRenderableSource = false;
    for (const item of section.items || []) {
      if ((item.source?.content || '').trim().length >= 40) {
        sectionHasRenderableSource = true;
      }
      // Normalize legacy aliases before validation/rendering.
      const itemAny = item as Record<string, unknown>;
      if (!item.itemsToOrder && Array.isArray(itemAny.orderingItems)) item.itemsToOrder = itemAny.orderingItems as EvaluationItemV2['itemsToOrder'];
      if (!item.itemsToOrder && Array.isArray(itemAny.sequence)) item.itemsToOrder = itemAny.sequence as EvaluationItemV2['itemsToOrder'];
      if (!item.leftColumn && Array.isArray(itemAny.leftItems)) item.leftColumn = itemAny.leftItems as EvaluationItemV2['leftColumn'];
      if (!item.rightColumn && Array.isArray(itemAny.rightItems)) item.rightColumn = itemAny.rightItems as EvaluationItemV2['rightColumn'];
      if (!item.table && itemAny.tableData && typeof itemAny.tableData === 'object') item.table = itemAny.tableData as EvaluationItemV2['table'];
      if (!item.table && (Array.isArray(itemAny.headers) || Array.isArray(itemAny.columns) || Array.isArray(itemAny.rows))) {
        const headers = (Array.isArray(itemAny.headers) ? itemAny.headers : itemAny.columns) as unknown[] | undefined;
        const rows = (Array.isArray(itemAny.rows) ? itemAny.rows : []) as unknown[];
        item.table = {
          columns: (headers || []).map((h, i) => ({
            id: `col-${item.id}-${i + 1}`,
            header: typeof h === 'string' ? h : String((h as Record<string, unknown>)?.header || (h as Record<string, unknown>)?.text || `Columna ${i + 1}`)
          })),
          rows: rows.map((r) => Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c : String(c ?? ''))) : [])
        };
      }

      if (item.type === 'source_analysis') {
        const current = (item.source?.content || '').trim();
        const currentQuality = filterPassageByQuality(current, { isFromStartOfDocument: false });
        const currentIsUsable = current.length >= MIN_EXCERPT_LENGTH_CHARS && currentQuality.keep && !looksLikeTOC(current) && !looksLikeMetadata(current);
        if (!currentIsUsable) {
          const prompt = (item.prompt || '').trim();
          const chosen = selectDeterministicSourcePassage(materialsWithText, prompt, terms, subject);
          if (chosen.length >= MIN_EXCERPT_LENGTH_CHARS) {
            if (!item.source) item.source = { type: 'text' };
            item.source.type = item.source.type || 'text';
            item.source.content = chosen;
            item.source.caption = item.source.caption || 'Fragmento para análisis';
            filledSource += 1;
            sectionHasRenderableSource = true;
          } else {
            item.type = 'short_answer';
            item.prompt = fixPromptFragmentReference(prompt || `Explique un aspecto relevante de ${subject || 'la temática trabajada'}.`);
            (item as Record<string, unknown>).source = undefined;
            warnings.push({
              code: 'SOURCE_EXCERPT_LOW_QUALITY_DEGRADED',
              message: `Ítem ${item.id || 'sin-id'} degradado a short_answer por falta de excerpt de calidad.`,
              severity: 'warning'
            });
          }
        } else {
          sectionHasRenderableSource = true;
        }
      }

      if (item.type === 'table_completion') {
        const cols = item.table?.columns || [];
        const rows = item.table?.rows || [];
        const hasValid = cols.length >= 2 && rows.length >= 1;
        if (!hasValid) {
          item.table = buildDeterministicTable(terms);
          if (!item.prompt || item.prompt.trim().length < 12) {
            item.prompt = `Completá la tabla utilizando información de ${subject || 'la temática trabajada'}.`;
          }
          filledTable += 1;
        }
      }

      if (item.type === 'matching') {
        const left = toTextArray(item.leftColumn);
        const right = toTextArray(item.rightColumn);
        if (left.length < 2 || right.length < 2) {
          const pairs = buildDeterministicPairs(terms);
          item.leftColumn = pairs.left.map((text, i) => ({ id: `l-${item.id}-${i + 1}`, text }));
          item.rightColumn = pairs.right.map((text, i) => ({ id: `r-${item.id}-${i + 1}`, text }));
          if (!item.prompt || item.prompt.trim().length < 12) {
            item.prompt = `Relacioná cada concepto con su impacto o evidencia en ${subject || 'el tema trabajado'}.`;
          }
          filledMatching += 1;
        }
      }

      if (item.type === 'ordering') {
        const values = toTextArray(item.itemsToOrder);
        if (values.length < 3) {
          const sequence = buildDeterministicOrdering(terms);
          item.itemsToOrder = sequence.map((text, i) => ({ id: `o-${item.id}-${i + 1}`, text }));
          if (!item.prompt || item.prompt.trim().length < 12) {
            item.prompt = `Ordená cronológicamente los eventos o etapas vinculadas con ${subject || 'la temática trabajada'}.`;
          }
          filledOrdering += 1;
        }
      }

      if (item.type === 'multiple_choice') {
        const options = Array.isArray(item.options) ? item.options : [];
        const validOptions = options.filter((o) => typeof o?.text === 'string' && o.text.trim().length > 0);
        if (validOptions.length < 3 || hasGenericMcOptions(validOptions)) {
          item.options = buildDeterministicMcOptions(terms, subject).map((opt, idx) => ({ ...opt, id: `${item.id}-opt-${idx + 1}` }));
          filledMultipleChoice += 1;
        } else if (!validOptions.some((o) => o.isCorrect === true)) {
          validOptions[0].isCorrect = true;
          item.options = validOptions;
        } else {
          item.options = validOptions;
        }
      }

      const promptText = (item.prompt || '').trim();
      if (promptText && containsFragmentReference(promptText)) {
        const hasOwnSource = (item.source?.content || '').trim().length >= 40;
        if (!hasOwnSource && !sectionHasRenderableSource) {
          if (item.type === 'source_analysis') {
            const chosen = selectDeterministicSourcePassage(materialsWithText, promptText, terms, subject);
            if (chosen.length >= MIN_EXCERPT_LENGTH_CHARS) {
              if (!item.source) item.source = { type: 'text' };
              item.source.type = item.source.type || 'text';
              item.source.content = chosen;
              item.source.caption = item.source.caption || 'Fragmento para análisis';
              sectionHasRenderableSource = true;
              filledSource += 1;
              fixedFragmentReference += 1;
            } else {
              item.type = 'short_answer';
              item.prompt = fixPromptFragmentReference(promptText);
              (item as Record<string, unknown>).source = undefined;
              warnings.push({
                code: 'SOURCE_EXCERPT_LOW_QUALITY_DEGRADED',
                message: `Ítem ${item.id || 'sin-id'} degradado por referencia a fragmento sin excerpt de calidad.`,
                severity: 'warning'
              });
              fixedFragmentReference += 1;
            }
          } else {
            item.prompt = fixPromptFragmentReference(promptText);
            fixedFragmentReference += 1;
          }
        }
      }
    }
  }

  if (filledSource > 0) {
    warnings.push({ code: 'SOURCE_FILLED', message: `Se completó source.content de ${filledSource} ítem(s) source_analysis con selección determinista.`, severity: 'info' });
  }
  if (filledTable > 0) {
    warnings.push({ code: 'ITEM_DATA_FILLED_TABLE', message: `Se completó estructura de tabla en ${filledTable} ítem(s) table_completion.`, severity: 'info' });
  }
  if (filledMatching > 0) {
    warnings.push({ code: 'MATCHING_FILLED', message: `Se completaron columnas de relación en ${filledMatching} ítem(s) matching.`, severity: 'info' });
  }
  if (filledOrdering > 0) {
    warnings.push({ code: 'ORDERING_FILLED', message: `Se completó secuencia en ${filledOrdering} ítem(s) ordering.`, severity: 'info' });
  }
  if (filledMultipleChoice > 0) {
    warnings.push({ code: 'MC_OPTIONS_FILLED', message: `Se completaron opciones coherentes en ${filledMultipleChoice} ítem(s) multiple_choice.`, severity: 'info' });
  }
  if (fixedFragmentReference > 0) {
    warnings.push({ code: 'PROMPT_FRAGMENT_REFERENCE_FIXED', message: `Se corrigieron ${fixedFragmentReference} referencia(s) a fragmento sin fuente visible.`, severity: 'info' });
  }
}

/**
 * Deterministic validator: when usable passages were sent, at least one section must contain
 * a "comprehension bundle": 1 source_analysis with excerpt + 4–6 MC + 1 short_answer.
 * Used for smoke tests and optional quality checks (no LLM).
 */
export function hasSectionWithComprehensionBundle(spec: EvaluationSpecV2): boolean {
  if (!spec.sections?.length) return false;
  for (const section of spec.sections) {
    const items = section.items || [];
    const sourceAnalysis = items.filter((i) => i.type === 'source_analysis' && (i.source?.content || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS);
    const mcCount = items.filter((i) => i.type === 'multiple_choice').length;
    const shortAnswer = items.filter((i) => i.type === 'short_answer').length;
    if (sourceAnalysis.length >= 1 && mcCount >= 4 && mcCount <= 10 && shortAnswer >= 1) return true;
  }
  return false;
}

/**
 * Degrade invalid items deterministically: ordering -> short_answer, matching -> paragraph.
 * Keeps item IDs; preserves prompt/points; adds rubric for open-ended. Mutates spec.
 */
function degradeInvalidItems(
  spec: EvaluationSpecV2,
  invalidItems: InvalidItem[],
  warnings: WarningV2[],
  buildRubric: (prompt: string, points: number) => ItemRubricV2
): void {
  const byKey = new Map(invalidItems.map((i) => [`${i.sectionId}:${i.itemId}`, i]));
  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      const key = `${section.id}:${item.id}`;
      const inv = byKey.get(key);
      if (!inv) continue;
      const newType = getDegradationType(inv.type);
      const prompt = (item.prompt || '').trim();
      const points = typeof item.points === 'number' ? item.points : 2;
      (item as EvaluationItemV2).type = newType as EvaluationItemV2['type'];
      if (inv.type === 'ordering') {
        (item as Record<string, unknown>).itemsToOrder = undefined;
        if (!item.prompt || item.prompt.length < 20) {
          (item as EvaluationItemV2).prompt = `Explique el orden o la secuencia cronológica correcta según lo estudiado. ${prompt || 'Describa los pasos o eventos en orden.'}`;
        }
      }
      if (inv.type === 'matching') {
        (item as Record<string, unknown>).leftColumn = undefined;
        (item as Record<string, unknown>).rightColumn = undefined;
        if (!item.prompt || item.prompt.length < 20) {
          (item as EvaluationItemV2).prompt = `Relacione los conceptos o términos con sus correspondencias y explique la relación en sus propias palabras. ${prompt || ''}`.trim();
        }
      }
      if (inv.type === 'source_analysis') {
        (item as Record<string, unknown>).source = undefined;
      }
      if (inv.type === 'multiple_choice') {
        (item as Record<string, unknown>).options = undefined;
      }
      if (newType === 'short_answer' || newType === 'paragraph') {
        if (!(item as EvaluationItemV2).rubric) {
          (item as EvaluationItemV2).rubric = buildRubric((item as EvaluationItemV2).prompt, points);
        }
      }
    }
  }
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
  
  // Generate request ID and start timer
  const requestId = generateRequestId();
  const timer = new Timer(requestId);
  const metrics = { llmCallCount: 0 };

  // Behavior path: default = NEW (production). Header x-aulaplus-env: legacy = LEGACY (rollback only; frontend must NOT send this).
  const envHeader = req.headers.get('x-aulaplus-env')?.toLowerCase?.()?.trim?.() ?? '';
  const useLegacyPath = (envHeader === 'legacy');
  const currentBuildMarker = useLegacyPath ? `${BUILD_ID}-legacy` : `${BUILD_ID}-new`;
  timer.log(`[BEHAVIOR] path=${useLegacyPath ? 'legacy' : 'new'} (x-aulaplus-env=${envHeader || 'absent'})`);
  console.log(`[BEHAVIOR] useLegacyPath=${useLegacyPath} x-aulaplus-env=${envHeader || 'absent'} buildMarker=${currentBuildMarker}`);
  
  try {
    timer.log('Request received, parsing body');
    const requestBody = await req.json();
    
    // PING MODE: Lightweight probe (gateway already validated JWT when verify_jwt=true). No OpenAI calls.
    if (requestBody && typeof requestBody === 'object' && requestBody.__ping === true) {
      const build = String(currentBuildMarker);
      const pingResponse = {
        success: true,
        pong: true,
        debug: {
          build,
          mode: useLegacyPath ? 'legacy' : 'new',
          now: new Date().toISOString()
        }
      };
      return new Response(JSON.stringify(pingResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'x-aulaplus-build-probe': build
        }
      });
    }
    
    if (!openAIApiKey) {
      console.error('[V2_ERROR] OpenAI API key not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'OpenAI API key not configured',
        warnings: [{ code: 'CONFIG_ERROR', message: 'El servicio no está configurado correctamente', severity: 'error' }]
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
    const targetDurationMinutesRaw = (designPlan as Record<string, unknown>)?.targetDurationMinutes;
    const targetDurationMinutes = typeof targetDurationMinutesRaw === 'number' && targetDurationMinutesRaw > 0
      ? Math.round(targetDurationMinutesRaw)
      : null;
    const materialsForExcerpt = Array.isArray((designPlan as Record<string, unknown>)?.materials)
      ? ((designPlan as Record<string, unknown>).materials as Array<{ title?: string; focusText?: string; extractedText?: string }>)
      : [];

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
      requestedVersions,
      targetDurationMinutes
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
    const selectionStartMs = Date.now();
    let selectionMs = 0;
    let materialsPromptPath: 'bundle' | 'legacy' = 'legacy';
    let materialsPromptStats: {
      materialsIndexCount: number;
      passagesSelectedCount: number;
      materialsCharsSent: number;
      passagesRejectedCount?: Record<PassageRejectReason, number>;
      topKeywordsUsedForSelection: string[];
      keptBlocksCount: number;
      usableBlocksCount: number;
      finalK: number;
      finalChars: number;
      bundleShortfallReason?: string;
    } = {
      materialsIndexCount: 0,
      passagesSelectedCount: 0,
      materialsCharsSent: 0,
      topKeywordsUsedForSelection: [],
      keptBlocksCount: 0,
      usableBlocksCount: 0,
      finalK: 0,
      finalChars: 0,
      bundleShortfallReason: undefined,
    };
    if (materialsForExcerpt.length > 0) {
      const withUsableText = materialsForExcerpt.filter(
        (m) => ((m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS)
      ).length;
      timer.log(`[PROMPT] materials: ${materialsForExcerpt.length} total, ${withUsableText} with extractedText >= ${MIN_EXCERPT_LENGTH_CHARS} chars`);
      const selectionContext = [
        modification || '',
        groupContext?.subject || '',
        ...(Array.isArray(groupContext?.content) ? groupContext.content : []),
        ...(Array.isArray(groupContext?.competencies) ? groupContext.competencies : []),
        ...(Array.isArray(groupContext?.criteriosLogro) ? groupContext.criteriosLogro : []),
        instrumentDesignRules.join(' ')
      ].join('\n');
      const materialsBundle = buildMaterialsPromptBundle(materialsForExcerpt, selectionContext);
      if (materialsBundle.promptSection) {
        userPrompt += materialsBundle.promptSection;
        materialsPromptPath = 'bundle';
      }
      materialsPromptStats = {
        materialsIndexCount: materialsBundle.materialsIndexCount,
        passagesSelectedCount: materialsBundle.passagesSelectedCount,
        materialsCharsSent: materialsBundle.materialsCharsSent,
        passagesRejectedCount: materialsBundle.passagesRejectedCount,
        topKeywordsUsedForSelection: materialsBundle.topKeywordsUsedForSelection,
        keptBlocksCount: materialsBundle.keptBlocksCount ?? 0,
        usableBlocksCount: materialsBundle.usableBlocksCount ?? 0,
        finalK: materialsBundle.finalK ?? 0,
        finalChars: materialsBundle.finalChars ?? 0,
        bundleShortfallReason: materialsBundle.bundleShortfallReason,
      };
      timer.log(`[PROMPT] materialsPromptPath=${materialsPromptPath} index=${materialsPromptStats.materialsIndexCount} passages=${materialsPromptStats.passagesSelectedCount} chars=${materialsPromptStats.materialsCharsSent} usableBlocks=${materialsPromptStats.usableBlocksCount} keptBlocks=${materialsPromptStats.keptBlocksCount} finalK=${materialsPromptStats.finalK} finalChars=${materialsPromptStats.finalChars} shortfall=${materialsPromptStats.bundleShortfallReason || 'none'} rejected=${JSON.stringify(materialsPromptStats.passagesRejectedCount || {})}`);
    }
    selectionMs = Date.now() - selectionStartMs;

    timer.mark('prompts_built');
    timer.log(`Prompts built: system=${systemPrompt.length}chars, user=${userPrompt.length}chars`);
    if (!USE_LLM_REPAIRS) timer.log('[QUALITY_BY_CONSTRUCTION] USE_LLM_REPAIRS=false; only one OpenAI call + deterministic safeguards');
    
    // Generate evaluation (pass isAdjustMode for timeout tuning)
    const result = await generateEvaluationV2(
      systemPrompt,
      userPrompt,
      requestedVersions,
      requestId,
      timer,
      isAdjustMode  // Use shorter timeout for adjust mode
    );
    metrics.llmCallCount += 1;
    timer.mark('generation_complete');
    
    // Build response
    if (result.spec) {
      const postProcessStartMs = Date.now();
      let nonEssentialDebugSkipped = false;
      let excerptStatsForDebug: ExcerptDebugStat[] = [];
      let invalidItemCountsForDebug: Record<string, number> = {};
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
      let estimatedMinutes = estimateDurationFromSpec(result.spec);
      if (!result.spec.meta.duration) result.spec.meta.duration = { minutes: 90 };
      result.spec.meta.duration.minutes = estimatedMinutes;
      if (targetDurationMinutes !== null) {
        result.spec.meta.duration.targetMinutes = targetDurationMinutes;
      }
      timer.log(`[DURATION] target=${targetDurationMinutes ?? 'none'} estimated=${estimatedMinutes}`);
      console.log(`[DURATION] target=${targetDurationMinutes ?? 'none'} estimated=${estimatedMinutes}`);

      // NEW behavior (default): excerpt validation, delta filler, deterministic fill. Auto-extend/trim only when USE_DURATION_AUTO_EXTEND=true (reduces llmCallCount to 1).
      if (!useLegacyPath) {
      if (USE_DURATION_AUTO_EXTEND && targetDurationMinutes !== null && estimatedMinutes < targetDurationMinutes * 0.95) {
        const low = Math.round(targetDurationMinutes * 0.95);
        const deltaMinutesNeeded = computeDeltaMinutesNeeded(estimatedMinutes, low);
        timer.log(`[DURATION_AUTO_EXTEND_LOOP] initial estimate=${estimatedMinutes} target=${targetDurationMinutes} low=${low} deltaMinutesNeeded=${deltaMinutesNeeded}`);
        console.log(`[DURATION_AUTO_EXTEND_LOOP] initial estimate=${estimatedMinutes} target=${targetDurationMinutes} deltaMinutesNeeded=${deltaMinutesNeeded}`);
        if (deltaMinutesNeeded > 8) {
          timer.log(`[DURATION_AUTO_EXTEND_LOOP] using 3 attempts (deltaMinutesNeeded=${deltaMinutesNeeded} > 8)`);
          console.log(`[DURATION_AUTO_EXTEND_LOOP] using 3 attempts (deltaMinutesNeeded=${deltaMinutesNeeded} > 8)`);
        }

        let bestSpec = result.spec;
        let bestEstimate = estimatedMinutes;
        let previousAttemptDidNotIncreaseHeuristic = false;
        const maxExtendAttempts = deltaMinutesNeeded > 8 ? 3 : 2;
        const MIN_MEANINGFUL_INCREASE = 1; // newEst must be > oldEst + MIN_MEANINGFUL_INCREASE to count

        for (let extendAttempt = 1; extendAttempt <= maxExtendAttempts; extendAttempt++) {
          timer.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} start current_estimated=${bestEstimate} target=${targetDurationMinutes}`);
          console.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} start current_estimated=${bestEstimate} target=${targetDurationMinutes}`);
          const extended = await runDurationAutoExtend(
            bestSpec,
            targetDurationMinutes,
            requestedVersions,
            requestId,
            timer,
            bestEstimate,
            extendAttempt >= 2 && previousAttemptDidNotIncreaseHeuristic ? true : undefined
          );
          metrics.llmCallCount += 1;
          result.warnings.push(...extended.warnings);
          if (!extended.spec) {
            timer.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} returned no spec`);
            console.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} returned no spec`);
            continue;
          }

          const newEst = estimateDurationFromSpec(extended.spec);
          timer.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} oldEst=${bestEstimate} -> newEst=${newEst}`);
          console.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} oldEst=${bestEstimate} -> newEst=${newEst}`);
          const increasedMeaningfully = newEst > bestEstimate + MIN_MEANINGFUL_INCREASE;
          if (!increasedMeaningfully) {
            previousAttemptDidNotIncreaseHeuristic = true;
            timer.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} rejected: heuristic estimate did not increase meaningfully`);
            console.log(`[DURATION_AUTO_EXTEND_LOOP] attempt ${extendAttempt}/${maxExtendAttempts} rejected: heuristic estimate did not increase meaningfully`);
          }
          if (newEst > bestEstimate) {
            bestSpec = extended.spec;
            bestEstimate = newEst;
          }
          if (newEst >= targetDurationMinutes * 0.95) {
            timer.log(`[DURATION_AUTO_EXTEND_LOOP] stopping early: reached >=95% target with estimate=${newEst}`);
            console.log(`[DURATION_AUTO_EXTEND_LOOP] stopping early: reached >=95% target with estimate=${newEst}`);
            break;
          }
        }

        result.spec = bestSpec;
        estimatedMinutes = bestEstimate;
        if (!result.spec.meta.duration) result.spec.meta.duration = { minutes: 90 };
        result.spec.meta.duration.minutes = estimatedMinutes;
        if (targetDurationMinutes !== null) {
          result.spec.meta.duration.targetMinutes = targetDurationMinutes;
        }

        if (estimatedMinutes < targetDurationMinutes * 0.95) {
          result.warnings.push({
            code: 'DURATION_EXTEND_FAILED',
            message: `Tras los intentos de extensión, la duración estimada final (${estimatedMinutes} min) no alcanzó al menos el 95% del objetivo (${targetDurationMinutes} min).`,
            severity: 'warning'
          });
        } else {
          timer.log(`[DURATION] auto-extend accepted best_estimated=${estimatedMinutes}`);
          console.log(`[DURATION] auto-extend accepted best_estimated=${estimatedMinutes}`);
        }
      }

      // Excerpt validation (after generation and after auto-extend): source_analysis items must have source.content >= MIN_EXCERPT_LENGTH_CHARS.
      const excerptValidation = validateExcerpts(result.spec);
      if (!excerptValidation.valid) {
        timer.log(`[EXCERPT_VALIDATION] failures: ${excerptValidation.failures.map(f => f.itemId + '(' + f.itemType + ')').join(', ')}`);
        console.log(`[EXCERPT_VALIDATION] failures:`, excerptValidation.failures.map((f) => ({ itemId: f.itemId, itemType: f.itemType, sectionId: f.sectionId })));
        const materialsWithUsableText = materialsForExcerpt.filter(
          (m) => ((m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS)
        ).length;
        if (materialsForExcerpt.length > 0 && materialsWithUsableText === 0) {
          result.warnings.push({
            code: 'SOURCE_EXCERPT_MISSING',
            message: 'Los materiales no incluyen texto extraído suficiente (mín. 200 caracteres); los ítems source_analysis pueden quedar sin fragmento.',
            severity: 'warning'
          });
          console.log('[EXCERPT] materials provided but no usable extractedText (>=200 chars); excerpts may be missing');
        }
        if (materialsForExcerpt.length > 0 && materialsWithUsableText > 0 && USE_LLM_REPAIRS) {
          timer.log('[EXCERPT_REPAIR] running LLM repair (USE_LLM_REPAIRS=true)');
          const repaired = await runExcerptRepair(result.spec, materialsForExcerpt, requestedVersions, requestId, timer);
          metrics.llmCallCount += 1;
          result.warnings.push(...repaired.warnings);
          result.spec = repaired.spec;
          const afterRepair = validateExcerpts(repaired.spec);
          timer.log(`[EXCERPT_REPAIR] after repair valid=${afterRepair.valid}`);
          if (!afterRepair.valid) {
            degradeItemsWithMissingExcerpt(result.spec, afterRepair.failures, result.warnings);
            timer.log('[EXCERPT_VALIDATION] after repair still invalid; degraded remaining items');
          }
        } else {
          if (materialsForExcerpt.length > 0 && materialsWithUsableText > 0 && !USE_LLM_REPAIRS) {
            timer.log('[EXCERPT_VALIDATION] skipping LLM repair; using deterministic cleaning + degrade');
          }
          degradeItemsWithMissingExcerpt(result.spec, excerptValidation.failures, result.warnings);
          timer.log('[EXCERPT_VALIDATION] degraded items with missing/invalid excerpt');
        }
      }

      // Coherent excerpt cleaning: replace raw/metadata source_analysis content with 1–3 substantive paragraphs (when materials available)
      const materialsWithUsableForCleaning = materialsForExcerpt.filter(
        (m) => (m.extractedText || '').trim().length >= MIN_EXCERPT_LENGTH_CHARS
      );
      if (materialsWithUsableForCleaning.length > 0) {
        const canCollectExcerptDebug = (Date.now() - postProcessStartMs) <= 200;
        const { excerptStats } = applyExcerptCleaningToSpec(
          result.spec,
          materialsForExcerpt,
          result.warnings,
          { collectDebugStats: canCollectExcerptDebug }
        );
        if (canCollectExcerptDebug) excerptStatsForDebug = excerptStats;
        else nonEssentialDebugSkipped = true;
      }

      // Auto-trim: if estimate >120% of target, one attempt to reduce (only when USE_DURATION_AUTO_EXTEND=true).
      if (USE_DURATION_AUTO_EXTEND && targetDurationMinutes !== null && estimatedMinutes > targetDurationMinutes * 1.2) {
        const trimmed = await runDurationAutoTrim(
          result.spec,
          targetDurationMinutes,
          requestedVersions,
          requestId,
          timer,
          estimatedMinutes
        );
        metrics.llmCallCount += 1;
        result.warnings.push(...trimmed.warnings);
        if (trimmed.spec) {
          result.spec = trimmed.spec;
          estimatedMinutes = estimateDurationFromSpec(trimmed.spec);
          timer.log(`[DURATION] auto-trim applied new_estimated=${estimatedMinutes}`);
          console.log(`[DURATION] auto-trim applied new_estimated=${estimatedMinutes}`);
        } else {
          result.warnings.push({
            code: 'DURATION_TRIM_FAILED',
            message: `No se pudo acortar la evaluación; la duración estimada (${estimatedMinutes} min) supera el objetivo (${targetDurationMinutes} min). Se devuelve la evaluación sin recortar.`,
            severity: 'warning'
          });
        }
      }

      // Single deterministic post-processing pass is executed at the end of NEW path.

      // Rubric + Version B completion: one LLM repair pass when USE_LLM_REPAIRS (else quality-by-construction only)
      if (USE_LLM_REPAIRS) {
        const rubricPromptBRepaired = await runRubricAndPromptBRepair(result.spec, requestedVersions, requestId, timer);
        metrics.llmCallCount += 1;
        result.warnings.push(...rubricPromptBRepaired.warnings);
        if (rubricPromptBRepaired.spec) result.spec = rubricPromptBRepaired.spec;
      } else {
        timer.log('[RUBRIC_PROMPTB] skipped LLM repair (USE_LLM_REPAIRS=false)');
      }

      // Ensure Version B is reflected when requested and at least one item has promptB (avoid "not generated" after repair)
      ensureVersionBVariantWhenRequested(result.spec, requestedVersions);
      // When B is now present, drop stale warnings from earlier validation (no content / not generated)
      if (requestedVersions.B && (result.spec.versionVariants as Record<string, unknown>)?.B) {
        result.warnings = result.warnings.filter(
          (w) => w.code !== 'VERSION_B_NO_CONTENT' && w.code !== 'VERSION_B_MISSING'
        );
      }
      // Emit VERSION_B_PARTIAL_CONTENT once with final counts
      if (requestedVersions.B) {
        const { itemsWithPromptB, totalItems } = countPromptBCoverage(result.spec);
        if (itemsWithPromptB > 0 && itemsWithPromptB < totalItems) {
          result.warnings.push({
            code: 'VERSION_B_PARTIAL_CONTENT',
            message: `Solo ${itemsWithPromptB} de ${totalItems} ítems tienen versionedContent.promptB; el resto usa contenido base en B.`,
            severity: 'info'
          });
        }
      }

      // Item validity: validate ordering/matching/MC/source_analysis; repair once or degrade
      const validity = validateSpecItems(result.spec);
      if (validity.invalid.length > 0) {
        invalidItemCountsForDebug = validity.invalid.reduce((acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const answerLeakCount = validity.invalid.filter((i) => i.reason.includes('answer-leaking')).length;
        if (answerLeakCount > 0) {
          result.warnings.push({
            code: 'SOURCE_EXCERPT_ANSWER_LEAK',
            message: `${answerLeakCount} fragmento(s) de fuente parecen dar la respuesta (estilo resumen/abstract); se intentará reemplazar o degradar.`,
            severity: 'warning'
          });
        }
        if (USE_LLM_REPAIRS) {
          const repaired = await runItemValidityRepair(
            result.spec,
            validity.invalid,
            materialsForExcerpt,
            groupContext || {},
            requestedVersions,
            requestId,
            timer
          );
          metrics.llmCallCount += 1;
          result.warnings.push(...repaired.warnings);
          if (repaired.spec) {
            result.spec = repaired.spec;
            const recheck = validateSpecItems(result.spec);
            if (recheck.invalid.length > 0) {
              degradeInvalidItems(result.spec, recheck.invalid, result.warnings, buildFallbackRubric);
              timer.log(`[ITEM_VALIDITY] repair left ${recheck.invalid.length} invalid; degraded`);
            }
          } else {
            degradeInvalidItems(result.spec, validity.invalid, result.warnings, buildFallbackRubric);
            timer.log(`[ITEM_VALIDITY] repair failed; degraded ${validity.invalid.length} items`);
          }
        } else {
          degradeInvalidItems(result.spec, validity.invalid, result.warnings, buildFallbackRubric);
          timer.log(`[ITEM_VALIDITY] skipped LLM repair; deterministic degradation of ${validity.invalid.length} items`);
        }
        estimatedMinutes = estimateDurationFromSpec(result.spec);
        if (targetDurationMinutes !== null && estimatedMinutes < Math.round(targetDurationMinutes * 0.95)) {
          const low = Math.round(targetDurationMinutes * 0.95);
          const { spec: specAfterFiller, itemsAdded } = applyDeltaFiller(
            result.spec,
            targetDurationMinutes,
            materialsForExcerpt,
            result.warnings,
            groupContext?.subject
          );
        if (itemsAdded > 0) {
          result.spec = specAfterFiller;
          estimatedMinutes = estimateDurationFromSpec(specAfterFiller);
          timer.log(`[DURATION_DELTA_FILLER] post-degradation filler added ${itemsAdded} items, new_estimated=${estimatedMinutes}`);
        }
      }

      // Deterministic item fill runs LAST so table/matching/ordering/MC are always renderable (including filler-added items).
      fillMissingItemDataDeterministically(
        result.spec,
        materialsForExcerpt,
        materialsPromptStats.topKeywordsUsedForSelection,
        groupContext?.subject,
        result.warnings
      );
      if (materialsPromptStats.finalChars >= MIN_EXCERPT_LENGTH_CHARS) {
        ensureComprehensionBundleDeterministically(
          result.spec,
          materialsForExcerpt,
          materialsPromptStats.topKeywordsUsedForSelection,
          groupContext?.subject,
          result.warnings
        );
      }
      enforceFinalItemInvariants(result.spec, result.warnings, groupContext?.subject);
      }
      } else {
        // Rollback path: single-call + minimal deterministic invariants only.
        fillMissingItemDataDeterministically(
          result.spec,
          materialsForExcerpt,
          materialsPromptStats.topKeywordsUsedForSelection,
          groupContext?.subject,
          result.warnings
        );
        enforceFinalItemInvariants(result.spec, result.warnings, groupContext?.subject);
      } // end behavior path (NEW vs LEGACY)

      // Structure validation: warning only (no metadata-only scaling).
      if (targetDurationMinutes !== null) {
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
        }
      }
      const timeBreakdown = buildDurationBreakdownFromSpec(result.spec);
      if (!result.spec.meta.duration) result.spec.meta.duration = { minutes: estimatedMinutes };
      result.spec.meta.duration.minutes = estimatedMinutes;
      result.spec.meta.duration.breakdown = timeBreakdown;
      if (targetDurationMinutes !== null) {
        result.spec.meta.duration.targetMinutes = targetDurationMinutes;
      }

      const postProcessMs = Date.now() - postProcessStartMs;
      if (postProcessMs > 200 && excerptStatsForDebug.length > 0) {
        excerptStatsForDebug = [];
        nonEssentialDebugSkipped = true;
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
      
      // If narrative is present but too short (<200 chars), try narrative-only OpenAI call only when USE_NARRATIVE_LLM_CALLS=true (default: single-call flow).
      if (narrativeText && typeof narrativeText === 'string') {
        const len = narrativeText.trim().length;
        if (len > 0 && len < MIN_NARRATIVE_LENGTH && USE_NARRATIVE_LLM_CALLS) {
          timer.log('[AI_REPORT] Narrative too short (any source), requesting narrative-only OpenAI call...');
          const enhanced = await generateNarrativeOnlyCall(
            result.spec,
            groupContext || {},
            modification || '',
            evaluation_design_plan,
            requestId,
            timer
          );
          metrics.llmCallCount += 1;
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
      // When B/C are effective but narratives missing, attempt one fast secondary OpenAI call only when USE_NARRATIVE_LLM_CALLS=true (default: deterministic ensureByVersionNarratives only).
      const needsB = effectiveRequestedVersions.B && (!baseAiReport.byVersion?.B?.narrative?.trim());
      const needsC = effectiveRequestedVersions.C && (!baseAiReport.byVersion?.C?.narrative?.trim());
      if (USE_NARRATIVE_LLM_CALLS && (needsB || needsC) && baseAiReport.byVersion) {
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
        metrics.llmCallCount += 1;
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
      console.log('[BUILD_FINGERPRINT]', currentBuildMarker, 'requestId=', requestId);
      const response: V2Response = {
        success: true,
        evaluationSpec: evaluationSpecForResponse as typeof result.spec,
        targetDurationMinutes: targetDurationMinutes ?? null,
        estimatedTotalMinutes: estimatedMinutes,
        timeBreakdown,
        requestedVersions: effectiveRequestedVersions,
        instrumentDesignRulesApplied: instrumentDesignRules,
        teacherRemindersByStudent: teacherReminders,
        aiReport: normalizedAiReport, // Normalized to match AIDesignReportData contract
        warnings: dedupeWarningsByCode([
          ...result.warnings,
          ...(narrativeWarning ? [narrativeWarning] : [])
        ]),
        debug: {
          mode: useLegacyPath ? 'legacy' : 'new',
          build: currentBuildMarker,
          model: result.attempts?.[result.attempts.length - 1]?.model ?? OPENAI_MODEL_PRIMARY,
          llmCallCount: metrics.llmCallCount,
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
          semanticMap: { A: 'universal', B: 'content_adaptation_declared', C: 'equivalent_accessibility' },
          materialsPromptPath: materialsPromptPath,
          materialsIndexCount: materialsPromptStats.materialsIndexCount,
          passagesSelectedCount: materialsPromptStats.passagesSelectedCount,
          materialsCharsSent: materialsPromptStats.materialsCharsSent,
          passagesRejectedCount: materialsPromptStats.passagesRejectedCount ?? undefined,
          keptBlocksCount: materialsPromptStats.keptBlocksCount,
          finalK: materialsPromptStats.finalK,
          finalChars: materialsPromptStats.finalChars,
          bundleShortfallReason: materialsPromptStats.bundleShortfallReason,
          materialQuality: {
            usableBlocksCount: materialsPromptStats.usableBlocksCount,
            rejectedByReason: materialsPromptStats.passagesRejectedCount,
            selectedPassagesCount: materialsPromptStats.finalK,
            selectedChars: materialsPromptStats.finalChars,
            shortfallReason: materialsPromptStats.bundleShortfallReason
          },
          metrics: {
            promptChars: systemPrompt.length + userPrompt.length,
            selectionMs,
            postProcessMs,
            openaiMs: result.debug.openaiDurationMs ?? null,
            totalMs: timer.elapsed(),
            skippedNonEssentialDebug: nonEssentialDebugSkipped
          },
          topKeywordsUsedForSelection: materialsPromptStats.topKeywordsUsedForSelection,
          ...(excerptStatsForDebug?.length ? { excerptStats: excerptStatsForDebug } : {}),
          ...(invalidItemCountsForDebug && Object.keys(invalidItemCountsForDebug).length ? { invalidItemCountsByType: invalidItemCountsForDebug } : {})
        }
      };
      
      timer.log(`[DEPLOY_CHECK] ${currentBuildMarker} SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms`);
      
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
          targetDurationMinutes: targetDurationMinutes ?? null,
          estimatedTotalMinutes: estimateDurationFromSpec(emergencySpec),
          timeBreakdown: buildDurationBreakdownFromSpec(emergencySpec),
          requestedVersions,
          instrumentDesignRulesApplied: instrumentDesignRules,
          teacherRemindersByStudent: teacherReminders,
          aiReport: contingencyAiReport,
          warnings: emergencyWarnings,
          debug: {
            mode: useLegacyPath ? 'legacy' : 'new',
            build: currentBuildMarker,
            model: 'emergency_template',
            llmCallCount: metrics.llmCallCount,
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
        
        // Add debug info with attempts (excerptStats only when present)
        (response as V2Response & { debug?: unknown }).debug = {
          mode: useLegacyPath ? 'legacy' : 'new',
          build: currentBuildMarker,
          model: 'gpt-4.1-2025-04-14',
          llmCallCount: metrics.llmCallCount,
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
      targetDurationMinutes: null,
      estimatedTotalMinutes: 0,
      timeBreakdown: null,
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
        mode: useLegacyPath ? 'legacy' : 'new',
        build: currentBuildMarker,
        model: 'gpt-4.1-2025-04-14',
        llmCallCount: metrics.llmCallCount,
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
