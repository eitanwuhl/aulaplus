# 45) Fix AI report assembly and teacher-facing output (planning)

Fecha: 2026-03-04  
Ámbito: **Solo planificación** (`generate-plan-completo` y UI del reporte de IA). No se modifica `modify-evaluation-v2`.

## Causa raíz

- El modelo a veces devuelve un **AI Design Report** rico (JSON con `materials: true`, `contentCoverage` específico tipo "secciones 3 y 4 de Yaffé", `teacherRequirementsApplied` poblado), pero la respuesta que llega al docente se **sobrescribía** con un reporte inferido que decía "No materials were provided" y perdía `teacherRequirementsApplied` y cobertura concreta.
- **Origen del fallo:**  
  1. **Precedencia invertida:** Se usaba siempre el resultado de `buildTeacherReportNarrative` para `report_narrative` y solo se conservaba la narrativa del modelo si tenía ≥1200 caracteres. Con narrativas más cortas pero válidas (p. ej. 400–600 palabras) se reemplazaba por el fallback genérico.  
  2. **`plan_html` contaminado:** Cuando el modelo embebía el reporte en el contenido (p. ej. `### AI Design Report` + bloque ```json), ese texto quedaba dentro de `plan_html`, mezclando HTML del plan con markdown/JSON de debug.  
  3. **Campos del reporte estructurado:** Aunque solo se rellenaban `contentCoverage` / `teacherRequirementsApplied` cuando faltaban, la narrativa final venía del fallback y no del reporte estructurado del modelo, dando la impresión de que "no había materiales".

## Cambios realizados

### 1) Regla de fuente canónica (backend)

- **Si el modelo devolvió un reporte estructurado** (objeto `ai_design_report` con al menos una de: `narrative`/`report_narrative` ≥80 caracteres, `contentCoverage` con ítems, `teacherRequirementsApplied` con ítems), ese reporte se trata como **canónico**.
- Solo se usa el reporte **inferido / derivado de HTML** cuando el reporte estructurado falta o no es parseable (p. ej. respuesta no es JSON válido).
- No se sobrescriben `contentCoverage` ni `teacherRequirementsApplied` cuando el modelo ya los devolvió (el relleno solo se hace cuando están ausentes o vacíos).

### 2) Narrativa: prioridad al modelo y umbral reducido

- Se considera narrativa del modelo válida con **≥200 caracteres** (antes 1200). Así se conservan narrativas de 400–600 palabras.
- `report_narrative` (y `narrative` en `ai_design_report`) se fijan a la narrativa **sanitizada** (sin HTML ni fugas de prompt) y solo se usa `buildTeacherReportNarrative` cuando la narrativa del modelo falta o es demasiado corta.

### 3) Limpieza de `plan_html`

- **`stripDebugFromPlanHtml(plan_html)`:**  
  - Elimina de `plan_html` cabeceras tipo `### AI Design Report` y bloques ```json ... ``` / ``` ... ```.  
  - Conserva solo el HTML del plan: desde `<section id="plan">` hasta el `</section>` correspondiente.  
- Se aplica tanto cuando la respuesta es JSON válido (sobre `parsed.plan_html`) como cuando el parseo falla y se usa el contenido crudo como `plan_html`.

### 4) Política de supuestos (assumptions)

- No se afirma que "los estudiantes tienen conocimientos previos" como hecho; se usa lenguaje condicional.
- Texto usado: *"Activar conocimientos previos si resulta apropiado para el grupo y el momento de la secuencia."* (y equivalente en ejemplos del prompt), en lugar de afirmaciones categóricas.

### 5) Contrato de salida (docente vs debug)

- **`report_narrative`:** Texto limpio para el docente (sin etiquetas HTML visibles ni instrucciones de prompt). Se aplica `sanitizeReportNarrative` antes de devolverlo.
- **`report_technical`:** No se muestra a docentes por defecto; queda disponible solo para debug/admin (en la UI, solo si `window.__PLAN_REPORT_DEBUG__ === true`).
- **`response.debug`:**  
  - `debug.aiReportSource`: `"structured"` | `"fallback"` (indica si se usó el reporte estructurado del modelo o el inferido).  
  - `debug.materialsUsed`: `true` | `false`.  
  Permite verificar en DevTools sin depender de logs pesados.

### 6) UI (componente teacher-facing)

- El componente de reporte de IA usa de forma consistente `report_narrative` o `ai_design_report.narrative` para el texto que ve el docente.
- No se muestra JSON técnico crudo a docentes; la sección "Detalle técnico (raw)" solo se renderiza si está activado `window.__PLAN_REPORT_DEBUG__`.
- La narrativa se muestra como texto/markdown limpio (sin mostrar literales `<p>` ni HTML); se sigue usando `stripHtmlToText` en el front y sanitización en el backend.

## Cómo verificar

1. **DevTools / respuesta de `generate-plan-completo`:**  
   - `response.debug.aiReportSource` debe ser `"structured"` cuando el modelo devolvió un reporte con narrativa o `contentCoverage`/`teacherRequirementsApplied` poblados.  
   - `response.debug.materialsUsed` debe ser `true` cuando se enviaron materiales.  
   - Con materiales y reporte estructurado, `contentCoverage` en la respuesta debe seguir refiriendo materiales concretos (p. ej. secciones del texto), no el mensaje genérico de "No se proporcionaron materiales".

2. **Plan de 2 sesiones con materiales:**  
   - Generar un plan de 2 sesiones con materiales subidos.  
   - Revisar el reporte de la sesión 2: debe mencionar el segmento/material correspondiente a esa sesión (p. ej. "secciones 3 y 4 de…") y no "No materials were provided".  
   - Confirmar que no se muestra ningún bloque crudo de JSON ni markdown de debug al docente (salvo con `__PLAN_REPORT_DEBUG__` activado).

## Pasos de prueba manual

1. Crear una planificación con 2 sesiones y al menos un material con contenido relevante.  
2. Generar el plan completo para ambas sesiones.  
3. En la respuesta (o en la UI si se expone), comprobar:  
   - `debug.aiReportSource === "structured"` cuando el modelo devolvió reporte completo.  
   - `debug.materialsUsed === true`.  
   - En el reporte visible para el docente (narrativa), que se mencionen los materiales o secciones correctas y que no aparezca "No se proporcionaron materiales" cuando sí se subieron.  
4. Para la sesión 2, abrir el reporte de IA y confirmar que hace referencia al segmento/material adecuado para esa sesión.  
5. Comprobar que no se muestra JSON ni markdown crudo al docente (y que sí aparece la sección técnica si se activa `window.__PLAN_REPORT_DEBUG__ = true`).

## Restricciones respetadas

- No se modificó la generación de evaluaciones ni `modify-evaluation-v2`.
- Sin llamadas LLM adicionales; rendimiento estable.
- Respuesta consistente y orientada al docente.
