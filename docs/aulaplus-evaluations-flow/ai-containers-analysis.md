# AI Containers Analysis: Group Evaluations Flow

> **Purpose**: Deep technical analysis of how AI prompts are constructed, how student characteristics are sent, and how UI containers are populated in the Group Evaluations flow.
>
> **Date**: February 2026  
> **Scope**: Post-generation data flow analysis

---

## 1. Trace Timeline

From clicking "Generar Evaluaciones Inteligentes" to full UI population:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ T0: User clicks "Generar Evaluaciones Inteligentes"                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ T1: handleGenerateEvaluations() [EvaluacionesGrupo.tsx:835]                    │
│     - Validates: selectedGroup, materia, content sources                        │
│     - Sets: setIsGenerating(true)                                               │
│                                                                                 │
│ T2: Build generation context [EvaluacionesGrupo.tsx:880-905]                   │
│     - Calls: buildEvaluationGenerationContext() if hasSessions || hasMaterials │
│     - Serializes: session digests, material metadata                            │
│                                                                                 │
│ T3: Load group context [EvaluacionesGrupo.tsx:910-925]                         │
│     - Calls: getGroupContextForAI(selectedGroup.id, {purpose:'evaluation'})    │
│     - Returns: students, contemplaciones, dominantLearningStyle                 │
│                                                                                 │
│ T4: Build evaluation design plan [EvaluacionesGrupo.tsx:930-950]               │
│     - Calls: buildEvaluationDesignPlan({groupContext, teacherRequirements})    │
│     - Computes: triggers, assignmentByStudentId, perStudentReminders           │
│                                                                                 │
│ T5: Build request payload [EvaluacionesGrupo.tsx:1020-1030]                    │
│     - Constructs: requestBody with generation_mode:'universal'                  │
│     - Includes: evaluation_design_plan, groupContext, modification             │
│                                                                                 │
│ T6: Invoke Edge Function [EvaluacionesGrupo.tsx:1070]                          │
│     - Calls: supabase.functions.invoke('modify-evaluation', {body: requestBody})│
│                                                                                 │
│ ═══════════════════════════════════════════════════════════════════════════════│
│ BACKEND: modify-evaluation Edge Function                                        │
│ ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                 │
│ T7: Parse request [modify-evaluation/index.ts:980-1010]                        │
│     - Extracts: evaluation_design_plan, groupContext, generation_mode          │
│     - Validates: triggers, studentAssignments                                   │
│                                                                                 │
│ T8: Build system prompt [modify-evaluation/index.ts:2050-2120]                 │
│     - Constructs: DELIMITER_SUFFIX, version requirements, design rules         │
│     - Determines: generateVersionB, generateVersionC from triggers             │
│                                                                                 │
│ T9: Build user prompt [modify-evaluation/index.ts:2120-2160]                   │
│     - Includes: groupContext, modification, instrumentDesignRules              │
│                                                                                 │
│ T10: Call OpenAI [modify-evaluation/index.ts:2230-2260]                        │
│     - Model: gpt-4.1-2025-04-14                                                │
│     - Retry logic: generateEvaluationWithRetries (max 3 attempts)              │
│                                                                                 │
│ T11: Extract versions [modify-evaluation/index.ts:2280-2400]                   │
│     - Uses delimiters: <<<A_EVAL_HTML_START_8f3a7b>>>...                       │
│     - Fallback: JSON extraction, regex extraction                              │
│                                                                                 │
│ T12: Normalize HTML [modify-evaluation/index.ts:2400-2500]                     │
│     - Removes: <html>, <head>, <body>, <style>, <script>                       │
│     - Validates: wrapper leaks, forbidden tags                                 │
│                                                                                 │
│ T13: Build aiReport [modify-evaluation/index.ts:2750-2800]                     │
│     - Constructs: design_rationale, versions, contemplaciones, assignments     │
│                                                                                 │
│ T14: Build response [modify-evaluation/index.ts:2900-2920]                     │
│     - Returns: evaluationBundle, studentAssignments, teacherRemindersByStudent │
│     - Returns: aiReport, warnings, _debug                                       │
│                                                                                 │
│ ═══════════════════════════════════════════════════════════════════════════════│
│ FRONTEND: Response Processing                                                   │
│ ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                 │
│ T15: Validate response [EvaluacionesGrupo.tsx:1100-1130]                       │
│     - Checks: hasVersionA, data.aiReport, data.evaluationBundle                │
│                                                                                 │
│ T16: Extract versions [EvaluacionesGrupo.tsx:1195-1230]                        │
│     - Reads: data.evaluationBundle.versions.{A,B,C}                            │
│     - Validates: typeof === 'string'                                            │
│                                                                                 │
│ T17: Set state [EvaluacionesGrupo.tsx:1230-1290]                               │
│     - setEvaluationBundle(evaluationBundleToSet)                               │
│     - setStudentAssignments(normalizedResult.normalized)                       │
│     - setTeacherReminders(data.teacherRemindersByStudent)                      │
│     - setAiDesignReport(JSON.stringify(data.aiReport))                         │
│                                                                                 │
│ T18: Render UI [EvaluacionesGrupo.tsx (useMemo displayEvaluations)]            │
│     - Builds cards from evaluationBundle.versions                              │
│     - Renders: EvaluationAssignmentsPanel, TeacherRemindersPanel               │
│     - Renders: EvaluacionVisualRenderer[], AIDesignReport                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Contract

### 2.1 Request Payload (Frontend → Edge Function)

**File**: [src/pages/EvaluacionesGrupo.tsx](../../src/pages/EvaluacionesGrupo.tsx) lines 1020-1030

```typescript
interface ModifyEvaluationRequest {
  originalEvaluation: string;  // Base prototype HTML
  modification: string;        // Teacher requirements + session/material context
  groupContext: {
    subject: string;
    subjects?: string[];       // For interdisciplinary
    content: string[];         // ANEP subtema IDs
    competencies: string[];    // Competencia IDs
    criteriosLogro: string[];  // Criterio de logro IDs
    isInterdisciplinary: boolean;
    groupName: string;
    students: AnonymizedStudent[];  // From getGroupContextForAI
    dominantProfile?: string;
  };
  type: 'modification';
  generation_mode: 'universal';
  evaluation_design_plan: {
    instrumentDesignRules: string[];
    responseOptions: { include: boolean; optionCount: 1|2|3; triggerReasons: string[] };
    triggers: { versionB: boolean; versionC: boolean };
    assignmentByStudentId: Record<string, 'A'|'B'|'C'>;
    perStudentReminders: StudentReminders[];
    varkDistribution: { visual: number; auditory: number; readWrite: number; kinesthetic: number };
    highStructureNeed: { totalStudents: number; qualifyingStudents: number; percent: number; qualifyingStudentIds: string[] };
    designComplexityCount: number;
    bucketedContemplacionIds: Record<ContemplacionBucket, string[]>;
  };
}
```

### 2.2 Response Payload (Edge Function → Frontend)

**File**: [supabase/functions/modify-evaluation/index.ts](../../supabase/functions/modify-evaluation/index.ts) lines 1850-1920

```typescript
interface ModifyEvaluationResponse {
  success: boolean;
  content: string;              // Legacy: Version A HTML
  type: 'modification';
  
  evaluationBundle: {
    baseHtml: string;           // Alias for versions.A
    versionBHtml: string|null;  // Alias for versions.B
    versionCHtml: string|null;  // Alias for versions.C
    versions: {
      A: string;                // Clean HTML fragment
      B: string|null;           // Clean HTML fragment or null
      C: string|null;           // Clean HTML fragment or null
    };
    responseOptionsIncluded: boolean;
    responseOptionCount: number;
    finalAssignmentCounts: { A: number; B: number; C: number };
  };
  
  studentAssignments: Record<string, 'A'|'B'|'C'>;
  finalAssignmentCounts: { A: number; B: number; C: number };
  
  teacherRemindersByStudent: Array<{
    studentId: string|number;
    admin: string[];
    correction: string[];
    allowances: string[];
  }>;
  
  aiReport: {
    design_rationale: string;
    versions: { generated: string[]; reason: string; count: number };
    contemplaciones: {
      instrument_design: string[];
      admin_reminders: string[];
      correction_reminders: string[];
      bucketed_ids: Record<string, string[]>;
      high_structure_need_percent: number;
    };
    response_options: { included: boolean; optionCount: number; rationale: string; location: string };
    vark: { summary: string; distribution: object };
    assignments: {
      rationale: string;
      counts: { A: number; B: number; C: number };
      content_adaptation_student_ids: string[];
      by_version: { A: string[]; B: string[]; C: string[] };
      total_students: number;
    };
    warnings: string[];
  };
  
  warnings: string[];
  metadata: { tokensUsed: number; model: string };
  _debug: object;
}
```

---

## 3. Where Each Container Gets Its Data

| Container Name | Component Path | Data Field(s) | Source | Notes |
|----------------|----------------|---------------|--------|-------|
| **Evaluation Cards (A/B/C)** | `EvaluacionVisualRenderer` via `displayEvaluations` useMemo | `evaluationBundle.versions.{A,B,C}` | AI response | Cards built from `evaluationBundle`; visibility depends on `finalAssignmentCounts` |
| **Recordatorios para el docente** | [TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx) | `teacherReminders` state | Computed client-side via `buildPerStudentReminders()` in `designPlan.ts`, then passed through backend | Shows admin/correction/allowances per student; empty state if no reminders |
| **Asignaciones por estudiante** | [EvaluationAssignmentsPanel.tsx](../../src/components/evaluaciones/EvaluationAssignmentsPanel.tsx) | `studentAssignments` state | AI response `studentAssignments` + client normalization | Maps studentId → version; normalized in frontend if version unavailable |
| **Reporte de IA** | [AIDesignReport.tsx](../../src/components/evaluaciones/AIDesignReport.tsx) | `aiDesignReport` state (JSON string) | AI response `aiReport` | Collapsible; shows rationale, versions, options, warnings |
| **Advertencias de ajustes** | Alert card with `assignmentWarnings` | `assignmentWarnings` state | Combined: backend `warnings[]` + frontend normalization warnings | Shows when students reassigned due to missing versions |
| **Save Dialog** | Dialog in `EvaluacionesGrupo.tsx` | `nombreEvaluacion`, `evaluationBundle`, etc. | Local state | Persists to `evaluaciones` table via handleSaveEvaluation |

---

## 4. Section A: The Exact AI Prompt

### 4.1 Prompt Building Functions

| Function | File | Purpose |
|----------|------|---------|
| `systemPrompt` construction | [modify-evaluation/index.ts](../../supabase/functions/modify-evaluation/index.ts) lines 2050-2120 | Builds system instructions with rules, delimiter format, version requirements |
| `userPrompt` construction | [modify-evaluation/index.ts](../../supabase/functions/modify-evaluation/index.ts) lines 2120-2160 | Builds context + requirements + version instructions |
| `generateEvaluationWithRetries()` | [modify-evaluation/index.ts](../../supabase/functions/modify-evaluation/index.ts) lines 2170-2330 | Retry wrapper with repair prompts |

### 4.2 System Prompt Structure (Universal Path)

The system prompt is built at runtime in the Edge Function. Here is the reconstructed structure:

```
Eres un especialista en evaluación educativa. Tu tarea es generar una evaluación escrita universal, lista para entregar.

REGLAS CRÍTICAS (NO NEGOCIABLES):
1. Evidencia SIEMPRE escrita. Prohibido generar tareas "solo orales".
2. NO inferir diagnósticos ni necesidades desde narrativas. Usa SOLO datos estructurados.
3. CE/CL son definidos por el docente: NO inventar ni inferir nuevos criterios.
4. No incluir explicaciones meta ni razonamientos de IA. NO incluir "Nota:" ni comentarios sobre adaptaciones.
5. **CRÍTICO HTML**: Usa SOLO fragmentos HTML. PROHIBIDO usar:
   - <html>, </html>
   - <head>, </head>
   - <body>, </body>
   - <style>, </style>
   - Cualquier CSS global
6. **CRÍTICO JSON**: NO usar JSON. NO usar { ni }. Si generas JSON, la respuesta es INVÁLIDA.

FORMATO HTML PERMITIDO:
- Usa <div class="evaluation">...</div> como contenedor principal
- Usa <strong>, <p>, <table>, <ul>, <ol>, <li>, <h2>, <h3>
- NO uses <html>, <head>, <body>, <style>, <script>
- Incluye puntajes por ítem cuando aplique

RESPUESTAS CON OPCIONES EQUIVALENTES:
[Conditional: If responseOptionsInclude=true]
- OBLIGATORIO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE {optionCount} opciones equivalentes de formato.
- Formato: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
[Else]
- NO incluir opciones equivalentes de respuesta.

**FORMATO DE SALIDA OBLIGATORIO (DELIMITADORES ÚNICOS):**

<<<A_EVAL_HTML_START_8f3a7b>>>
<div class="evaluation">...contenido completo de versión A...</div>
<<<A_EVAL_HTML_END_8f3a7b>>>

[Conditional: If generateVersionB=true]
<<<B_EVAL_HTML_START_8f3a7b>>>
<div class="evaluation">...versión B (formato equivalente)...</div>
<<<B_EVAL_HTML_END_8f3a7b>>>

[Conditional: If generateVersionC=true]
<<<C_EVAL_HTML_START_8f3a7b>>>
<div class="evaluation">...versión C (adecuación de contenido)...</div>
<<<C_EVAL_HTML_END_8f3a7b>>>

REGLAS ABSOLUTAS:
- PROHIBIDO usar JSON ({ o "versions":)
- PROHIBIDO usar <html>, <head>, <body>, <style>
- Cada versión es INDEPENDIENTE: NO incluir contenido de otras versiones
- NO incluir notas como "Nota: Esta versión..." dentro del contenido
```

### 4.3 User Prompt Structure

```
CONTEXTO DEL GRUPO:
Materia: {groupContext.subject}
Contenidos: {groupContext.content.join(', ')}
Competencias: {groupContext.competencies.join(', ')}
Criterios de logro: {groupContext.criteriosLogro.join(', ')}

REQUERIMIENTOS DOCENTE:
{modification || 'No hay requerimientos adicionales'}

REGLAS DE DISEÑO:
{instrumentDesignRules.map(rule => `- ${rule}`).join('\n')}

VERSIONES REQUERIDAS:
- Versión A: OBLIGATORIA (universal)
- Versión B: {generateVersionB ? 'OBLIGATORIA' : 'NO generar'}
- Versión C: {generateVersionC ? 'OBLIGATORIA' : 'NO generar'}

TAREA:
1. Genera evaluaciones usando los delimitadores <<<X_EVAL_HTML_START_8f3a7b>>> y <<<X_EVAL_HTML_END_8f3a7b>>>.
2. USA SOLO fragmentos HTML. PROHIBIDO usar: <html>, <head>, <body>, <style>, <script>
3. Cada versión debe ser INDEPENDIENTE.
4. NO uses JSON. NO uses { ni }.
5. Las evaluaciones deben verse como exámenes reales de secundaria.
```

### 4.4 Repair Prompt (On Retry)

When extraction fails, attempt 2+ uses a repair prompt:

```
Tu salida anterior violó el formato requerido. Aquí está tu salida anterior (truncada):

{lastFailedOutput.slice(0, 1500)}

ERRORES DETECTADOS:
- La salida contiene JSON o fragmentos como {"versions": {"A": " o ", "B":
- O contiene wrappers JSON que no deberían aparecer
- O no usa los delimitadores correctos

REQUERIMIENTOS ABSOLUTOS:
1. Re-genera SOLO los bloques delimitados, HTML limpio, sin JSON, sin notas.
2. Cada bloque DEBE empezar con <div (no texto plano).
3. NO incluyas texto antes/después de los bloques.
4. NO incluyas otras versiones dentro de ninguna versión.
5. USA SOLO los delimitadores: <<<A_EVAL_HTML_START_8f3a7b>>>, etc.

CONTEXTO ORIGINAL:
{userPrompt}
```

### 4.5 Multiple Prompts Summary

| Prompt Type | Trigger | File Location | Key Differences |
|-------------|---------|---------------|-----------------|
| **Universal generation** | `generation_mode='universal'` + `type='modification'` | lines 2050-2160 | Full A/B/C generation with delimiters |
| **Feedback/modification** | `handleFeedback()` → `type='modification'` | lines 3100-3300 (legacy path) | Modifies existing evaluation |
| **Chat response** | `type='chat'` | lines 2930-2960 | Pedagogical assistant response |
| **HTML plan** | `type='html_plan'` | lines 2960-3000 | HTML-only lesson plan |
| **Planning** | `type='planning'` | lines 3000-3100 | Plain text planning suggestions |

---

## 5. Section B: How Student Characteristics Are Sent

### 5.1 Data Structures

**StudentForAI** (from `getGroupContextForAI`):
```typescript
interface StudentForAI {
  studentId: string | number;
  displayName: string;           // Anonymized: "Estudiante A", "Estudiante B"
  learningProfile?: string;      // From mockData.perfil: "Visual", "Kinestésico", etc.
  contemplacionesClase: string[];      // IDs from localStorage
  contemplacionesEvaluaciones: string[]; // IDs from localStorage
  ajustes?: string;              // From mockData.ajustes
  requiresContentAdaptation: boolean;
  hasDeclaredContentAdaptation: boolean;
  declaredContentAdaptationSource: 'informe_tecnico' | 'docente' | null;
  declaredContentAdaptationNotes?: string;
}
```

**AnonymizedStudent** (sent to AI):
```typescript
interface AnonymizedStudent {
  perfil?: string;           // learningProfile
  ajustes?: string;          // Free text adjustments
  contemplaciones: string[]; // contextual: clase or evaluaciones
}
```

### 5.2 Data Sources

| Field | Source | Key/Path | Notes |
|-------|--------|----------|-------|
| Student list | `mockData.ts` → `mockGroups[].students` | Resolved via `resolveMockGroup(grupoId)` | NOT persisted in Supabase |
| Student profile | `mockData.ts` | `student.perfil` | e.g., "Visual-Kinestésico" |
| Student ajustes | `mockData.ts` | `student.ajustes` | Free text adjustments |
| Contemplaciones clase | localStorage | `contemplaciones_clase_${studentId}` | Array of contemplacion IDs |
| Contemplaciones evaluaciones | localStorage | `contemplaciones_evaluaciones_${studentId}` | Array of contemplacion IDs |
| Content adaptation flag | localStorage OR mockData | `adecuacionContenido:${studentId}` OR `student.informeTecnico.requiereAdecuacionContenido` | Triggers Version C |

### 5.3 Transformation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. getGroupContextForAI(grupoId, {purpose:'evaluation'})               │
│    File: src/services/groupContext/provider.ts                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    a) Load students from MockStudentDataSource.getGroupStudents()      │
│       → Returns Student[] from mockGroups                              │
│                                                                         │
│    b) For each student, load contemplaciones:                          │
│       → readSelected(studentId, 'evaluaciones')                        │
│       → Returns string[] from localStorage                             │
│                                                                         │
│    c) Check content adaptation flags:                                   │
│       → checkContentAdaptation(student)                                │
│       → Returns { hasDeclaredContentAdaptation, source, notes }        │
│                                                                         │
│    d) Build StudentForAI objects (max 10 students)                     │
│                                                                         │
│    e) Build anonymizedStudentsForPrompt:                               │
│       → { perfil, ajustes, contemplaciones }                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. buildEvaluationDesignPlan({groupContext, teacherRequirementsText})  │
│    File: src/services/evaluations/designPlan.ts                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    a) Collect all contemplacionesEvaluaciones from students            │
│       → Flatten and deduplicate IDs                                    │
│                                                                         │
│    b) Map to buckets via mapSelectedContemplacionesToBuckets():        │
│       → INSTRUMENT_DESIGN, ADMIN_REMINDER, CORRECTION_REMINDER         │
│                                                                         │
│    c) Calculate triggers:                                              │
│       → versionB: highStructureNeed >= 30% AND complexityCount >= 6    │
│       → versionC: any student has hasDeclaredContentAdaptation         │
│                                                                         │
│    d) Compute assignmentByStudentId:                                   │
│       → Default: all students → 'A'                                    │
│       → If versionB: qualifying students → 'B'                         │
│       → If versionC: contentAdaptation students → 'C'                  │
│                                                                         │
│    e) Build perStudentReminders via buildPerStudentReminders():        │
│       → For each student, map contemplaciones → reminder texts         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Request payload construction                                         │
│    File: src/pages/EvaluacionesGrupo.tsx lines 1020-1030               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    requestBody = {                                                     │
│      groupContext: {                                                   │
│        students: groupContextData.anonymizedStudentsForPrompt,         │
│        // Anonymized: { perfil, ajustes, contemplaciones }             │
│      },                                                                │
│      evaluation_design_plan: {                                         │
│        assignmentByStudentId,                                          │
│        perStudentReminders,                                            │
│        triggers,                                                       │
│        bucketedContemplacionIds,                                       │
│        // ... other fields                                             │
│      }                                                                 │
│    }                                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.4 What Gets Sent to AI vs What Stays Local

| Data | Sent to AI | Used Locally | Notes |
|------|------------|--------------|-------|
| Student names | ❌ | ✅ | Anonymized to "Estudiante A/B/C..." |
| Student IDs | ❌ | ✅ | Only in assignmentByStudentId |
| Learning profile (perfil) | ✅ | ✅ | Included in anonymizedStudentsForPrompt |
| Ajustes text | ✅ | ✅ | Included in anonymizedStudentsForPrompt |
| Contemplaciones IDs | ✅ | ✅ | Translated to instrumentDesignRules |
| Reminder texts | ❌ | ✅ | Generated via enforcement.ts, not sent to AI |
| Content adaptation flag | ✅ (implicit) | ✅ | Triggers versionC, influences prompt |

---

## 6. Section C: "Recordatorios para el docente" Container

### 6.1 Component Details

| Aspect | Value |
|--------|-------|
| **Component** | `TeacherRemindersPanel` |
| **File** | [src/components/evaluaciones/TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx) |
| **Props** | `reminders: StudentReminders[]`, `students: Array<{id, name}>` |

### 6.2 Data Source

The `teacherReminders` state is populated from **two sources** that converge:

1. **Client-side computation** (`buildPerStudentReminders` in `designPlan.ts`):
   - Reads each student's `contemplacionesEvaluaciones`
   - Maps to buckets: ADMIN_REMINDER, CORRECTION_REMINDER, INSTRUMENT_DESIGN
   - For each contemplacion, looks up reminder text via `getEvaluationReminderTemplate()`
   - Returns `StudentReminders[]` with `{studentId, admin[], correction[], allowances[]}`

2. **Backend passthrough** (Edge Function):
   - Receives `perStudentReminders` in `evaluation_design_plan`
   - Passes through as `teacherRemindersByStudent` in response

### 6.3 Data Shape

```typescript
interface StudentReminders {
  studentId: string | number;
  admin: string[];      // e.g., ["Recordar leer consignas en voz alta"]
  correction: string[]; // e.g., ["No penalizar ortografía cuando no es objetivo"]
  allowances: string[]; // e.g., ["Permitir hoja auxiliar / borrador"]
}
```

### 6.4 Generation Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ storage.ts: readSelected(studentId, 'evaluaciones')                 │
│ → Returns: ['contemplacion-1', 'contemplacion-6', ...]              │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ mapping.ts: mapSelectedContemplacionesToBuckets(ids)                │
│ → Returns: Map { ADMIN_REMINDER → [...], CORRECTION_REMINDER → [...] }│
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ enforcement.ts: getEvaluationReminderTemplate(contemplacionId)      │
│ → Returns: "Recordar leer consignas en voz alta" (or undefined)     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ designPlan.ts: buildPerStudentReminders(students)                   │
│ → Returns: StudentReminders[]                                        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Edge Function: passes through as teacherRemindersByStudent          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ EvaluacionesGrupo.tsx: setTeacherReminders(data.teacherRemindersByStudent) │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ TeacherRemindersPanel renders with student names resolved           │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.5 Update Triggers

- **Initial render**: After successful `handleGenerateEvaluations()` response
- **On error**: Cleared to `[]` in catch block
- **On re-generation**: Replaced with new response data

### 6.6 Missing Data Behavior

If `teacherRemindersByStudent` is empty or missing:
- Component renders: "No hay recordatorios específicos para este grupo."
- Console logs: `[EVAL_PIPELINE] No teacher reminders available from backend`

---

## 7. Section D: "¿A quién contempla esta versión?" (Assignments)

### 7.1 Component Details

| Aspect | Value |
|--------|-------|
| **Component** | `EvaluationAssignmentsPanel` |
| **File** | [src/components/evaluaciones/EvaluationAssignmentsPanel.tsx](../../src/components/evaluaciones/EvaluationAssignmentsPanel.tsx) |
| **Props** | `assignments: Record<string, 'A'|'B'|'C'>`, `students: Array<{id, name}>` |

### 7.2 Assignment Algorithm

The assignment algorithm runs in `buildEvaluationDesignPlan()`:

```typescript
// Step 1: Default all students to Version A
for (const student of students) {
  assignmentByStudentId[student.studentId] = 'A';
}

// Step 2: If Version B triggered, reassign qualifying students
if (versionBTriggered) {
  // Students with ≥2 STRUCTURE_NEED_CONTEMPLACIONES
  for (const student of qualifyingStudents) {
    assignmentByStudentId[student.studentId] = 'B';
  }
}

// Step 3: If Version C triggered, reassign content adaptation students (overrides B)
if (versionCTriggered) {
  for (const studentId of contentAdaptationStudentIds) {
    assignmentByStudentId[studentId] = 'C';
  }
}
```

### 7.3 Version Triggering Rules

| Version | Trigger Condition | Priority |
|---------|-------------------|----------|
| **A (Universal)** | Always generated | Lowest (default) |
| **B (Equivalente)** | `highStructureNeed.percent >= 30` AND `designComplexityCount >= 6` | Medium |
| **C (Adecuación)** | Any student has `hasDeclaredContentAdaptation === true` | Highest (overrides B) |

### 7.4 STRUCTURE_NEED_CONTEMPLACIONES

Students qualify for Version B if they have ≥2 of these contemplaciones:
- `contemplacion-13`: Modelos y plantillas de respuesta
- `contemplacion-23`: Respuestas estructuradas
- `contemplacion-5`: Segmentación de consignas
- `contemplacion-19`: Fragmentación de textos

### 7.5 Frontend Normalization

After receiving backend response, frontend normalizes assignments:

```typescript
// EvaluacionesGrupo.tsx lines 1180-1200
const normalizeAssignments = (assignments, bundle) => {
  const available = {
    A: true,
    B: Boolean(bundle?.versions?.B),
    C: Boolean(bundle?.versions?.C)
  };
  
  // If assigned version wasn't generated, fallback to A
  Object.entries(assignments).forEach(([studentId, version]) => {
    if (!available[version]) {
      normalized[studentId] = 'A';
      warnings.push(`Se reasignó ${studentId} a Versión A porque ${version} no fue generada.`);
    }
  });
  
  return { normalized, warnings };
};
```

### 7.6 Terminology Clarification

| Term | Definition | Where Used |
|------|------------|------------|
| **"Contemplated"** | Students whose needs are addressed by a version | UI label: "¿A quién contempla?" |
| **"Assigned"** | Students who will receive a specific version | `studentAssignments` state |
| **"Covered"** | Not used in code | - |

The component `EvaluationAssignmentsPanel` shows the **assignment** (which version each student receives), not which students' needs are "contemplated" by each version. The naming is slightly misleading.

---

## 8. Section E: "Reporte de IA"

### 8.1 Component Details

| Aspect | Value |
|--------|-------|
| **Component** | `AIDesignReport` |
| **File** | [src/components/evaluaciones/AIDesignReport.tsx](../../src/components/evaluaciones/AIDesignReport.tsx) |
| **Props** | `reportData: AIDesignReportData | null`, `className?: string` |

### 8.2 Data Source

The report is **entirely generated by the Edge Function** in `buildUniversalResponse()`:

**File**: [modify-evaluation/index.ts](../../supabase/functions/modify-evaluation/index.ts) lines 2750-2820

```typescript
const aiReport = {
  design_rationale: `${contentsRationale}${competenciesRationale}${contemplacionesRationale}`,
  versions: {
    generated: generatedVersions,  // ['A', 'B'] or ['A', 'B', 'C'] etc.
    reason: versionsRationale,
    count: generatedVersions.length
  },
  contemplaciones: {
    instrument_design: safeInstrumentDesignRules,
    admin_reminders: perStudentReminders.filter(r => r.type === 'admin').map(r => r.text),
    correction_reminders: perStudentReminders.filter(r => r.type === 'correction').map(r => r.text),
    bucketed_ids: bucketedContemplacionIds,
    high_structure_need_percent: highStructureNeed.percent || 0
  },
  response_options: {
    included: responseOptionsInclude,
    optionCount: responseOptionCount,
    rationale: responseOptionsRationale,
    location: responseOptionsInclude ? 'Después de cada consigna...' : 'No aplica'
  },
  vark: {
    summary: `Distribución VARK: Visual=${...}, Auditivo=${...}, ...`,
    distribution: safeVarkDistribution
  },
  assignments: {
    rationale: assignmentsRationale,
    counts: assignmentCounts,
    content_adaptation_student_ids: contentAdaptationStudentIds,
    by_version: assignmentsByVersion,
    total_students: Object.keys(adjustedAssignments).length
  },
  warnings: allWarnings
};
```

### 8.3 Expected Format

The component expects `AIDesignReportData`:

```typescript
interface AIDesignReportData {
  rationale?: string;
  versions?: {
    generated?: string[];
    reason?: string;
    count?: number;
  };
  contemplaciones?: {
    instrument_design?: string[];
    admin_reminders?: string[];
    correction_reminders?: string[];
  };
  response_options?: {
    included?: boolean;
    optionCount?: number;
    rationale?: string;
    location?: string;
  };
  vark?: {
    summary?: string;
  };
  assignments?: {
    rationale?: string;
    counts?: { A?: number; B?: number; C?: number };
    by_version?: { A?: string[]; B?: string[]; C?: string[] };
    total_students?: number;
  };
  warnings?: string[];
  coverageMapping?: Array<{...}>;  // For session → section mapping
  materialsUsage?: Array<{...}>;   // For material usage description
  adaptationNotes?: string;
}
```

### 8.4 Parsing/Sanitization

- **Frontend**: Stores as JSON string in `aiDesignReport` state
- **On render**: Parsed via `JSON.parse(aiDesignReport)` in JSX
- **No HTML sanitization**: Report is plain text/structured data

### 8.5 Persistence

When evaluation is saved:
```typescript
// EvaluacionesGrupo.tsx handleSaveEvaluation
evaluacion_generada: {
  evaluationBundle,
  studentAssignments,
  teacherRemindersByStudent: teacherReminders,
  aiReport: aiDesignReport ? JSON.parse(aiDesignReport) : null
}
```

The report is persisted in the `evaluaciones.evaluacion_generada` JSONB column.

### 8.6 Fallback Behavior

If `aiReport` is missing from response:
- Tries legacy field `aiDesignReport`
- If both missing: sets `aiDesignReport` state to `null`
- Component shows: "El reporte de IA no está disponible para esta evaluación (legacy o generación previa)."

---

## 9. Potential Fragility Points

### 9.1 Prompt-Related

1. **Delimiter extraction fragility**: If AI generates malformed delimiters or includes them inside content, extraction fails. The retry system mitigates but doesn't guarantee success.

2. **Model version dependency**: The prompt explicitly references `gpt-4.1-2025-04-14`. Model behavior changes could break delimiter adherence.

3. **JSON wrapper leakage**: Despite explicit instructions, the model sometimes returns JSON wrappers (`{"versions": {...}}`). Multiple extraction fallbacks exist but add complexity.

4. **Response truncation**: If `max_completion_tokens: 6000` is insufficient for complex multi-version evaluations, content may be cut off.

### 9.2 Student Data

5. **Student ID normalization**: IDs can be string or number. Multiple normalization calls (`normalizeStudentId()`, `String()`) throughout the pipeline. Inconsistent handling could cause mismatches.

6. **Mock data dependency**: Students come from `mockData.ts`, not Supabase. If mock data structure changes or is removed, the entire flow breaks.

7. **localStorage key migration**: Legacy keys (`contemplacionesClase:`, `contemplacionesEval:`) require automatic migration. If migration fails silently, contemplaciones may appear empty.

### 9.3 Version Assignment

8. **Version generation vs assignment mismatch**: Frontend assigns students to versions before knowing if those versions were actually generated. Normalization catches this but generates warnings.

9. **Content adaptation flag inconsistency**: Four different field names checked for content adaptation (`hasDeclaredContentAdaptation`, `requiereAdecuacionContenido`, `requiresContentAdaptation`, `informeTecnico.requiereAdecuacionContenido`). Any typo or missing field could skip a student.

10. **Version B drop logic**: If `assignmentCounts.B === 0` AND `triggers.versionB === false`, Version B is silently dropped. Students might be reassigned without clear feedback.

### 9.4 UI Containers

11. **Teacher reminders empty state**: If `buildPerStudentReminders()` returns empty arrays for all students (no contemplaciones selected), the panel shows "No hay recordatorios" which might confuse users who expected reminders.

12. **AI report JSON parsing**: `aiDesignReport` is stored as JSON string and parsed on render. If backend sends malformed JSON, the parse could fail and crash the component.

13. **Evaluation card visibility logic**: Cards are shown based on `finalAssignmentCounts` from backend. If this field is missing or incorrect, cards may be hidden even when versions exist.

### 9.5 Data Flow

14. **Race condition on rapid re-generation**: If user clicks "Generate" twice quickly, `requestInProgress` flag should prevent double calls, but state updates from first call might interfere with second.

15. **Supabase session expiry**: If auth session expires during generation, the Edge Function call fails with 401/403 but error handling may not clearly indicate the cause.

16. **Large payload size**: With 10 students, each having multiple contemplaciones, and session digests with extracted PDF text, the request payload can become large. No explicit size limit validation exists.

---

*This document provides a complete trace of the AI prompt construction, student characteristic transmission, and UI container population in the Group Evaluations flow. For implementation changes, refer to the specific file paths and function names cited throughout.*
