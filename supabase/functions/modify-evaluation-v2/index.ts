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

const OPENAI_TIMEOUT_GENERATE_MS = 55000;  // 55s for generate (first attempt)
const OPENAI_TIMEOUT_RETRY_MS = 45000;     // 45s for retry (reduced payload)
const OPENAI_TIMEOUT_ADJUST_MS = 30000;    // 30s for adjust mode (smaller changes)
const TOTAL_TIMEOUT_MS = 120000;           // 2 minutes total budget

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

interface AIReportV2 {
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
  aiReport: AIReportV2 | null;
  warnings: WarningV2[];
  debug?: {
    model: string;
    promptTokensEstimate: number;
    completionTokensEstimate: number;
    attempt: number;
    extractionMethod: string;
    requestId?: string;
    timings?: Record<string, number>;
    totalDurationMs?: number;
    openaiDurationMs?: number;
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
  
  // Validate versionedContent when Version B is requested
  if (requestedVersions.B) {
    let itemsWithVersionedContent = 0;
    let totalItems = 0;
    
    for (const section of spec.sections as Array<Record<string, unknown>>) {
      const items = section.items as Array<Record<string, unknown>>;
      for (const item of items) {
        totalItems++;
        if (item.versionedContent && typeof item.versionedContent === 'object') {
          const vc = item.versionedContent as Record<string, unknown>;
          if (vc.promptB && typeof vc.promptB === 'string' && vc.promptB.length > 0) {
            itemsWithVersionedContent++;
          }
        }
      }
    }
    
    console.log(`[V2_VALIDATION] Version B requested: ${itemsWithVersionedContent}/${totalItems} items have versionedContent.promptB`);
    
    if (totalItems > 0 && itemsWithVersionedContent === 0) {
      warnings.push({
        code: 'VERSION_B_NO_CONTENT',
        message: `Versión B solicitada pero ningún item tiene versionedContent.promptB. La Versión B será idéntica a la A.`,
        severity: 'warning'
      });
    } else if (itemsWithVersionedContent < totalItems) {
      warnings.push({
        code: 'VERSION_B_PARTIAL_CONTENT',
        message: `Solo ${itemsWithVersionedContent} de ${totalItems} items tienen versionedContent.promptB adaptado.`,
        severity: 'info'
      });
    }
  }
  
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
  
  // Check B/C presence matches requested
  if (requestedVersions.B && !variants.B) {
    warnings.push({
      code: 'VERSION_B_MISSING',
      message: 'La versión B (Adaptación de Contenido) fue solicitada pero no fue generada',
      severity: 'warning'
    });
  }
  
  if (requestedVersions.C && !variants.C) {
    warnings.push({
      code: 'VERSION_C_MISSING',
      message: 'La versión C (Adaptación Excepcional) fue solicitada pero no fue generada',
      severity: 'warning'
    });
  }
  
  // Set version and timestamp if missing
  if (!spec.version) spec.version = '2.0';
  if (!spec.generatedAt) spec.generatedAt = new Date().toISOString();
  
  return { spec: spec as unknown as EvaluationSpecV2, warnings };
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
  }
}

## TIPOS DE ITEMS

- multiple_choice: Requiere "options": [{"id": "a", "text": "...", "isCorrect": true/false}]
- true_false: Requiere "correctAnswer": true/false
- true_false_justify: Requiere "correctAnswer", "justificationRequired": true
- short_answer: Puede incluir "maxLength"
- paragraph: Puede incluir "minLength", "maxLength"
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions"
- source_analysis: Requiere "source": {"type": "text"|"image", "content"/"url", "caption"}
- table_completion: Requiere "table": {"columns": [{"id": "col-1", "header": "Columna 1"}, ...], "rows": [["valor1", "", "valor3"], ["", "", ""]]}
  - columns: array de objetos con id y header (encabezados de columna)
  - rows: array de arrays de strings. Strings vacíos "" indican celdas para completar por el estudiante
  - Ejemplo: tabla de 3 columnas con 2 filas, algunas celdas pre-llenadas y otras vacías
- matching: Requiere "leftColumn": ["item1", "item2"], "rightColumn": ["matchA", "matchB"]
- ordering: Requiere "itemsToOrder": ["paso1", "paso2", "paso3"]

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
- Ejemplo: Si prompt es "Analiza las consecuencias socioeconómicas...", promptB debe ser "Lee con atención. ¿Qué cambios importantes ocurrieron? Piensa en cómo afectó a las personas."` : '- NO incluyas versionedContent.'}
${requestedVersions.C ? '- Incluye versionedContent.promptC para adaptación excepcional cuando corresponda.' : ''}

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
  debug: {
    promptLength: number;
    responseLength: number;
    openaiDurationMs?: number;
    timeoutUsedMs?: number;
    retryReason?: string;
  };
}> {
  // RETRY STRATEGY:
  // Attempt 1: Full prompt with generous timeout (55s)
  // Attempt 2: Reduced prompt (no Version B/C) with shorter timeout (45s)
  const MAX_ATTEMPTS = 2;
  const warnings: WarningV2[] = [];
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
    
    // Build reduced prompt for retry (removes Version B/C complexity)
    let currentSystemPrompt = systemPrompt;
    let currentUserPrompt = userPrompt;
    let reducedVersions = requestedVersions;
    
    if (isRetryAttempt) {
      timer.log(`RETRY MODE: Reducing prompt complexity for faster response`);
      
      // On retry: simplify to Version A only to reduce output size
      if (requestedVersions.B || requestedVersions.C) {
        reducedVersions = { A: true, B: false, C: false };
        warnings.push({
          code: 'RETRY_SIMPLIFIED',
          message: 'Reintentando con versión simplificada (solo Versión A). Las versiones B/C deberán regenerarse.',
          severity: 'warning'
        });
        
        // Remove Version B instructions from system prompt
        currentSystemPrompt = systemPrompt
          .replace(/## VERSIÓN B[\s\S]*?(?=##|$)/g, '')
          .replace(/OBLIGATORIO: Generar "versionedContent\.promptB"[^\n]*/g, 
                   'NO incluir versionedContent (Version B omitida por timeout)')
          .replace(/- Incluir versionedContent\.promptC[^\n]*/g, '');
        
        timer.log(`  Original systemPrompt: ${systemPrompt.length} chars`);
        timer.log(`  Reduced systemPrompt: ${currentSystemPrompt.length} chars`);
      }
      
      // If previous attempt had a response, build repair prompt
      if (lastRawResponse && retryReason === 'parse_error') {
        const truncated = lastRawResponse.slice(0, 500);
        currentUserPrompt = `Tu respuesta anterior no fue JSON válido. Error de parsing detectado.

Respuesta anterior (truncada):
${truncated}

REQUERIMIENTOS:
1. Responde ÚNICAMENTE con JSON válido
2. Sin code fences (\`\`\`)
3. Sin comentarios
4. Sin texto antes o después del JSON

CONTEXTO ORIGINAL:
${userPrompt}`;
      }
    }
    
    // Log request metadata for debugging
    const promptSizeKB = ((currentSystemPrompt.length + currentUserPrompt.length) / 1024).toFixed(1);
    timer.log(`OpenAI request details:`);
    timer.log(`  model: gpt-4.1-2025-04-14`);
    timer.log(`  systemPrompt: ${currentSystemPrompt.length} chars`);
    timer.log(`  userPrompt: ${currentUserPrompt.length} chars`);
    timer.log(`  totalPromptSize: ${promptSizeKB} KB`);
    timer.log(`  effectiveTimeout: ${effectiveTimeout}ms`);
    timer.log(`  requestedVersions: A=${reducedVersions.A}, B=${reducedVersions.B}, C=${reducedVersions.C}`);
    
    const openaiStartTime = Date.now();
    
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
            model: 'gpt-4.1-2025-04-14',
            messages: [
              { role: 'system', content: currentSystemPrompt },
              { role: 'user', content: currentUserPrompt }
            ],
            response_format: { type: 'json_object' },
            // Reduce tokens on retry for faster response
            max_completion_tokens: isRetryAttempt ? 4000 : 6000
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
        
        return {
          spec,
          warnings,
          attempt,
          extractionMethod,
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
      
    } catch (apiError) {
      openaiDurationMs = Date.now() - openaiStartTime;
      const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
      timer.log(`✗ API call failed after ${openaiDurationMs}ms: ${errorMsg}`);
      
      // Check if it's a timeout error
      const isTimeout = errorMsg.includes('TIMEOUT');
      warnings.push({
        code: isTimeout ? 'OPENAI_TIMEOUT' : 'API_ERROR',
        message: isTimeout 
          ? `El servicio de IA tardó demasiado (>${effectiveTimeout}ms). ${attempt < MAX_ATTEMPTS ? 'Reintentando con prompt simplificado...' : 'Intenta de nuevo.'}`
          : `Intento ${attempt}: Error de API - ${errorMsg}`,
        severity: attempt >= MAX_ATTEMPTS ? 'error' : 'warning'
      });
      
      retryReason = isTimeout ? 'timeout' : 'api_error';
      
      // On timeout, ALLOW retry with reduced prompt (unlike before)
      if (isTimeout && attempt < MAX_ATTEMPTS) {
        timer.log(`Timeout on attempt ${attempt}, will retry with reduced prompt`);
        continue;
      }
    }
  }
  
  // All attempts failed
  timer.log(`═══════════════════════════════════════════════════════════════`);
  timer.log(`✗ All ${MAX_ATTEMPTS} attempts failed`);
  timer.log(`  lastRetryReason: ${retryReason}`);
  timer.log(`  totalElapsed: ${timer.elapsed()}ms`);
  timer.log(`═══════════════════════════════════════════════════════════════`);
  
  return {
    spec: null,
    warnings,
    attempt,
    extractionMethod: 'failed',
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
    
    const {
      mode,  // 'generate' (default) or 'adjust'
      modification,
      groupContext,
      evaluation_design_plan,
      currentEvaluationSpec,  // For adjust mode: the current spec to refine
      adjustmentDetails       // For adjust mode: { targetVersions, scope, sectionId?, itemId? }
    } = await req.json();
    
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
      // Success
      const response: V2Response = {
        success: true,
        evaluationSpec: result.spec,
        requestedVersions,
        instrumentDesignRulesApplied: instrumentDesignRules,
        teacherRemindersByStudent: teacherReminders,
        aiReport: {
          designRationale: `Evaluación generada para ${groupContext?.subject || 'materia no especificada'} con ${result.spec.sections.length} secciones.`,
          versionsExplanation: {
            generated: ['A', ...(requestedVersions.B ? ['B'] : []), ...(requestedVersions.C ? ['C'] : [])],
            notGenerated: {
              ...(requestedVersions.B ? {} : { B: 'No hay estudiantes con alta necesidad de estructuración' }),
              ...(requestedVersions.C ? {} : { C: 'No hay estudiantes con adecuación de contenido declarada' })
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
        },
        warnings: result.warnings,
        debug: {
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
          retryReason: result.debug.retryReason
        }
      };
      
      timer.log(`SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms`);
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Generation failed - return safe minimal response with requestId
      timer.log('══════════════════════════════════════════════════════════════════');
      timer.log('❌ [V2_FAILURE] GENERATION FAILED - Returning success=false');
      timer.log('══════════════════════════════════════════════════════════════════');
      timer.log(`[V2_FAILURE] warnings: ${JSON.stringify(result.warnings.map(w => ({code: w.code, message: w.message})))}`);
      timer.log(`[V2_FAILURE] attempt: ${result.attempt}, extractionMethod: ${result.extractionMethod}`);
      timer.log(`[V2_FAILURE] promptLength: ${result.debug.promptLength}, responseLength: ${result.debug.responseLength}`);
      timer.log(`[V2_FAILURE] openaiDurationMs: ${result.debug.openaiDurationMs}`);
      timer.log(`[V2_FAILURE] timeoutUsedMs: ${result.debug.timeoutUsedMs}, retryReason: ${result.debug.retryReason}`);
      
      const response = buildSafeMinimalResponse(
        result.warnings,
        requestedVersions,
        instrumentDesignRules,
        teacherReminders
      );
      
      // Add debug info even on failure
      (response as V2Response & { debug?: unknown }).debug = {
        requestId,
        timings: timer.summary(),
        totalDurationMs: timer.elapsed(),
        openaiDurationMs: result.debug.openaiDurationMs,
        timeoutUsedMs: result.debug.timeoutUsedMs,
        retryReason: result.debug.retryReason,
        promptSizeKB: (result.debug.promptLength / 1024).toFixed(1)
      };
      
      timer.log(`FAILED: warnings=${result.warnings.length}, totalTime=${timer.elapsed()}ms`);
      
      return new Response(JSON.stringify(response), {
        status: 200, // Return 200 with success=false to allow frontend to handle gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
