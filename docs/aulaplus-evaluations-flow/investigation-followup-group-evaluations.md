# Investigación Técnica: Flujo de Evaluaciones Grupales

> **Objetivo**: Documentación exhaustiva del flujo "Evaluaciones Grupo" (`/evaluaciones/nuevo`)
> 
> **Fecha**: 2025-01-XX  
> **Archivo Principal**: `src/pages/EvaluacionesGrupo.tsx` (2,683 LOC)

---

## 1. Route & Entrypoint

| Aspecto | Valor |
|---------|-------|
| **Route** | `/evaluaciones/nuevo` |
| **Componente** | `EvaluacionesGrupo` |
| **Archivo** | [src/pages/EvaluacionesGrupo.tsx](../src/pages/EvaluacionesGrupo.tsx) |
| **LOC** | 2,683 líneas (monolítico, candidato a refactor) |
| **Layout** | Dentro de `AppLayout` (sidebar + breadcrumbs) |

**Propósito**: Generación de evaluaciones con IA para grupos escolares, con soporte para versiones A/B/C basadas en contemplaciones y adecuaciones.

---

## 2. Component Tree & Responsibilities

```
EvaluacionesGrupo (page - 2,683 LOC)
├── ErrorBoundary (wrapper)
├── Card [Selector de Grupo/Materia]
│   ├── Select (grupo)
│   ├── Select (materia) OR Checkbox[] (interdisciplinaria)
│   ├── EvaluationSourceSelector (planificaciones + sesiones)
│   ├── EvaluationMaterialsSection (materiales docente)
│   ├── TimeBudgetingSection (duración)
│   ├── Competencias/Criterios selectors (collapsibles)
│   └── Button [Generar Evaluaciones]
├── Tabs [results]
│   └── TabsContent
│       ├── Button [Guardar evaluación]
│       ├── EvaluationAssignmentsPanel (asignaciones A/B/C)
│       ├── TeacherRemindersPanel (recordatorios por estudiante)
│       ├── EvaluacionVisualRenderer[] (tarjetas de evaluación)
│       └── AIDesignReport (reporte IA)
└── Dialog [Save Evaluation]
```

### Componentes Clave (Subcomponentes)

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| `EvaluationSourceSelector` | [src/components/evaluaciones/EvaluationSourceSelector.tsx](../src/components/evaluaciones/EvaluationSourceSelector.tsx) | Selección de planificación guardada y sesiones como fuente |
| `EvaluationMaterialsSection` | [src/components/evaluaciones/EvaluationMaterialsSection.tsx](../src/components/evaluaciones/EvaluationMaterialsSection.tsx) | Materiales docente (PDFs) con focus text |
| `TimeBudgetingSection` | [src/components/evaluaciones/TimeBudgetingSection.tsx](../src/components/evaluaciones/TimeBudgetingSection.tsx) | Duración objetivo (60-120 min) |
| `EvaluacionVisualRenderer` | [src/components/evaluaciones/EvaluacionVisualRenderer.tsx](../src/components/evaluaciones/EvaluacionVisualRenderer.tsx) | Renderiza tarjeta de evaluación con feedback |
| `EvaluationAssignmentsPanel` | [src/components/evaluaciones/EvaluationAssignmentsPanel.tsx](../src/components/evaluaciones/EvaluationAssignmentsPanel.tsx) | Muestra qué versión corresponde a cada estudiante |
| `TeacherRemindersPanel` | [src/components/evaluaciones/TeacherRemindersPanel.tsx](../src/components/evaluaciones/TeacherRemindersPanel.tsx) | Recordatorios docente por estudiante |
| `AIDesignReport` | [src/components/evaluaciones/AIDesignReport.tsx](../src/components/evaluaciones/AIDesignReport.tsx) | Reporte de decisiones de la IA |

---

## 3. Full Query Inventory

### 3.1 Supabase Queries (Database)

| Query | Tabla | Filtros | Ubicación | Propósito |
|-------|-------|---------|-----------|-----------|
| `SELECT *` | `planificaciones` | `is_saved=true`, `deleted_at IS NULL` | `EvaluationSourceSelector.tsx:55-65` | Cargar planificaciones guardadas del usuario |
| `SELECT *` | `sesiones_clase` | `planificacion_id=X`, `ORDER BY orden` | `EvaluationSourceSelector.tsx:95-105` | Cargar sesiones de planificación seleccionada |
| `SELECT teacher_sugerencias` | `grupos` | `id=X`, `user_id=auth.uid()` | `provider.ts:305-330` | Cargar sugerencias docente para el grupo |
| `INSERT INTO` | `evaluaciones` | - | `EvaluacionesGrupo.tsx:580-650` | Guardar evaluación generada |

### 3.2 localStorage Reads

| Key Pattern | Datos | Ubicación | Propósito |
|-------------|-------|-----------|-----------|
| `contemplaciones_clase_${studentId}` | `string[]` | `storage.ts:50-55` | IDs de contemplaciones para clase |
| `contemplaciones_evaluaciones_${studentId}` | `string[]` | `storage.ts:50-55` | IDs de contemplaciones para evaluaciones |
| `contemplaciones_custom_clase_${studentId}` | `CustomContemplacion[]` | `storage.ts:65-70` | Contemplaciones personalizadas clase |
| `contemplaciones_custom_evaluaciones_${studentId}` | `CustomContemplacion[]` | `storage.ts:65-70` | Contemplaciones personalizadas evaluaciones |
| `adecuacionContenido:${studentId}` | `boolean` | `provider.ts:175-185` | Flag de adecuación de contenido |

### 3.3 Mock Data Reads

| Fuente | Datos | Ubicación | Propósito |
|--------|-------|-----------|-----------|
| `mockGroups` | `Group[]` | `mockData.ts` → `provider.ts:350-360` | Lista de grupos y estudiantes |
| `resolveMockGroup(grupoId)` | `Group \| null` | `utils/resolveMockGroup.ts` | Resolver grupo por ID |

### 3.4 Edge Function Invocations

| Endpoint | Método | Trigger | Payload Key | Response |
|----------|--------|---------|-------------|----------|
| `modify-evaluation` | `POST` | `handleGenerateEvaluations()` | `generation_mode='universal'`, `evaluation_design_plan` | `evaluationBundle`, `studentAssignments`, `aiReport` |
| `modify-evaluation` | `POST` | `handleFeedback()` | `type='modification'`, `modification` | `content` modificado |
| `modify-evaluation` | `POST` | `handleRegenerate()` | `type='modification'` | `content` regenerado |

---

## 4. Data Persistence Model (Supabase)

### Tabla: `evaluaciones`

```sql
CREATE TABLE evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core identification
  nombre text DEFAULT '',
  materia text NOT NULL,
  grupo_id text NOT NULL,
  nivel text,
  fecha date,
  
  -- Competencies tracking
  competencias_anep text[] DEFAULT '{}',
  
  -- Explicit save pattern
  is_saved boolean DEFAULT false,
  saved_at timestamptz,
  deleted_at timestamptz,  -- Soft delete
  
  -- Evaluation payload
  contenidos text[] DEFAULT '{}',
  criterios_logro text[] DEFAULT '{}',
  requerimientos text,
  evaluacion_generada jsonb,  -- ← Contiene evaluationBundle completo
  rubrica jsonb,
  configuracion jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Índices Clave**:
- `idx_evaluaciones_user_saved` → Filtro por `user_id, is_saved, deleted_at`
- `idx_evaluaciones_filters` → Filtro por `materia, grupo_id, fecha`
- `idx_evaluaciones_competencias` → GIN index en `competencias_anep`

**RLS Policy**: `auth.uid() = user_id` (aislamiento por usuario)

### Estructura de `evaluacion_generada` (JSONB)

```typescript
interface EvaluacionGenerada {
  evaluationBundle: {
    versions: {
      A: string;  // HTML de versión universal
      B: string | null;  // HTML de versión equivalente
      C: string | null;  // HTML de versión adecuación
    };
    baseHtml: string;  // Legacy: alias de versions.A
    versionBHtml: string | null;  // Legacy
    versionCHtml: string | null;  // Legacy
    responseOptionsIncluded: boolean;
    responseOptionCount: number;
    finalAssignmentCounts: { A: number; B: number; C: number };
  };
  studentAssignments: Record<string, 'A' | 'B' | 'C'>;
  teacherRemindersByStudent: StudentReminders[];
  aiReport: AIDesignReportData;
}
```

---

## 5. A/B/C Versions Logic (MANDATORY)

### 5.1 Overview

El sistema genera **hasta 3 versiones** de evaluación:
- **Versión A (Universal)**: Siempre generada, base para todos los estudiantes
- **Versión B (Equivalente)**: Misma evidencia, formato diferente (estructura mejorada)
- **Versión C (Adecuación)**: Contenido simplificado para estudiantes con declaración explícita

### 5.2 Trigger Determinístico

El cálculo de triggers ocurre en `buildEvaluationDesignPlan()` ([designPlan.ts](../src/services/evaluations/designPlan.ts)):

```typescript
// Versión B se activa si:
// 1. ≥30% de estudiantes califican para "alta estructura"
// 2. AND complejidad de diseño ≥ 6 contemplaciones INSTRUMENT_DESIGN
const versionBTriggered = highStructureTrigger && complexityTrigger;

// Versión C se activa si:
// 1. Algún estudiante tiene hasDeclaredContentAdaptation === true
const versionCTriggered = contentAdaptationStudentIds.length > 0;
```

### 5.3 Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND: EvaluacionesGrupo.tsx                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. getGroupContextForAI(grupoId, {purpose:'evaluation'})          │
│     ↓                                                               │
│     Carga estudiantes + contemplaciones + adecuaciones             │
│                                                                     │
│  2. buildEvaluationDesignPlan({groupContext, teacherRequirements}) │
│     ↓                                                               │
│     Calcula triggers, assignments, reminders                        │
│     Returns: {                                                      │
│       triggers: { versionB: bool, versionC: bool }                 │
│       assignmentByStudentId: Record<studentId, 'A'|'B'|'C'>        │
│       perStudentReminders: StudentReminders[]                       │
│     }                                                               │
│                                                                     │
│  3. supabase.functions.invoke('modify-evaluation', {               │
│       generation_mode: 'universal',                                │
│       evaluation_design_plan: designPlan,                          │
│       groupContext                                                 │
│     })                                                              │
│     ↓                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND: modify-evaluation Edge Function (3,533 LOC)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  4. Construye system prompt con:                                   │
│     - Versiones requeridas (A siempre, B/C según triggers)         │
│     - DELIMITER_SUFFIX único para extraction                       │
│     - Reglas de instrumentos desde contemplaciones                 │
│                                                                     │
│  5. Llama OpenAI (gpt-4o) con retry + repair logic                │
│     ↓                                                               │
│     Output esperado:                                                │
│     <<<A_EVAL_HTML_START_8f3a7b>>>..<<<A_EVAL_HTML_END_8f3a7b>>>   │
│     <<<B_EVAL_HTML_START_8f3a7b>>>..<<<B_EVAL_HTML_END_8f3a7b>>>   │
│     <<<C_EVAL_HTML_START_8f3a7b>>>..<<<C_EVAL_HTML_END_8f3a7b>>>   │
│                                                                     │
│  6. extractVersions() + normalizeHtmlFragment()                    │
│     ↓                                                               │
│     Limpia wrappers JSON, tags prohibidos (<head>, <style>)        │
│                                                                     │
│  7. buildUniversalResponse()                                       │
│     Returns: {                                                      │
│       evaluationBundle: { versions: {A,B,C}, ... },                │
│       studentAssignments,                                          │
│       aiReport                                                     │
│     }                                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND: Procesamiento de Respuesta                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  8. setEvaluationBundle(response.evaluationBundle)                 │
│  9. setStudentAssignments(response.studentAssignments)             │
│  10. setTeacherReminders(response.teacherRemindersByStudent)       │
│  11. setAiDesignReport(response.aiReport)                          │
│                                                                     │
│  12. displayEvaluations (useMemo) construye tarjetas:              │
│      - CardA: siempre visible                                      │
│      - CardB: visible si assignmentCounts.B > 0                    │
│      - CardC: visible si assignmentCounts.C > 0                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Contemplaciones que Califican para "Alta Estructura"

```typescript
const STRUCTURE_NEED_CONTEMPLACIONES = new Set([
  'contemplacion-13', // Modelos y plantillas de respuesta
  'contemplacion-23', // Respuestas estructuradas
  'contemplacion-5',  // Segmentación de consignas
  'contemplacion-19'  // Fragmentación de textos
]);

// Estudiante califica si tiene ≥2 de estas contemplaciones
const qualifyingStudents = students.filter(student => {
  const count = student.contemplacionesEvaluaciones
    .filter(id => STRUCTURE_NEED_CONTEMPLACIONES.has(id)).length;
  return count >= 2;
});
```

### 5.5 Detección de Adecuación de Contenido

```typescript
// provider.ts:225-250
const contentAdaptationStudentIds = students
  .filter(student => {
    return (
      student.hasDeclaredContentAdaptation === true ||
      student.requiereAdecuacionContenido === true ||
      student.requiresContentAdaptation === true ||
      student.informeTecnico?.requiereAdecuacionContenido === true
    );
  })
  .map(student => String(student.studentId));
```

---

## 6. Contemplaciones Integration (MANDATORY)

### 6.1 Catálogo de Contemplaciones

**Archivo**: [src/lib/contemplaciones/catalog.ts](../src/lib/contemplaciones/catalog.ts)

El catálogo define 26 contemplaciones (1-26), unificando #9 y #22:

| ID | Etiqueta | Categoría | Materialización Evaluación |
|----|----------|-----------|---------------------------|
| `contemplacion-1` | Lectura oral de consignas | evaluaciones | Recordatorio docente |
| `contemplacion-2` | Palabras clave en negrita | ambas | Diseño cuadernillo |
| `contemplacion-3` | Tiempo adicional y pausas | evaluaciones | Recordatorio docente |
| `contemplacion-5` | Segmentación de consignas | evaluaciones | Diseño cuadernillo |
| `contemplacion-9-22` | Corrección centrada en contenido | evaluaciones | Regla corrección |
| `contemplacion-13` | Plantillas de respuesta | evaluaciones | Diseño cuadernillo |
| ... | ... | ... | ... |

### 6.2 Buckets de Materialización

**Archivo**: [src/lib/contemplaciones/mapping.ts](../src/lib/contemplaciones/mapping.ts)

```typescript
type ContemplacionBucket =
  | 'INSTRUMENT_DESIGN'       // → Reglas de diseño para cuadernillo
  | 'ADMIN_REMINDER'          // → Recordatorios administración
  | 'CORRECTION_REMINDER'     // → Recordatorios corrección
  | 'CONTENT_ADAPTATION_EXCEPTION';
```

### 6.3 Flujo de Lectura

```
localStorage
    │
    ▼
readSelected(studentId, 'evaluaciones')
    │
    ▼
Returns: string[] (IDs normalizados)
    │
    ▼
mapSelectedContemplacionesToBuckets(ids)
    │
    ▼
Map<ContemplacionBucket, string[]>
    │
    ▼
Usado en buildEvaluationDesignPlan()
```

### 6.4 Enforcement (Output Determinístico)

**Archivo**: [src/lib/contemplaciones/enforcement.ts](../src/lib/contemplaciones/enforcement.ts)

El módulo genera outputs **determinísticos** (sin depender del LLM):

```typescript
// Recordatorios por estudiante (para TeacherRemindersPanel)
const EVALUATION_REMINDER_TEMPLATES: Record<string, string> = {
  'contemplacion-1': 'Recordar leer consignas en voz alta',
  'contemplacion-3': 'Recuerda brindar más tiempo y pausas...',
  'contemplacion-6': 'Permitir hoja auxiliar / borrador',
  // ...
};

// Reglas de diseño (para prompt del LLM)
const EVALUATION_DESIGN_RULES: Record<string, string> = {
  'contemplacion-2': 'Palabras clave en negrita e íconos de apoyo',
  'contemplacion-5': 'Consignas en 2 capas (producto + pasos numerados)',
  'contemplacion-13': 'Plantillas de respuesta (tabla/matriz/guía)...',
  // ...
};
```

---

## 7. AI/Generation Contracts

### 7.1 Request Contract (Frontend → Edge Function)

```typescript
interface ModifyEvaluationRequest {
  type: 'modification';
  generation_mode: 'universal';
  
  // Contexto del grupo
  groupContext: {
    groupId: string;
    students: StudentForAI[];
    subject: string;
    content: string[];
    competencies: string[];
    criteriosLogro: string[];
  };
  
  // Plan de diseño (determinístico)
  evaluation_design_plan: {
    triggers: { versionB: boolean; versionC: boolean };
    assignmentByStudentId: Record<string, 'A'|'B'|'C'>;
    responseOptions: { include: boolean; optionCount: 1|2|3 };
    instrumentDesignContemplacionIds: string[];
    perStudentReminders: StudentReminders[];
    highStructureNeed: { percent: number; qualifyingStudentIds: string[] };
    varkDistribution: { visual: number; auditory: number; ... };
  };
  
  // Opcional: feedback para modificación
  modification?: string;
}
```

### 7.2 Response Contract (Edge Function → Frontend)

```typescript
interface ModifyEvaluationResponse {
  success: boolean;
  content: string;  // Legacy: HTML de versión A
  type: 'modification';
  
  evaluationBundle: {
    versions: {
      A: string;  // HTML limpio (sin <head>, <style>)
      B: string | null;
      C: string | null;
    };
    baseHtml: string;  // Alias versions.A
    versionBHtml: string | null;
    versionCHtml: string | null;
    responseOptionsIncluded: boolean;
    responseOptionCount: number;
    finalAssignmentCounts: { A: number; B: number; C: number };
  };
  
  studentAssignments: Record<string, 'A'|'B'|'C'>;
  teacherRemindersByStudent: StudentReminders[];
  aiReport: AIDesignReportData;
  warnings: string[];
  
  metadata: {
    tokensUsed: number;
    model: string;
  };
  
  _debug: {
    generationPath: 'universal' | 'universal_parse_failed';
    triggers: { versionB: boolean; versionC: boolean };
    // ... diagnósticos
  };
}
```

### 7.3 System Prompt Structure

El Edge Function construye un system prompt con:

1. **Reglas críticas** (no negociables):
   - Evidencia siempre escrita
   - No inferir diagnósticos
   - CE/CL definidos por docente
   - Prohibido `<html>`, `<head>`, `<body>`, `<style>`, JSON

2. **Reglas de diseño** (desde contemplaciones INSTRUMENT_DESIGN):
   - Plantillas de respuesta
   - Consignas segmentadas
   - Tipografía legible
   - etc.

3. **Formato de salida** (delimitadores únicos):
   ```
   <<<A_EVAL_HTML_START_8f3a7b>>>
   <div class="evaluation">...</div>
   <<<A_EVAL_HTML_END_8f3a7b>>>
   ```

---

## 8. Output/Export Flow

### 8.1 Save to Database

```typescript
// EvaluacionesGrupo.tsx:580-650
const handleSaveEvaluation = async () => {
  const { data, error } = await supabase
    .from('evaluaciones')
    .insert({
      user_id: user.id,
      nombre: nombreEvaluacion,
      materia: esInterdisciplinaria ? materiasSeleccionadas.join(', ') : materia,
      grupo_id: selectedGroupId,
      is_saved: true,
      saved_at: new Date().toISOString(),
      competencias_anep: selectedCompetenciasIds,
      contenidos: selectedSubtemas,
      criterios_logro: selectedCriteriosLogro,
      requerimientos,
      evaluacion_generada: {
        evaluationBundle,
        studentAssignments,
        teacherRemindersByStudent: teacherReminders,
        aiReport: aiDesignReport ? JSON.parse(aiDesignReport) : null
      }
    });
};
```

### 8.2 Export PDF (Not Implemented in EvaluacionesGrupo)

El flujo de exportación PDF existe en `MisEvaluaciones.tsx` y `EvaluacionVisualRenderer.tsx` usando:
- `jspdf` (4.1.0)
- `html2canvas` (1.4.1)

**Nota**: El botón de exportar PDF no está presente en la página de generación.

---

## 9. Stabilization Opportunities (Max 8)

### 9.1 🔴 CRÍTICO: Monolito de 2,683 LOC

**Problema**: `EvaluacionesGrupo.tsx` es extremadamente grande y difícil de mantener.

**Recomendación**: Extraer en módulos:
```
EvaluacionesGrupo/
├── index.tsx (orchestrator, <500 LOC)
├── hooks/
│   ├── useEvaluationGeneration.ts
│   ├── useGroupContext.ts
│   └── useEvaluationSave.ts
├── components/
│   ├── GroupMateriaSelector.tsx
│   ├── CompetenciasSelector.tsx
│   ├── EvaluationResults.tsx
│   └── SaveDialog.tsx
└── utils/
    └── displayEvaluationsBuilder.ts
```

### 9.2 🔴 CRÍTICO: Edge Function de 3,533 LOC

**Problema**: `modify-evaluation/index.ts` contiene lógica de extracción, validación, y generación mezclada.

**Recomendación**: Modularizar en archivos separados:
- `extractVersions.ts`
- `normalizeHtml.ts`
- `buildPrompt.ts`
- `generateWithRetries.ts`

### 9.3 🟡 ALTO: Estudiantes en mockData (no persistidos)

**Problema**: Estudiantes vienen de `mockData.ts`, no de Supabase. Las contemplaciones se guardan en localStorage pero los estudiantes no existen en la BD.

**Recomendación**: Crear tabla `estudiantes` en Supabase con migración de datos.

### 9.4 🟡 ALTO: Múltiples formatos de extracción en Edge Function

**Problema**: El backend tiene funciones duplicadas:
- `extractVersions()`
- `extractVersionsFromModelOutput()`
- `extractAndNormalizeVersions()`
- `unwrapVersionsPayload()`
- `extractVersionsFromMaybeWrapped()`

**Recomendación**: Consolidar en UNA función canónica con tests exhaustivos.

### 9.5 🟡 MEDIO: Sin tests para lógica de triggers A/B/C

**Problema**: `buildEvaluationDesignPlan()` tiene lógica compleja sin cobertura de tests.

**Recomendación**: Agregar tests unitarios en `src/services/evaluations/__tests__/designPlan.test.ts`.

### 9.6 🟡 MEDIO: Debug panels condicionales sin flag unificado

**Problema**: El código tiene múltiples `showDebugPanel` checks dispersos.

**Recomendación**: Crear hook `useDebugMode()` que centralice la lógica.

### 9.7 🟢 BAJO: localStorage keys inconsistentes

**Problema**: Existen keys legacy (`contemplacionesClase:`, `contemplacionesEval:`) que requieren migración automática.

**Recomendación**: Agregar migración one-time al inicio de la app con cleanup de keys legacy.

### 9.8 🟢 BAJO: Tipos `any` en múltiples lugares

**Problema**: El código usa `any` extensivamente (especialmente en Edge Function).

**Recomendación**: Gradualmente reemplazar con tipos específicos y usar `unknown` + type guards.

---

## 10. Diagrams

### 10.1 Data Flow Overview

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  mockData.ts │────▶│  provider.ts    │────▶│ EvaluacionesGrupo│
│  (estudiantes)│     │ getGroupContext │     │    (page)        │
└──────────────┘     └─────────────────┘     └────────┬─────────┘
                              ▲                       │
┌──────────────┐              │                       │
│ localStorage │──────────────┘                       │
│(contemplaciones)                                    ▼
└──────────────┘                           ┌─────────────────────┐
                                           │ designPlan.ts       │
                                           │ buildEvaluationPlan │
                                           └──────────┬──────────┘
                                                      │
                                                      ▼
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Supabase    │◀────│ modify-evaluation│◀────│  OpenAI GPT-4o  │
│ evaluaciones │     │ Edge Function   │     │  (generation)    │
└──────────────┘     └─────────────────┘     └──────────────────┘
```

### 10.2 A/B/C Version Assignment

```
                    ┌─────────────────────┐
                    │   Todos los        │
                    │   estudiantes      │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
   ┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐
   │ hasDeclared      │  │ qualifica   │  │ resto            │
   │ ContentAdaptation│  │ ≥2 contempl │  │                  │
   │ === true         │  │ estructura  │  │                  │
   └────────┬─────────┘  └──────┬──────┘  └────────┬─────────┘
            │                   │                  │
            │   versionC=true   │  versionB=true   │
            │   (si trigger)    │  (si trigger)    │
            ▼                   ▼                  ▼
      ┌──────────┐        ┌──────────┐       ┌──────────┐
      │ Versión C│        │ Versión B│       │ Versión A│
      │(adecuación)       │(equivalente)     │(universal)
      └──────────┘        └──────────┘       └──────────┘
```

---

## Appendix A: Key Files Reference

| Archivo | LOC | Propósito |
|---------|-----|-----------|
| [EvaluacionesGrupo.tsx](../src/pages/EvaluacionesGrupo.tsx) | 2,683 | Página principal |
| [modify-evaluation/index.ts](../supabase/functions/modify-evaluation/index.ts) | 3,533 | Edge Function |
| [provider.ts](../src/services/groupContext/provider.ts) | 653 | Context provider |
| [designPlan.ts](../src/services/evaluations/designPlan.ts) | 350 | A/B/C logic |
| [catalog.ts](../src/lib/contemplaciones/catalog.ts) | 569 | Contemplaciones |
| [enforcement.ts](../src/lib/contemplaciones/enforcement.ts) | 503 | Enforcement rules |
| [storage.ts](../src/lib/contemplaciones/storage.ts) | 682 | localStorage I/O |

---

## Appendix B: Environment Variables

| Variable | Ubicación | Propósito |
|----------|-----------|-----------|
| `VITE_DEBUG_EVAL_PIPELINE` | `.env` (frontend) | Muestra debug panels |
| `OPENAI_API_KEY` | Supabase Secrets | API key para generación |
| `SERVICE_ROLE_KEY` | Supabase Secrets | Admin operations |

---

*Documento generado como parte de investigación técnica del codebase AulaPlus v0.*
