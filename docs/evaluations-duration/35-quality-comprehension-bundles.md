# 35) Calidad: bloques de comprensión lectora y filtro de pasajes

Fecha: 2026-03-04  
Ámbito: `modify-evaluation-v2` (prompt, post-procesamiento determinista, filtro de pasajes).

## Causas raíz observadas

- **Selección de TOC/Prólogo:** Fragmentos de Índice, Prólogo, Referencias o portada se enviaban al modelo como “pasajes relevantes”, generando ítems poco útiles o genéricos.
- **Referencias a fragmento sin fuente:** Prompts con “según el fragmento anterior” sin excerpt adjunto, generando confusión o ítems no respondibles.
- **Falta de bloque de comprensión estructurado:** Con material disponible, no se exigía explícitamente una sección con excerpt + MC + short_answer, lo que podía dar evaluaciones poco ancladas al texto.

## Cambios realizados

### 1) Filtro determinista de calidad de pasajes (compartido conceptualmente con planificación)

- **Ubicación:** `excerptCleaning.ts` (modify-evaluation-v2).
- **Funciones:** `filterPassageByQuality(block)`, `filterPassagesByQuality(blocks)`.
- **Criterios de rechazo:**
  - **toc:** Índice, Contenido, listas de capítulos, líderes de puntos + números de página.
  - **biblio:** Referencias, Bibliografía, patrones autor-año, DOI/URL.
  - **prologue:** Prólogo, Presentación, Prefacio, Agradecimientos (solo en bloques del inicio del documento).
  - **metadata:** Líneas tipo portada/correo/institución (reutiliza `looksLikeMetadata`).
- **Uso:** Antes de construir “Index + Relevant Passages”, se filtran los bloques de cada material; solo los `kept` entran a ventanas y presupuesto.
- **Métricas de debug (sin logs grandes):** `passagesRejectedCount` por razón (toc, biblio, prologue, metadata), `passagesSelectedCount`, `materialsCharsSent` en la respuesta debug.

### 2) Requisito “Bloque de comprensión lectora” en el prompt principal

- En el **system prompt** se añadió la sección **BLOQUE DE COMPRENSIÓN LECTORA (OBLIGATORIO cuando hay pasajes utilizables)**:
  - Cuando hay PASAJES RELEVANTES en el prompt:
    - (a) Al menos un ítem **source_analysis** con el fragmento en `source.content` (1–3 párrafos).
    - (b) Entre **4 y 6** ítems **multiple_choice** que se refieran a ese mismo fragmento.
    - (c) Un ítem **short_answer** que pida citar o parafrasear evidencia del fragmento.
  - Prohibido usar “según el fragmento anterior” / “texto proporcionado” si no hay `source` adjunto al ítem o a la sección.
  - Opciones de MC de comprensión deben ser específicas del contenido (no placeholders genéricos).

### 3) Post-procesamiento determinista (sin LLM adicional)

- **Referencias a fragmento sin fuente:** Ya existente: detección de frases tipo “según el fragmento…”, “texto proporcionado”, etc. Si no hay fuente propia ni previa en la sección: en `source_analysis` se adjunta excerpt determinista; en otros tipos se reescribe el prompt. Warning `PROMPT_FRAGMENT_REFERENCE_FIXED`.
- **Opciones MC genéricas o faltantes:** Ya existente: generación determinista de opciones a partir de keywords/tema y marcado de `isCorrect` cuando falta. Warning `MC_OPTIONS_FILLED`.

### 4) Validador determinista para tests

- **Función:** `hasSectionWithComprehensionBundle(spec): boolean`.
- Comprueba si existe al menos una sección con: 1 source_analysis con `source.content` ≥ 120 caracteres, 4–10 ítems multiple_choice, 1 short_answer.
- Se usa en tests “max difficulty” para asegurar que, cuando hay pasajes, el spec cumple el bloque de comprensión (tras generación + rellenos deterministas).

## Cómo se evita WORKER_LIMIT

- **Una sola llamada OpenAI** en el flujo normal (generación del spec).
- **Filtro de pasajes y post-procesamiento** son 100% deterministas (sin llamadas adicionales).
- No se añaden reparaciones por LLM; solo reglas en prompt y relleno/reescritura determinista.

## Cómo probar manualmente (“max difficulty”)

1. **Evaluación con máxima dificultad y material:**
   - Generar evaluación con materiales que tengan texto sustantivo (evitar solo PDFs con índice/portada).
   - Verificar en la respuesta:
     - `debug.passagesRejectedCount` (toc/prologue/biblio/metadata) si hubo rechazos.
     - `debug.passagesSelectedCount` y `debug.materialsCharsSent`.
   - Abrir la evaluación generada y comprobar:
     - Al menos una sección con un ítem de “Análisis de fuente” con fragmento visible.
     - 4–6 ítems de opción múltiple que aludan al mismo fragmento.
     - Al menos un ítem de respuesta corta que pida citar/parafrasear.
   - No debe aparecer “según el fragmento anterior” en ítems sin fragmento adjunto.

2. **Tests automáticos (Deno):**
   - `excerptCleaning.test.ts`: filtro rechaza bloques TOC y prólogo; mantiene bloque sustantivo; `rejectedByReason` tiene conteos.
   - `deterministicItemFill.test.ts`: `hasSectionWithComprehensionBundle` true en spec con bundle, false en spec solo MC.
