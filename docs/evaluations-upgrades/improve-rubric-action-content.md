# Mejora de rúbricas: acción cognitiva + contenido (comprobaciones y fallback)

**Objetivo:** Que los descriptores de rúbrica por ítem evalúen de forma explícita la **acción cognitiva** pedida en la consigna y el **contenido/tema** de la pregunta. Si falta alguna de las dos dimensiones, se reemplaza solo la rúbrica de ese ítem por un fallback que incluye ambas.

**Archivo modificado:** `supabase/functions/modify-evaluation-v2/index.ts`

---

## 1. Extracción de acción desde el prompt

### `extractPromptAction(prompt): string | null`

- **Función:** Detecta el verbo de acción cognitiva principal en el prompt y lo devuelve en **infinitivo** (español). Si no hay coincidencia, devuelve `null`.
- **Implementación:** Mapeo determinista con expresiones regulares y límite de palabra (`\b`):
  - Formas imperativas e infinitivo → infinitivo normalizado:  
    `analiza/analice/analizar` → `analizar`, `compara/compare/comparar` → `comparar`, `justifica/justifique` → `justificar`, `explica/explique` → `explicar`, `interpreta/interprete` → `interpretar`, `argumenta/argumente` → `argumentar`, `relaciona/relacione` → `relacionar`, `describe/describa` → `describir`, `evalúa/evalue/evaluar` → `evaluar`.
- **Orden:** Se evalúa la primera coincidencia en el orden del mapa (no se prioriza un verbo sobre otro si ambos aparecen).

---

## 2. Extracción de frase de contenido

### `extractContentPhrase(prompt): string`

- **Función:** Obtiene una frase legible que representa el tema/contenido evaluado (no una lista de palabras clave separadas por comas).
- **Prioridad 1 — Conectores:** Se busca texto después de:
  - `sobre`, `acerca de`, `respecto a`, `en relación con`
  - `causas de`, `consecuencias de`, `rol de`, `impacto de`
  Se toma el fragmento hasta el siguiente `.`, `?` o `!`, recortado a 60–70 caracteres según el conector.
- **Prioridad 2 — Fallback:** Si no se encuentra ningún conector:
  - Se localiza el verbo de acción (mismo mapa que `extractPromptAction`) y se omiten las palabras hasta y comprendiendo ese verbo.
  - Se toman las siguientes 8–12 palabras del prompt, unidas por espacios, hasta 80 caracteres.
- Si el prompt está vacío o el resultado es demasiado corto, se devuelve `"el contenido de la consigna"`.

---

## 3. Detección de calidad de rúbrica

### `checkRubricQuality(rubric, keywords, contentPhrase, action): RubricQualityResult`

Reemplaza/amplía la lógica de “genérico” para exigir **contenido** y **acción**:

- **(A) Presencia de contenido:** Se considera cumplido si:
  - Al menos **una** palabra clave (de `extractPromptKeywords`) aparece en los descriptores, **o**
  - La frase de contenido tiene al menos 2 palabras (≥3 caracteres) y **al menos 2** de esas palabras aparecen en los descriptores (coincidencia parcial).
- **(B) Presencia de acción:** Si se extrajo un verbo de acción del prompt (`action !== null`), al menos **un** descriptor debe contener el verbo en infinitivo o una forma cercana (raíz: `analizar`/`analiza`, `explicar`/`explica`, etc.).

**Resultado:** `{ lowQuality, missingContent, missingAction }`.  
`lowQuality === true` si falta contenido **o** falta acción. Si no hay acción en el prompt (`action === null`), no se exige acción en la rúbrica.

---

## 4. Fallback de rúbrica (acción + contenido)

### `buildContentSpecificFallbackRubric(prompt, points)`

- **Acción:** Se usa `extractPromptAction(prompt)`; si es `null`, se usa `"explicar"`.
- **Contenido:** Se usa `extractContentPhrase(prompt)` como tema en todos los niveles.
- **Redacción:** Cada descriptor incluye:
  - El verbo en forma imperativa (o “Realiza la acción de X”) y la frase de contenido.
  - Cuatro niveles: Excelente, Bueno, En proceso, Insuficiente; `minPoints`/`maxPoints` coherentes con `item.points`.
- **Ejemplo** (prompt: *"Compara las causas económicas de la PGM con el rol de las potencias centrales."*):
  - Acción: `comparar` → imperativo “Compara”.
  - Contenido: p. ej. “las causas económicas de la PGM con el rol de las potencias centrales” (por conector o fallback).
  - Excelente: *"Compara las causas económicas de la PGM... con precisión, evidencia pertinente y desarrollo claro."*

---

## 5. Comportamiento de los warnings

| Código | Cuándo se emite |
|--------|------------------|
| `OPEN_ENDED_RUBRIC_FALLBACK_APPLIED` | No había rúbrica válida (o no se pudo normalizar) y se aplicó la rúbrica de respaldo. |
| `RUBRIC_LOW_QUALITY_REPLACED` | Había rúbrica normalizada pero `checkRubricQuality` la marcó como baja calidad (falta de contenido y/o de acción). Se reemplaza solo esa rúbrica y se añade este warning. |

El **mensaje** de `RUBRIC_LOW_QUALITY_REPLACED` indica la causa:
- `"falta de contenido específico"` si `missingContent === true`
- `"falta de acción cognitiva"` si `missingAction === true`
- `"falta de contenido específico y falta de acción cognitiva"` si ambas.

Ejemplo:  
*"Rúbrica de baja calidad reemplazada (falta de acción cognitiva) en sección 1, ítem 2 (essay)."*

No se falla la evaluación: solo se sustituye la rúbrica del ítem y se registra el warning.

---

## 6. Ejemplos antes / después

**Prompt:** *"Analiza las causas económicas de la Primera Guerra Mundial y el rol de las potencias centrales."*

- **Antes (genérico):**
  - Excelente: *"Responde correctamente con precisión, profundidad y evidencia pertinente."*
  - No se menciona “analizar” ni “causas”, “PGM”, “potencias”, etc.

- **Después (fallback con acción + contenido):**
  - Acción: `analizar`; contenido: p. ej. “las causas económicas de la Primera Guerra Mundial y el rol de las potencias centrales”.
  - Excelente: *"Analiza las causas económicas de la Primera Guerra Mundial y el rol de las potencias centrales con precisión, evidencia pertinente y desarrollo claro."*
  - Insuficiente: *"No logra analizar de forma suficiente las causas económicas de la Primera Guerra Mundial..., o presenta errores conceptuales relevantes."*

**Prompt:** *"Justifica con evidencia el impacto de las reformas batllistas."*

- Acción: `justificar`; contenido (por “impacto de”): “las reformas batllistas”.
- Descriptores del fallback incluyen “Justifica”/“justifica” y “las reformas batllistas” en cada nivel.

---

## 7. Pasos de validación manual

1. **Acción**
   - Probar prompts que comiencen con: *Analiza...*, *Compara...*, *Justifica...*, *Explica...*, *Interpreta...*, *Argumenta...*, *Relaciona...*, *Describe...*, *Evalúa...*.
   - Verificar que el fallback use el imperativo correcto (Analiza, Compara, Justifica, etc.) y que “Insuficiente” use el infinitivo (“No logra analizar/justificar...”).

2. **Contenido**
   - Probar un prompt con “causas de X” o “impacto de Y” y comprobar que la frase de contenido en los descriptores sea legible y no una lista “X, Y y Z”.
   - Probar un prompt sin conector (solo “Explica la Revolución Industrial”) y comprobar que el fallback use un trozo coherente (p. ej. “la Revolución Industrial” o similar).

3. **Calidad**
   - Generar una evaluación y, si es posible, forzar una rúbrica genérica (p. ej. solo “Responde correctamente”) en un ítem abierto; verificar que se reemplace y que en `warnings` aparezca `RUBRIC_LOW_QUALITY_REPLACED` con el motivo correcto (contenido y/o acción).
   - Verificar que la evaluación no falle y que solo cambie la rúbrica de ese ítem.

4. **Compatibilidad**
   - Confirmar que no se cambian estructuras de datos ni frontend; que los ítem sigan teniendo `rubric.levels` con `key`, `label`, `descriptor`, `minPoints`, `maxPoints`.
