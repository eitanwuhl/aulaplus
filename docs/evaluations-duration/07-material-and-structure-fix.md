# Material quality, item bundling y extend reforzado

**Objetivo:** Mejorar la calidad de ítems basados en fuente (excerpts reales), agrupar MC por pasaje, y reforzar el auto-extend para acercarse al target de duración.

---

## 1) Por qué los ítems de fuente eran pobres (solo títulos)

Algunos ítems `source_analysis` mostraban solo el título del capítulo o material en lugar del fragmento real. La estimación de duración tampoco alcanzaba el objetivo (p. ej. target 80, estimado extendido ~61).

**Causas:**
- El modelo a veces rellenaba `item.source.content` con el título del material en lugar del texto extraído.
- La duración heurística no sube solo expandiendo texto; hace falta añadir ítems o cambiar tipos (ver doc 06).
- Si los materiales enviados al prompt no incluían `extractedText` (solo título), el LLM no tenía fragmento real para copiar.

**Cambios:**
- Validación de excerpts en servidor: todo ítem `source_analysis` debe tener `source.content` con al menos **200 caracteres** (umbral documentado en `excerptValidation.ts`). Así se evita “solo título”.
- Reparación con materiales: si hay fallos de validación y el diseño incluye materiales con `extractedText` usable (≥200 caracteres), se ejecuta un paso de reparación que rellena `source.content` solo con esos textos (sin inventar).
- Si no hay materiales con texto usable, se emite warning `SOURCE_EXCERPT_MISSING` y se degradan los ítems afectados a `short_answer` (sin modificar IDs de ítems que se mantienen).
- El pipeline de diseño ya envía `extractedText` en `designPlan.materials` cuando está disponible (p. ej. desde digest de sesión); el edge lo usa en el prompt y en la reparación.

---

## 2) Validación y reparación de excerpts (umbral y flujo)

**Umbral:** `MIN_EXCERPT_LENGTH_CHARS = 200` (definido en `excerptValidation.ts`). Cualquier ítem cuyo tipo está en `ITEM_TYPES_REQUIRING_SOURCE` (p. ej. `source_analysis`) debe tener `item.source.content` con al menos 200 caracteres (tras trim).

**Flujo:**
1. Tras generación y tras auto-extend, se ejecuta `validateExcerpts(spec)`. Si hay fallos (ítems con excerpt ausente o corto):
2. Se registra en logs: `[EXCERPT_VALIDATION] failures:` con `itemId`, `itemType`, `sectionId`.
3. Si hay materiales con `extractedText` usable (≥200 caracteres): se llama a `runExcerptRepair` (un paso LLM que solo rellena `source.content` con los textos proporcionados, sin inventar). Se registra `[EXCERPT_REPAIR] ran` y `succeeded=true/false`. Si tras la reparación siguen fallos, se degradan esos ítems a `short_answer`.
4. Si no hay materiales con texto usable (o no hay materiales): se añade warning `SOURCE_EXCERPT_MISSING` cuando corresponda (“Los materiales no incluyen texto extraído suficiente…”) y se degradan los ítems afectados.
5. Códigos de warning: `SOURCE_EXCERPT_MISSING`, `SOURCE_EXCERPT_REPAIRED` (info cuando la reparación rellenó excerpts).

---

## 3) Reglas de agrupación (MC por pasaje y source_analysis)

En el prompt de generación V2 (sección “AGRUPACIÓN POR TEXTO/PASAGE”):

- **Cuando un ítem se basa en un texto/pasaje/fuente proporcionado:**
  - **multiple_choice:** se debe generar un **conjunto de 4 a 6 ítems** de opción múltiple sobre ese mismo texto (no una sola pregunta). Cada ítem con id único. La duración se calcula por ítem (2 min por cada MC).
  - **source_analysis:** al menos **2–3 subpreguntas o ítems** claramente separados sobre la misma fuente (subItems o ítems consecutivos con la misma source). Cada uno con id único. 14 min por ítem en la estimación.

- Reglas explícitas: no un solo ítem MC por pasaje (se requieren 4–6 cuando hay texto base); no un solo ítem source_analysis sin subpreguntas (mínimo 2–3).

Estas reglas están alineadas con la tabla heurística (MC=2 min, source_analysis=14 min, etc.).

---

## 4) Estrategia de extend mejorada (deltaMinutesNeeded y 3.er intento)

En los mensajes de auto-extend se incluyen:
- `currentEstimateMinutes`, `targetMinutes`, banda aceptable (low/high, 90–110%).
- `deltaMinutesNeeded = max(0, low - currentEstimateMinutes)` (minutos heurísticos a añadir para llegar al menos a `low`).
- Instrucción concreta: añadir **≥ deltaMinutesNeeded** minutos según la tabla heurística, mediante **ítems nuevos** y/o **conversión de tipos** a tipos de más minutos (no ampliando solo texto).

Si tras el intento 1 la estimación heurística apenas sube (≤ old + 1), el intento 2 (y, si aplica, el 3) recibe la instrucción reforzada: “Tu intento anterior no aumentó los minutos heurísticos estimados; debes añadir ítems nuevos o cambiar tipos de ítem; expandir texto no basta.”

**Tercer intento:** cuando `deltaMinutesNeeded > 8` (queda mucho por cubrir), se permiten **3 intentos** de extend en lugar de 2, para reducir casos “stuck” (p. ej. estimado ~61 con target 80).

Logs: estimación inicial, target, `deltaMinutesNeeded`; por intento `oldEst → newEst`; indicación de uso de 3 intentos cuando aplique; rechazo por “heuristic estimate did not increase meaningfully”.

---

## 5) Pasos para probar a mano

**Target 80 y sección basada en fuente:**
1. Crear un plan de diseño con duración objetivo 80 min y materiales que tengan `extractedText` (p. ej. desde digest de sesión con PDF con texto extraído).
2. Generar evaluación V2. Revisar logs: `[DURATION_AUTO_EXTEND_LOOP]` (initial estimate, deltaMinutesNeeded, intentos, oldEst → newEst); `[EXCERPT_VALIDATION]` y `[EXCERPT_REPAIR]` si hay ítems source_analysis.
3. Comprobar en la evaluación generada:
   - Ítems `source_analysis` con `source.content` largo (≥200 caracteres), no solo título.
   - Si hay un pasaje/fuente, que existan 4–6 ítems MC sobre ese texto (o 2–3 subpreguntas/ítems en source_analysis).
   - Duración estimada lo más cerca posible del target (al menos en banda 90–110% si el extend tuvo éxito).
4. Probar sin `extractedText` en materiales: debe aparecer warning `SOURCE_EXCERPT_MISSING` y degradación a `short_answer` en ítems que no cumplan el umbral.

**Sample source-based section:** Incluir en el diseño una sección que indique “usar material X” y asegurarse de que el material tenga texto extraído; verificar que la sección resultante tenga múltiples ítems MC o 2–3 ítems/subpreguntas de source_analysis con el mismo `source`.

---

## Limitaciones conocidas

- La reparación de excerpts solo usa textos ya proporcionados en `designPlan.materials`; no se inventa contenido.
- Si el PDF no tiene texto extraído o los materiales no incluyen `extractedText`, los ítems source_analysis se degradan o quedan con warning.
- El extend sigue siendo best-effort (tokens, capacidad del modelo); puede no alcanzar exactamente la banda 90–110%.
- Los IDs de ítems existentes no se modifican; solo los ítems nuevos reciben IDs únicos.
