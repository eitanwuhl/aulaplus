# Phase 3 Block 3g — Per-version AI report (A/B/C) and canonical root aiReport

## Objetivo

- El reporte de IA en V2 debe cambiar según la versión seleccionada (A/B/C): un solo panel cuyo contenido se intercambia según `selectedVersion`.
- El backend debe devolver narrativas por versión (`aiReport.byVersion.A/B/C`) y una única fuente canónica de `aiReport` (raíz), sin duplicar en `evaluationSpec`.
- Compatible con evaluaciones guardadas y respuestas antiguas que solo tienen `narrative` global.

---

## 1. Cambios en la forma de la respuesta (backend)

### Contrato de salida (raíz)

El **único** `aiReport` canónico es el de la **raíz** de la respuesta V2:

```ts
{
  success: true,
  evaluationSpec: { ... },   // sin aiReport
  requestedVersions: { A: boolean, B: boolean, C: boolean },
  aiReport: {
    narrative: string,       // fallback global (puede ser resumen de A)
    byVersion?: {
      A: { narrative: string },
      B?: { narrative: string },
      C?: { narrative: string }
    },
    // resto de campos existentes: rationale, versions, contemplacionesApplied, responseOptions, etc.
  },
  ...
}
```

- `narrative`: siempre presente como fallback (resumen global o copia de A).
- `byVersion.A`: obligatorio cuando hay narrativa (contenidos evaluados, alineación competencias/criterios, requerimientos del docente, materiales/sesión si hay).
- `byVersion.B` / `byVersion.C`: solo si esa versión fue **efectivamente generada** (`requestedVersions.B` / `requestedVersions.C` true y contenido B/C presente en `versionVariants`).

### Coherencia con versiones efectivas

- Solo se incluye `byVersion.B` si `effectiveRequestedVersions.B === true`.
- Solo se incluye `byVersion.C` si `effectiveRequestedVersions.C === true`.
- Si se pidió B o C pero el spec no generó esa versión (p. ej. fallback solo A), no se incluyen en `byVersion` ni en `requestedVersions`.

---

## 2. Resolución de duplicación (root vs evaluationSpec)

- **Antes:** el modelo podía devolver `aiReport` dentro de `evaluationSpec` y además se construía un `aiReport` en la raíz, generando dos fuentes posibles.
- **Ahora:**
  - La respuesta se construye con **`evaluationSpec` sin `aiReport`**: antes de enviar, se elimina `aiReport` del objeto `evaluationSpec` (clonando el spec y borrando la clave).
  - El **único** `aiReport` que consume el frontend es el de la **raíz** de la respuesta.
- Al guardar, se persiste `evaluation_spec` (sin aiReport) y el reporte en `evaluacion_generada.ai_report` / `ai_design_report`, que corresponden al `aiReport` raíz.

---

## 3. Lógica de selección en el frontend (un solo panel)

- **Componente:** `V2AIReportPanel` en `V2InfoPanels.tsx`, que recibe `aiReport` (raíz de `v2Response`) y `selectedVersion` (mismo estado que usa `EvaluationRendererV2`).

- **Orden de prioridad del texto mostrado:**
  1. `v2Response.aiReport.byVersion[selectedVersion].narrative` si existe y no está vacío.
  2. `v2Response.aiReport.narrative` (fallback global).
  3. Narrativa legacy: cuando la evaluación se carga desde BD, `aiReport` ya viene de `evaluacion_generada?.ai_report` o `ai_design_report`, que pueden tener solo `narrative`; ese mismo objeto se pasa como `aiReport`, por lo que el fallback a `aiReport.narrative` cubre el caso legacy.
  4. Si no hay ninguno: mensaje breve “No hay reporte disponible para esta versión.” (un solo panel, sin tarjetas duplicadas).

- Se mantiene **un único panel**; no se renderizan varias tarjetas de reporte.

---

## 4. Compatibilidad hacia atrás

- **Respuestas antiguas** sin `byVersion`: el panel usa `aiReport.narrative` para cualquier `selectedVersion`. Comportamiento correcto.
- **Evaluaciones guardadas** con solo `narrative` en `ai_design_report` / `evaluacion_generada.ai_report`: al reconstruir `v2Response` (p. ej. en detalle), `aiReport` es ese payload; el panel muestra `aiReport.narrative` para todas las versiones.
- **Solo versión A:** si `requestedVersions` es solo A, la respuesta no incluye `byVersion.B` ni `byVersion.C`; el panel muestra siempre el reporte de A (por `byVersion.A` o por `narrative`).

---

## 5. Backend: prompt y generación de byVersion

- **Prompt:** se exige que, si se generan versiones B o C, `aiReport.byVersion.B` y/o `aiReport.byVersion.C` sean obligatorios (no opcionales), con narrativas que describan diferencias respecto a A y justificación pedagógica sin bajar la dificultad.
- **Llamada de relleno:** si hay varias versiones efectivas (B o C) pero el JSON parseado no trae `byVersion` o trae B/C vacíos, se hace **una sola** llamada “byVersion-only” (modelo rápido, timeout corto) que pide JSON con `byVersion.A/B/C` y se rellenan solo las claves faltantes.
- **Fallback local:** si aun así falta narrativa para B o C, se usa un texto fijo corto que describe la adaptación de esa versión (misma demanda cognitiva, mismos objetivos).

---

## 6. Checklist de pruebas manuales

1. **Generar V2 con A+B+C**
   - En la respuesta de red, `aiReport` (raíz) incluye `byVersion.A`, `byVersion.B` y `byVersion.C`.
   - Al cambiar la versión (A → B → C) en el selector, el texto del panel de reporte cambia (B/C mencionan diferencias con A cuando corresponda).

2. **Generar V2 solo A**
   - En la respuesta, `aiReport.byVersion` tiene al menos `A`; no hay `byVersion.B` ni `byVersion.C`.
   - El panel de reporte se muestra correctamente (por `byVersion.A` o `narrative`).

3. **Compatibilidad**
   - Cargar una evaluación guardada antigua (solo `narrative`, sin `byVersion`): el panel muestra el reporte usando `narrative` para la versión seleccionada.
   - No se muestran dos reportes ni dos bloques de “Reporte de IA”; solo uno cuyo contenido cambia con la versión.

4. **Duplicación**
   - Inspeccionar la respuesta JSON: `evaluationSpec` no debe contener la clave `aiReport`; solo la raíz debe tener `aiReport`.
