# Auditoría técnica LLM (fase investigación)

Proyecto: `aulaplus`  
Fecha: 2026-03-04  
Alcance: investigación de arquitectura y flujos (sin cambios de lógica en código)

---

## 1) Resumen ejecutivo

El sistema actual separa generación de evaluaciones (v2 + fallback v1) y planificación de clase en Edge Functions de Supabase, invocadas desde React.  
El problema de calidad (filler genérico/no anclado) y el riesgo de error `546` están concentrados en el pipeline de `modify-evaluation-v2` cuando hay materiales largos y/o se habilitan rutas de reparación/auto-extend por LLM.

Hallazgos principales:

- **Evaluaciones v2** sí tiene defensas de grounding y control de costo (filtros de pasajes, top-K, presupuesto de caracteres, invariantes deterministas), pero puede degradar calidad cuando no hay excerpt usable y entra en degradaciones/fallbacks internos.
- **Fallback v2 -> v1** ocurre en frontend por checks de `success`/error de endpoint, no por un código específico `546`.
- **No existe manejo explícito de `546`** en frontend ni en edge; se trata como error genérico de red/timeout/HTTP.
- **Planificación** usa un solo endpoint (`generate-plan-completo`) y persiste `ai_design_report`; aún existen rutas donde pueden aparecer campos técnicos o `assumptions` porque el backend los sigue construyendo en fallback/error.
- **Riesgo de producción**: `generate-plan-completo` tiene `verify_jwt = false` en `supabase/config.toml`.

---

## 2) System map (UI -> API/Edge -> LLM -> postproceso -> DB -> UI)

### 2.1 Evaluaciones (v2 con fallback v1)

1. UI ruta `/evaluaciones/nuevo` (`src/App.tsx`)  
2. Página `src/pages/EvaluacionesGrupo.tsx`  
3. Hook orquestador `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`  
4. Invocación edge auth: `invokeEdgeFunctionAuthed()` (`src/lib/edgeFunctionAuth.ts`)  
5. Endpoint primario: `supabase/functions/modify-evaluation-v2/index.ts`  
6. LLM OpenAI (`chat/completions`) + postproceso determinista (duración, excerpts, invariantes)  
7. Respuesta v2 (`evaluationSpec`, `aiReport`, `warnings`, `debug`)  
8. Persistencia en tabla `evaluaciones` desde frontend (`EvaluacionesGrupo.tsx`, insert Supabase)  
9. Render:
   - Preferente JSON: `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`
   - Fallback visual v1/HTML si falla render v2.

### 2.2 Planificación

1. UI rutas `/planificacion/nuevo` y `/planificacion/:id` (`src/App.tsx`)  
2. `src/pages/PlanificacionWizard.tsx` (generación N sesiones) y `src/pages/PlanificacionWorkspace.tsx` (regeneración sesión)  
3. Invocación directa `supabase.functions.invoke('generate-plan-completo')`  
4. Endpoint `supabase/functions/generate-plan-completo/index.ts`  
5. LLM OpenAI (`gpt-4o-mini`) + parse/sanitización `plan_html` + ensamblado `ai_design_report`  
6. Persistencia en `sesiones_clase.ai_design_report` y `planificaciones.ai_design_report`  
7. Render en UI con `src/components/planificacion/PlanningAIDesignReport.tsx`.

---

## 3) Arquitectura del repo (framework, routing, estado, capa API, Supabase)

- **Frontend:** React + Vite + TypeScript (`package.json`, scripts `vite`, `vite build`).
- **Routing:** React Router (`src/App.tsx`), rutas protegidas por rol vía `AuthContext`.
- **Estado de datos remotos:** TanStack React Query (`QueryClientProvider` en `src/App.tsx`).
- **Auth:** Supabase Auth (demo-heavy) en `src/contexts/AuthContext.tsx`.
- **API layer:** invocaciones `supabase.functions.invoke()` y helper auth `invokeEdgeFunctionAuthed()`.
- **Backend:** Supabase Edge Functions en `supabase/functions/*`.
- **DB:** Postgres Supabase con RLS; tablas clave: `evaluaciones`, `planificaciones`, `sesiones_clase`, `teacher_materials`, `material_attachments`.

Nota de gobernanza: `AGENTS.md` exige consultar `docs/ARCHITECTURE_SSoT.md`, pero ese archivo no está presente en el repositorio actual.

---

## 4) Pipeline de evaluación (entrada -> payload -> edge -> LLM -> postproceso -> almacenamiento -> render)

## 4.1 Entry points y payload

Archivo clave: `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`.

Payload v2 enviado a `modify-evaluation-v2`:

- `modification` (texto + contexto serializado de sesiones/materiales)
- `groupContext` (materia, contenidos, competencias, criterios, estudiantes anonimizados)
- `evaluation_design_plan`:
  - `instrumentDesignRules`
  - `responseOptions`
  - `triggers`
  - `assignmentByStudentId`
  - `perStudentReminders`
  - `targetDurationMinutes`
  - `materials` (hasta 5, `extractedText` truncado a 4000 chars c/u)

Contexto de materiales/sesiones para evaluación:

- `src/services/evaluations/sessionDigests.ts`
- `src/services/evaluations/designPlan.ts`
- `src/services/groupContext/provider.ts`

## 4.2 v2 vs v1 y fallback exacto

### v2 -> v1 (frontend, generación)

En `useEvaluationPipeline.ts`, cuando `useBetaV2=true`:

- cae a v1 (`modify-evaluation`) si:
  - `v2Result.error` existe
  - o `!v2Result.data`
  - o `v2Result.data.success !== true`

Si `success=true`, **no** cae a v1 aunque luego el renderer v2 falle.

### Fallback de render v2 -> render estándar

- En `EvaluationRendererV2` existe `onRenderError`.
- En `EvaluacionesGrupo.tsx`, `onRenderError` hace `setV2RawResponse(null)` y muestra fallback visual estándar.

### requestService duplicado (no orquestador principal actual)

`src/services/evaluations/requestService.ts` implementa también fallback v2->v1, pero no es el camino principal de `EvaluacionesGrupo`.  
Riesgo: lógica duplicada que puede divergir.

## 4.3 Edge v2 (`modify-evaluation-v2`) y llamadas LLM

Archivo: `supabase/functions/modify-evaluation-v2/index.ts`.

Configuración detectada:

- Modelos:
  - `OPENAI_MODEL_PRIMARY` (default `gpt-4o`)
  - `OPENAI_MODEL_FALLBACK` (default `gpt-4o-mini`)
- Timeouts:
  - `OPENAI_TIMEOUT_PER_ATTEMPT_MS = 120000`
  - `TOTAL_TIMEOUT_MS = 400000`
- Feature toggles por env:
  - `MODIFY_EVALUATION_V2_USE_LLM_REPAIRS`
  - `MODIFY_EVALUATION_V2_USE_DURATION_AUTO_EXTEND`
  - `MODIFY_EVALUATION_V2_USE_NARRATIVE_LLM_CALLS`
- Routing runtime:
  - header `x-aulaplus-env: legacy` para ruta rollback.

Llamada principal OpenAI usa `response_format: { type: 'json_object' }`, `max_completion_tokens: 6000`, temperatura variable por intento.

## 4.4 Time fulfillment logic (duración -> ítems -> filler)

Base heurística en `supabase/functions/modify-evaluation-v2/durationMath.ts`:

- tabla fija min/ítem (ej: `multiple_choice=2`, `short_answer=4`, `paragraph=9`, `essay=14`, etc.)
- `SECTION_OVERHEAD_MINUTES=1`
- estimación: suma por tipo + overhead por sección.

En `index.ts`:

- calcula objetivo 95%-105%
- opcional `runDurationAutoExtend` y `runDurationAutoTrim` (si toggle activo)
- si falta duración: `applyDeltaFiller()`
  - cap duro: `MAX_DELTA_FILLER_ITEMS_TOTAL = 4`
  - prioridad: `essay` -> `paragraph` -> `MC` (solo con excerpt de calidad) -> `short_answer`
  - antirepetición por stem
  - warnings `DURATION_DELTA_FILLER_APPLIED` y `DURATION_REALISM_CAP_REACHED`.

## 4.5 Grounding en evaluación

### Inyección de material

- Frontend pasa materiales resumidos/truncados (ver `useEvaluationPipeline.ts` + `sessionDigests.ts`).
- En edge:
  - selección de pasajes: `buildMaterialsPromptBundle(...)`
  - parámetros:
    - `MATERIAL_SELECTION_MIN_K = 6`
    - `MATERIAL_SELECTION_CHAR_BUDGET = 28000`
    - `MATERIAL_SELECTION_CHAR_BUDGET_MIN = 20000`
  - filtros de calidad (TOC, metadata, biblio, prólogo) en `excerptCleaning.ts`.

### Selección/limpieza de excerpt por ítem

- `cleanAndSelectExcerpt()`
- valida calidad con `filterPassageByQuality()`
- si no hay excerpt aceptable:
  - degrada `source_analysis` -> `short_answer`
  - corrige prompts con referencia a fragmento sin fuente.

### Guardrails finales de invariantes

- `enforceFinalItemInvariants()` al final de la ruta new:
  - corrige MC inválido (opciones insuficientes/genéricas)
  - evita referencias a fragmento sin excerpt
  - degrada source_analysis sin calidad suficiente.

## 4.6 Competencias, requerimientos, contemplaciones, metacognición

- Competencias/criterios entran en `groupContext` y meta de spec.
- Requerimientos docente: concatenados en `modification`.
- Contemplaciones:
  - se cargan desde provider (demo/local storage) `src/services/groupContext/provider.ts`
  - plan de diseño y reminders por estudiante en `src/services/evaluations/designPlan.ts`.
- Metacognición/opciones de respuesta:
  - controladas por `responseOptions` + fallback deterministic en v2.

## 4.7 Persistencia y render

- Persistencia evaluaciones en frontend (tabla `evaluaciones`) desde `EvaluacionesGrupo.tsx`.
- Se guarda `evaluacion_generada` con `evaluation_spec` (si v2), `ai_report`, `evaluation_design_plan`, reminders, duración estimada.
- Render v2: `EvaluationRendererV2`; fallback a estándar si no puede normalizar/renderizar.

---

## 5) Pipeline de planificación (N clases, materiales, competencias, contemplaciones, AI report)

## 5.1 Entrypoints y ejecución

- `PlanificacionWizard.tsx`: genera múltiples sesiones secuenciales.
- `PlanificacionWorkspace.tsx`: genera/regenera sesión individual.
- `EditorSesionNuevo.tsx`: también invoca `generate-plan-completo`.

Todos envían payload con:

- `duracionMin` (obligatorio)
- `contenidos`, `competencias`, `criterios`
- `instruccionesDocente`
- `unitContext` (posición en secuencia de N clases)
- `sessionBrief` (override pedagógico por sesión)
- `materialsContext` (si hay adjuntos)
- `perfilGrupo` y `estudiantes` (cuando disponible)

## 5.2 Mapeo multi-clase (N sesiones)

En `PlanificacionWizard.tsx`:

- `expandUnitsToSessionPlan()`
- `mapSessionsToUnits()`

La sesión se ubica como primera/intermedia/final/adicional y eso se incorpora en prompt (`unitContext`), para continuidad didáctica.

## 5.3 Materiales y extracción

Flujo materiales:

- Biblioteca: `BibliotecaMateriales.tsx`
- Upload + extracción automática: `useUploadAndCreateMaterial` (`src/hooks/useMaterials.ts`)
- Edge extracción PDF: `supabase/functions/extract-material-text/index.ts`

Detalle importante:

- extracción usa `unpdf` y guarda en `teacher_materials.extracted_text`
- recorte duro a 20000 chars en edge de extracción
- en planning, si es modo solo materiales y PDF sin `extracted_text`, bloquea generación y poll de extracción.

## 5.4 AI report en planificación y por qué aparecen campos técnicos/raw/assumptions

Backend `generate-plan-completo/index.ts`:

- pide JSON con `ai_design_report` estructurado
- si parse falla, arma fallback con `assumptions`, `contentCoverage`, etc.
- normaliza `report_narrative` y asigna:
  - `ai_design_report.narrative`
  - `ai_design_report.report_narrative`
  - `ai_design_report.report_technical`
- agrega `debug.aiReportSource` (`structured|fallback`) y `debug.materialsUsed`.

Frontend `PlanningAIDesignReport.tsx`:

- no muestra `report_technical` salvo flag `window.__PLAN_REPORT_DEBUG__ === true`
- pero el backend sigue incluyendo `assumptions` en múltiples ramas (incluido fallback/error), por eso puede aparecer en payload persistido.

---

## 6) Source material handling (ingesta, chunking, filtros, budgeting)

## 6.1 Ingesta y almacenamiento

- tabla `teacher_materials` + `material_attachments` (migración `20260127000000_add_teacher_materials_schema.sql`)
- bucket storage `teacher-materials`
- extracción texto PDF vía `extract-material-text` y persistencia en `teacher_materials.extracted_text`.

## 6.2 Presupuestos/tamaños en frontend y backend

Observado:

- `sessionDigests.ts`: truncado a ~2000 chars por material en digest.
- `useEvaluationPipeline.ts`: al construir payload v2, vuelve a recortar a 4000 chars por material (max 5 materiales).
- `loadAttachedMaterials.ts` (planning): al formatear, limita a 2000 chars por material.
- `modify-evaluation-v2` reconstruye pasajes con target de 20k-28k chars, pero depende de texto recibido.

Riesgo de grounding: truncados múltiples en frontend pueden empobrecer el material antes de llegar al selector robusto del edge.

## 6.3 Heurísticas de descarte

- Evaluación: `supabase/functions/modify-evaluation-v2/excerptCleaning.ts`
- Planificación: `supabase/functions/generate-plan-completo/passageQualityFilter.ts`

Descartan TOC/índice, bibliografía, prólogo, metadata usando reglas deterministas.

## 6.4 Gating de source_analysis

En evaluación v2:

- `source_analysis` solo se mantiene si hay excerpt usable de calidad.
- si no, se degrada a `short_answer` para preservar coherencia.

---

## 7) Configuración de modelo/proveedor

## 7.1 Evaluación v2

Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

- proveedor: OpenAI `chat/completions`
- modelos por env (`OPENAI_MODEL_PRIMARY`, `OPENAI_MODEL_FALLBACK`)
- structured output: `response_format: json_object`
- parámetros observados:
  - `max_completion_tokens` 6000 (principal)
  - temperatura entre 0.7 y 0.4 según intento
- múltiples sub-llamadas opcionales (extend/trim/repair/narrative) controladas por toggles.

## 7.2 Evaluación v1

Archivo: `supabase/functions/modify-evaluation/index.ts`

- ruta universal usa `gpt-4.1-2025-04-14`
- ruta legacy/chat usa mezcla de modelos
- sin contrato JSON fuerte tan estricto como v2; mucho saneo posterior.

## 7.3 Planificación

Archivo: `supabase/functions/generate-plan-completo/index.ts`

- modelo hardcoded `gpt-4o-mini`
- sin `response_format` estricto (parsea texto a JSON)
- `temperature: 0.7`
- retry/backoff para rate-limit.

## 7.4 Variables de entorno detectadas

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEBUG_EVAL_PIPELINE` (debug UI/logs)

Edge:

- `OPENAI_API_KEY` (planning/evaluación)
- `OPENAI_MODEL_PRIMARY`, `OPENAI_MODEL_FALLBACK` (evaluación v2)
- `MODIFY_EVALUATION_V2_USE_*` toggles
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` (funciones que tocan DB/storage)

---

## 8) Logging y observabilidad actual

## 8.1 Evaluación v2

Fortalezas:

- `requestId` generado por request
- `Timer` con hitos temporales
- `debug` rico en respuesta (`llmCallCount`, timings, materials stats, selected/rejected passages, etc.)
- warnings tipificados.

Brechas:

- no hay correlación global estándar entre frontend y edge (cada capa genera ids diferentes o ninguno).

## 8.2 Planificación

Logs en backend con prefijo `[GEN_PLAN]` para start/end/openai/parse/error.  
En frontend hay logs de materiales/sesión (`[MATERIALS]`, `[SESSION_BRIEF]`).

Brechas:

- no hay requestId formal end-to-end.
- fallbacks devuelven estructura válida, pero pueden ocultar degradaciones si no se inspecciona `debug`.

---

## 9) Data model map (tablas y campos implicados)

## 9.1 Evaluaciones

Tabla `evaluaciones` (migraciones `20251222000000...`, `20260128000000...`, `20260129000002...`):

- metadatos: `nombre`, `materia`, `grupo_id`, `nivel`, `fecha`
- filtros: `is_saved`, `saved_at`, `deleted_at`
- contenido: `evaluacion_generada` (JSONB)
- trazabilidad fuentes:
  - `source_planificacion_id`
  - `source_session_ids`
  - `direct_material_ids`
  - `include_session_materials`
  - `evaluation_focus`
- reporte: `ai_design_report`.

## 9.2 Planificación/sesiones

Tabla `planificaciones`:

- datos base + `ai_design_report`.

Tabla `sesiones_clase`:

- `duracion_minutos`, contenidos/competencias/criterios
- `plan_desarrollo`, `recursos`, `observaciones`
- `ai_design_report`.

## 9.3 Materiales

Tabla `teacher_materials`:

- `title`, `storage_path`, `mime_type`, `metadata`, `extracted_text`, `deleted_at`.

Tabla `material_attachments`:

- relación polimórfica (`target_type`, `target_id`) + `focus_text`, prioridad.

## 9.4 Student considerations / competencies representation

- contemplaciones (ajustes) en capa demo/local storage y mapeo determinista:
  - provider: `src/services/groupContext/provider.ts`
  - diseño evaluación: `src/services/evaluations/designPlan.ts`
  - enforcement planificación: `src/lib/contemplaciones/enforcement.ts` + `planParser.ts`.

Competencias:

- evaluación: `selectedCompetenciasIds` / `selectedCriteriosLogro` -> payload -> meta spec/persistencia.
- planificación: `competencias` por sesión y mapeo en `ai_design_report`.

---

## 10) Fallback triggers y ramas de error (detalle solicitado)

## 10.1 Evaluación v2 -> v1 (exacto)

`src/features/evaluaciones/hooks/useEvaluationPipeline.ts`:

- fallback a v1 si:
  - `v2Result.error`
  - `!v2Result.data`
  - `v2Result.data.success === false`

## 10.2 Fallbacks internos en v2 (sin saltar a v1)

`supabase/functions/modify-evaluation-v2/index.ts`:

- si intentos LLM fallan: genera `emergency template`
- responde `success: true` para evitar fallback frontend a v1
- en error no manejado: responde `success:false` con HTTP 200 y warning `UNHANDLED_ERROR`.

## 10.3 Planificación (`generate-plan-completo`)

- valida `duracionMin`; si inválido: HTTP 400 (`INVALID_INPUT`)
- si falta API key: HTTP 500 (`CONFIG_ERROR`)
- OpenAI rate-limit: puede devolver 429.
- fallback parse/estructura: construye plan/report de respaldo.

---

## 11) Sección dedicada: Error 546

## 11.1 Dónde se levanta

No hay código explícito en repo que genere o maneje `546` como código semántico.  
El número `546` aparece solo en documentación, no en ramas de ejecución.

Conclusión: `546` probablemente proviene de infraestructura/gateway/runtime limit externo (worker timeout/CPU/memoria/proxy), no de un `throw` explícito de aplicación.

## 11.2 Evidencia técnica asociada

- Comentarios y docs del repo asocian `WORKER_LIMIT` a exceso de costo por request.
- `modify-evaluation-v2` tiene toggles para reducir llamadas LLM y tiempo (`USE_*`), métricas `llmCallCount`, `selectionMs`, `postProcessMs`.
- Flujo de materiales largos + múltiples fases LLM eleva riesgo de exceder límites.

## 11.3 Hipótesis priorizadas (546)

1. **Sobrecarga por múltiples llamadas LLM en una misma request**  
   Evidencia: v2 tiene rutas de repair/extend/trim/narrative opcionales, cada una suma costo.

2. **Prompt/material demasiado grande + parse/postproceso pesado**  
   Evidencia: material largo, múltiples truncados/rearmados, selección y limpieza intensiva.

3. **Timeouts acumulados edge + frontend race timeout**  
   Evidencia: frontend usa timeout 120s en planning/evaluación; edge también maneja timeouts largos.

4. **Diferencias de configuración entre entornos (local vs Render/Supabase project)**  
   Evidencia: no hay visibilidad en repo de límites reales de runtime/proxy del entorno desplegado.

## 11.4 Cómo confirmar

- registrar y comparar por request:
  - `debug.llmCallCount`
  - `debug.totalDurationMs`
  - `debug.metrics.selectionMs/postProcessMs/openaiMs`
  - tamaño de payload/material enviado
- comparar misma entrada en local vs Render con mismas flags/env.

---

## 12) Sección dedicada: Time fulfillment logic

Implementación principal:

- estimación determinista por tipo (`durationMath.ts`)
- objetivo de banda 95%-105%
- rutas:
  - auto-extend/trim por LLM (feature flag)
  - delta filler determinista si falta tiempo
- cap de filler `<=4` para preservar realismo.

Punto crítico de calidad:

- cuando se fuerza cerrar delta sin excerpt de calidad, el sistema puede introducir ítems menos anclados (aunque con guardrails), generando percepción de “filler”.

---

## 13) Sección dedicada: Grounding (selección de excerpts e inyección en prompts)

Evaluación v2:

- `buildMaterialsPromptBundle` selecciona pasajes por keywords + calidad + presupuesto chars.
- `cleanAndSelectExcerpt` escoge 1-3 párrafos coherentes.
- `filterPassageByQuality` descarta TOC/biblio/prólogo/metadata.
- `source_analysis` sin excerpt válido se degrada.

Planificación:

- `materialsContext` se filtra con `filterMaterialPassages` (passageQualityFilter).
- se usa en prompt, cobertura y reporte de materiales.

Riesgo detectado:

- truncados en frontend pueden reducir evidencia disponible antes del selector de backend, disminuyendo fidelidad al material original.

---

## 14) Reproducción de issues (local + Render)

## 14.1 Evaluación: filler genérico / grounding bajo

Local:

1. `npm run dev`
2. Ir a `/evaluaciones/nuevo`
3. Seleccionar grupo/materia/competencias.
4. Generar con material PDF largo (con TOC + contenido real), target duración alto (ej. 80-90).
5. Activar beta v2 si corresponde.
6. Revisar response de `modify-evaluation-v2` en Network:
   - `debug.materialsPromptPath`
   - `debug.finalK`, `debug.finalChars`
   - `debug.llmCallCount`
   - warnings `DURATION_*`, `SOURCE_*`, `ITEM_INVARIANT_*`
7. Revisar ítems agregados por duración y verificar si citan/exigen evidencia del material.

Render:

1. Repetir mismos pasos en entorno deploy.
2. Comparar `debug` contra local.
3. Si ocurre 546, registrar payload size aproximado, tiempo hasta error y `llmCallCount` de casos exitosos comparables.

## 14.2 Evaluación: repro de error 546

1. Caso con documento muy largo (70+ páginas) y requisitos complejos.
2. Ejecutar múltiples veces para detectar intermitencia.
3. Capturar:
   - status HTTP real
   - respuesta body (si existe)
   - headers/timing en DevTools
   - logs de edge en Supabase (por timestamp/request).
4. Correlacionar con flags `MODIFY_EVALUATION_V2_USE_*`.

## 14.3 Planificación: coherencia N sesiones + AI report teacher-friendly

Local:

1. Ir a `/planificacion/nuevo`
2. Crear 3+ sesiones con `sessionBrief` distinto por sesión.
3. Adjuntar PDF largo (preferir materials-only en al menos una sesión).
4. Generar y abrir `/planificacion/:id`.
5. Verificar:
   - continuidad entre sesiones (`unitContext`)
   - cobertura específica por sesión (`contentCoverage`)
   - `debug.aiReportSource` y `debug.materialsUsed`
   - ausencia de raw técnico visible para docente (sin flag debug).

Render:

1. Repetir con la misma planificación.
2. Comparar narrativa/reportes y `debug` del endpoint.
3. Revisar divergencias por entorno.

---

## 15) Riesgos de cambio en producción + patrones de resguardo (sin implementar)

Riesgos altos:

- tocar pipeline v2 puede degradar calidad o reintroducir timeouts/546.
- dualidad v2/v1 + fallback de render puede ocultar fallos reales.
- diferencias de config entre entornos (Supabase project, env vars, flags).
- `verify_jwt=false` en `generate-plan-completo`.

Patrones recomendados para próxima fase:

1. **Feature flags explícitos por comportamiento** (no solo por entorno)  
   Ej: `EVAL_V2_MATERIAL_BUNDLE_V2`, `EVAL_V2_DELTA_FILLER_STRICT`.

2. **Runtime routing gradual**  
   Header o porcentaje de tráfico a variantes de pipeline.

3. **Kill switch operativo**  
   Forzar modo legacy/new por tenant o por request.

4. **Contract tests + golden inputs**  
   Casos largos (70+ páginas), materials-only, sin ANEP, con contemplaciones.

5. **Observabilidad mínima obligatoria**  
   requestId único end-to-end + métricas de tamaño/tiempo/llmCallCount + motivo de fallback.

---

## 16) Hipótesis raíz (ranking) con evidencia + cómo confirmar + dirección de arreglo

## H1 (Alta): filler genérico por presión de duración y falta de excerpt usable

- Evidencia:
  - `applyDeltaFiller` intenta cerrar delta con cap y reglas heurísticas.
  - degradación de `source_analysis` cuando excerpt no pasa calidad.
- Confirmación:
  - comparar casos con `finalChars` bajo y warnings `DURATION_REALISM_CAP_REACHED`.
- Dirección:
  - en próxima fase, separar “cumplir minutos” de “calidad mínima de grounding” con umbral duro de no-inyección.

## H2 (Alta): pérdida de grounding por truncado temprano en frontend

- Evidencia:
  - truncados a 2000/4000 chars por material antes de llegar al edge.
- Confirmación:
  - medir `materialsCharsSent` vs chars reales del material en DB.
- Dirección:
  - mover budgeting principal al backend y enviar más contexto estructurado o referencias.

## H3 (Alta): 546 asociado a costo acumulado de rutas LLM opcionales

- Evidencia:
  - múltiples paths de repair/extend/trim/narrative en v2.
- Confirmación:
  - correlación entre incidentes y `llmCallCount`/`totalDurationMs`.
- Dirección:
  - mantener single-call por defecto + escalamiento controlado.

## H4 (Media): fallbacks silenciosos enmascaran calidad degradada

- Evidencia:
  - v2 emergencia responde `success:true`.
  - fallback render v2->estándar no siempre visible como incidente.
- Confirmación:
  - auditar warnings/debug persistidos contra salida que ve el docente.
- Dirección:
  - señalización explícita de modo degradado y telemetría de fallback.

## H5 (Media): AI report de planificación mezcla técnico/teacher por ramas de fallback

- Evidencia:
  - backend sigue poblando `assumptions` y `report_technical`.
  - UI tiene flag para mostrar raw.
- Confirmación:
  - revisar payloads reales en casos parse-fail/error.
- Dirección:
  - separar contrato teacher/public vs técnico/debug a nivel schema.

---

## 17) Preguntas para el developer (solo incertidumbres reales)

1. ¿Dónde se observa exactamente el `546` (Supabase logs, Render reverse proxy, cliente) y con qué mensaje textual?  
2. ¿Qué límites operativos reales tienen hoy los Edge Functions en prod (CPU/mem/timeout/concurrency)?  
3. ¿Qué env vars/toggles están activas en producción para `modify-evaluation-v2` (`USE_*`, modelos)?  
4. ¿Hay diferencias entre proyecto Supabase de local y Render (funciones/versiones deployadas)?  
5. ¿Se exige actualmente que planificación o evaluación muestren `assumptions` al docente, o debe ser siempre oculto/eliminado?  
6. ¿El fallback v2->v1 debe seguir habilitado en producción o se quiere “hard fail + observabilidad” para depurar?

---

## 18) Prioridades sugeridas para próxima fase (planificación de fixes, no implementación)

1. **Observabilidad primero**: requestId end-to-end + trazas de fallback + métricas de payload/llmCallCount.  
2. **Control de tamaño/contexto**: reducir truncado temprano frontend y centralizar budgeting en edge.  
3. **Política de duración estricta**: no meter filler si no cumple grounding mínimo (explicitar trade-off).  
4. **Contrato AI report teacher-safe**: separar definitivamente campos técnicos de salida docente.  
5. **Estrategia de rollout**: flags + canary + rollback por header/tenant.

---

## 19) Evidencias (archivos clave inspeccionados)

- `src/App.tsx`
- `src/main.tsx`
- `src/integrations/supabase/client.ts`
- `src/lib/edgeFunctionAuth.ts`
- `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`
- `src/pages/EvaluacionesGrupo.tsx`
- `src/services/evaluations/requestService.ts`
- `src/services/evaluations/sessionDigests.ts`
- `src/services/evaluations/designPlan.ts`
- `src/services/groupContext/provider.ts`
- `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`
- `supabase/functions/modify-evaluation-v2/index.ts`
- `supabase/functions/modify-evaluation-v2/durationMath.ts`
- `supabase/functions/modify-evaluation-v2/excerptCleaning.ts`
- `supabase/functions/modify-evaluation/index.ts`
- `supabase/functions/generate-plan-completo/index.ts`
- `supabase/functions/generate-plan-completo/passageQualityFilter.ts`
- `supabase/functions/extract-material-text/index.ts`
- `src/pages/PlanificacionWizard.tsx`
- `src/pages/PlanificacionWorkspace.tsx`
- `src/components/planificacion/EditorSesionNuevo.tsx`
- `src/components/planificacion/PlanningAIDesignReport.tsx`
- `src/services/materials/materials.ts`
- `src/utils/loadAttachedMaterials.ts`
- `src/utils/pollExtractedText.ts`
- `supabase/config.toml`
- migraciones:
  - `20250923163758_55c12a12-40c6-4eac-8b92-032b9e90ec85.sql`
  - `20251222000000_add_evaluaciones_explicit_save.sql`
  - `20260128000000_add_evaluation_sources.sql`
  - `20260127000000_add_teacher_materials_schema.sql`
  - `20260128000006_add_extracted_text_to_materials.sql`
  - `20260129000002_add_ai_design_report.sql`
  - `20260129000003_add_sesiones_clase_ai_design_report.sql`

