# AI Request/Response Investigation - Group Evaluations

> Investigation report: How Group Evaluation AI generation works end-to-end.

## Table of Contents

1. [Where Can We Read the Exact Prompt Sent to AI?](#1-where-can-we-read-the-exact-prompt-sent-to-ai)
2. [What Information Does the AI Actually Receive?](#2-what-information-does-the-ai-actually-receive)
3. [OpenAI Response Format](#3-openai-response-format)
4. [Frontend Parsing of AI Output](#4-frontend-parsing-of-ai-output)
5. [Trace Timeline](#5-trace-timeline)

---

## 1. Where Can We Read the Exact Prompt Sent to AI?

### Prompt Construction Location

**File**: `supabase/functions/modify-evaluation/index.ts`

The prompts are built entirely **in the backend Edge Function**, not in the frontend.

| Prompt Type | Line Range | Function/Location |
|-------------|-----------|-------------------|
| **System Prompt** | Lines 2077-2143 | Variable `systemPrompt` in universal path |
| **User Prompt** | Lines 2145-2167 | Variable `userPrompt` in universal path |
| **Repair Prompt** (retries) | Lines 2199-2219 | Built dynamically in `generateEvaluationWithRetries()` |

### System Prompt Structure

```
systemPrompt = `Eres un especialista en evaluación educativa. Tu tarea es generar...

REGLAS CRÍTICAS (NO NEGOCIABLES):
1. Evidencia SIEMPRE escrita...
2. NO inferir diagnósticos...
...

FORMATO DE SALIDA OBLIGATORIO (DELIMITADORES ÚNICOS):
<<<A_EVAL_HTML_START_${DELIMITER_SUFFIX}>>>
...
<<<A_EVAL_HTML_END_${DELIMITER_SUFFIX}>>>
`
```

### User Prompt Structure

```
userPrompt = `CONTEXTO DEL GRUPO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
...

REGLAS DE DISEÑO:
${instrumentDesignRules.map(rule => '- ' + rule).join('\n')}

VERSIONES REQUERIDAS:
- Versión A: OBLIGATORIA (universal)
...
`
```

### Where to Inspect the Prompt at Runtime

| Method | Details |
|--------|---------|
| **Edge Function Logs** | Use Supabase Dashboard → Functions → modify-evaluation → Logs. The function logs request details but **NOT the full prompt** (to avoid log bloat). |
| **Console Logs** | Line 1003: `console.log('Request received:', { type, adaptationLevel, modification, hasGenerationContext, generation_mode })` |
| **API Key Debug** | Line 976-978: Debug endpoint `?debug=apikey` returns API key presence/preview |
| **Prompt NOT Persisted** | ⚠️ The full prompt is **not saved** to database or returned to frontend. It exists only in runtime memory during the Edge Function execution. |

### How to See Full Prompt (Debugging)

To inspect the full prompt, add a temporary log in the Edge Function:

```typescript
// Line ~2170 (before OpenAI call)
console.log('[DEBUG] Full System Prompt:', systemPrompt);
console.log('[DEBUG] Full User Prompt:', userPrompt);
```

Then check Supabase Edge Function logs.

---

## 2. What Information Does the AI Actually Receive?

### Request Flow

```
Frontend (EvaluacionesGrupo.tsx)
    │
    ▼
getGroupContextForAI() ─────────────────────┐
    │                                        │
    ▼                                        ▼
buildEvaluationDesignPlan() ───► evaluation_design_plan
    │
    ▼
supabase.functions.invoke('modify-evaluation', { body: requestBody })
    │
    ▼
Edge Function builds systemPrompt + userPrompt
    │
    ▼
OpenAI Chat Completions API
```

### Data Contract: Frontend → Edge Function

**File**: [EvaluacionesGrupo.tsx](../../src/pages/EvaluacionesGrupo.tsx) (Lines 1035-1050)

```typescript
const requestBody = {
  originalEvaluation: basePrototype || generatePrototipo(...),
  modification: modificationText,  // Teacher requirements + sessions/materials context
  groupContext,                     // See GroupContext Contract below
  type: 'modification',
  generation_mode: 'universal',
  evaluation_design_plan: {
    instrumentDesignRules,          // string[] - INSTRUMENT_DESIGN bucket templates
    responseOptions: { include, optionCount },
    triggers: { versionB, versionC },
    assignmentByStudentId: Record<studentId, 'A'|'B'|'C'>,
    perStudentReminders: StudentReminders[],
    varkDistribution: { visual, auditory, readWrite, kinesthetic, total },
    highStructureNeed: { totalStudents, qualifyingStudents, percent, qualifyingStudentIds },
    designComplexityCount: number,
    bucketedContemplacionIds: Record<ContemplacionBucket, string[]>
  }
};
```

### GroupContext Contract

**Source**: `getGroupContextForAI()` in [provider.ts](../../src/services/groupContext/provider.ts)

```typescript
interface GroupContextForAI {
  groupId: string;
  groupName: string;
  gradeLevel?: string;
  subject?: string;                 // Added in Edge Function from modification context
  content?: string[];               // Added in Edge Function from modification context
  competencies?: string[];          // Added in Edge Function from modification context
  criteriosLogro?: string[];        // Added in Edge Function from modification context
  
  teacherSugerencias?: {
    aula?: string;
    evaluaciones?: string;
    otras?: string;
  };
  
  students: StudentForAI[];         // Full student data (see below)
  
  groupProfile?: {
    tamanio: number;
    dominante: string;              // Dominant learning style
    distribucion?: Record<string, number>;
  };
  
  hasContentAdaptation: boolean;
  
  coverageHints: {
    studentsNeedingAltResponseFormat: string[];
    studentsNeedingExtraTime: string[];
    studentsNeedingBreaks: string[];
    studentsNeedingReadingAssistance: string[];
    studentsWithDeclaredContentAdaptation: string[];
  };
}
```

### StudentForAI Contract (Per Student)

**Source**: [groupContextForAI.ts](../../src/types/groupContextForAI.ts)

```typescript
interface StudentForAI {
  studentId: string | number;
  displayName: string;                    // Anonymized: "Estudiante A", "Estudiante B", etc.
  learningProfile?: string;               // e.g., "Visual-Kinestésico"
  contemplacionesClase: string[];         // IDs from localStorage (clase category)
  contemplacionesEvaluaciones: string[];  // IDs from localStorage (evaluaciones category)
  ajustes?: string;                       // Free-text accommodations
  requiresContentAdaptation: boolean;
  hasDeclaredContentAdaptation: boolean;
  declaredContentAdaptationSource: 'informe_tecnico' | 'docente' | null;
  declaredContentAdaptationNotes?: string | null;
}
```

### Student Anonymization

Students are anonymized in `getGroupContextForAI()`:

- Real names are **never sent** to OpenAI
- Students are labeled "Estudiante A", "Estudiante B", etc.
- `studentId` (numeric) is preserved for assignment tracking
- Learning profiles and contemplaciones are included (no PII)

### Evaluation Design Plan Contract

**Source**: `buildEvaluationDesignPlan()` in [designPlan.ts](../../src/services/evaluations/designPlan.ts)

| Field | Type | Purpose |
|-------|------|---------|
| `instrumentDesignRules` | `string[]` | Templates from INSTRUMENT_DESIGN bucket contemplaciones |
| `responseOptions` | `{ include, optionCount }` | Whether to include equivalent response options |
| `triggers` | `{ versionB, versionC }` | Whether to generate B/C versions |
| `assignmentByStudentId` | `Record<string, 'A'\|'B'\|'C'>` | Pre-computed version assignments |
| `perStudentReminders` | `StudentReminders[]` | ADMIN/CORRECTION reminders per student |
| `varkDistribution` | `object` | Learning style distribution |
| `highStructureNeed` | `object` | % of students needing structured formats |
| `bucketedContemplacionIds` | `Record<bucket, ids[]>` | Contemplaciones grouped by bucket |

---

## 3. OpenAI Response Format

### API Endpoint Used

**Endpoint**: `https://api.openai.com/v1/chat/completions` (Chat Completions API)

**Location**: [modify-evaluation/index.ts](../../supabase/functions/modify-evaluation/index.ts) Lines 2222-2243

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    // NO response_format: json_object - we use delimiter blocks
    max_completion_tokens: 6000
  }),
});
```

### Expected Model Output Format

The model is instructed to return **delimiter-wrapped HTML fragments**, NOT JSON:

```
<<<A_EVAL_HTML_START_8f3a7b>>>
<div class="evaluation">
...evaluation HTML for Version A...
</div>
<<<A_EVAL_HTML_END_8f3a7b>>>

<<<B_EVAL_HTML_START_8f3a7b>>>
<div class="evaluation">
...evaluation HTML for Version B...
</div>
<<<B_EVAL_HTML_END_8f3a7b>>>

<<<C_EVAL_HTML_START_8f3a7b>>>
<div class="evaluation">
...evaluation HTML for Version C...
</div>
<<<C_EVAL_HTML_END_8f3a7b>>>
```

### Why Delimiters Instead of JSON?

The system explicitly uses delimiter blocks to avoid JSON wrapper issues:

- System prompt says: "PROHIBIDO usar JSON ({ o \"versions\":)"
- This prevents the model from wrapping HTML in `{"versions": {"A": "..."}}` structures
- Delimiter suffix `8f3a7b` makes delimiters unique to avoid false matches

### Response Extraction Pipeline

**Location**: Lines 2257-2320 in `generateEvaluationWithRetries()`

1. **Extract from delimiters**: `extractVersionsFromModelOutput()` parses delimiter blocks
2. **Finalize each version**: `finalizeExtractedVersion()` cleans the HTML
3. **Validate**: `finalizeVersion()` checks for wrappers and valid HTML
4. **Retry on failure**: Up to 3 attempts with repair prompts

### Wrapper Detection & Repair

**Location**: Lines 60-110 (`hasWrapperLeak()`)

If the model returns JSON wrappers despite instructions, the backend:

1. Detects wrappers via regex (`/"versions"\s*:\s*\{/`, `/{.*"A"\s*:/`, etc.)
2. Extracts HTML from within the JSON structure
3. If extraction fails after 3 attempts, returns error HTML blocks

---

## 4. Frontend Parsing of AI Output

### Edge Function Response Shape

**Built by**: `buildUniversalResponse()` at Line 1853

```typescript
{
  success: true,
  content: finalA,                    // Legacy field
  type: 'modification',
  evaluationBundle: {
    baseHtml: finalA,                 // Version A HTML
    versionBHtml: finalB,             // Version B HTML (or null)
    versionCHtml: finalC,             // Version C HTML (or null)
    versions: {
      A: finalA,
      B: finalB,
      C: finalC
    },
    responseOptionsIncluded: boolean,
    responseOptionCount: number,
    finalAssignmentCounts: { A, B, C }
  },
  studentAssignments: Record<studentId, 'A'|'B'|'C'>,
  teacherRemindersByStudent: StudentReminders[],
  aiReport: {
    design_rationale: string,
    versions: { generated, reason, count },
    contemplaciones: { instrument_design, admin_reminders, correction_reminders },
    response_options: { included, optionCount, rationale, location },
    vark: { summary, distribution },
    assignments: { rationale, counts, by_version, total_students },
    warnings: string[]
  },
  warnings: string[],
  metadata: { tokensUsed, model },
  _debug: { ... }
}
```

### Frontend Response Processing

**Location**: [EvaluacionesGrupo.tsx](../../src/pages/EvaluacionesGrupo.tsx) Lines 1108-1300

#### Step 1: Validate Response (Lines 1108-1130)

```typescript
if (!data) throw new Error('Edge function returned no data');
if (!data?.evaluationBundle?.versions?.A) {
  setGenerationError({ message: 'Response missing Version A' });
  return;
}
```

#### Step 2: Extract Versions (Lines 1212-1230)

```typescript
const versionA = data.evaluationBundle?.versions?.A || data.evaluationBundle?.baseHtml || '';
const versionB = data.evaluationBundle?.versions?.B ?? data.evaluationBundle?.versionBHtml ?? null;
const versionC = data.evaluationBundle?.versions?.C ?? data.evaluationBundle?.versionCHtml ?? null;
```

**Key Point**: Frontend trusts backend to return clean HTML strings. No parsing/transformation on frontend.

#### Step 3: Type Validation (Lines 1218-1227)

```typescript
if (versionA && typeof versionA !== 'string') {
  console.error('[EVAL_PIPELINE] CRITICAL: versionA from backend is not string!');
}
```

#### Step 4: Set Evaluation Bundle (Lines 1229-1244)

```typescript
const evaluationBundleToSet: EvaluationBundle = {
  baseHtml: typeof versionA === 'string' ? versionA : '',
  versionBHtml: typeof versionB === 'string' ? versionB : null,
  versionCHtml: typeof versionC === 'string' ? versionC : null,
  versions: { A, B, C },
  responseOptionsIncluded: data.evaluationBundle?.responseOptionsIncluded ?? false,
  responseOptionCount: data.evaluationBundle?.responseOptionCount ?? 2,
  finalAssignmentCounts: data.finalAssignmentCounts
};
setEvaluationBundle(evaluationBundleToSet);
```

#### Step 5: AI Report Parsing (Lines 1292-1301)

```typescript
if (data?.aiReport) {
  setAiDesignReport(JSON.stringify(data.aiReport));  // Store as string
} else if (data?.aiDesignReport) {
  setAiDesignReport(JSON.stringify(data.aiDesignReport));  // Legacy fallback
}
```

**Note**: `aiReport` is an object from backend, stored as JSON string in state, then parsed when displayed.

### Loading Saved Evaluations

**Location**: [EvaluacionDetalle.tsx](../../src/pages/EvaluacionDetalle.tsx) Lines 206-212

```typescript
const evaluationBundle = evaluacion.evaluacion_generada?.evaluation_bundle;
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report 
  || evaluacion.ai_design_report 
  || null;
```

- Saved evaluations store `evaluacion_generada` in database
- Contains same structure as live generation response
- AI report is stored as JSON object, read directly (no parsing needed)

### Error Handling

**Location**: Lines 1100-1115, 1312-1340

| Error Type | Handling |
|------------|----------|
| Edge function error | `setGenerationError({ message, details, show: true })` |
| Missing Version A | Show error toast + set `generationError` state |
| Missing AI Report | Show warning toast, continue with partial data |
| Invalid version type | Log CRITICAL error, use empty string fallback |

---

## 5. Trace Timeline

### "Generate" Button Click → Rendered Evaluation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS "Generar Evaluación"                                          │
│    └─ EvaluacionesGrupo.tsx: generateEvaluationsForGroup()                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. LOAD GROUP CONTEXT                                                        │
│    └─ getGroupContextForAI(selectedGroup.id, { purpose: 'evaluation' })     │
│    └─ Loads: students, contemplaciones (localStorage), teacher_sugerencias  │
│    └─ Anonymizes student names                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. BUILD EVALUATION DESIGN PLAN                                              │
│    └─ buildEvaluationDesignPlan({ groupContext, teacherRequirementsText })  │
│    └─ Computes: version triggers, assignments, reminders, VARK distribution │
│    └─ Maps contemplaciones → buckets → templates                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. BUILD REQUEST PAYLOAD                                                     │
│    └─ requestBody = { originalEvaluation, modification, groupContext,        │
│                       type: 'modification', generation_mode: 'universal',   │
│                       evaluation_design_plan }                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. INVOKE EDGE FUNCTION                                                      │
│    └─ supabase.functions.invoke('modify-evaluation', { body: requestBody }) │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. EDGE FUNCTION: BUILD PROMPTS                                              │
│    └─ Extract designPlan fields                                              │
│    └─ Build systemPrompt (rules, format, delimiters)                        │
│    └─ Build userPrompt (context, requirements, version specs)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. EDGE FUNCTION: CALL OPENAI (with retries)                                 │
│    └─ POST https://api.openai.com/v1/chat/completions                       │
│    └─ Model: gpt-4.1-2025-04-14                                             │
│    └─ Up to 3 attempts with repair prompts on validation failure            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 8. EDGE FUNCTION: EXTRACT & NORMALIZE                                        │
│    └─ extractVersionsFromModelOutput() - parse delimiter blocks             │
│    └─ finalizeExtractedVersion() - clean HTML                               │
│    └─ finalizeVersion() - validate, detect wrappers                         │
│    └─ normalizeHtmlFragment() - remove <html>/<head>/<style>                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 9. EDGE FUNCTION: BUILD RESPONSE                                             │
│    └─ buildUniversalResponse() - assemble evaluationBundle + aiReport       │
│    └─ Return JSON: { success, evaluationBundle, aiReport, ... }             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 10. FRONTEND: PROCESS RESPONSE                                               │
│    └─ Validate: hasVersionA, hasAiReport                                    │
│    └─ Extract versions as strings (no parsing)                              │
│    └─ setEvaluationBundle(), setStudentAssignments(), setTeacherReminders() │
│    └─ setAiDesignReport(JSON.stringify(data.aiReport))                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 11. FRONTEND: RENDER                                                         │
│    └─ displayEvaluations computed from evaluationBundle.versions            │
│    └─ Each version rendered via dangerouslySetInnerHTML                     │
│    └─ AIDesignReport component parses aiDesignReport string → object        │
│    └─ TeacherRemindersPanel renders teacherReminders array                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Question | Answer |
|----------|--------|
| **Where is prompt built?** | Backend Edge Function (`modify-evaluation/index.ts`) |
| **Is prompt logged?** | Request metadata logged, full prompt NOT logged by default |
| **Is prompt persisted?** | NO - exists only in runtime memory |
| **What data goes to AI?** | Anonymized groupContext + evaluation_design_plan + teacher requirements |
| **Student names sent?** | NO - anonymized as "Estudiante A, B, C..." |
| **OpenAI endpoint?** | Chat Completions API (`/v1/chat/completions`) |
| **Response format?** | Delimiter-wrapped HTML fragments (NOT JSON) |
| **Frontend parsing?** | Trusts backend strings, no transformation |
| **AI Report format?** | JSON object from backend, stored as string in frontend state |

---

*Investigation Date: 2026-02-06*
