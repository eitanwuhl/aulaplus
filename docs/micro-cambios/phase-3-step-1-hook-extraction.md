# Phase 3 — Step 1: Hook extraction report

**Rama:** Micro-cambios  
**Fecha:** Paso 1 del refactor de higiene mínima (solo extracción del hook).

---

## Summary of what moved into the hook

- **Estado del pipeline:** `evaluationBundle`, `evaluationDesignPlan`, `generatedEvaluations`, `studentAssignments`, `teacherReminders`, `missingTemplateErrors`, `assignmentWarnings`, `isGenerating`, `generationError`, `v2RawResponse`, `v2SelectedVersion`, `previousV2Response`, `pipelineDebug`. Todo ello vive en `useEvaluationPipeline`; la página solo los consume vía el retorno del hook.

- **Lógica de generación:** La función que antes era el cuerpo de `handleGenerateEvaluations` (validación inicial, construcción de `groupContext`, `effectivePlan`, `modificationText`, `requestBody`, llamada a `modify-evaluation-v2` con fallback a `modify-evaluation`, normalización de asignaciones, comprobación de Version A, actualización de bundle/assignments/reminders/warnings, manejo de errores y toasts) se movió íntegra a `runGeneration()` dentro del hook.

- **Derivación de `displayEvaluations`:** El `useMemo` que construía las tarjetas V1 (A/B/C) a partir de `evaluationBundle` + `studentAssignments` + `getSafeHtml` se movió al hook. Incluye la misma lógica de `getSafeHtml` (detección de wrapper JSON y mensaje de error idéntico), `sid`, asignaciones por versión, `backendFinalCounts` / `shouldShowB` y construcción de las cards.

- **Guards de guardado:** `hasV2Spec`, `hasV1`, `canSave` y `getEvaluationsToSave()` se calculan en el hook con la misma definición que en la página (hasV2Spec: useBetaV2 + spec con al menos una sección con ítems; hasV1: displayEvaluations.length > 0; getEvaluationsToSave: array mínimo para V2 o displayEvaluations para V1).

- **Callbacks de éxito:** El hook recibe `onSuccess` con `setActiveTab`, `setIsConfigCollapsed`, `setAiDesignReport`, `setEstimatedDurationMinutes`, `setTimeBreakdown`; los invoca al finalizar la generación con éxito para mantener el mismo comportamiento de la página (cambio de pestaña, colapso, reporte de IA y tiempos).

---

## New hook API (inputs/outputs)

**Archivo:** `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`

**Inputs (objeto `options`):**  
`groupId`, `group`, `materia`, `esInterdisciplinaria`, `materiasSeleccionadas`, `selectedSubtemas`, `selectedCompetenciasIds`, `selectedCriteriosLogro`, `requerimientos`, `evaluationSourceConfig`, `evaluationMaterialsConfig`, `targetDurationMinutes`, `originalEvaluation` (string del prototipo/base), `useBetaV2`, `onToast`, `debugPanelEnabled`, `onSuccess` (opcional, con setters de tab, collapse, aiReport, estimatedDuration, timeBreakdown).

**Outputs:**  
`status`, `isGenerating`, `generationError`, `runGeneration`, `displayEvaluations`, `evaluationBundle`, `evaluationDesignPlan`, `studentAssignments`, `teacherReminders`, `assignmentWarnings`, `missingTemplateErrors`, `v2RawResponse`, `v2SelectedVersion`, `setV2RawResponse`, `setV2SelectedVersion`, `previousV2Response`, `setPreviousV2Response`, `hasV2Spec`, `hasV1`, `canSave`, `getEvaluationsToSave`, `generatedEvaluations`, `setGeneratedEvaluations`, `pipelineDebug`, `setPipelineDebug`.

---

## List of files changed/created

- **Creados:**  
  - `src/features/evaluaciones/types.ts` — Tipos compartidos: `GeneratedEvaluation`, `EvaluationBundle`, `GenerationErrorState`, `PipelineDebugState`.  
  - `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` — Hook con toda la orquestación del pipeline.

- **Modificados:**  
  - `src/pages/EvaluacionesGrupo.tsx` — Eliminado estado y handler de generación duplicados; eliminado el `useMemo` de `displayEvaluations` y helpers `sid`/`isHtmlString`/`getSafeHtml`; añadido uso de `useEvaluationPipeline` y reemplazo de `handleGenerateEvaluations` por llamada a `runGeneration()`; `handleSaveEvaluation` usa `canSave`, `getEvaluationsToSave()` y datos del hook (sin cambiar lógica de insert ni textos de toasts).

---

## Behavior preservation (what was kept identical)

- **V2 y fallback V2→V1:** Mismo orden: si `useBetaV2`, se llama `modify-evaluation-v2`; si hay error, no hay data o `success === false`, se llama `modify-evaluation` (V1). Mismos mensajes de log y mismo formato de datos sintético cuando V2 tiene éxito.

- **Safe HTML / wrapper JSON:** La función `getSafeHtml` dentro del hook repite la misma condición y el mismo texto de error: `"El backend devolvió un wrapper JSON inválido en versión X."` (y el mismo HTML de error). No se simplificaron condiciones ni mensajes.

- **Normalización de asignaciones:** La función interna `normalizeAssignments` y la prioridad edge vs `effectivePlan.assignmentByStudentId` se mantienen. Los avisos de reasignación conservan el texto `"Se reasignó ${studentId} a Versión A porque ${version} no fue generada."`.

- **Guards de guardado:** En la página, `handleSaveEvaluation` sigue comprobando `canSave` (equivalente a `hasV2Spec || hasV1`) y usa `getEvaluationsToSave()` para el array a persistir. El toast `"No hay evaluaciones generadas para guardar"` se muestra cuando no se puede guardar, igual que antes.

- **Validaciones previas a generar:** El hook replica las mismas validaciones (grupo, materia, interdisciplinaria, al menos uno de: contenidos ANEP, sesiones, materiales) y los mismos toasts de error de validación.

- **Version A crítica y aiReport:** Se mantienen la comprobación de `hasVersionA`, el toast de “Error crítico” cuando falta la versión A, y las comprobaciones de `evaluationBundle` y `aiReport` en modo V1 con los mismos mensajes.

---

## Manual test checklist (recommended)

1. **Generar con V2:** Activar Beta V2, configurar grupo/materia/contenidos, Generar. Comprobar que se llama a V2, se muestran paneles V2 (info, renderer, ajustes) y no tarjetas V1.
2. **Fallback V2→V1:** Con V2 activo, provocar error en V2 (por ejemplo red); comprobar que se usa V1 y se muestran tarjetas A/B/C.
3. **Generar solo V1:** Desactivar V2, generar; comprobar tarjetas, asignaciones y recordatorios docente.
4. **Guardar V2:** Tras resultado V2, Guardar evaluación con nombre; comprobar que se persiste y al reabrir se ve el contenido V2.
5. **Guardar V1:** Tras resultado V1, guardar y reabrir; comprobar que las versiones A/B/C se ven igual.
6. **Guard sin resultado:** Comprobar que no se puede guardar sin generación previa (toast “No hay evaluaciones generadas para guardar” si se intenta).
7. **Recordatorios:** Generar con estudiantes con contemplaciones; comprobar que los recordatorios docente se muestran en V1 (y en V2 donde corresponda).
8. **Panel de debug (opcional):** Con `VITE_DEBUG_EVAL_PIPELINE=true`, generar y comprobar que el panel de pipeline y el de Version Integrity se actualizan.

---

*Implementación completada en Step 1. No se extrajeron componentes UI en este paso.*
