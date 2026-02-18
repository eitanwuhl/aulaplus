# Mejora de especificidad de rúbricas por ítem

**Objetivo:** Que cada descriptor de rúbrica evalúe de forma explícita la **acción cognitiva** pedida en la consigna y el **contenido/conocimiento** concreto, sin frases genéricas reutilizables entre ítems.

**Archivo modificado:** `supabase/functions/modify-evaluation-v2/index.ts`

---

## 1. Resumen del cambio de prompt

En la sección **"RÚBRICA POR ÍTEM (CRÍTICO)"** del system prompt se añadieron:

- **Requisitos por descriptor:**
  1. Extraer el verbo de acción principal del ítem (explicar, justificar, analizar, comparar, argumentar, interpretar).
  2. Identificar los conceptos o contenidos clave de la consigna.
  3. Que cada descriptor mencione explícitamente la acción y el contenido concreto evaluado.

- **Prohibiciones:** Frases genéricas como "responde correctamente", "desarrolla una respuesta adecuada", "argumenta de forma clara", o "identifica ideas relevantes" sin mencionar el tema.

- **Regla explícita (inglés):**  
  *"Each level descriptor must clearly mention the specific topic/content evaluated in the question and the action required. Generic, reusable wording is not allowed."*

La instrucción crítica en el bloque de estructura JSON se actualizó para reforzar que los descriptores deben mencionar la acción pedida y el contenido específico del ítem.

---

## 2. Heurística de calidad en servidor

Tras parsear `evaluationSpec`, para cada ítem abierto con rúbrica ya normalizada se aplica:

1. **Extracción de palabras clave del prompt** (`extractPromptKeywords`):
   - Normalización a minúsculas y eliminación de caracteres no alfanuméricos.
   - Filtro de stopwords en español (artículos, preposiciones, etc.) y palabras de longitud &lt; 3.
   - Hasta **5 palabras** significativas, sin repetición, en orden de aparición.

2. **Detección de descriptores genéricos** (`areDescriptorsGeneric`):
   - Se concatena el texto de todos los `descriptor` de la rúbrica.
   - Si **ninguna** de las palabras clave del prompt aparece en ese texto, la rúbrica se considera genérica.

3. **Acción:** Si la rúbrica es genérica, se **reemplaza solo esa rúbrica** por `buildContentSpecificFallbackRubric(prompt, points)` y se añade un warning `RUBRIC_GENERIC_REPLACED` en `response.warnings`. La evaluación no falla.

---

## 3. Ejemplo antes / después de descriptor

**Prompt del ítem (ejemplo):**  
*"Analiza las causas económicas de la Primera Guerra Mundial y el rol de las potencias centrales."*

**Antes (genérico):**
- Excelente: *"Responde correctamente con precisión, profundidad y evidencia pertinente."*
- Insuficiente: *"No logra responder la consigna de forma suficiente o presenta errores conceptuales relevantes."*

**Después (específico de contenido y acción):**
- Excelente: *"Desarrolla la consigna sobre causas, económicas, primera con precisión, evidencia pertinente y relación clara con el contenido evaluado."*  
  (En la práctica el fallback usa hasta 3 palabras clave unidas: ej. *"causas, económicas y primera"* como tema.)
- Insuficiente: *"No logra abordar de forma suficiente el contenido de la consigna (causas, económicas y primera) o presenta errores conceptuales relevantes."*

El fallback content-specific construye una frase de contenido a partir de las palabras clave extraídas del prompt (`contentPhrase`) y la incluye en los cuatro niveles (excelente, bueno, en proceso, insuficiente) para que los descriptores no sean intercambiables entre ítems.

---

## 4. Comportamiento del fallback

- **Cuándo se usa el fallback de rúbrica:**
  1. **Sin rúbrica o rúbrica inválida:** se asigna `buildFallbackRubric(prompt, points)` (que internamente llama a `buildContentSpecificFallbackRubric`) y se emite `OPEN_ENDED_RUBRIC_FALLBACK_APPLIED`.
  2. **Rúbrica presente pero genérica:** tras normalizar, si `areDescriptorsGeneric` es verdadero, se reemplaza la rúbrica por `buildContentSpecificFallbackRubric(prompt, points)` y se emite `RUBRIC_GENERIC_REPLACED`.

- **Compatibilidad:**  
  El fallback content-specific mantiene la misma estructura (`ItemRubricV2`, cuatro niveles con `key`, `label`, `descriptor`, `minPoints`, `maxPoints`). No se cambia el modelo de datos. Sigue siendo compatible con el flujo de fast fallback y emergency template.

- **Limitación:**  
  El fallback no infiere verbos de acción desde el prompt; solo inyecta contenido (palabras clave). La mejora de acción explícita depende sobre todo del prompt al modelo. En futuras iteraciones podría añadirse detección de verbos en el prompt para incluirlos en los descriptores del fallback.
