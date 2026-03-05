# 46) Verificación en runtime de los fixes 42 (evaluaciones) y 45 (planificación)

Fecha: 2026-03-04  
Objetivo: Comprobar en respuestas reales que los campos de debug y el comportamiento descrito en docs 42 y 45 están activos.

---

## A) Evaluaciones (modify-evaluation-v2)

### Campos de debug a revisar en DevTools

Tras una llamada exitosa a la edge function `modify-evaluation-v2`, inspeccionar el cuerpo JSON de la respuesta y localizar `response.debug`. Debe contener:

| Campo | Descripción | Valor esperado (con materiales) |
|-------|-------------|----------------------------------|
| `materialsPromptPath` | Indica qué camino se usó para materiales | `"bundle"` cuando hay materiales con `extractedText` y se añadió la sección al prompt; `"legacy"` si no |
| `keptBlocksCount` | Bloques que pasaron el filtro de calidad | Número ≥ 0 (con materiales útiles, típ. ≥ 6) |
| `passagesRejectedCount` | Rechazos por razón (toc, biblio, prologue, metadata) | Objeto, p. ej. `{ "toc": 2, "biblio": 0, "prologue": 1, "metadata": 3 }` |
| `finalK` | Número de pasajes finalmente seleccionados | 6–10 cuando hay `extractedText` suficiente |
| `finalChars` | Caracteres totales de materiales enviados en el prompt | ~20 000–30 000 cuando hay material suficiente |
| `passagesSelectedCount` | Mismo concepto que `finalK` (legacy) | Debe coincidir con `finalK` |
| `materialsCharsSent` | Mismo concepto que `finalChars` (legacy) | Debe coincidir con `finalChars` |
| `llmCallCount` | Número de llamadas OpenAI en este request | 1 en flujo normal (sin auto-extend ni narrative LLM) |

Si `materialsPromptPath === 'bundle'` y hay materiales con texto extraído, `keptBlocksCount`, `finalK`, `finalChars` deben reflejar el pipeline nuevo (6–10 pasajes, ~20k–30k chars). Si ves `passagesSelectedCount === 1` y `materialsCharsSent ≈ 2000` con materiales largos, el path usado no es el bundle o el bundle no se aplicó correctamente.

### Checklist manual (evaluaciones)

1. [ ] Llamar a `modify-evaluation-v2` con un design plan que incluya `materials` con `extractedText` de al menos ~15k caracteres.
2. [ ] En la respuesta, comprobar que `response.debug` existe.
3. [ ] Comprobar que `response.debug.materialsPromptPath` está presente y es `"bundle"` cuando hay materiales utilizables.
4. [ ] Comprobar que `response.debug.keptBlocksCount`, `finalK`, `finalChars`, `passagesRejectedCount` están presentes (números u objeto, no ausentes).
5. [ ] Verificar que `finalK` está en rango 6–10 y `finalChars` en ~20k–30k cuando el material lo permite.
6. [ ] Verificar que `response.debug.llmCallCount === 1` en flujo normal (sin env vars de auto-extend/narrative).

---

## B) Planificación (generate-plan-completo)

### Campos de debug a revisar en DevTools

Tras una llamada exitosa a `generate-plan-completo`, inspeccionar el cuerpo JSON de la respuesta:

| Campo | Descripción | Valor esperado |
|-------|-------------|----------------|
| `debug.aiReportSource` | Origen del reporte de IA | `"structured"` cuando el modelo devolvió `ai_design_report` con narrativa/contentCoverage/teacherRequirementsApplied; `"fallback"` cuando se usó el inferido |
| `debug.materialsUsed` | Si se enviaron materiales en el request | `true` o `false` |
| `plan_html` | HTML del plan para renderizar | **No debe contener** cadenas como `` ``` `` o `### AI Design Report`; solo HTML (p. ej. `<section id="plan">...</section>`) |
| `ai_design_report.contentCoverage` | Cobertura de contenido | Cuando hay materiales y reporte estructurado, debe referir materiales concretos (p. ej. secciones del texto), **no** el mensaje genérico de “No se proporcionaron materiales” |

### Checklist manual (planificación)

1. [ ] Generar un plan (1 o 2 sesiones) con materiales subidos y, si es posible, instrucciones del docente.
2. [ ] En la respuesta, comprobar que existe `response.debug` con `aiReportSource` y `materialsUsed`.
3. [ ] Comprobar que `response.plan_html` no contiene `` ``` `` ni bloques `### AI Design Report` ni JSON en bruto.
4. [ ] Si el modelo devolvió reporte estructurado, comprobar que `response.debug.aiReportSource === "structured"`.
5. [ ] Comprobar que `response.debug.materialsUsed === true` cuando se enviaron materiales.
6. [ ] Comprobar que `response.ai_design_report.contentCoverage` (o el equivalente en la estructura devuelta) no es el texto inferido “No se proporcionaron materiales…” cuando sí se subieron materiales.

---

## C) Resumen de cambios realizados (implementación 46)

### modify-evaluation-v2 (fix 42 + verificación runtime)

- **Objeto de estadísticas de materiales:**  
  - `materialsPromptStats` ahora incluye siempre `keptBlocksCount`, `finalK`, `finalChars` como **números** (por defecto 0), para que aparezcan en el JSON y no se pierdan por ser `undefined`.
- **Ruta de materiales:**  
  - Variable `materialsPromptPath`: se pone a `'bundle'` solo cuando `materialsBundle.promptSection` se añade al `userPrompt`; en caso contrario queda `'legacy'`.  
  - Permite distinguir en runtime si se usó el bundle (index + relevant passages) o no.
- **Respuesta `debug`:**  
  - Se añade `materialsPromptPath` al objeto `response.debug`.  
  - Se garantiza que `response.debug` incluya siempre: `keptBlocksCount`, `finalK`, `finalChars`, `passagesRejectedCount` (los dos primeros como números; el último como objeto o sin sobrescribir con valores legacy).  
  - No se elimina ni sobrescribe después con métricas legacy en el camino de éxito; los valores que se envían son los mismos que se usan para construir el prompt (los del bundle cuando aplica).
- **Log:**  
  - En el log de materiales se incluye `materialsPromptPath` para ver qué camino se ejecutó (bundle vs legacy).

### generate-plan-completo (fix 45 + verificación runtime)

- **Precedencia estructurado vs fallback:**  
  - Si el modelo devuelve un `ai_design_report` estructurado (narrative/report_narrative ≥80 chars, o `contentCoverage` con ítems, o `teacherRequirementsApplied` con ítems), se considera **canónico**; solo se usa el reporte inferido cuando falta o no es parseable.
- **Umbral de narrativa:**  
  - En `buildTeacherReportNarrative` el umbral para aceptar la narrativa del modelo es **200 caracteres** (no 1200).
- **Debug en respuesta:**  
  - `response.debug.aiReportSource`: `"structured"` | `"fallback"`.  
  - `response.debug.materialsUsed`: `true` | `false`.  
  - Se asignan siempre antes de devolver la respuesta (en el objeto que se serializa).
- **Limpieza de `plan_html`:**  
  - Se aplica `stripDebugFromPlanHtml` a `parsed.plan_html` tras el parseo exitoso y al contenido crudo cuando el parseo falla.  
  - Se eliminan `### AI Design Report`, bloques `` ```json ... ``` `` y `` ``` ... ``` ``, y se conserva solo el tramo desde `<section id="plan">` hasta `</section>`.  
  - Se añade una pasada final que elimina cualquier `` ``` `` restante para que la respuesta no devuelva vallas de markdown.
- **Assumptions:**  
  - Sustitución por redacción condicional: “Activar conocimientos previos si resulta apropiado para el grupo y el momento de la secuencia” (no afirmar conocimientos previos como hecho salvo que venga explícito en inputs).

### Documentación

- Creado **`/docs/deploy/46-verify-42-and-45-running.md`** (este archivo) con:
  - Campos exactos de DevTools para evaluaciones: `finalK`, `finalChars`, `keptBlocksCount`, `passagesRejectedCount`, `llmCallCount`, `materialsCharsSent`, `materialsPromptPath`.
  - Campos exactos de DevTools para planificación: `debug.aiReportSource`, `debug.materialsUsed`, `plan_html` sin vallas, `contentCoverage` no inferido cuando hay materiales.
  - Checklist de verificación manual paso a paso para ambos flujos.
  - Resumen completo de los cambios de implementación realizados en esta fase.

---

## Restricciones respetadas

- Sin nuevas llamadas OpenAI.
- Sin relajar restricciones de calidad existentes.
- Tras los cambios, los campos de debug anteriores deben aparecer en las respuestas reales; si no, revisar que la versión desplegada de las edge functions sea la que incluye estos cambios.
