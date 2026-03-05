# V2 Duration Mismatch — Implementation Summary

## 1) Qué cambió

Se implementó la corrección del desajuste “duración objetivo solicitada” vs “duración estimada” en el flujo V2, con foco en:

1. **Prompt inicial con objetivo de duración**
   - La generación principal V2 ahora recibe `targetDurationMinutes` en `buildV2UserPrompt`.
   - Se agregó un bloque operativo de duración cuando hay objetivo positivo:
     - objetivo y banda aceptable (90–110%),
     - tabla de minutos por tipo de ítem alineada al heurístico backend,
     - sugerencia estructural mínima (cantidad de ítems),
     - instrucción explícita: `meta.duration.minutes` debe reflejar la estimación, no copiar el target.

2. **Separación clara target vs estimate**
   - `evaluationSpec.meta.duration.minutes` queda como **estimación heurística** del spec final.
   - Se agregó `evaluationSpec.meta.duration.targetMinutes` (opcional) cuando hay target.
   - Se removió el overwrite engañoso de `meta.duration.minutes = targetDurationMinutes`.

3. **Contrato de respuesta V2 ampliado**
   - Se agregaron campos root-level:
     - `targetDurationMinutes` (nullable),
     - `estimatedTotalMinutes` (number),
     - `timeBreakdown` (nullable object).
   - Además, `meta.duration.breakdown` se completa en el spec final para consumidores que leen solo `evaluationSpec`.

4. **Auto-extend más robusto**
   - De 1 intento a **hasta 2 intentos** cuando `estimated < target*0.85`.
   - Criterio de corte temprano: `>= target*0.9`.
   - Se mantiene el mejor spec (mayor estimación) entre intentos.
   - Si sigue corto tras 2 intentos, se devuelve best-effort + warning `DURATION_EXTEND_FAILED`.
   - Se agregaron logs con índice de intento (`attempt 1/2`, `attempt 2/2`).

5. **Frontend con fallback robusto**
   - `useEvaluationPipeline` ahora deriva `estimatedMinutes` y `timeBreakdown` así:
     - primero root-level (`estimatedTotalMinutes`, `timeBreakdown`),
     - luego fallback a `evaluationSpec.meta.duration.minutes` y `evaluationSpec.meta.duration.breakdown`.
   - Resultado: el widget puede mostrar comparación de tiempos también con respuestas viejas.

---

## 2) Archivos modificados

### Edge (Supabase)
- `supabase/functions/modify-evaluation-v2/index.ts`
- `supabase/functions/modify-evaluation-v2/durationMath.ts` (nuevo)

### Tests (edge)
- `supabase/functions/modify-evaluation-v2/__tests__/durationMath.test.ts` (nuevo)
- `supabase/functions/modify-evaluation-v2/__tests__/durationResponseContract.test.ts` (nuevo)

### Frontend types/pipeline
- `src/services/evaluations/v2Types.ts`
- `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`

---

## 3) Representación actual de duración (target vs estimate)

### En la respuesta V2 (root)
- `targetDurationMinutes`: objetivo solicitado por docente (o `null`).
- `estimatedTotalMinutes`: estimación heurística final (determinística) del spec devuelto.
- `timeBreakdown`: desglose de tiempo (por sección + supuestos heurísticos).

### En `evaluationSpec.meta.duration`
- `minutes`: **estimación** (misma semántica que `estimatedTotalMinutes`).
- `targetMinutes`: objetivo solicitado (opcional).
- `breakdown`: desglose (opcional).

**Regla aplicada:** `evaluationSpec.meta.duration.minutes === estimatedTotalMinutes` en respuestas exitosas.

---

## 4) Cómo probar manualmente en UI (paso a paso)

1. Abrir generación de evaluaciones con V2 habilitado.
2. Seleccionar un grupo/materia y fijar **Duración objetivo** (por ejemplo, 80).
3. Generar evaluación.
4. Verificar en UI:
   - En `TimeBudgetingSection`, se muestre comparación objetivo vs estimado.
   - En header de evaluación (`EvalHeader`), la duración coincida con la estimación final.
5. Abrir logs del edge y confirmar:
   - logs `[DURATION] target=... estimated=...`,
   - si aplica, logs `[DURATION_AUTO_EXTEND_LOOP] attempt 1/2 ...`.
6. Caso de brecha grande:
   - si no alcanza `>= 90%` del target tras 2 intentos, debe aparecer warning `DURATION_EXTEND_FAILED` (best-effort).

---

## 5) Tests agregados y cómo correrlos

### Tests agregados
1. `durationMath.test.ts`
   - valida cálculo determinístico de `estimateDurationFromSpec`.
   - valida consistencia de `buildDurationBreakdownFromSpec`.

2. `durationResponseContract.test.ts`
   - valida contrato esperado para target=80:
     - `estimatedTotalMinutes` numérico,
     - `meta.duration.minutes === estimatedTotalMinutes`,
     - echo de `targetDurationMinutes`,
     - criterio de aceptación: en banda 90–110% o warning best-effort.

### Comandos
- Desde raíz:
  - `deno test "supabase/functions/modify-evaluation-v2/__tests__/durationMath.test.ts"`
  - `deno test "supabase/functions/modify-evaluation-v2/__tests__/durationResponseContract.test.ts"`

> Nota: en este entorno de trabajo actual no está instalado `deno`, por lo que no se pudieron ejecutar aquí; se dejaron listos para correrse en entorno con Deno.

---

## 6) Limitaciones conocidas

1. **Token truncation sigue siendo posible** en respuestas muy largas (`max_completion_tokens`); se mitigó con 2 intentos y best-effort, pero no se elimina completamente.
2. **Auto-extend es best-effort**: puede no llegar al 90% del target en casos complejos; se informa por warning en vez de ocultarlo.
3. **Tests de integración reales contra OpenAI no incluidos**: los tests añadidos son determinísticos y no dependen de llamadas externas (intencional para estabilidad).

