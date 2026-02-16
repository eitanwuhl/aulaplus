# Phase 3 — Block 3c: Real Version Switching + Generate True A/B/C Variants

**Date:** 2026-02-16  
**Scope:** V2 only (EvaluationSpecV2 path). No rubric-per-question, no PDF export changes. Backward compatible.

---

## Root cause

1. **Backend**
   - The spec model is correct: a single `sections` array with items; each item has `prompt` (A) and optionally `versionedContent: { promptB, promptC, optionsB }`. `versionVariants` is metadata (label, isBase, reason).
   - When B/C were requested, the model sometimes did not fill `versionedContent.promptB`/`promptC` for (all) items. The backend did not treat “B requested but no promptB” as “B not generated”: it left `versionVariants.B` in place and still set `requestedVersions` from the original request, so the UI could show B/C as available even when there was no variant content.
   - There was no logic to remove B/C from `versionVariants` when no items had the corresponding content, so “effective” versions did not match actual content.

2. **Frontend**
   - The normalizer already used `selectedVersion` and chose `versionedContent.promptB`/`promptC` when B/C were selected; for multiple_choice it did not use `versionedContent.optionsB` for B.
   - `availableVersions` was built from `spec.versionVariants` (metadata only), so the version selector could show B and C even when the backend had effectively generated only A.
   - The version selector value could be B/C when only A was available (no sync of selected version to “first available” when response changed).
   - Student assignments could still show students assigned to B/C when only A was generated, because the panel did not normalize by `requestedVersions`.

---

## Exact files modified

### 1. `supabase/functions/modify-evaluation-v2/index.ts`

- **Validation and effective variants**
  - Before normalizing `versionVariants`, we now count items that have non-empty `versionedContent.promptB` and `versionedContent.promptC`.
  - After ensuring `versionVariants.A` exists, we **remove** `versionVariants.B` when B was requested but no item has `promptB`; we **remove** `versionVariants.C` when C was requested but no item has `promptC`. Warnings are pushed (e.g. `VERSION_B_NO_CONTENT`, `VERSION_C_NO_CONTENT`). Partial content (some items with promptB) still keeps B and adds an info warning.
  - So `getEffectiveRequestedVersions(versionVariants)` now returns `B: false` / `C: false` when those variants were removed, and the response’s `requestedVersions` matches what was actually generated.
- **Prompt**
  - In the user prompt, added an explicit note: if B is requested, every item must have `versionedContent.promptB`, otherwise Version B will not be offered. Same idea for C and `promptC`.

### 2. `src/services/evaluations/v2Normalizer.ts`

- **availableVersions**
  - `availableVersions` is now derived from **`response.requestedVersions`** (effective) instead of `spec.versionVariants`. So we only add A/B/C to the list when `requestedVersions.A` / `requestedVersions.B` / `requestedVersions.C` is true. Labels still come from `spec.versionVariants` when present. If the list would be empty, we fall back to `[{ key: 'A', label: '...', isBase: true }]`.
- **multiple_choice options**
  - For `multiple_choice`, when `selectedVersion === 'B'` and `versionedContent.optionsB` exists and is an array, we use it as the options source; otherwise we use `item.options`. So Version B can show simplified options when the backend provides them.

### 3. `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`

- **effectiveVersion**
  - We compute `effectiveVersion`: if `v2Response.requestedVersions[selectedVersion]` is true we use `selectedVersion`, otherwise we use the first available version (A, then B, then C). So we never normalize with a version that was not generated.
- **Normalization**
  - `normalizeV2Response` is called with `effectiveVersion` instead of `selectedVersion`, so the rendered content always corresponds to a version that exists.
- **Sync parent when selection is invalid**
  - When normalization succeeds and `selectedVersion` is not in `evaluation.availableVersions`, we call `onVersionChange(firstAvailable)` so the parent state (e.g. `v2SelectedVersion`) is updated and we don’t leave the UI with an invalid selection.
- **Version selector value**
  - The Select value is `displayVersion`: `selectedVersion` if it is in `availableVersions`, otherwise the first available version. So the dropdown never shows a value that isn’t in the list (e.g. B when only A exists). Badge highlight uses `displayVersion` as well.

### 4. `src/components/evaluaciones/v2/V2InfoPanels.tsx`

- **V2StudentAssignmentByVersionPanel**
  - When building `effectiveAssignments` from `studentAssignments`, we map each assignment through `requestedVersions`: if a student is assigned to B but `!requestedVersions.B`, we treat them as A; same for C. So we never display a student as assigned to a version that was not generated.

---

## How selectedVersion maps to versionVariants / content

- **Data model**
  - There is a single `evaluationSpec.sections` array. Each item has:
    - `prompt`: content for Version A.
    - `versionedContent.promptB` / `promptC`: content for B/C when present.
    - `versionedContent.optionsB`: optional simplified options for B (multiple_choice).
  - `evaluationSpec.versionVariants` only holds metadata (A/B/C label, isBase, reason). It does **not** hold separate section trees.
- **Effective versions**
  - After validation, `versionVariants` may have B/C removed when no item has the corresponding content. `response.requestedVersions` is derived from that (via `getEffectiveRequestedVersions`), so it reflects “what was actually generated.”
- **Rendering**
  - `selectedVersion` is the user’s choice. `effectiveVersion` is the version we actually use for normalization: it equals `selectedVersion` if that version is in `requestedVersions`, otherwise the first available (usually A).
  - The normalizer uses `effectiveVersion` to choose, per item:
    - **A:** `item.prompt`; options from `item.options`.
    - **B:** `versionedContent.promptB` if present, else `item.prompt`; options from `versionedContent.optionsB` if present, else `item.options`.
    - **C:** `versionedContent.promptC` if present, else `item.prompt`.
  - So switching A/B/C in the UI changes the content when the backend provided distinct promptB/promptC (and optionsB for B).

---

## Validation rules for “effective versions”

1. **Backend (validateAndNormalizeSpec)**
   - Count, across all sections/items, how many have non-empty `versionedContent.promptB` and how many have non-empty `versionedContent.promptC`.
   - After ensuring `versionVariants.A` exists:
     - If B was requested and `itemsWithPromptB === 0` → delete `versionVariants.B`; add warning `VERSION_B_NO_CONTENT`.
     - If C was requested and `itemsWithPromptC === 0` → delete `versionVariants.C`; add warning `VERSION_C_NO_CONTENT`.
     - If B was requested and `0 < itemsWithPromptB < totalItems` → keep B; add info `VERSION_B_PARTIAL_CONTENT`.
   - `getEffectiveRequestedVersions(versionVariants)` then returns `A: true`, `B: !!variants.B`, `C: !!variants.C`, and the handler puts this in `response.requestedVersions`.
2. **Frontend**
   - `availableVersions` is built only from `response.requestedVersions`, so the selector only lists versions that were effectively generated.
   - Assignments panel maps any student assigned to B/C to A when `!requestedVersions.B` / `!requestedVersions.C`, so no student is shown as assigned to a non-existing version.

---

## Manual test checklist

- [ ] **Generate with A/B/C requested**
  - Request an evaluation with B (and optionally C) enabled (e.g. students with contemplaciones that trigger B/C).
  - After generation, switch the version selector between A, B, C.
  - Confirm that the evaluation **content** (prompts, and for multiple_choice the options when B is selected) changes visibly when switching versions, not only the label.
- [ ] **At least one observable difference A vs B**
  - With B generated, compare one item in A and in B: confirm at least one difference in the instrument (e.g. simpler wording in B, or different options for multiple_choice).
- [ ] **Fallback A-only**
  - Generate in a scenario that triggers A-only (e.g. fast fallback, or no B/C triggers).
  - Confirm the version selector shows **only** Version A (no B/C options).
  - Confirm no student is shown as assigned to B or C in the assignments panel; all show A.
- [ ] **Invalid selection sync**
  - If the UI state had B selected and a new response arrives with only A, confirm the selector updates to A and the content shown is A.
