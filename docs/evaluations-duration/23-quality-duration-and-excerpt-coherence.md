# Calidad, duración 95% y coherencia de excerpts

**Objetivo:** Acercar la duración al objetivo (≥95%), reducir fallbacks de rúbrica y completar Version B (promptB), y garantizar que los fragmentos de fuente en `source_analysis` sean párrafos coherentes y analizables (no portada ni metadatos).

---

## 1) Por qué los excerpts “crudos” no eran analizables

En el camino V2 NEW, los ítems `source_analysis` usan `extractedText` real de los materiales; aun así, a veces el contenido en `source.content` era **pedagógicamente inanalizable**:

- **Portada / metadatos:** líneas con título repetido, autor, afiliación, correo, “Instituto…”, “Universidad…”, DOI, páginas.
- **Cabeceras bibliográficas:** pies de página, números sueltos, separadores.
- **Falta de relevancia:** fragmentos que no contienen los conceptos que pide la consigna del ítem.

Eso hacía que la consigna (p. ej. “Analiza las políticas económicas del Batllismo…”) no tuviera un pasaje donde aparecieran esos conceptos, lo que degrada la validez del ítem.

**Solución:** Un paso determinista de **limpieza y selección** de excerpts: quitar patrones de portada/metadatos y elegir 1–3 párrafos contiguos que coincidan con los términos clave del prompt del ítem (con longitud mínima/máxima acotada).

---

## 2) Cómo funciona la limpieza y selección de excerpts

**Archivos:** `excerptCleaning.ts`, `excerptValidation.ts` (umbrales).

### 2.1) Limpieza (eliminar portada y metadatos)

- **Patrones de línea** considerados metadatos (y por tanto descartados o no usados como párrafo sustantivo):
  - Emails (`@...`), líneas que empiezan por “Instituto”, “Universidad”, “Facultad”, “Autor”, “Correspondencia”, “DOI”, “ISSN”, “ISBN”, URLs, líneas de solo números, separadores (`---`, `___`).
- Líneas muy cortas (< 15 caracteres) se tratan como títulos/repetidos y no se conservan como párrafos.
- Solo se consideran “párrafos sustantivos” bloques de texto con al menos **40 caracteres** por línea (evita cabeceras sueltas).

### 2.2) Relevancia (coincidencia con el prompt del ítem)

- Se extraen **términos clave** del prompt del ítem (palabras ≥ 4 caracteres, sin duplicados, en minúsculas).
- Cada candidato de 1–3 párrafos contiguos se puntúa por **solapamiento de términos**: cuántos de esos términos aparecen en el pasaje.
- Se elige el bloque que maximice esa puntuación y cumpla longitud mínima/máxima.

### 2.3) Estructura y longitud

- **Salida:** 1–3 párrafos contiguos (no una concatenación arbitraria de líneas).
- **Longitud mínima:** `MIN_EXCERPT_LENGTH_CHARS = 200` (mismo que validación de excerpts).
- **Longitud máxima:** `MAX_EXCERPT_LENGTH_CHARS = 3500` para no devolver bloques enormes.

### 2.4) Dónde se aplica

1. **Al construir la sección de materiales en el prompt:** `buildMaterialsExcerptSection` usa `cleanMaterialTextForPrompt` por material, de modo que el LLM recibe ya fragmentos limpios (sin portada/metadatos).
2. **Tras validación/reparación de excerpts:** Se ejecuta `applyExcerptCleaningToSpec(spec, materials, warnings)`: para cada ítem `source_analysis` se reemplaza `source.content` por el mejor candidato limpio y relevante (si el contenido actual parece metadatos o hay un candidato mejor). Se emiten:
   - **SOURCE_EXCERPT_CLEANED** (info): se reemplazó un fragmento crudo por uno limpio.
   - **SOURCE_EXCERPT_LOW_RELEVANCE** (warning): no se encontró un pasaje óptimo; se usó el mejor disponible.

### 2.5) Debug (solo en respuesta debug)

Cuando hay estadísticas de excerpt, en `response.debug.excerptStats` se incluye por ítem:

- `excerptSource`: `"cleaned_selection"` o `"raw"`
- `excerptLengthChars`
- `topMatchedKeywords`: términos del prompt que aparecieron en el pasaje elegido

---

## 3) Cambios en umbrales de duración (95% y banda centrada)

**Antes:** Banda 90%–110% del objetivo; parada al alcanzar ≥90%; extensión si estimado < 85% del objetivo.

**Ahora:**

- **Banda objetivo:** 95%–105% del objetivo (centrada en el target).
- **Cota inferior (low):** `low = round(target * 0.95)`.
- **Cota superior (high):** `high = round(target * 1.05)` para extend y trim.
- **Disparo del auto-extend:** se extiende si la estimación heurística es **&lt; 95%** del objetivo (no solo &lt; 85%).
- **Condición de parada del extend:** se deja de extender cuando la estimación alcanza **≥ 95%** del objetivo (no 90%).
- **Advertencia DURATION_EXTEND_FAILED:** se emite cuando, tras los intentos de extensión, la estimación final sigue por debajo del **95%** del objetivo.

Con target 80 min, el sistema intenta que la estimación quede entre 76 y 84 min (95%–105%), y solo da por fallida la extensión si no se llega a 76 min.

**Importante:** `meta.duration.minutes` sigue siendo siempre la **estimación heurística** (suma por tipo de ítem y sobrecarga de sección); no se sustituye por el target.

---

## 4) Repair pass de rúbricas y Version B (promptB)

Tras tener el spec final (después de extend, validación/reparación de excerpts y trim), se ejecuta **una sola** llamada LLM de reparación que:

1. **Detecta:**
   - Ítems abiertos (essay, paragraph, short_answer, source_analysis, true_false_justify) con rúbrica ausente, mal formada o de baja calidad (sin contenido específico o sin acción cognitiva en los descriptores).
   - Ítems sin `versionedContent.promptB` cuando se solicitó Version B.

2. **Reparación (una sola pasada):**
   - Mejora las rúbricas de esos ítems con descriptores **específicos al contenido** y a la acción pedida (analizar, justificar, etc.); no descriptores genéricos reutilizables.
   - Rellena `versionedContent.promptB` en los ítems que lo tenían vacío (adaptación de contenido declarada).
   - **No cambia** IDs de ítems ni el contenido evaluado (prompt base, opciones, correctAnswer, objetivos).

3. **Si la reparación falla** (parse, validación o error de OpenAI): se mantiene el spec original y se añade un único warning `RUBRIC_PROMPTB_REPAIR_FAILED`.

Códigos de aviso: `RUBRIC_PROMPTB_REPAIRED` (info), `RUBRIC_PROMPTB_REPAIR_FAILED` (warning).

---

## 5) Advertencias sin duplicados

Las advertencias se **deduplican por código** antes de devolver la respuesta: cada código (p. ej. `VERSION_B_PARTIAL_CONTENT`) aparece como máximo una vez por request. Así se evitan repeticiones cuando la validación/normalización se ejecuta varias veces (generación, extend, repair).

---

## 6) Cómo probar a mano

### Duración (target 80)

1. Generar una evaluación con duración objetivo **80 min**.
2. Comprobar que la **duración estimada** (`meta.duration.minutes`) quede **cerca de 80** (idealmente entre 76 y 84 min; al menos ≥ 76 si el extend tuvo éxito).
3. Revisar logs: `[DURATION_AUTO_EXTEND_LOOP]` con banda 76–84; parada “reached >=95% target”.

### Excerpts coherentes en source_analysis

1. Usar materiales con `extractedText` que incluya portada/metadatos (autor, email, institución) y párrafos sustantivos con conceptos (p. ej. “Batllismo”, “políticas económicas”, “Estado”).
2. Generar evaluación con ítems `source_analysis` que pidan analizar esos conceptos.
3. Comprobar en el spec devuelto:
   - En los ítems `source_analysis`, `source.content` son **1–3 párrafos** con contenido sustantivo, **sin** bloques de autor/email/institución/portada.
   - El fragmento está **alineado con la consigna** (aparecen términos como los del prompt).
4. Opcional: revisar `response.debug.excerptStats` (si existe): `excerptSource: "cleaned_selection"`, `topMatchedKeywords` no vacío cuando el prompt tiene términos claros.

### Rúbricas y promptB

1. Solicitar **Version B** (estudiantes con adaptación de contenido declarada).
2. Tras generar, comprobar que los ítems tengan `versionedContent.promptB` rellenado cuando corresponda.
3. Revisar que las rúbricas de ítems abiertos tengan descriptores específicos (no genéricos); si se aplicó reparación, puede aparecer `RUBRIC_PROMPTB_REPAIRED` en las advertencias.

---

## 7) Tests unitarios (sin OpenAI)

- **`durationMath.test.ts`:** Banda 95%–105% (low/high para target 80), `computeDeltaMinutesNeeded` para alcanzar 95%.
- **`excerptCleaning.test.ts`:** Limpieza de metadatos, selección por términos clave, `looksLikeMetadata`, `cleanMaterialTextForPrompt`, longitud mínima.
- **`excerptValidation.test.ts`:** Validación de longitud mínima y tipos que requieren fuente.

Ejecución (en entorno con Deno, p. ej. Supabase):

```bash
deno test __tests__/durationMath.test.ts __tests__/excerptCleaning.test.ts __tests__/excerptValidation.test.ts --allow-read
```
