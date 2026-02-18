# Phase 3: Save Guard Fix for V2 Spec (EvaluacionesGrupo)

## Causa del problema

En **EvaluacionesGrupo**, al generar una evaluación **V2** (que se muestra en pantalla con el renderer JSON), al hacer clic en **Guardar** aparecía el toast:

> "No hay evaluaciones generadas para guardar"

**Motivo:** El guard del guardado comprobaba solo **`generatedEvaluations.length === 0`**. En modo V2:

- La pipeline llama a `modify-evaluation-v2` y no rellena `evaluationBundle.versions` con HTML (el contenido viene en `evaluationSpec`).
- Se hace `setGeneratedEvaluations([])` y `displayEvaluations` queda vacío (porque depende de `evaluationBundle.baseHtml` / `versions.A` para construir las tarjetas V1).
- Por tanto, el guard bloqueaba el guardado aunque hubiera un **spec V2 válido** en `v2RawResponse.evaluationSpec`.

Es decir, el guard estaba pensado solo para flujo V1 (tarjetas HTML) y no consideraba “tener algo que guardar” cuando solo existía spec V2.

---

## Cambios realizados

### 1. Guard de guardado (TASK 2)

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

- Se definen:
  - **`hasV2Spec`**: `useBetaV2 && v2RawResponse?.evaluationSpec` y que al menos una sección tenga ítems.
  - **`hasV1`**: `displayEvaluations?.length > 0`.
- El guard ahora **solo bloquea** cuando no hay ni V2 ni V1:
  - `if (!hasV2Spec && !hasV1)` → se muestra el toast y se hace `return`.
- Si hay V2 spec válido (aunque `displayEvaluations` esté vacío), el guardado **no** se bloquea.

### 2. Payload al guardar en V2 (TASK 3 — Option A)

- Se mantiene la persistencia de **`evaluacion_generada.evaluation_spec`** con el spec V2 actual (ya existente).
- Para **`evaluacion_generada.evaluaciones`** en modo V2 se evita depender de un array vacío:
  - Si **`hasV2Spec`**: se construye un array **mínimo** de una sola “evaluación” de compatibilidad:
    - `id: 'A'`, `title: 'Versión A (Universal)'`,
    - `content`: HTML mínimo `<h1>{título}</h1><p>Esta evaluación se almacena como especificación V2 (N sección(es)).</p>` (título desde `spec.meta.subject` o "Evaluación (V2)").
  - Si no hay V2 spec: se usa **`displayEvaluations`** como hasta ahora (flujo V1).
- Así el JSONB `evaluaciones` no queda vacío en guardados V2 y cualquier código que espere al menos un elemento sigue siendo compatible, sin tocar backend ni esquema.

### 3. Página de detalle (TASK 4)

- **EvaluacionDetalle** ya prioriza **`evaluation_spec`** cuando existe y usa el renderer V2; no fue necesario cambiar la lógica.
- Si `evaluation_spec` está presente, el detalle no depende de `evaluaciones.length > 0` para mostrar la evaluación; con el array mínimo en V2 no se introduce regresión en la vista de detalle.

---

## Resumen del guard (nota para desarrolladores)

- **Antes:** Se bloqueaba guardado si `generatedEvaluations.length === 0`.
- **Ahora:** Se bloquea solo si **no** hay contenido ni en V2 ni en V1:
  - `hasV2Spec = useBetaV2 && v2RawResponse?.evaluationSpec && al menos una sección con ítems`
  - `hasV1 = displayEvaluations?.length > 0`
  - Bloqueo: `if (!hasV2Spec && !hasV1)`.

---

## Prueba manual

1. En **EvaluacionesGrupo**, activar el modo beta V2 y generar una evaluación (que se muestre con el renderer V2).
2. Hacer clic en **Guardar**.
3. **Esperado:** El guardado se realiza con éxito (sin toast “No hay evaluaciones generadas para guardar”).
4. Ir a **Mis evaluaciones** y abrir la evaluación recién guardada.
5. **Esperado:** La página de detalle muestra la evaluación con el **renderer V2** (contenido desde `evaluation_spec`), con secciones e ítems correctos.

---

## Restricciones respetadas

- Sin cambios en backend ni en esquema.
- Flujo V1 sin cambios (guardado con `displayEvaluations` cuando no hay V2).
- Sin reintroducir html2canvas; el HTML mínimo en `evaluaciones` es estático y determinista.
