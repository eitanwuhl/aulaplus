# Mitigación de CPU Time / WORKER_LIMIT (modify-evaluation-v2)

## Objetivo
Reducir consumo de CPU en `modify-evaluation-v2` sin degradar calidad pedagógica, eliminando relleno no fundamentado y mejorando trazabilidad operativa con `requestId` y códigos estables.

## Cambios implementados (por archivo)

- `supabase/functions/modify-evaluation-v2/index.ts`
  - Se agregaron guardas de presupuesto (`CPU_GUARD_MAX_WALL_MS`) y tope de llamadas LLM por request (`MAX_LLM_CALLS_PER_REQUEST`).
  - Se cambió selección de materiales a modo más liviano por defecto (K y char budget más bajos, configurables por env).
  - Se dejó el top-up agresivo de selección de pasajes desactivado por defecto (`MODIFY_EVALUATION_V2_USE_AGGRESSIVE_SELECTION_TOPUP=false`).
  - Se propagó `requestId` cliente-servidor-respuesta.
  - Se agregó superficie explícita de error/outcome (`error.code`, `outcome.code`).
  - Se endureció política de duración con grounding: si no alcanza evidencia, retorna outcome `GROUNDING_INSUFFICIENT_TO_MEET_DURATION` (sin agregar filler genérico).
  - Se agregaron reason codes de degradación/guardas (`CPU_BUDGET_GUARD_TRIGGERED`, `GROUNDING_INSUFFICIENT`, `GROUNDING_INSUFFICIENT_TO_MEET_DURATION`).
- `supabase/functions/modify-evaluation-v2/excerptCleaning.ts`
  - Se agregó filtrado cacheado (`filterPassagesByQualityCached`) para evitar trabajo repetido en bloques duplicados.
- `supabase/functions/modify-evaluation-v2/__tests__/deltaFiller.test.ts`
  - Se actualizaron tests a la nueva política de grounding (sin evidencia suficiente no se agrega filler).
- `supabase/functions/modify-evaluation-v2/__tests__/excerptCleaning.test.ts`
  - Se agregó test de cache reutilizable en filtrado de calidad de pasajes.
- `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`
  - Se desactivó fallback `v2 -> v1` por defecto, con flag `VITE_EVAL_V2_TO_V1_FALLBACK` (default OFF).
  - Se agregó `requestId` por request desde frontend y se usa en errores accionables.
- `src/pages/EvaluacionesGrupo.tsx`
  - Se etiqueta explícitamente `render fallback` cuando falla solo el render de V2 (sin ocultarlo silenciosamente).
- `src/services/evaluations/v2Types.ts`
  - Se extendió contrato TS con `requestId`, `error`, `outcome`.
- `supabase/functions/generate-plan-completo/index.ts`
  - `ai_design_report` pasa a formato teacher-safe (sin `assumptions`, `report_technical`, campos raw/debug en payload persistible).
- `src/services/planning/teacherSafeAiReport.ts`
  - Nuevo sanitizador de reporte docente para persistencia segura.
- `src/pages/PlanificacionWizard.tsx`
- `src/pages/PlanificacionWorkspace.tsx`
- `src/components/planificacion/EditorSesionNuevo.tsx`
- `src/components/planificacion/EditorSesionTabs.tsx`
  - Se aplica sanitización teacher-safe antes de persistir `ai_design_report` en `sesiones_clase` y `planificaciones`.

## Nuevos defaults de flags (production-safe)

- `MODIFY_EVALUATION_V2_USE_LLM_REPAIRS=false`
- `MODIFY_EVALUATION_V2_USE_DURATION_AUTO_EXTEND=false`
- `MODIFY_EVALUATION_V2_USE_NARRATIVE_LLM_CALLS=false`
- `MODIFY_EVALUATION_V2_USE_AGGRESSIVE_SELECTION_TOPUP=false`
- `MODIFY_EVALUATION_V2_MAX_LLM_CALLS=1` (si se habilitan features opcionales, recomendado `2` como máximo)
- `MODIFY_EVALUATION_V2_CPU_GUARD_MAX_WALL_MS=45000`
- `MODIFY_EVALUATION_V2_SELECTION_TOP_K=6`
- `MODIFY_EVALUATION_V2_SELECTION_MIN_K=4`
- `MODIFY_EVALUATION_V2_SELECTION_CHAR_BUDGET=14000`
- `MODIFY_EVALUATION_V2_SELECTION_CHAR_BUDGET_MIN=9000`
- Frontend: `VITE_EVAL_V2_TO_V1_FALLBACK=false` (default)

## Cómo overridear por env vars

- Edge Function (`modify-evaluation-v2`):
  - habilitar reparaciones: `MODIFY_EVALUATION_V2_USE_LLM_REPAIRS=true`
  - habilitar auto-extend/trim: `MODIFY_EVALUATION_V2_USE_DURATION_AUTO_EXTEND=true`
  - habilitar llamadas narrativas secundarias: `MODIFY_EVALUATION_V2_USE_NARRATIVE_LLM_CALLS=true`
  - subir límite LLM: `MODIFY_EVALUATION_V2_MAX_LLM_CALLS=2`
- Frontend:
  - reactivar fallback legacy solo temporalmente: `VITE_EVAL_V2_TO_V1_FALLBACK=true`

## Política nueva de duración con grounding

- Nunca se agregan ítems genéricos solo para alcanzar minutos.
- El delta de duración solo se cubre con evidencia textual usable (excerpt de calidad).
- Si no hay evidencia suficiente para completar la duración objetivo:
  - se corta el relleno,
  - se devuelve `success=false`,
  - `outcome.code=GROUNDING_INSUFFICIENT_TO_MEET_DURATION`,
  - con guidance accionable:
    - reducir minutos,
    - agregar materiales,
    - reducir alcance/complejidad.

## Propagación de requestId

- Frontend genera `requestId` por intento de generación.
- Se envía en body a `modify-evaluation-v2` (`requestId`) y puede enviarse también por header `x-request-id`.
- Edge responde con `requestId` en root y lo refleja en `debug.requestId`.
- Errores y outcomes relevantes lo incluyen para trazabilidad en soporte/observabilidad.

## Reproducción y verificación (local + producción)

### Local

1. Configurar flags en modo seguro (todos `false`, `MAX_LLM_CALLS=1`).
2. Ejecutar generación V2 con material extenso.
3. Verificar respuesta:
   - incluye `requestId`,
   - `debug.llmCallCount <= 1`,
   - no hay fallback silencioso a V1.
4. Forzar escenario con grounding insuficiente:
   - objetivo de minutos alto + poco material útil.
   - esperar `success=false` y `outcome.code=GROUNDING_INSUFFICIENT_TO_MEET_DURATION`.

### Producción

1. Monitorear logs de edge por `requestId`.
2. Confirmar ausencia de `WORKER_LIMIT` en requests equivalentes.
3. Revisar warnings de presupuesto (`CPU_BUDGET_GUARD_TRIGGERED`) para tuning fino.

## Script corto de QA manual

- [ ] **PDF largo (70+ páginas)**: V2 completa sin `WORKER_LIMIT`.
- [ ] **Grounding insuficiente**: UI muestra mensaje explícito de ajuste (minutos/materiales), sin filler genérico.
- [ ] **Sin fallback V2->V1**: error explícito cuando V2 falla (excepto si flag de fallback está en `true`).
- [ ] **Render fallback etiquetado**: si falla solo render V2, se informa como "Render fallback activado".
- [ ] **Planning report persistido**:
  - `planificaciones.ai_design_report` y `sesiones_clase.ai_design_report` no contienen `assumptions`, `report_technical`, ni debug/raw.

## Notas operativas

- En este entorno no se pudo ejecutar `deno test` porque `deno` no está instalado en shell local.
- Los tests añadidos/ajustados quedan listos para CI o entorno con Deno.
