# Ultra-Lite CPU Mitigation para `modify-evaluation-v2`

## Qué se cambió (por archivo)

- `supabase/functions/modify-evaluation-v2/index.ts`
  - Se agregó modo `ULTRA_LITE` para bundling de materiales, con defaults de producción seguros.
  - Se agregó modo `SMART_SELECTION` como opt-in explícito.
  - Se incorporó short-circuit por tamaño de input: si el input total es grande y `ULTRA_LITE` estaba apagado, se fuerza `ULTRA_LITE` para ese request.
  - Se agregó constructor de bundle ultra-liviano:
    - máximo de materiales,
    - máximo por material,
    - tope total de caracteres,
    - limpieza barata en una sola pasada.
  - Se conectó el resto del pipeline para usar `materialsForPipeline` (bundle ya reducido), evitando rescans de textos grandes.
  - Se saltea limpieza pesada de excerpt en `ULTRA_LITE`.
  - Se mantiene política de grounding: sin evidencia usable no se agrega filler y se retorna outcome explícito.
  - Se agregó resumen debug liviano (`modeUsed`, `totalInputChars`, `bundleChars`, `llmCallCount`) sin dumps grandes.

## Nuevas env vars y defaults

- `MODIFY_EVALUATION_V2_ULTRA_LITE_MODE=true`
- `MODIFY_EVALUATION_V2_SMART_SELECTION_MODE=false`
- `MODIFY_EVALUATION_V2_ULTRA_LITE_MAX_MATERIALS=2`
- `MODIFY_EVALUATION_V2_ULTRA_LITE_MAX_CHARS_PER_MATERIAL=4000`
- `MODIFY_EVALUATION_V2_ULTRA_LITE_TOTAL_BUNDLE_CHARS=9000`
- `MODIFY_EVALUATION_V2_ULTRA_LITE_FORCE_THRESHOLD_CHARS=50000`

Ya existentes (recomendados en prod-safe):
- `MODIFY_EVALUATION_V2_USE_LLM_REPAIRS=false`
- `MODIFY_EVALUATION_V2_USE_DURATION_AUTO_EXTEND=false`
- `MODIFY_EVALUATION_V2_USE_NARRATIVE_LLM_CALLS=false`
- `MODIFY_EVALUATION_V2_MAX_LLM_CALLS=1`

## Por qué `ULTRA_LITE` baja CPU

En `ULTRA_LITE` se evita el trabajo sincrónico más caro:

- No se ejecuta el pipeline de selección inteligente (chunking, ranking, rescoring, top-up).
- No se construyen arrays grandes de ventanas/pasajes para scoring.
- No se hacen múltiples pasadas de limpieza heurística compleja.
- No se hace top-up agresivo de materiales.
- No se corre limpieza pesada de excerpts post-generación.

En su lugar:

- Se toma una muestra chica y acotada (lineal, una pasada).
- Se aplica filtro de ruido mínimo por línea.
- Se corta por presupuesto fijo de caracteres.

Resultado esperado: menor CPU síncrono por request y menor riesgo de `WORKER_LIMIT`.

## Comportamiento esperado

### Caso PDF largo (70+ páginas)

- Con defaults (`ULTRA_LITE=true`), el request usa bundle compacto.
- `debug.modeUsed=ULTRA_LITE`.
- `debug.bundleChars` queda dentro de tope configurado.
- `debug.llmCallCount` se mantiene en 1 por defecto.
- Debe bajar fuertemente la probabilidad de `WORKER_LIMIT`.

### Caso grounding insuficiente

- Si el bundle ultra-lite no tiene evidencia usable para completar duración:
  - no se inventan ítems genéricos,
  - respuesta:
    - `success=false`
    - `outcome.code=GROUNDING_INSUFFICIENT_TO_MEET_DURATION`
    - guidance para bajar minutos o agregar material mejor/limpio.

## Verificación rápida (manual)

- [ ] Generar V2 con materiales extensos y confirmar:
  - [ ] `requestId` presente en respuesta
  - [ ] `debug.modeUsed` = `ULTRA_LITE` (o `SMART_SELECTION` solo si activado)
  - [ ] `debug.totalInputChars` y `debug.bundleChars` presentes
  - [ ] `debug.llmCallCount <= 1` en default
- [ ] Forzar material pobre/ruidoso + objetivo de minutos alto y confirmar:
  - [ ] `success=false`
  - [ ] `outcome.code=GROUNDING_INSUFFICIENT_TO_MEET_DURATION`
  - [ ] no aparece filler genérico
- [ ] Confirmar que `v2 -> v1` fallback sigue desactivado por defecto en frontend.

## Configuración recomendada de producción

- Mantener `ULTRA_LITE` activo.
- Activar `SMART_SELECTION` solo para diagnóstico puntual/controlado.
- Mantener `MAX_LLM_CALLS=1` salvo pruebas controladas.
- Ajustar `ULTRA_LITE_*_CHARS` conservadoramente si reaparece presión de CPU.
