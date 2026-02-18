# Phase 3 Block 3h — Version narrative evidence analysis

**Branch:** `mejorar-evaluaciones`  
**Scope analyzed:** `supabase/functions/modify-evaluation-v2/index.ts`

---

## 1) Datos disponibles hoy en el handler

### 1.1 Asignación de estudiantes por versión (WHO)

Fuentes detectadas en el payload:

- `designPlan.studentAssignments` (primaria)
- `designPlan.assignmentByStudentId` (fallback)
- `groupContext.students[]` para resolver nombres visibles (`displayName`) y fallback `Estudiante {id}`.

Resultado: se puede construir de forma determinística `A/B/C -> [nombres]`.

### 1.2 Contemplaciones/adecuaciones por estudiante (WHY)

Fuentes detectadas:

- Estructurada (preferida): `designPlan.contemplacionesByStudent` (si viene en request).
- Proxy en estudiante: `groupContext.students[].contemplaciones` (si existe).
- Fallback robusto: `teacherRemindersByStudent` (derivado de `designPlan.perStudentReminders`), usando cadenas de:
  - `admin[]`
  - `correction[]`

Observación: en escenarios reales, los triggers estructurados no siempre llegan completos; por eso el fallback de reminders es necesario para no perder causalidad.

### 1.3 Evidencia en spec (WHERE)

Señales disponibles directamente en `spec.sections[].items[]`:

- `item.id`, `item.type`, `item.points`
- `item.versionedContent.promptB` -> `hasB`
- `item.versionedContent.promptC` -> `hasC`
- `item.versionedContent.optionsB` -> `hasOptionsB`
- `item.equivalentResponseOptions.enabled` -> `hasEquivalentResponseOptions`

Estas señales permiten citar evidencia concreta por `item-*` de manera determinística.

---

## 2) Por qué las narrativas salían genéricas

Antes del ajuste final de 3h, persistían tres causas típicas de “texto genérico”:

1. El prompt de generación por versión no obligaba headings exactos + citas concretas de `item-*`.
2. No existía una garantía estricta por versión para anexar evidencia con formato estable cuando el modelo respondía abstracto.
3. Las entradas de triggers no estaban normalizadas en una fuente canónica única (a veces sin contemplaciones estructuradas).

Efecto: la narrativa podía ser correcta en tono pedagógico, pero sin WHO/WHY/WHERE verificable.

---

## 3) Decisión canónica de trigger source

Orden adoptado (determinístico):

1. **Preferido:** `contemplacionesByStudent` estructurado del request (`designPlan.contemplacionesByStudent`).
2. **Fallback 1:** `groupContext.students[].contemplaciones` si existe.
3. **Fallback 2 (canon de contingencia):** `teacherRemindersByStudent.admin/correction` para los estudiantes asignados a la versión.
4. **Si no hay datos:** `topTriggers = [{ key: "(sin datos)", count: n }]` + `whySummary` explícito de ausencia de datos.

Con esto, siempre se puede explicar causalidad sin romper contrato.

---

## 4) Implementación aplicada en index.ts (resumen)

- Se implementó `buildVersionRationalePack(selectedVersion, ...)` con salida:
  - `version`, `assignedStudents`, `topTriggers[{key,count}]`, `whySummary`.
- Se agregó `buildSpecEvidenceSummary(spec)` con salida:
  - `sections[{id,title,itemCount}]`
  - `items[{id,sectionId,type,points,hasB,hasC,hasOptionsB,hasEquivalentResponseOptions}]`
  - `changedItemsB[]`, `changedItemsC[]`.
- Se agregó `ensureNarrativeHasEvidence(narrative, pack, specSummary)` con apéndice obligatorio cuando faltan marcadores.
- Heading obligatorio en apéndice:
  - `Quiénes usan esta versión:`
  - `Por qué existe esta versión (disparadores):`
  - `Dónde se refleja en la evaluación (evidencia en ítems):`
  - `Equivalencia de exigencia:`
- Regla de evidencia para debug:
  - `debug.aiReportByVersionHasEvidence.{A,B,C} = true` cuando contiene `"Quiénes usan"` y regex `/item-\d+/`.
- Prompt byVersion reforzado para exigir WHO + WHY + WHERE + equivalencia; si no cumple, backend completa de forma determinística.

---

## 5) Riesgos y mitigaciones

- **Riesgo:** IDs no numéricos (ej. `item-a`) no cumplen `/item-\d+/` para debug.
  - **Mitigación:** el apéndice prioriza referencias existentes; si el generador mantiene `item-1`, `item-2`, etc., el marcador queda en true.
- **Riesgo:** ausencia total de triggers estructurados.
  - **Mitigación:** fallback de reminders y, en último caso, `(sin datos)` explícito.
- **Riesgo:** salida OpenAI parcial.
  - **Mitigación:** apéndice determinístico por versión + `ensureByVersionNarratives`.

---

## 6) Resultado esperado en aceptación manual

En escenario A+B+C efectivo:

- `aiReport.byVersion.B/C.narrative` incluye explícitamente:
  - quiénes (nombres),
  - disparadores con conteos,
  - evidencia en `item-*` (>= 3 cuando posible),
  - equivalencia de exigencia.
- `debug.aiReportByVersionHasEvidence.B/C === true`.
- Al cambiar versión en UI, las narrativas difieren y muestran evidencia trazable.
