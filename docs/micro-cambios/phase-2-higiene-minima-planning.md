# Phase 2 — Higiene mínima: plan de refactor (solo planificación)

**Rama:** Micro-cambios  
**Objetivo:** Reducir `EvaluacionesGrupo.tsx` (~3000+ líneas) extrayendo un hook de orquestación y 2–3 componentes UI, sin cambiar comportamiento ni contratos.  
**Restricciones:** Sin nuevas dependencias, sin cambios en Edge ni en esquema de BD, sin rediseño de UI.

---

## Executive summary

Se propone un refactor mínimo de higiene en tres ejes:

1. **Un único hook de orquestación** (`useEvaluationPipeline`) que concentre: estado de generación (loading, error, warnings), llamadas a V2/V1 y fallback, normalización de asignaciones y **derivación de “display evaluations”** (incluido el guard `getSafeHtml` para JSON/wrapper). La página deja de tener la lógica del pipeline y solo conecta el hook con la UI.

2. **Dos o tres componentes UI** con props acotadas y tipadas: **(A)** un bloque “Results” que muestre V2 (V2InfoPanels + EvaluationRendererV2 + EvaluationAdjustmentsPanel) o V1 (avisos + asignaciones + recordatorios + lista de EvaluacionVisualRenderer); **(B)** un bloque “Save” (botón Guardar + diálogo + nombre + lógica de guardado con los mismos guards que hoy); **(C)** opcional: panel de recordatorios docente reutilizable (ya existe `TeacherRemindersPanel`, solo asegurar que se use desde Results).

3. **Comportamiento idéntico:** Los guards de guardado (`hasV2Spec` / `hasV1`), la construcción de `evaluationsToSave` (mínimo para V2 o `displayEvaluations` para V1), el `getSafeHtml` y el fallback V2→V1 se mantienen; solo cambia la ubicación del código (hook o componente Save).

**Meta de reducción:** `EvaluacionesGrupo.tsx` por debajo de ~1200 líneas en esta fase (sin tocar formularios de configuración ni catálogos que viven en la misma página).

---

## Proposed folder structure

```
src/
├── features/
│   └── evaluaciones/
│       ├── hooks/
│       │   └── useEvaluationPipeline.ts   (NUEVO)
│       └── components/
│           ├── EvaluationResultsSection.tsx   (NUEVO)
│           ├── SaveEvaluationSection.tsx      (NUEVO)
│           └── (opcional) TeacherRemindersBlock.tsx   (NUEVO, o re-exportar uso de TeacherRemindersPanel)
├── pages/
│   └── EvaluacionesGrupo.tsx   (MODIFICAR: consumir hook + componentes)
└── ... (resto sin cambios)
```

- **`useEvaluationPipeline.ts`:** Hook que contiene toda la orquestación del pipeline (estado, request, fallback, normalización, `displayEvaluations` con safe HTML).
- **`EvaluationResultsSection.tsx`:** Componente que recibe el resultado del pipeline y muestra o bien la UI V2 (paneles + renderer V2 + ajustes) o bien la UI V1 (avisos, asignaciones, recordatorios, tarjetas).
- **`SaveEvaluationSection.tsx`:** Componente que renderiza el botón “Guardar evaluación”, el diálogo con nombre y los botones Cancelar/Guardar; recibe callbacks y flags para no duplicar lógica de guard (guards y construcción de payload se mantienen, ya sea en el hook o en el componente según se detalle abajo).

No se crean nuevas carpetas fuera de `src/features/evaluaciones/` para este refactor.

---

## Hook API proposal: `useEvaluationPipeline`

### Input parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.groupId` | `string` | selectedGroupId (grupo seleccionado). |
| `options.group` | `Group \| undefined` | selectedGroup (objeto grupo de mockData). |
| `options.materia` | `Materia \| ""` | Materia seleccionada (V1 no interdisciplinaria). |
| `options.esInterdisciplinaria` | `boolean` | Si es evaluación interdisciplinaria. |
| `options.materiasSeleccionadas` | `Materia[]` | Materias (cuando es interdisciplinaria). |
| `options.selectedSubtemas` | `string[]` | IDs de contenidos/subtemas. |
| `options.selectedCompetenciasIds` | `string[]` | IDs de competencias. |
| `options.selectedCriteriosLogro` | `string[]` | IDs de criterios de logro. |
| `options.requerimientos` | `string` | Texto de requerimientos del docente. |
| `options.evaluationSourceConfig` | `{ planificacionId?: string; sessionIds: string[]; evaluationFocus: string }` | Fuente sesiones/enfoque. |
| `options.evaluationMaterialsConfig` | `{ directMaterialIds: string[]; includeSessionMaterials: boolean }` | Materiales vinculados. |
| `options.targetDurationMinutes` | `number` | Duración objetivo (para design plan). |
| `options.instrumentDesignRules` | `string[]` | Reglas de diseño (del diseño efectivo). |
| `options.effectiveDesignPlan` | `EvaluationDesignPlan \| null` | Plan de diseño efectivo (instrumentDesignRules, responseOptions, triggers, assignmentByStudentId, perStudentReminders, etc.). |
| `options.basePrototype` | `string` | Prototipo base para el body de V1. |
| `options.useBetaV2` | `boolean` | Si se usa el endpoint V2 (beta). |
| `options.onBetaV2Change` | `(value: boolean) => void` | Callback para sincronizar toggle (o el hook puede leer getBetaToggleState y no recibirlo). |
| `options.onToast` | `(params: { title: string; description?: string; variant?: ... }) => void` | Para toasts (errores, avisos de fallback, etc.). |
| `options.debugPanelEnabled` | `boolean` | Ej. `import.meta.env.VITE_DEBUG_EVAL_PIPELINE === 'true'`. |

Todos los inputs que hoy la página usa para construir `groupContext`, `evaluation_design_plan`, `requestBody` y para validaciones pre-generación deben poder derivarse de estos parámetros (o pasarse ya derivados).

### Returned value (shape)

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'idle' \| 'generating' \| 'success' \| 'error'` | Estado del pipeline. |
| `isGenerating` | `boolean` | true mientras corre la generación. |
| `generationError` | `{ message: string; details?: string; show: boolean } \| null` | Error visible (cuando status === 'error' o show). |
| `runGeneration` | `() => Promise<void>` | Dispara generación (V2 si useBetaV2, si falla llama V1). |
| `// --- Resultado normalizado para UI ---` | | |
| `displayEvaluations` | `GeneratedEvaluation[]` | Tarjetas V1 (derivadas de evaluationBundle + getSafeHtml + studentAssignments). Vacío en modo V2 puro; el render V2 no las usa. |
| `evaluationBundle` | `EvaluationBundle \| null` | Bundle crudo (versions.A/B/C, etc.) después del pipeline. |
| `evaluationDesignPlan` | `EvaluationDesignPlan \| null` | Plan efectivo usado (se actualiza tras generación). |
| `studentAssignments` | `Record<string, 'A' \| 'B' \| 'C'>` | Asignación estudiante → versión. |
| `teacherReminders` | `StudentReminders[]` | Recordatorios por estudiante. |
| `assignmentWarnings` | `string[]` | Avisos de reasignación (ej. “Se reasignó X a A”). |
| `missingTemplateErrors` | `MissingTemplateError[]` | Errores de plantillas faltantes. |
| `v2RawResponse` | `V2Response \| null` | Respuesta cruda V2 (para renderer e info panels). |
| `v2SelectedVersion` | `'A' \| 'B' \| 'C'` | Versión seleccionada en UI V2. |
| `setV2RawResponse` | `(r: V2Response \| null) => void` | Para ajustes y fallback en render. |
| `setV2SelectedVersion` | `(v: 'A' \| 'B' \| 'C') => void` | Cambio de pestaña versión. |
| `previousV2Response` | `V2Response \| null` | Para undo en panel de ajustes. |
| `setPreviousV2Response` | `(r: V2Response \| null) => void` | Para ajustes. |
| `// --- Save (guards y payload) ---` | | |
| `hasV2Spec` | `boolean` | `useBetaV2 && v2RawResponse?.evaluationSpec && sections?.some(s => s.items?.length)`. |
| `hasV1` | `boolean` | `displayEvaluations.length > 0`. |
| `canSave` | `boolean` | `hasV2Spec \|\| hasV1`. |
| `getEvaluationsToSave` | `() => Array<...>` | Devuelve el array a persistir en `evaluacion_generada.evaluaciones` (mínimo para V2, o displayEvaluations para V1). Misma lógica que hoy en el page. |
| `// --- Debug ---` | | |
| `pipelineDebug` | `{ lastRequest?: ...; lastResponse?: ... }` | Solo si debugPanelEnabled. |
| `setPipelineDebug` | `(prev => next) => void` | Para actualizar debug tras request/response. |

El hook **no** realiza el insert a Supabase; eso sigue en la página o en un callback que recibe el payload (por ejemplo `SaveEvaluationSection` llama a `onSave(payload)` y la página hace el insert). Así se evita acoplar el hook a Supabase y se mantiene un solo lugar para “guardar evaluación”.

Resumen de responsabilidades del hook:

- Construir `groupContext` y `evaluation_design_plan` a partir de `options`.
- Ejecutar `runGeneration`: si `useBetaV2`, llamar `invokeEdgeFunctionAuthed('modify-evaluation-v2', ...)`; si falla o no hay data, llamar `invokeEdgeFunctionAuthed('modify-evaluation', ...)`.
- Tras respuesta: normalizar asignaciones (normalizeAssignments), comprobar hasVersionA / isV2Mode, actualizar estado (evaluationBundle, generatedEvaluations, studentAssignments, teacherReminders, assignmentWarnings, v2RawResponse, etc.).
- Derivar `displayEvaluations` en un useMemo interno con la **misma** lógica actual: evaluationBundle + studentAssignments + getSafeHtml (trimmed.startsWith('{') → error HTML; trimmed.startsWith('<') → HTML). No cambiar condiciones ni mensajes.
- Exponer hasV2Spec, hasV1, getEvaluationsToSave con la misma definición que hoy (hasV2Spec: useBetaV2 && spec con al menos una sección con ítems; hasV1: displayEvaluations.length > 0; getEvaluationsToSave: si hasV2Spec construir array mínimo de una evaluación, si no usar displayEvaluations).

---

## Component extraction list (2–3 max)

### 1. `EvaluationResultsSection` (obligatorio)

- **Ubicación:** `src/features/evaluaciones/components/EvaluationResultsSection.tsx`
- **Responsabilidad:** Mostrar el resultado de la generación: o bien UI V2 (V2InfoPanels + EvaluationRendererV2 + EvaluationAdjustmentsPanel) o bien UI V1 (card de assignment warnings, EvaluationAssignmentsPanel, TeacherRemindersPanel, lista de EvaluacionVisualRenderer). No decide si hay resultado; eso lo hace el padre (mostrar sección si `displayEvaluations.length > 0 || (useBetaV2 && v2RawResponse)`).
- **Props (mínimas y tipadas):**
  - `useBetaV2: boolean`
  - `v2RawResponse: V2Response | null`
  - `v2SelectedVersion: 'A' | 'B' | 'C'`
  - `onV2VersionChange: (v: 'A' | 'B' | 'C') => void`
  - `onV2ResponseChange: (r: V2Response) => void`
  - `displayEvaluations: GeneratedEvaluation[]`
  - `studentAssignments: Record<string, 'A' | 'B' | 'C'>`
  - `teacherReminders: StudentReminders[]`
  - `assignmentWarnings: string[]`
  - `missingTemplateErrors: MissingTemplateError[]`
  - `students: Student[]` (selectedGroup.students)
  - `evaluationDesignPlan: EvaluationDesignPlan | null`
  - `isGenerating: boolean`
  - `showDebug: boolean`
  - `teacherName: string | null`
  - `subjectDisplay: string` (materia o materias para labels)
  - `previousV2Response: V2Response | null`
  - `onAdjustmentApplied: (newR: V2Response, prev: V2Response) => void`
  - `onUndo: () => void`
  - `onPointsWarning: (msg: string) => void`
  - `onRenderError: (reason: string) => void`
- **Comportamiento:** Mismo JSX que hoy para la pestaña “results”: condicional `useBetaV2 && v2RawResponse` → bloque V2; else → bloque V1. Incluye los paneles de debug (Version Integrity, etc.) si showDebug. Sin lógica de negocio nueva; solo composición.

### 2. `SaveEvaluationSection` (obligatorio)

- **Ubicación:** `src/features/evaluaciones/components/SaveEvaluationSection.tsx`
- **Responsabilidad:** Botón “Guardar evaluación”, diálogo con input de nombre y botones Cancelar/Guardar; deshabilitar Guardar cuando !nombre.trim() o isSaving; al confirmar, llamar `onSaveRequest({ nombre, evaluationsToSave, ... })` con el payload que la página o el hook construyen. **No** contiene la lógica de guards “hasV2Spec / hasV1” en la UI del botón: el padre solo muestra el botón cuando hay resultado (ya sea V2 o V1); el guard “no guardar si !canSave” se aplica en el callback (si canSave es false, onSaveRequest no se llama o el padre lo ignora).
- **Props:**
  - `saveDialogOpen: boolean`
  - `onSaveDialogOpenChange: (open: boolean) => void`
  - `nombreEvaluacion: string`
  - `onNombreEvaluacionChange: (value: string) => void`
  - `isSaving: boolean`
  - `canSave: boolean` (hasV2Spec || hasV1; para deshabilitar botón Guardar en el header si se desea, o solo para el submit)
  - `onSaveRequest: () => void` — al hacer clic en Guardar en el diálogo, el padre ejecuta handleSaveEvaluation que usa getEvaluationsToSave() y hace el insert.
  - `defaultNombreSuggestion: string` (ej. “Evaluación Historia - 9no 1”) para pre-llenar al abrir.
- **Comportamiento:** Idéntico al actual: mismo texto, mismo placeholder, mismo flujo abrir → rellenar nombre → Guardar/Cancelar.

### 3. TeacherRemindersBlock (opcional)

- **Ubicación:** Se puede dejar como uso de `TeacherRemindersPanel` dentro de `EvaluationResultsSection` (V1 branch). No hace falta un wrapper nuevo a menos que se quiera un nombre más semántico; en el plan se considera opcional y de bajo impacto.
- Si se extrae: un componente que recibe `reminders`, `students`, `missingTemplateErrors` y renderiza `TeacherRemindersPanel`; así EvaluationResultsSection solo pasa esas props a un subcomponente nombrado.

---

## Step-by-step implementation plan (ordered)

### Paso 1: Crear carpeta y tipos compartidos

- **Crear:** `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` (vacío o solo export de un stub).
- **Crear:** `src/features/evaluaciones/components/EvaluationResultsSection.tsx` (vacío o solo export de un placeholder).
- **Crear:** `src/features/evaluaciones/components/SaveEvaluationSection.tsx` (vacío o solo export de un placeholder).
- **Crear (opcional):** `src/features/evaluaciones/types.ts` — re-exportar o definir los tipos que usan el hook y los componentes (`GeneratedEvaluation`, `EvaluationBundle`, `StudentReminders`, `V2Response`, etc.) para que no dependan de la página. Si los tipos ya viven en `@/services/evaluations` o en la página, se pueden importar desde ahí y no duplicar.
- **No modificar** aún `EvaluacionesGrupo.tsx`.

### Paso 2: Implementar `useEvaluationPipeline`

- **Archivo:** `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`
- **Mover desde EvaluacionesGrupo.tsx:**
  - Estado: `evaluationBundle`, `evaluationDesignPlan`, `generatedEvaluations`, `studentAssignments`, `teacherReminders`, `missingTemplateErrors`, `assignmentWarnings`, `v2RawResponse`, `v2SelectedVersion`, `previousV2Response`, `isGenerating`, `generationError`, `pipelineDebug` (y setter). No mover `useBetaV2` si se deja en la página y se pasa como input; o moverlo al hook y exponerlo + onBetaV2Change.
  - La función que hoy está en el handler del botón “Generar” (desde la construcción de `effectivePlan` / `requestBody` hasta el final del `try` que hace setEvaluationBundle, setGeneratedEvaluations, setStudentAssignments, setTeacherReminders, setAssignmentWarnings, setV2RawResponse, setPipelineDebug, etc.) → convertirla en `runGeneration` dentro del hook, usando los `options` del hook para construir groupContext y evaluation_design_plan.
  - La lógica de `normalizeAssignments` (inner function que normaliza asignaciones y reasigna a A cuando la versión no está disponible) → moverla al hook y usarla tras recibir data.
  - El `useMemo` de `displayEvaluations`: moverlo al hook (incluyendo `getSafeHtml`, `isHtmlString`, la construcción de tarjetas A/B/C, assignmentCounts, getAssigned, etc.). Dependencias: evaluationBundle, evaluationDesignPlan, generatedEvaluations, studentAssignments, selectedGroup, studentAssignments (y cualquier otra que use el useMemo actual).
  - Cálculo de `hasV2Spec`, `hasV1` y la construcción de `evaluationsToSave` (minimal array para V2 o displayEvaluations para V1) → exponer como `hasV2Spec`, `hasV1`, `canSave`, `getEvaluationsToSave()` en el return del hook.
- **Mantener idéntico:** Condición hasVersionA y toast de “Error crítico” cuando falta Version A; comportamiento de fallback V2 → V1 (mismo orden de llamadas y mismos setState); contenido exacto de getSafeHtml (mensaje “El backend devolvió un wrapper JSON inválido en versión X”); lógica de assignmentCounts (backendFinalCounts vs calculado) y shouldShowB.
- **No mover (siguen en página):** Estado de formulario (selectedGroupId, materia, competencias, contenidos, criterios, requerimientos, evaluationSourceConfig, evaluationMaterialsConfig, targetDurationMinutes, instrumentDesignRules, basePrototype, nombreEvaluacion, saveDialogOpen, isSaving), y la función `handleSaveEvaluation` que hace el insert a Supabase (pero sí recibirá de la página los datos que hoy usa, que ahora vendrán del hook vía getEvaluationsToSave y canSave).

### Paso 3: Conectar la página con el hook

- **Archivo:** `src/pages/EvaluacionesGrupo.tsx`
- **Modificar:** Eliminar el estado y el useMemo que se movieron al hook. Llamar a `useEvaluationPipeline({ ... })` pasando todos los inputs listados en la API (desde el estado que sigue en la página: selectedGroupId, selectedGroup, materia, esInterdisciplinaria, etc., y effectivePlan / instrumentDesignRules que la página sigue calculando). Destructurar el return del hook (status, isGenerating, generationError, runGeneration, displayEvaluations, evaluationBundle, evaluationDesignPlan, studentAssignments, teacherReminders, assignmentWarnings, missingTemplateErrors, v2RawResponse, v2SelectedVersion, setV2RawResponse, setV2SelectedVersion, previousV2Response, setPreviousV2Response, hasV2Spec, hasV1, canSave, getEvaluationsToSave, pipelineDebug, setPipelineDebug).
- **Mantener en la página:** Toda la UI de configuración (grupo, materia, competencias, contenidos, criterios, requerimientos, fuentes, materiales, tiempo, diseño, recordatorios, build de effectivePlan), el botón que dispara `runGeneration()`, el manejo de `handleSaveEvaluation` (que ahora usará getEvaluationsToSave() y canSave del hook, y el mismo insert a Supabase que hoy).

### Paso 4: Implementar `EvaluationResultsSection`

- **Archivo:** `src/features/evaluaciones/components/EvaluationResultsSection.tsx`
- **Mover desde EvaluacionesGrupo.tsx:** El bloque JSX que renderiza la pestaña “results”: el condicional `useBetaV2 && v2RawResponse` con V2InfoPanels, EvaluationRendererV2, EvaluationAdjustmentsPanel; y el else con assignment warnings, EvaluationAssignmentsPanel, TeacherRemindersPanel y el map de displayEvaluations a EvaluacionVisualRenderer. Incluir también los paneles de debug (Version Integrity, etc.) si showDebug. Recibir todas las props listadas en “Component extraction list”.
- **Imports:** Traer desde los mismos sitios que la página (evaluaciones/v2, TeacherRemindersPanel, EvaluacionVisualRenderer, etc.). No añadir dependencias nuevas.
- **Archivo:** `src/pages/EvaluacionesGrupo.tsx` — Reemplazar ese bloque por `<EvaluationResultsSection ... />` pasando las props desde el estado del hook y de la página.

### Paso 5: Implementar `SaveEvaluationSection`

- **Archivo:** `src/features/evaluaciones/components/SaveEvaluationSection.tsx`
- **Mover desde EvaluacionesGrupo.tsx:** El `<Dialog>` de “Guardar Evaluación” (input nombre, botones Cancelar/Guardar, lógica de disabled). El botón “Guardar evaluación” del header de resultados que abre el diálogo y puede pre-llenar el nombre con defaultNombreSuggestion.
- **Comportamiento del guard:** El padre (EvaluacionesGrupo) no mostrará el botón “Guardar evaluación” si no hay resultado (ya se hace hoy con `(displayEvaluations.length > 0 || (useBetaV2 && v2RawResponse))`). Al hacer clic en “Guardar” dentro del diálogo, se llamará `onSaveRequest()`; en la página, `handleSaveEvaluation` seguirá haciendo las comprobaciones hasV2Spec/hasV1 al inicio (o recibirá getEvaluationsToSave y canSave del hook y no llamará al backend si !canSave). Así el guard de “No hay evaluaciones generadas para guardar” se mantiene.
- **Archivo:** `src/pages/EvaluacionesGrupo.tsx` — Reemplazar el Dialog y el botón de guardar por `<SaveEvaluationSection ... />` y pasar saveDialogOpen, setSaveDialogOpen, nombreEvaluacion, setNombreEvaluacion, isSaving, canSave (del hook), onSaveRequest: () => handleSaveEvaluation(), defaultNombreSuggestion (derivado de materia/grupo).

### Paso 6: Ajustar `handleSaveEvaluation` en la página

- **Archivo:** `src/pages/EvaluacionesGrupo.tsx`
- **Modificar:** handleSaveEvaluation debe seguir recibiendo (o leyendo del hook) hasV2Spec, hasV1, v2RawResponse, displayEvaluations (o getEvaluationsToSave()). Sustituir el uso directo de `displayEvaluations` y del bloque “evaluationsToSave” por: `const evaluationsToSave = getEvaluationsToSave()` (o el nombre que se dé a la función del hook). El resto del save (validaciones de grupo, materia, competencias, nombre, isSaving, supabase insert con evaluacion_generada.evaluaciones, evaluation_spec, etc.) permanece igual.
- **Comprobar:** Que hasV2Spec y hasV1 usados en handleSaveEvaluation son los mismos que devuelve el hook (misma fórmula) para no cambiar comportamiento.

### Paso 7: Revisar imports y tipos

- **Archivo:** `src/pages/EvaluacionesGrupo.tsx` — Eliminar imports que ya solo usen el hook o los nuevos componentes (por ejemplo tipos que pasen a vivir en features/evaluaciones o que solo use el hook). Añadir imports de useEvaluationPipeline, EvaluationResultsSection, SaveEvaluationSection.
- **Archivos nuevos:** Asegurar que importan desde `@/...` o rutas relativas correctas y que no generan dependencias circulares (la página importa el hook y los componentes; el hook no importa la página; los componentes no importan la página).

### Paso 8: Verificación y lint

- Ejecutar `npm run lint` y corregir errores.
- Comprobar que no quedan referencias a estado o funciones que ya viven en el hook (buscar en EvaluacionesGrupo setEvaluationBundle, setGeneratedEvaluations, setStudentAssignments, setTeacherReminders, setAssignmentWarnings, setV2RawResponse, setGenerationError, pipelineDebug, displayEvaluations como variable local, getSafeHtml, etc.).
- Comprobar que el flujo de “Generar” sigue usando runGeneration y que el flujo de “Guardar” sigue usando handleSaveEvaluation con getEvaluationsToSave y canSave.

---

## Acceptance criteria

1. **Reducción de líneas:** `EvaluacionesGrupo.tsx` queda con menos de ~1200 líneas (contando solo esa fase mínima; formularios de configuración y helpers de catálogo/competencia pueden seguir en la página).
2. **TypeScript:** Sin errores de compilación en los archivos tocados.
3. **Comportamiento:**
   - Generar con V2 activo: se llama modify-evaluation-v2; si falla, fallback a modify-evaluation; se muestra V2InfoPanels + EvaluationRendererV2 + ajustes.
   - Generar con V2 desactivado (o fallback): se muestra evaluación V1 (tarjetas A/B/C) con las mismas asignaciones y recordatorios.
   - Si el backend devuelve JSON en versions.A: se muestra el mensaje de error HTML “El backend devolvió un wrapper JSON inválido en versión A” (getSafeHtml sin cambios).
   - Guardar con solo V2 (sin displayEvaluations): hasV2Spec true, canSave true, getEvaluationsToSave() devuelve el array mínimo de una evaluación; el insert incluye evaluation_spec y evaluaciones con ese mínimo.
   - Guardar con solo V1: hasV1 true, getEvaluationsToSave() devuelve displayEvaluations; mismo insert que antes.
   - Si no hay ni V2 spec ni V1: canSave false; al intentar guardar (si en algún flujo se dispara), se muestra el toast “No hay evaluaciones generadas para guardar” (la lógica de guard se mantiene en handleSaveEvaluation usando canSave o hasV2Spec/hasV1 del hook).
4. **Reabrir evaluación:** Tras guardar (V1 o V2) y abrir desde “Mis evaluaciones”, el detalle muestra el mismo contenido (V2 desde evaluation_spec, V1 desde evaluaciones/HTML).
5. **Recordatorios:** Los recordatorios docente se siguen mostrando en la sección de resultados (V1) y en V2 vía V2InfoPanels / teacherReminders según corresponda.

---

## Manual testing checklist

1. **Configuración y generación V2**
   - Ir a Evaluaciones → Nuevo.
   - Seleccionar grupo, materia, competencias, contenidos, criterios; activar “Beta V2”.
   - Clic en “Generar evaluación”.
   - Verificar: loading durante la llamada; luego se muestran paneles V2 (info, renderer, ajustes) y no tarjetas V1.
   - Verificar: no aparece error “Version A missing” ni fallback a V1 salvo que V2 falle.

2. **Fallback V2 → V1**
   - (Si es posible forzar error V2, p. ej. cortando red o mock): activar V2, generar, provocar error en modify-evaluation-v2.
   - Verificar: se llama a modify-evaluation (V1) y se muestran tarjetas A/B/C (V1).
   - Verificar: toast o mensaje coherente (ej. “Usando formato estándar” si aplica).

3. **Generación V1**
   - Desactivar Beta V2.
   - Generar evaluación.
   - Verificar: se muestran tarjetas Versión A (y B/C si aplica), asignaciones y recordatorios docente.

4. **Safe HTML (JSON wrapper)**
   - (Requiere simular backend que devuelve JSON en versions.A o inspección manual del código): comprobar que getSafeHtml sigue en el hook y que, si rawA empieza por `{`, se muestra el div de error “El backend devolvió un wrapper JSON inválido en versión A” (o equivalente). No cambiar esa string.

5. **Guardar V2**
   - Con resultado V2 en pantalla, clic en “Guardar evaluación”.
   - Ingresar nombre, clic en “Guardar”.
   - Verificar: guardado correcto; en “Mis evaluaciones” la evaluación abre con el renderer V2 y el mismo contenido.

6. **Guardar V1**
   - Con resultado V1 (tarjetas), abrir diálogo de guardar, nombre, Guardar.
   - Verificar: guardado correcto; al reabrir se ven las mismas versiones A/B/C.

7. **Guard sin resultado**
   - (Opcional) Si en algún flujo se puede abrir el diálogo sin tener resultado: verificar que no se pueda enviar el guardado (o que se muestre “No hay evaluaciones generadas para guardar”). En el flujo normal el botón “Guardar evaluación” solo aparece cuando hay resultado, así que este caso puede ser de regresión explícita.

8. **Ajustes V2 y undo**
   - Con resultado V2, usar el panel de ajustes para solicitar un cambio; aplicar.
   - Verificar: contenido actualizado; Undo restaura el anterior.
   - Verificar: al guardar después del ajuste, se persiste el spec actualizado.

9. **Recordatorios**
   - Generar evaluación (V1 o V2) con estudiantes que tengan contemplaciones/recordatorios.
   - Verificar: en V1 se ve TeacherRemindersPanel con la lista; en V2 se ven los recordatorios en la respuesta (teacherRemindersByStudent) donde corresponda.

10. **Debug (si aplica)**
    - Con VITE_DEBUG_EVAL_PIPELINE=true, generar y verificar que el panel de debug de pipeline (y el de Version Integrity en V1) se muestran y tienen la misma información que antes.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Regresión en guard de guardado (V2 no guarda o guarda vacío) | Definir hasV2Spec/hasV1/getEvaluationsToSave en un solo lugar (hook) y usarlos en handleSaveEvaluation sin duplicar fórmulas; añadir caso “Guardar V2” en el checklist y verificar en “Mis evaluaciones”. |
| Cambio involuntario en getSafeHtml o en displayEvaluations | Copiar el useMemo y getSafeHtml tal cual al hook; no simplificar condiciones ni mensajes; test manual “JSON wrapper”. |
| Fallback V2→V1 deja de ejecutarse o cambia orden | Mantener en runGeneration el mismo flujo: si useBetaV2, llamar V2; si error o !data o !data.success, no setear v2RawResponse y continuar a llamar V1; luego procesar data como hoy. |
| Dependencias circulares (página ↔ hook ↔ componentes) | Hook no importa página ni componentes; página importa hook y componentes; componentes solo reciben props y no importan la página. Tipos en types.ts o re-export desde services. |
| Hook con demasiados parámetros | Agrupar en un solo objeto `options` y, si hace falta en una segunda iteración, subdividir en options.group, options.design, options.debug. En esta fase se prioriza no cambiar comportamiento. |
| EvaluacionesGrupo no baja de ~1200 líneas | Además del hook y los dos componentes, valorar mover solo los “helpers” puros (getSafeHtml, normalizeAssignments, build de evaluationsToSave) al hook o a un util; dejar en página solo el formulario de configuración y el layout que conecta hook + Results + Save. |

---

*Documento de planificación únicamente. No se implementa código en esta fase. Ruta del documento: `/docs/micro-cambios/phase-2-higiene-minima-planning.md`.*
