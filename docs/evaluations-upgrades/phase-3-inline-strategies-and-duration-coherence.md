# Phase 3: Inline Response Strategies + Duration Coherence (V2)

## Resumen

Se implementaron dos mejoras **solo en V2** (rama `mejorar-evaluaciones`):

- **Parte A**: Integrar las “opciones equivalentes de respuesta” en el texto de la consigna (vista alumno y PDF académico), sin bloque/lista aparte.
- **Parte B**: Coherencia de duración: estimación determinística desde el spec y un intento automático de extensión cuando la evaluación generada queda por debajo del 85% del objetivo.

---

## Parte A — Estrategias de respuesta en línea (vista alumno)

### Objetivo

Que las evaluaciones se vean como exámenes impresos: la forma de respuesta no aparece como menú/lista separada, sino como una frase dentro del enunciado (ej.: “Puedes responder redactando un texto o haciendo un esquema claro.”).

### Cambios realizados

1. **Helper de formato** (`src/services/evaluations/responseOptionsInline.ts`, ya existente):
   - `formatResponseOptionsAsInlineSentence(options)`: convierte un array de opciones (format/description) en una sola frase corta en español; usa hasta 3 opciones; ej. “Puedes responder X o Y.” o “Puedes responder: A, B o C.”.
   - `getDisplayPromptWithInlineOptions(basePrompt, responseOptions)`: devuelve el prompt base + esa frase cuando hay opciones habilitadas (evitando doble punto si el base ya termina en `.` / `?` / `!`).

2. **UI V2** (`src/components/evaluaciones/v2/EvalItem.tsx`):
   - Se importa `getDisplayPromptWithInlineOptions`.
   - El texto mostrado del ítem pasa a ser `displayPrompt = getDisplayPromptWithInlineOptions(item.prompt, item.responseOptions)` en lugar de solo `item.prompt`.
   - Se eliminó el bloque `<ResponseOptions variant="inline" />` para la vista alumno: las opciones equivalentes quedan solo dentro del enunciado.
   - Los datos del spec (`item.responseOptions`) no se modifican; solo cambia la presentación.

3. **PDF académico** (`src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx`):
   - Se importa `getDisplayPromptWithInlineOptions`.
   - Para cada ítem se calcula `displayPrompt = getDisplayPromptWithInlineOptions(item.prompt, item.responseOptions)` y se usa como enunciado en el PDF.
   - Se eliminó el componente `EquivalentOptionsPDF` y los estilos `responseOptionsIntro`, `responseOption`, `optionLetter` asociados, de modo que no se renderiza ningún bloque separado de “Puedes responder de estas formas:” en el PDF.

### Dónde se aplica

- **EvalItem**: pantalla de evaluación V2 (vista alumno).
- **AcademicEvaluationDocument**: export a PDF académico (texto real, no screenshot).

### Compatibilidad

- No se eliminó `equivalentResponseOptions` del spec; solo se cambia cómo se muestran en la vista alumno y en el PDF.
- V1 no se modifica.

---

## Parte B — Coherencia de duración (backend V2)

### Objetivo

Que la duración de la evaluación generada se acerque al objetivo configurado: si el spec generado es claramente más corto que el objetivo, se hace un intento automático de extensión y, si no se alcanza, se devuelve un aviso sin fallar la evaluación.

### Cambios realizados (Edge Function `modify-evaluation-v2`)

1. **Fuente del objetivo**  
   La duración objetivo se sigue leyendo de `designPlan.targetDurationMinutes` (request/`evaluation_design_plan`).

2. **Estimación determinística** (`estimateDurationFromSpec(spec)`):
   - Nueva función que recorre `spec.sections` y sus `items` y suma minutos por tipo de ítem según una heurística fija:
     - `multiple_choice`: 2 min  
     - `true_false`: 2 min  
     - `true_false_justify`: 4 min  
     - `short_answer`: 3 min  
     - `paragraph`: 8 min  
     - `essay`: 12 min  
     - `source_analysis`: 10 min  
     - `table_completion`: 5 min  
     - `matching` / `ordering`: 4 min  
     - resto: 5 min  
   - Se suma 1 min de “overhead” por sección.
   - Documentado en comentarios en código como heurística de referencia.

3. **Flujo después de la generación**:
   - Tras obtener `result.spec` válido se calcula:
     - `targetDurationMinutes` desde `designPlan.targetDurationMinutes`
     - `estimatedMinutes = estimateDurationFromSpec(result.spec)` (no solo `meta.duration.minutes`).
   - Se registra en logs: `[DURATION] target=... estimated=...`.

4. **Auto-extend (un solo intento)**:
   - Si `targetDurationMinutes` está definido y `estimatedMinutes < targetDurationMinutes * 0.85`:
     - Se llama a `runDurationAutoExtend(currentSpec, targetDurationMinutes, requestedVersions, requestId, timer)`.
     - Esta función:
       - Construye un prompt que pide a OpenAI extender la evaluación (añadir o ampliar ítems) para que la duración estimada quede en el rango objetivo ±10%.
       - Llama a OpenAI una vez (`callOpenAIWithRetries` con propósito `duration_extend`).
       - Parsea la respuesta, re-valida con `validateAndNormalizeSpec` y re-estima con `estimateDurationFromSpec`.
     - Si la extensión devuelve un spec válido y la nueva estimación `>= targetDurationMinutes * 0.9`:
       - Se reemplaza `result.spec` por el spec extendido.
       - Se actualiza `result.spec.meta.duration.minutes` con la nueva estimación.
     - Si no (spec nulo, validación fallida o estimación aún &lt; 90% del objetivo):
       - Se añade un warning `DURATION_EXTEND_FAILED` al `response.warnings` (no se falla la evaluación).

5. **Warnings**:
   - Los avisos se incorporan a `result.warnings` (y por tanto al `response.warnings` existente).
   - Códigos usados: `DURATION_EXTEND_OPENAI_ERROR`, `DURATION_EXTEND_PARSE_ERROR`, `DURATION_EXTEND_VALIDATION_FAILED`, `DURATION_EXTEND_FAILED`.

6. **Validación de estructura (bloque ya existente)**:
   - Tras el posible auto-extend se mantiene la lógica de “Structure validation: duration coherence”: si la duración estimada final se desvía más del 15% del objetivo, se emite `DURATION_DEVIATION` y, si aplica, se escalan `section.duration` y `meta.duration.minutes`.

### Dónde se aplica

- `supabase/functions/modify-evaluation-v2/index.ts`:
  - Nuevas funciones: `estimateDurationFromSpec`, `runDurationAutoExtend` (y constante `DURATION_MINUTES_BY_ITEM_TYPE` + overhead por sección).
  - Integración en el flujo principal tras `if (result.spec)`, antes de construir `baseAiReport` y el resto de la respuesta.

### Logs

- `[DURATION] target=... estimated=...` al evaluar duración.
- `[DURATION_AUTO_EXTEND] target=... requestId=...` al iniciar extensión.
- `[DURATION_AUTO_EXTEND] extended estimate=... target=...` al terminar extensión.
- `[DURATION] auto-extend applied new_estimated=...` cuando se aplica el spec extendido.

---

## Checklist de pruebas manuales

### Parte A — Opciones equivalentes en línea

- [ ] Generar una evaluación V2 con “opciones equivalentes de respuesta” habilitadas en el plan de diseño.
- [ ] En la UI V2 (vista alumno): comprobar que cada ítem afectado muestra la frase tipo “Puedes responder…” **dentro** del texto de la consigna.
- [ ] En la UI V2: comprobar que **no** aparece un bloque/lista separado de opciones (sin componente ResponseOptions visible para el alumno).
- [ ] Exportar a PDF académico: comprobar que el enunciado de cada ítem incluye la misma frase integrada y que **no** aparece el bloque “Puedes responder de estas formas:” con lista aparte.

### Parte B — Duración

- [ ] Generar evaluaciones V2 con duración objetivo 40, 60 y 80 minutos.
- [ ] Comprobar en logs (o en la duración mostrada/exportada) que la duración estimada se acerca más al objetivo cuando el modelo genera contenido corto y se dispara el auto-extend.
- [ ] Cuando la evaluación generada sea corta respecto al objetivo: comprobar que se ejecuta el intento de auto-extend (logs `[DURATION_AUTO_EXTEND]`) y que, si tras extender se alcanza el rango, el spec y `meta.duration.minutes` se actualizan.
- [ ] Cuando ni siquiera tras el auto-extend se alcance el objetivo: comprobar que la respuesta incluye un warning (p. ej. `DURATION_EXTEND_FAILED`) y que la evaluación se devuelve igualmente (no se falla la generación).

---

## Archivos modificados

| Archivo | Cambio |
|--------|--------|
| `src/components/evaluaciones/v2/EvalItem.tsx` | Uso de `getDisplayPromptWithInlineOptions`, eliminación del bloque `ResponseOptions` en vista alumno. |
| `src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx` | Uso de `getDisplayPromptWithInlineOptions` para el enunciado en PDF; eliminación de `EquivalentOptionsPDF` y estilos asociados. |
| `supabase/functions/modify-evaluation-v2/index.ts` | `estimateDurationFromSpec`, `runDurationAutoExtend`, integración de duración objetivo + auto-extend y warnings en el flujo principal. |
| `src/services/evaluations/responseOptionsInline.ts` | Sin cambios en este phase (ya existía de un paso anterior). |

---

## Tipos y compatibilidad

- No se cambiaron contratos de tipos del spec; `equivalentResponseOptions` sigue presente en los ítems.
- El helper `responseOptionsInline` usa una interfaz compatible con `NormalizedItem.responseOptions`.
- TypeScript sin errores en los archivos tocados (EvalItem, AcademicEvaluationDocument).
