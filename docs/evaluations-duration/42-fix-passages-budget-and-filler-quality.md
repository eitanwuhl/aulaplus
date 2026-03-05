# 42) Fix passages budget (6–10, ~20k–30k chars), filler quality, single-call flow

Fecha: 2026-03-04  
Ámbito: `modify-evaluation-v2` (selección de pasajes, delta filler, fill determinista, llmCallCount).

## Por qué en runtime solo se enviaba 1 pasaje y ~2k caracteres

En depuración se observó:
- `passagesSelectedCount = 1`
- `materialsCharsSent = 2003`

Eso explicaba ítems de baja calidad: MC con placeholders, tablas sin datos, referencias a “fragmento anterior” sin excerpt real.

Causas identificadas:
1. **Chunking insuficiente:** Bloques muy largos no se partían; el filtro de calidad (TOC/prólogo/biblio/metadata) dejaba pocos candidatos y el top-K se aplicaba sobre una lista corta.
2. **Presupuesto no aplicado como 20k–30k:** El flujo no forzaba un mínimo de pasajes ni un char budget claro; con un solo bloque grande aceptado, el total quedaba en ~2k.
3. **Sin fallback cuando el filtro dejaba &lt;6 bloques:** No había lógica para relajar solo TOC/prólogo/biblio (manteniendo exclusión de metadata) ni para rellenar con bloques sustantivos por densidad.

## Cambios que garantizan 6–10 pasajes y ~20k–30k caracteres

### Constantes

- `MATERIAL_SELECTION_TOP_K = 10`, `MATERIAL_SELECTION_MIN_K = 6`
- `MATERIAL_SELECTION_CHAR_BUDGET = 28000`, `MATERIAL_SELECTION_CHAR_BUDGET_MIN = 20000`
- `MIN_PARAGRAPH_LEN = 60`, `LONG_BLOCK_CHUNK_SIZE = 700`

### Pipeline de selección

1. **Chunking:**  
   - Bloques por párrafos con mínimo `MIN_PARAGRAPH_LEN` (60) para obtener más candidatos.  
   - Bloques &gt; `LONG_BLOCK_CHUNK_SIZE*2` se parten con `chunkLongBlock(block, LONG_BLOCK_CHUNK_SIZE)` por frases coherentes.

2. **Filtro de calidad:**  
   - Se mantiene el filtro estricto (TOC, biblio, prologue, metadata).  
   - Si tras el filtro `kept.length < MATERIAL_SELECTION_MIN_K`, se rellena con bloques rechazados que **no** son metadata (`!looksLikeMetadata(b)`), hasta un tope de 24 bloques, para no colapsar a 1 pasaje.

3. **Top-K y presupuesto:**  
   - En `buildMaterialsPromptBundle`: se selecciona hasta `MATERIAL_SELECTION_TOP_K` ventanas respetando `MATERIAL_SELECTION_CHAR_BUDGET`.  
   - Si tras el primer recorrido `selected.length < MATERIAL_SELECTION_MIN_K`, un segundo bucle añade ventanas de `ranked` hasta alcanzar MIN_K (sin duplicar mismo materialIdx+passage).  
   - `finalChars` y `finalK` se calculan y se exponen en el bundle.

### Debug en respuesta

En el objeto `debug` de la respuesta se incluyen:
- `keptBlocksCount`, `passagesRejectedCount` (por razón), `finalK`, `finalChars`
- Además de los ya existentes: `passagesSelectedCount`, `materialsCharsSent`, `topKeywordsUsedForSelection`.

Así se puede comprobar en cada request que se están enviando 6–10 pasajes y ~20k–30k caracteres cuando hay `extractedText` disponible.

## Cómo se evita que el filler genere placeholders

### Delta filler (duration)

- **Prohibido:** MC con “Opción A/B/C/D” o “Según el fragmento anterior” sin excerpt.
- **Con excerpt:** Se usa prompt tipo “A partir del fragmento adjunto, seleccione la opción que mejor responde.” y opciones generadas por `buildDeterministicMcOptions(fillerTerms, subject)` (ids `id-opt-1`, etc.) a partir de `expandDeterministicTerms([subject], subject)`.
- **Sin excerpt:** No se añaden MC genéricos; solo se añaden ítems `short_answer` coherentes y evidence-based. Si no hay excerpt disponible para MC, no se crea ese ítem (evitar placeholders).

### Invariante final

- Ninguna opción de MC puede ser placeholder genérico.
- Ningún prompt puede referenciar un fragmento sin que exista un excerpt asociado al ítem o sección.

## Cómo se redujo llmCallCount a 1

- **Auto-extend y auto-trim:** Por defecto desactivados. Se controlan con `USE_DURATION_AUTO_EXTEND` (env `MODIFY_EVALUATION_V2_USE_DURATION_AUTO_EXTEND`, por defecto `false`). Cuando es `false`, no se ejecutan `runDurationAutoExtend` ni `runDurationAutoTrim` (evita 2–3 llamadas extra).
- **Narrativa:** Las llamadas `generateNarrativeOnlyCall` y `generateMissingByVersionNarrativesCall` solo se ejecutan si `USE_NARRATIVE_LLM_CALLS` es `true` (env `MODIFY_EVALUATION_V2_USE_NARRATIVE_LLM_CALLS`, por defecto `false`). En flujo normal se usan solo los fallbacks deterministas (`ensureByVersionNarratives`, `applyNarrativeEvidenceByVersion`, mensaje de timeout cuando no hay narrativa).

Con ambos flags en `false` (por defecto), el flujo normal hace **una sola llamada** a OpenAI (`generateEvaluationV2`).

## Deterministic item fill al final

- `fillMissingItemDataDeterministically` se ejecuta **después** del segundo delta filler (post-degradación), de modo que table/matching/ordering/MC queden con la forma que espera el renderer, incluyendo ítems añadidos por el filler.
- Se mantiene también la llamada anterior (tras excerpt cleaning) para ítems ya existentes; la llamada final asegura que todo lo añadido después tenga datos deterministas correctos.

## Pasos de prueba manual

1. **Dificultad máxima, con materiales:**  
   - Lanzar modify-evaluation-v2 con diseño que incluya materiales con `extractedText` largo y dificultad alta.  
   - En la respuesta, revisar `debug`:  
     - `passagesSelectedCount` (o `finalK`) en rango 6–10.  
     - `materialsCharsSent` (o `finalChars`) en rango ~20k–30k.  
     - `keptBlocksCount` y `passagesRejectedCount` para validar el pipeline.

2. **Sin placeholders:**  
   - Revisar ítems MC: ninguna opción “Opción A/B/C/D” ni “según el fragmento anterior” sin excerpt.  
   - Revisar que tablas/matching/ordering tengan datos (no “table without data”).

3. **llmCallCount:**  
   - En la respuesta, `debug.llmCallCount` (o equivalente en métricas) debe ser 1 en flujo normal sin env vars adicionales.

## Restricciones respetadas

- Sin llamadas OpenAI adicionales en el flujo por defecto.
- Rendimiento estable para evitar WORKER_LIMIT.
- IDs estables (no se cambian esquemas de IDs en spec ni en opciones).
