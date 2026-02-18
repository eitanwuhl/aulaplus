# Phase 3: Duration and Inline Response Options Fix (V2)

## Resumen

Correcciones para dos problemas en evaluaciones V2:

1. **Opciones equivalentes de respuesta** no aparecían en el enunciado (ni en UI ni en PDF).
2. **Duración** no se acercaba de forma fiable al tiempo objetivo y no se enviaba bien el target al backend.

Se añadieron diagnósticos (dev), validación y fallback en el edge, protección contra doble inyección en el cliente, envío de `targetDurationMinutes` en el payload, y avisos cuando la evaluación queda demasiado larga.

---

## Problema 1 — Opciones equivalentes no visibles

### Posibles causas

- **(A)** El spec V2 no generaba `equivalentResponseOptions` en ítems abiertos.
- **(B)** El spec los traía pero la UI/PDF no los inyectaban en el prompt mostrado.

Con los cambios actuales se abordan ambas: el edge **obliga y rellena** cuando faltan (A) y la UI/PDF usan un único helper con **protección contra doble inyección** (B).

### Cambios realizados

#### TASK 1A — Diagnósticos (solo dev)

- **Archivo:** `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`
- **Qué:** En el panel de debug (visible cuando `VITE_DEBUG_EVAL_PIPELINE=true`):
  - Se indica si se está usando respuesta V2 (sí/no).
  - Para cada ítem **abierto** (essay, paragraph, short_answer, source_analysis, true_false_justify):
    - Si el spec crudo tiene `equivalentResponseOptions` (sí/no y cantidad).
    - Si el ítem normalizado tiene `responseOptions.enabled` y cantidad de opciones.
- **Uso:** Permite ver si el fallo viene del spec (A) o de la normalización/UI (B). No expone datos sensibles.

#### TASK 1B — Generación y fallback en el edge

- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Payload:** El plan de diseño ya incluía `responseOptions.include` y `responseOptions.optionCount`; no se cambió el contrato.
- **Prompt de sistema:** Se amplió la instrucción de “opciones de respuesta equivalentes”:
  - Antes: solo “essay, paragraph” debían llevarlas.
  - Ahora: **todos** los ítems abiertos (essay, paragraph, short_answer, source_analysis, true_false_justify) deben incluir `equivalentResponseOptions` con al menos N opciones.
- **Post-validación (fallback):**
  - Nueva función `ensureEquivalentResponseOptionsForOpenEnded(spec, responseOptionsInclude, responseOptionCount, warnings)`.
  - Si la opción está habilitada, recorre todos los ítems abiertos del spec.
  - Si un ítem no tiene `equivalentResponseOptions` o tiene menos de 2 opciones, se rellenan con opciones por defecto según `item.type` (texto, esquema, lista, etc.).
  - Se añade el warning `RESPONSE_OPTIONS_FALLBACK_APPLIED` y un log de servidor.
  - La forma de `equivalentResponseOptions` en el spec se mantiene (enabled, options[], metacognitionText).
- **Dónde se llama:** Justo después de tener `result.spec` y antes del bloque de duración.

#### TASK 1C — UI y PDF: un solo helper y anti-doble-inyección

- **Archivo:** `src/services/evaluations/responseOptionsInline.ts`
- **Helper único:** Sigue siendo `getDisplayPromptWithInlineOptions(basePrompt, responseOptions)` para construir el enunciado mostrado.
- **Protección:** Si el `basePrompt` ya contiene una frase del tipo “Puedes responder” / “puedes elegir” (regex `INLINE_OPTIONS_MARKERS`), **no** se vuelve a añadir la frase de opciones, para evitar duplicados.
- **UI:** `EvalItem` ya usaba `getDisplayPromptWithInlineOptions` para el texto del ítem; no se cambió la API, solo el comportamiento ante prompt que ya trae la frase.
- **PDF:** `AcademicEvaluationDocument` ya usaba el mismo helper para el enunciado; se beneficia igual de la protección.

---

## Problema 2 — Duración por debajo (o por encima) del objetivo

### Cambios realizados

#### TASK 2A — Enviar duración objetivo al edge

- **Archivo:** `src/pages/EvaluacionesGrupo.tsx`
- **Qué:** En el cuerpo de la llamada a `modify-evaluation-v2`, dentro de `evaluation_design_plan` se añadió **`targetDurationMinutes`** (valor elegido por el usuario en la UI).
- **Dónde se usa en el edge:** Ya se leía `designPlan.targetDurationMinutes` para estimación, auto-extend y avisos; al incluir el campo en el payload, el valor llega correctamente.

#### TASK 2B — Estimación y umbrales en el edge

- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Tabla del estimador (minutos por tipo de ítem):**

| Tipo de ítem           | Minutos |
|------------------------|---------|
| multiple_choice        | 2       |
| true_false             | 1       |
| true_false_justify     | 4       |
| short_answer           | 4       |
| paragraph              | 9       |
| essay                  | 14      |
| source_analysis       | 14      |
| table_completion       | 5       |
| matching / ordering    | 5       |
| (resto)                | 5       |

- Se mantiene 1 min de “overhead” por sección en `estimateDurationFromSpec`.
- **Demasiado corto:** Si `estimatedMinutes < 0.85 * targetDurationMinutes` se sigue haciendo **un** intento de auto-extend (instrucción al modelo para ampliar carga hasta ~objetivo ±10%), se revalida y se reestima. Si tras el intento sigue corto, se añade `DURATION_EXTEND_FAILED` y se devuelve el mejor spec posible.
- **Demasiado largo:** Si `estimatedMinutes > 1.20 * targetDurationMinutes` se añade el warning **`DURATION_TOO_LONG`** (sin paso automático de acortado).
- **Escalado y meta:** Si la desviación supera 15%, se mantiene la lógica de escalar duraciones de sección y `meta.duration.minutes`; además, **siempre** se guarda la duración estimada en `result.spec.meta.duration.minutes` (estimador determinista).

---

## Archivos modificados

| Archivo | Cambios |
|--------|---------|
| `src/components/evaluaciones/v2/EvaluationRendererV2.tsx` | Diagnósticos en el panel de debug: V2 usado, por ítem abierto raw equivalentResponseOptions y normalized responseOptions. |
| `src/services/evaluations/responseOptionsInline.ts` | Evitar doble inyección si el prompt ya contiene “Puedes responder” / “puedes elegir”. |
| `src/pages/EvaluacionesGrupo.tsx` | Inclusión de `targetDurationMinutes` en `evaluation_design_plan` del request V2. |
| `supabase/functions/modify-evaluation-v2/index.ts` | Prompt ampliado a todos los ítems abiertos; `ensureEquivalentResponseOptionsForOpenEnded` + fallback; llamada al fallback tras tener spec; tabla de duración actualizada; warning `DURATION_TOO_LONG`; escritura de `meta.duration.minutes` con la estimación. |

---

## Checklist de pruebas manuales

1. **Opciones equivalentes**
   - [ ] Generar una evaluación V2 con “opciones de respuesta equivalentes” activadas en el plan.
   - [ ] Con `VITE_DEBUG_EVAL_PIPELINE=true`, abrir el panel de debug y comprobar:
     - Que el spec crudo incluye `equivalentResponseOptions` en ítems abiertos (o que aparece el warning `RESPONSE_OPTIONS_FALLBACK_APPLIED` si se aplicó fallback).
     - Que los ítems normalizados tienen `responseOptions.enabled` y opciones.
   - [ ] En la UI, comprobar que el enunciado de cada ítem abierto afectado incluye una frase del tipo “Puedes responder…” (sin bloque aparte).
   - [ ] Exportar a PDF académico y comprobar que la misma frase aparece en el enunciado.
   - [ ] Comprobar que no hay dos frases “Puedes responder…” seguidas (no doble inyección).

2. **Duración**
   - [ ] Generar evaluaciones V2 con duración objetivo 40, 60 y 80 minutos.
   - [ ] Comprobar en logs/respuesta que `estimatedMinutes` (y `meta.duration.minutes`) se acercan al objetivo (p. ej. dentro de ~15%).
   - [ ] Si el primer spec es corto: comprobar que se dispara el auto-extend y que, si aun así no alcanza, aparece el warning `DURATION_EXTEND_FAILED`.
   - [ ] Si la evaluación queda larga (>120% del objetivo): comprobar que aparece el warning `DURATION_TOO_LONG`.

3. **Regresiones**
   - [ ] Flujo V1 sin cambios.
   - [ ] Fallback rápido (sin spec) sigue funcionando.
   - [ ] Guardar y reabrir una evaluación V2: puntos y enunciados se mantienen.

---

## Resultados esperados

- **Causa (A/B):** Con el fallback en el edge, los ítems abiertos tendrán siempre opciones equivalentes cuando la opción esté activada; si el modelo no las envía, se rellenan y se avisa. La UI/PDF, al usar un solo helper y la protección contra doble “Puedes responder”, muestran la frase una sola vez. Los diagnósticos permiten ver en dev si el problema era de spec (A) o de normalización/UI (B).
- **Duración:** El target se envía correctamente; la estimación usa la tabla anterior; si la evaluación es corta se intenta una vez extenderla y se avisa si no se llega; si es larga solo se avisa. La duración estimada queda guardada en `spec.meta.duration.minutes`.
