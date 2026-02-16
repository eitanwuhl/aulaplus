# Phase 3 — Implementation Block 3 Summary (Persist V2 Spec + Detail Page Rendering)

**Date:** 2026-02-13  
**Scope:** Persist `evaluation_spec` on save; render from spec on evaluation detail page when present and valid.  
**Reference:** [Phase 2 Planning](/docs/evaluations-upgrades/phase-2-planning.md) Section E.

---

## Summary of Changes

### Part 1 — Persist V2 spec on save (EvaluacionesGrupo)

When the user saves an evaluation after generating with V2 (`useBetaV2` and `v2RawResponse.evaluationSpec`), the payload now includes `evaluation_spec` inside `evaluacion_generada`. All existing fields (evaluaciones, evaluation_bundle, ai_report, etc.) are unchanged. When not in V2 mode or when there is no spec, `evaluation_spec` is not added.

### Part 2 — Render from spec on detail page (EvaluacionDetalle)

When loading an evaluation, the page reads `evaluacion_generada.evaluation_spec`. If it exists and passes the same validation used by the group view (`canRenderV2`), the page builds a synthetic `V2Response` and renders **EvaluationRendererV2**. Otherwise it keeps the existing behavior and renders **EvaluacionVisualRenderer** with HTML from `evaluaciones` / `evaluation_bundle`. Assignments panel, teacher reminders, and AI report are shown in both paths. Malformed or missing spec does not crash; the page falls back to the V1 renderer.

---

## Exact Files Modified

### 1. `src/pages/EvaluacionesGrupo.tsx`

- **Location:** Object passed to `evaluacion_generada` in the save payload (around lines 606–622).
- **Change:** Add conditional spread so that when `useBetaV2 && v2RawResponse?.evaluationSpec`, the object includes `evaluation_spec: v2RawResponse.evaluationSpec`. All other fields are unchanged.

**Exact change:**

```ts
evaluacion_generada: {
  evaluaciones: displayEvaluations,
  base_prototype: basePrototype,
  targetDurationMinutes,
  estimatedDurationMinutes,
  timeBreakdown,
  aiDesignReport: ...,
  ai_report: ...,
  evaluation_bundle: evaluationBundle,
  evaluation_design_plan: evaluationDesignPlan,
  student_assignments: studentAssignments,
  teacher_reminders_by_student: teacherReminders,
  // Persist V2 spec when saving after V2 generation (Block 3)
  ...(useBetaV2 && v2RawResponse?.evaluationSpec
    ? { evaluation_spec: v2RawResponse.evaluationSpec }
    : {})
},
```

- No TypeScript type change was required: `evaluacion_generada` is JSONB and already accepts arbitrary keys.

### 2. `src/pages/EvaluacionDetalle.tsx`

- **Imports added:** `EvaluationRendererV2` from `@/components/evaluaciones/v2`, `canRenderV2` from `@/services/evaluations/v2Normalizer`, and type `V2Response` from `@/services/evaluations/v2Types`.
- **Interface:** On `Evaluacion['evaluacion_generada']`, added optional `evaluation_spec?: unknown`.
- **Logic added:**
  - **`v2ResponseForDetail`** (useMemo): Reads `evaluacion.evaluacion_generada?.evaluation_spec`. If present and object-like, builds a `V2Response` with `success: true`, `evaluationSpec: spec`, `aiReport` from existing payload, and minimal `requestedVersions`, `teacherRemindersByStudent` (mapped from existing reminders), `warnings`, `instrumentDesignRulesApplied`. Returns `null` if no spec.
  - **`useV2Renderer`** (useMemo): `true` when `v2ResponseForDetail` is non-null and `canRenderV2(v2ResponseForDetail)` is true; otherwise `false`.
- **Render branch:**
  - If **`useV2Renderer && v2ResponseForDetail`**: Render assignment warnings, assignments panel, teacher reminders, then **EvaluationRendererV2** with `v2Response={v2ResponseForDetail}`, `selectedVersion="A"`, `showDebug={false}`; then AI report card (same as before).
  - Else if **`displayEvaluations.length > 0`**: Keep previous behavior (assignment warnings, panels, `displayEvaluations.map(EvaluacionVisualRenderer)`, AI report).
  - Else: Empty state (“Esta evaluación no tiene contenido generado”).

---

## How Backward Compatibility Was Preserved

- **Existing V1 evaluations:** They have no `evaluation_spec`. `v2ResponseForDetail` is `null`, `useV2Renderer` is `false`, and the page uses `displayEvaluations` and **EvaluacionVisualRenderer** exactly as before. No change to data loading or to the shape of `evaluacion_generada` for old rows.
- **Save flow:** When not V2 (`!useBetaV2` or `!v2RawResponse?.evaluationSpec`), the spread adds nothing, so the saved object is identical to the previous implementation. When V2, only `evaluation_spec` is added; all legacy fields remain.
- **Malformed spec:** If `evaluation_spec` exists but is invalid (e.g. missing sections or items), `canRenderV2` returns `false`, so `useV2Renderer` is false and the page falls back to the V1 path. No throw, no blank screen.
- **DB and backend:** No migration and no Edge Function changes; `evaluacion_generada` is JSONB and already accepts new keys.

---

## Manual Test Checklist

- [ ] **V2 save → detail uses V2 renderer**
  - Generate a V2 evaluation on the group screen (beta V2 on).
  - Save the evaluation.
  - Open the evaluation detail page (e.g. from “Mis evaluaciones” or direct URL).
  - Confirm the content is rendered with **EvaluationRendererV2** (header, map without Ítems column, sections, inline response options if any). No “Version A missing” or HTML error block.
- [ ] **Old V1 evaluation still uses HTML renderer**
  - Open an evaluation that was saved before this change (no `evaluation_spec` in DB).
  - Confirm the content is rendered with **EvaluacionVisualRenderer** (HTML) and looks unchanged.
- [ ] **No TypeScript errors**
  - Run `npx tsc --noEmit` and confirm it succeeds.
- [ ] **No crash when `evaluation_spec` is missing**
  - Open any evaluation; confirm the page loads and shows either V2 or V1 content without runtime errors.
- [ ] **Panels on detail**
  - For a V2-loaded detail page: confirm assignment warnings (if any), assignments panel, teacher reminders, and AI report still appear above/below the evaluation content as before.

---

*End of Phase 3 Block 3 summary.*
