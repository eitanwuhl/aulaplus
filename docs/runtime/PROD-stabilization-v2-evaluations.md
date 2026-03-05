# PROD Stabilization V2 Evaluations

Fecha: 2026-03-04  
Branch: `micro-cambios`

## 1) Summary of changes

Se aplicó una estabilización cohesiva en `modify-evaluation-v2` para mejorar realismo, grounding en material y control de costo:

- **Grounding con evidencia usable**:
  - Rechazo fuerte de TOC/Índice, bibliografía, prólogo y metadata.
  - Heurística reforzada para patrones de índice (dot leaders + page numbers + chapter list).
  - `source_analysis` solo se mantiene si hay excerpt de calidad (1–3 párrafos, no TOC/metadata).
  - Si no hay excerpt válido, degradación determinista a `short_answer` con prompt reescrito.

- **Presupuesto mínimo de evidencia curada**:
  - Chunking por párrafos con mínimo 60 chars.
  - División de bloques largos en ventanas ~700 chars.
  - Top-up pass para alcanzar `MIN_K` + `MIN_CHARS` cuando el texto fuente lo permite.
  - Shortfall explícito: `INSUFFICIENT_USABLE_TEXT` cuando no hay material limpio suficiente.

- **Duration filler realista (sin spam)**:
  - Hard cap de filler: `MAX_FILLER_ITEMS_TOTAL = 4`.
  - Prioridad: `essay` / `paragraph` / `short_answer`; MC solo con excerpt de alta calidad.
  - Guard de no repetición de stems (normalización + overlap de keywords).
  - Si no conviene seguir sin degradar calidad: warning `DURATION_REALISM_CAP_REACHED`.
  - Se evita crear sección dedicada de relleno en el flujo normal (se agrega sobre sección existente).

- **Comprehension bundle real**:
  - Si hay pasajes utilizables y no existe bundle, se crea determinísticamente:
    - 1 `source_analysis` + 4 MC + 1 `short_answer` sobre excerpt real.
  - Si no hay excerpt de calidad, fallback a ítems abiertos coherentes (sin dependencia de fragmento).

- **Invariantes finales deterministas**:
  - Sin MC placeholder.
  - Sin referencias a fragmento sin excerpt válido.
  - Sin `source_analysis` con excerpt de baja calidad.
  - Warnings: `ITEM_INVARIANT_FIXED`, `SOURCE_EXCERPT_LOW_QUALITY_DEGRADED`.

- **Contención de costo/tiempo (546 prevention)**:
  - Se mantiene el flujo normal en una sola llamada OpenAI (`llmCallCount=1` esperado).
  - Selección de pasajes con early-exit cuando se cumple umbral mínimo.
  - `debug.metrics` con tiempos clave y skip de debug no esencial si `postProcessMs > 200`.

- **Rollback en runtime (sin redeploy)**:
  - Header `x-aulaplus-env: legacy` activa camino legacy.
  - `debug.mode = "new" | "legacy"` para verificación.

## 2) Invariants & warnings added/updated

### Invariants
- No usar TOC/Index/metadata como excerpt.
- No depender de “fragmento” sin excerpt de alta calidad adjunto.
- MC con al menos 3 opciones no placeholder y 1 correcta marcada.

### Warnings relevantes
- `SOURCE_EXCERPT_LOW_QUALITY_DEGRADED` (warning)
- `ITEM_INVARIANT_FIXED` (info)
- `DURATION_REALISM_CAP_REACHED` (warning)
- `DURATION_DELTA_FILLER_APPLIED` (info)
- `COMPREHENSION_BUNDLE_ADDED` (info)
- `COMPREHENSION_BUNDLE_FALLBACK_OPEN_ITEMS` (warning)

## 3) Runtime verification checklist (DevTools)

En respuesta de `modify-evaluation-v2` revisar `debug`:

- `mode` (`new` por defecto; `legacy` con header)
- `llmCallCount` (esperado: 1 en flujo normal)
- `materialsPromptPath` (`bundle` cuando hay materiales usables)
- `materialQuality`:
  - `usableBlocksCount`
  - `rejectedByReason`
  - `selectedPassagesCount`
  - `selectedChars`
  - `shortfallReason`
- `finalK`, `finalChars`, `keptBlocksCount`, `passagesRejectedCount`
- `metrics`:
  - `promptChars`
  - `selectionMs`
  - `postProcessMs`
  - `openaiMs`
  - `totalMs`
  - `skippedNonEssentialDebug`

Y en payload final:
- No excerpts TOC/Index.
- No prompts “según el fragmento anterior” sin excerpt válido.
- Sin MC con opciones placeholder.

## 4) Manual max-difficulty test recipe (3 runs)

Usar material Batllismo y target 80 min, dificultad máxima.

### Run 1
1. Ejecutar generación V2 normal.
2. Verificar:
   - `debug.mode = "new"`
   - `llmCallCount = 1`
   - excerpt de `source_analysis` coherente (1–3 párrafos) y no TOC.

### Run 2
1. Repetir con el mismo grupo/material.
2. Verificar:
   - filler <= 4 ítems totales.
   - si aparece `DURATION_REALISM_CAP_REACHED`, no hay spam ni ítems incoherentes.
   - sin stems repetidos evidentes en ítems agregados.

### Run 3
1. Repetir y revisar métricas:
   - `finalChars >= 20000` cuando `extractedText` usable lo soporta.
   - si no llega, `shortfallReason = "INSUFFICIENT_USABLE_TEXT"` y rechazo por calidad consistente.
   - sin HTTP 546 en la ejecución.

### Acceptance criteria
- No TOC excerpts.
- No filler spam (<=4 ítems; idealmente 0–2).
- No ítems incoherentes.
- `llmCallCount=1`.
- Sin 546.

## 5) Rollback instructions (header)

Para activar rollback en runtime, enviar:

`x-aulaplus-env: legacy`

Efecto esperado:
- `debug.mode = "legacy"`
- single OpenAI call + invariantes mínimas deterministas
- sin filling agresivo de duración.
