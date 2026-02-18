# Phase 3 Block 3h — Version narrative evidence fix

**Branch:** `mejorar-evaluaciones`  
**Scope:** `supabase/functions/modify-evaluation-v2/index.ts`

---

## Qué se cambió

Se reforzó el flujo backend de `aiReport.byVersion` para garantizar evidencia explícita por versión (A/B/C):

- Nuevos helpers determinísticos:
  - `resolveAssignedStudentsByVersion(...)`
  - `extractTriggersForStudents(...)`
  - `buildVersionRationalePack(...)`
  - `buildSpecEvidenceSummary(...)`
  - `ensureNarrativeHasEvidence(...)`
- `buildSpecEvidenceSummary` ahora entrega:
  - `sections[{ id, title, itemCount }]`
  - `items[{ id, sectionId, type, points, hasB, hasC, hasOptionsB, hasEquivalentResponseOptions }]`
  - `changedItemsB[]`, `changedItemsC[]`
- Se reforzó detección de evidencia:
  - `hasNarrativeEvidenceMarkers` requiere `"Quiénes usan"` + regex `item-[a-z0-9_-]+`.
- Orden de ejecución en handler (success path):
  1) `ensureByVersionNarratives(baseAiReport, ...)`
  2) `applyNarrativeEvidenceByVersion(...)` sobre `baseAiReport`
  3) `normalizeAiReportForFrontend(...)`
  4) safety: `ensureByVersionNarratives(normalizedAiReport, ...)`
  5) safety: `applyNarrativeEvidenceByVersion(...)` sobre `normalizedAiReport`

---

## Fuentes usadas para WHO/WHY (prioridad)

### WHO (estudiantes por versión)

1. `designPlan.studentAssignments` (primaria)  
2. `designPlan.assignmentByStudentId` (fallback)  
3. Resolución de nombre con `groupContext.students[].displayName`; fallback `Estudiante {id}`.

### WHY (triggers por versión)

1. `designPlan.contemplacionesByStudent` (estructurada preferida)  
2. `groupContext.students[].contemplaciones`  
3. `teacherRemindersByStudent.admin/correction` (fallback canónico)  
4. Sin datos: `[{ key: "(sin datos)", count: n }]`.

Normalización de trigger keys:
- lowercase
- trim
- colapso de espacios
- mapeo determinístico de variantes comunes (ej: “brindar más tiempo” -> “más tiempo”).

---

## Formato del apéndice determinístico (ejemplo)

```text
Quiénes usan esta versión: Ana Pérez, Juan López, +2 más.
Por qué existe esta versión (disparadores):
- más tiempo (3)
- consignas en pasos (2)
- vocabulario más accesible (2)
La versión B se genera para estudiantes asignados con disparadores predominantes: más tiempo (3); consignas en pasos (2); vocabulario más accesible (2).
Dónde se refleja en la evaluación (evidencia en ítems):
- sec-1/item-1 (source_analysis): promptB, optionsB en alternativas
- sec-2/item-3 (essay): equivalentResponseOptions habilitado
- sec-3/item-5 (multiple_choice): promptB
Secciones analizadas: 3.
Equivalencia de exigencia: se mantienen los mismos objetivos de aprendizaje y la misma demanda cognitiva; solo cambia el formato o andamiaje.
```

---

## Checklist manual de verificación (Network + logs)

1. Generar escenario efectivo A+B+C.
2. En Network (`modify-evaluation-v2`) validar en `aiReport.byVersion.B/C`:
   - contiene los 4 headings obligatorios:
     - `Quiénes usan esta versión:`
     - `Por qué existe esta versión (disparadores):`
     - `Dónde se refleja en la evaluación (evidencia en ítems):`
     - `Equivalencia de exigencia:`
   - incluye referencias `item-*` (idealmente >= 3 si hay suficientes ítems).
3. Validar debug:
   - `debug.aiReportByVersionHasEvidence.B === true`
   - `debug.aiReportByVersionHasEvidence.C === true`
   - conservar `debug.aiReportByVersionKeys` y `debug.aiReportByVersionLens`.
4. En logs y UI:
   - logs sin warnings de narrativa faltante por B/C,
   - al cambiar A/B/C, narrativa cambia y evidencia WHO/WHY/WHERE.
