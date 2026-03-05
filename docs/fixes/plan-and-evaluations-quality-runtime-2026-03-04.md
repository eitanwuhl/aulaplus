# Plan + Evaluations Quality Runtime Fixes (2026-03-04)

## Resumen de cambios

### A) V2 Evaluations
- Se endureció el filtro TOC/Index para que bloques con líderes punteados + números de página no se usen ni en bundle ni en `source_analysis`.
- `cleanAndSelectExcerpt()` ya no vuelve a “raw TOC”; cuando el fragmento no es usable devuelve fallback vacío con razón de rechazo.
- Si no existe excerpt de calidad para `source_analysis`, se degrada determinísticamente a `short_answer` y se corrige prompt para eliminar referencias a “fragmento”.
- Se agregó traza liviana por ítem de fuente en `debug.excerptStats`: `excerptSource` (`cleaned_selection|fallback|degraded`) y `excerptRejectReason`.
- Delta filler ahora prioriza ítems de mayor valor temporal (`essay`, `paragraph`, `short_answer`), limita total con hard cap de 6, y solo permite MC cuando existe excerpt de alta calidad.
- Se añadió validador final de invariantes deterministas (`ITEM_INVARIANT_FIXED`) para:
  - evitar MC con opciones placeholder;
  - evitar referencias a fragmento sin fuente válida;
  - evitar `source_analysis` con excerpt TOC/metadata.
- Se reforzó el bundle de materiales para evitar shortfall:
  - chunking más agresivo;
  - fallback controlado (nunca metadata/TOC);
  - top-up agresivo cuando hay material largo y `finalChars < 20000`;
  - `bundleShortfallReason` en debug cuando no se alcanza mínimo.

### B) Lesson Planning
- Se ocultó temporalmente el bloque narrativo superior en `PlanningAIDesignReport`.
- La narrativa docente queda dentro de “detalles pedagógicos” (acorde al pedido visual).
- `report_technical` sigue oculto salvo `window.__PLAN_REPORT_DEBUG__ === true`.

## Archivos cambiados

- `supabase/functions/modify-evaluation-v2/excerptCleaning.ts`
- `supabase/functions/modify-evaluation-v2/index.ts`
- `supabase/functions/modify-evaluation-v2/__tests__/excerptCleaning.test.ts`
- `supabase/functions/modify-evaluation-v2/__tests__/deltaFiller.test.ts`
- `src/components/planificacion/PlanningAIDesignReport.tsx`

## Evidencia before/after (campos reales de debug)

### Evaluations

**Antes (observado):**
- `passagesSelectedCount = 1`
- `materialsCharsSent ≈ 2000`
- excerpt de `source_analysis` con TOC/índice
- filler con demasiados ítems “Complemento de duración” y MC de baja calidad

**Después (esperado en runtime):**
- `debug.materialsPromptPath = "bundle"` cuando hay material utilizable
- `debug.keptBlocksCount` presente
- `debug.passagesRejectedCount` presente y desglosado por razón (`toc|biblio|prologue|metadata`)
- `debug.finalK` y `debug.finalChars` presentes
- `debug.bundleShortfallReason` solo si no se logra `finalChars >= 20000`
- `debug.excerptStats[*].excerptSource` y `debug.excerptStats[*].excerptRejectReason` presentes para ítems de fuente
- `warnings` puede incluir:
  - `SOURCE_EXCERPT_LOW_QUALITY_DEGRADED`
  - `ITEM_INVARIANT_FIXED`
- `llmCallCount` se mantiene en 1 en flujo normal configurado (sin calls extra habilitadas)

### Planning

**Antes (UI):**
- Se mostraba un bloque narrativo superior grande, compitiendo con la vista de detalles pedagógicos.

**Después (UI):**
- Bloque narrativo superior oculto temporalmente.
- Narrativa disponible dentro de “detalles pedagógicos” (expandible).
- `report_technical` solo visible con `window.__PLAN_REPORT_DEBUG__ === true`.
- En backend/planning se mantiene la señal de debug:
  - `debug.aiReportSource` (`structured|fallback`)
  - `debug.materialsUsed` (`true|false`)

## Cómo verificar (paso a paso)

### 1) Evaluations — smoke “max difficulty”
1. Generar evaluación V2 con target 80 y material Batllismo con `extractedText` amplio.
2. En DevTools, abrir respuesta JSON de `modify-evaluation-v2`.
3. Verificar:
   - `debug.materialsPromptPath === "bundle"` (si hay material utilizable).
   - `debug.finalK >= 6` y `debug.finalChars >= 20000` cuando el material lo soporta.
   - `debug.keptBlocksCount` y `debug.passagesRejectedCount` presentes.
4. Revisar `debug.excerptStats`:
   - al menos un `source_analysis` con `excerptSource = "cleaned_selection"` y excerpt coherente (1–3 párrafos).
   - no usar TOC/index como excerpt.
5. Revisar secciones filler:
   - máximo 6 ítems añadidos;
   - sin MC placeholder;
   - sin prompts “según el fragmento anterior” sin excerpt.

### 2) Planning — narrativa temporalmente oculta
1. Abrir una sesión con reporte de IA.
2. Verificar que el bloque narrativo superior no se renderiza.
3. Abrir “Ver detalles pedagógicos” y confirmar narrativa dentro de esa sección.
4. Confirmar que no aparece “Detalle técnico (raw)” salvo con `window.__PLAN_REPORT_DEBUG__ = true`.
5. En respuesta backend, verificar `debug.aiReportSource` y `debug.materialsUsed`.

## Limitaciones conocidas

- Si los materiales realmente no tienen suficiente texto limpio/no TOC/no metadata, `finalChars` puede quedar por debajo de 20000; en ese caso debe aparecer `bundleShortfallReason`.
- El validator final corrige de forma determinista (degrada/reescribe), por lo que puede reducir algunos `source_analysis` a `short_answer` cuando no hay fuente de calidad.
