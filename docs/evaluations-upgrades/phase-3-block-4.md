# Phase 3 — Block 4: Per-Question Rubric + CL Fallback Fix

## Summary

Implemented per-question rubric support end-to-end for V2 evaluations with backward-compatible fallback behavior:

- Added `item.rubric` to V2 spec types.
- Updated `modify-evaluation-v2` prompt + validation to require and enforce per-item rubrics for open-ended items.
- Added local fallback rubric generation when model output is missing/malformed (non-fatal, warning-based).
- Added emergency-template rubric support for open-ended contingency items.
- Added frontend per-item rubric rendering panel (grouped by section and item).
- Added inline edit controls (descriptor, min/max points) and wired edits back to `v2RawResponse`.
- Kept CL-derived rubric panel as fallback only when no per-item rubric exists.
- Hardened CL-derived rubric logic for empty/undefined criteria.
- Preserved backward compatibility for evaluations without per-item rubric.

---

## Backend Changes Summary

### File: `supabase/functions/modify-evaluation-v2/index.ts`

### 1) Spec/type extension in edge function types

- Added:
  - `RubricLevelV2`
  - `ItemRubricV2`
  - `EvaluationItemV2.rubric?: ItemRubricV2`

### 2) Prompt changes (per-question rubric generation)

#### `buildV2SystemPrompt(...)`
- Added section **“RÚBRICA POR ÍTEM (CRÍTICO)”** requiring rubric generation for:
  - `essay`
  - `paragraph`
  - `short_answer`
  - `source_analysis`
  - `true_false_justify` / justify-style items
- Added rules:
  - minimum 4 levels
  - item-specific descriptors
  - points alignment with `item.points`
- Extended required JSON example to include `rubric.levels`.
- Updated item-type list to explicitly require rubric for open-ended types.

#### `buildV2UserPrompt(...)`
- Added explicit instruction to include `rubric.levels` (>=4 levels) for open-ended items.

### 3) Validation/fallback logic

Added helper functions:
- `isOpenEndedItemType(type)`
- `buildFallbackRubric(itemPrompt, itemPoints)`
- `normalizeAndValidateRubric(rubric, itemPrompt, itemPoints)`
- `ensureOpenEndedRubrics(spec)`

Behavior:
- During `validateAndNormalizeSpec(...)`, after section/item normalization:
  - for each open-ended item, validate `item.rubric`.
  - if missing/malformed/too weak, inject local fallback rubric.
  - append warning:
    - `OPEN_ENDED_RUBRIC_FALLBACK_APPLIED`
- Evaluation is **not failed** due to rubric issues (warning-only).

### 4) Emergency template update

- In `buildEmergencyTemplateSpec(...)`, the contingency `essay` item now includes fallback `rubric`.

---

## Frontend Rendering Changes

### File: `src/services/evaluations/v2Types.ts`

- Added exported interfaces:
  - `RubricLevelV2`
  - `ItemRubricV2`
- Added optional field:
  - `EvaluationItemV2.rubric?: ItemRubricV2`
  - `NormalizedItem.rubric?: ItemRubricV2`

### File: `src/services/evaluations/v2Normalizer.ts`

- Added rubric pass-through normalization:
  - new helper `normalizeRubric(raw)`
  - in `normalizeItem(...)`, assigns `normalized.rubric` when valid.
- No breaking change to existing normalization paths.

### File: `src/components/evaluaciones/v2/ItemRubricPanel.tsx` (new)

New modular component to render and optionally edit per-item rubric:
- Groups rubric by section, then item.
- Shows item type, prompt preview, points.
- Renders compact levels table:
  - level label/key
  - descriptor (textarea, editable)
  - min/max points (number inputs, editable)
- Skips items without rubric safely.
- Supports read-only mode via `editable={false}`.

### File: `src/components/evaluaciones/v2/V2InfoPanels.tsx`

Key changes:
- Added prop:
  - `onV2ResponseChange?: (nextResponse: V2Response) => void`
- Added detection:
  - `hasPerItemRubric` across `evaluationSpec.sections[].items[].rubric.levels`
- Added edit handler:
  - `handleItemRubricChange(sectionId, itemId, nextLevels)` updates cloned `v2Response.evaluationSpec` and calls `onV2ResponseChange`.
- Rendering behavior:
  - If any per-item rubric exists:
    - render **“Rúbrica por ítem”** panel with `ItemRubricPanel` (primary behavior).
  - Else:
    - render legacy CL-derived `V2RubricPanel` (fallback).

### File: `src/components/evaluaciones/v2/V2InfoPanels.tsx` (CL fallback hardening)

`V2RubricPanel` improved:
- sanitizes `criteriosLogro` first (`safeCriterios`).
- handles undefined/empty/non-string criteria safely.
- `deriveRubricLevels(...)` now:
  - trims and normalizes case safely.
  - uses deterministic fallback text for empty criteria.
- shows clear empty-state message when no valid CL is available.

### File: `src/components/evaluaciones/v2/index.ts`

- Exported `ItemRubricPanel`.

---

## Persistence Wiring (Rubric Edits)

### File: `src/pages/EvaluacionesGrupo.tsx`

- Updated V2 panel usage:
  - `<V2InfoPanels ... onV2ResponseChange={setV2RawResponse} />`

Effect:
- Edits made in per-item rubric panel update `v2RawResponse` in page state.
- Existing save flow (from Block 3) already persists:
  - `evaluacion_generada.evaluation_spec = v2RawResponse.evaluationSpec`
- Therefore rubric edits are included in persisted `evaluation_spec`.

### File: `src/pages/EvaluacionDetalle.tsx`

- Added read-only display of per-item rubric for persisted V2 spec:
  - imports `ItemRubricPanel`
  - computes `hasPerItemRubricInDetail`
  - when V2 spec render path is active, shows “Rúbrica por ítem” card with `editable={false}`.

This ensures rubric content saved in `evaluation_spec` is visible after reload.

---

## CL Fallback Fix Explanation

The CL-derived rubric now acts as a strict fallback:

1. Primary path:
   - show per-item rubric panel if any item has `rubric.levels`.
2. Fallback path:
   - only when no per-item rubric exists, show `V2RubricPanel` derived from `criteriosLogro`.
3. Reliability improvements:
   - guard against undefined/empty CL arrays.
   - robust string normalization and deterministic generic descriptors.
   - no crash on malformed CL input.

---

## Exact Files Modified

- `supabase/functions/modify-evaluation-v2/index.ts`
- `src/services/evaluations/v2Types.ts`
- `src/services/evaluations/v2Normalizer.ts`
- `src/components/evaluaciones/v2/V2InfoPanels.tsx`
- `src/components/evaluaciones/v2/index.ts`
- `src/components/evaluaciones/v2/ItemRubricPanel.tsx` (new)
- `src/pages/EvaluacionesGrupo.tsx`
- `src/pages/EvaluacionDetalle.tsx`

---

## Manual Test Checklist

1. Generate V2 evaluation
- [ ] Ensure open-ended items (`essay`, `paragraph`, `short_answer`, `source_analysis`, `true_false_justify`) include rubric in `evaluationSpec`.
- [ ] In UI, confirm “Rúbrica por ítem” panel appears and groups by section/item.

2. Edit + persist rubric
- [ ] In group V2 panel, edit descriptor and/or min/max points for one level.
- [ ] Save evaluation.
- [ ] Reload detail page for the saved evaluation.
- [ ] Confirm edited rubric values are visible in read-only rubric panel (from persisted spec).

3. Fallback when model misses rubric
- [ ] Force/observe case where model omits or malforms rubric for an open-ended item.
- [ ] Confirm item still has fallback rubric (no generation failure).
- [ ] Confirm warning includes `OPEN_ENDED_RUBRIC_FALLBACK_APPLIED`.

4. CL-derived fallback only
- [ ] Open V2 evaluation/spec with no per-item rubric.
- [ ] Confirm CL-derived `V2RubricPanel` renders.
- [ ] Confirm no crash if `criteriosLogro` is empty/undefined.

5. Backward compatibility
- [ ] Open old evaluations (V1 or V2 without rubric).
- [ ] Confirm they still render without runtime errors.

6. Static checks
- [ ] `npx tsc --noEmit` passes.
- [ ] No lint/runtime errors in modified components.

---

## Edge Cases Handled

- `evaluationSpec` exists but some items missing rubric → fallback injected per item.
- `rubric.levels` present but malformed/short/weak descriptors → fallback injected.
- `item.points` missing/invalid → fallback rubric uses safe default points.
- `criteriosLogro` undefined/empty/non-string entries → CL fallback panel remains stable.
- No per-item rubric anywhere in spec → CL fallback panel shown instead of empty crash.
- Detail view with persisted spec but no per-item rubric → normal V2 rendering continues; rubric card only appears when available.

