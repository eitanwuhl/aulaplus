# Phase 3 — Block 3b: Per-Version AI Report (A/B/C) with Single Contextual Panel

**Date:** 2026-02-16  
**Scope:** V2 evaluations only. Single “Reporte de diseño de IA” panel whose content changes with the selected version (A/B/C).  
**Constraints:** No rubric-per-question, no PDF export changes, no DB schema change.

---

## Summary of changes

1. **Backend (modify-evaluation-v2)**  
   The Edge Function response now includes a per-version report: `aiReport.byVersion` with `A`, and optionally `B`/`C`, each with at least `narrative`. The model is prompted to produce a report per generated version; when only Version A is generated (e.g. fast fallback), only `byVersion.A` is included.

2. **Persistence**  
   The existing save flow already persists the full `aiReport` (including `byVersion`) inside `evaluacion_generada` JSONB via `ai_report` / `aiDesignReport`. No schema or save logic change.

3. **Frontend (V2 panel)**  
   The V2 “Reporte de diseño de IA” panel (V2AIReportPanel inside V2InfoPanels) now takes `selectedVersion`. It shows `aiReport.byVersion[selectedVersion].narrative` when present, otherwise `aiReport.narrative`, and otherwise the short message “No hay reporte disponible para esta versión.” One panel only; content swaps by version.

---

## Exact files modified

### 1. `supabase/functions/modify-evaluation-v2/index.ts`

- **Types**
  - `EvaluationSpecV2.aiReport`: added optional `byVersion` with `A`/`B`/`C` entries, each with `narrative` and optional `decisionsApplied`, `warnings`.
  - New `AiReportPerVersion` interface: `narrative: string`, `decisionsApplied?: string[]`, `warnings?: string[]`.
  - `AIReportV2`: added optional `byVersion?: { A?: AiReportPerVersion; B?: ...; C?: ... }`.
- **Prompt (buildV2SystemPrompt)**
  - JSON schema: `aiReport` now includes `byVersion` with `A` (always) and `B`/`C` when those versions are requested.
  - New section “REPORTE POR VERSIÓN (aiReport.byVersion)”:
    - A: contents evaluated, alignment with competencies, teacher requirements, materials/session use.
    - B/C: differences from A (format, structure, scaffolding, accessibility); why difficulty is preserved and clarity/support improved.
- **validateAndNormalizeSpec**
  - After validating `aiReport.narrative`, validates `aiReport.byVersion`:
    - Keeps only keys that exist in `versionVariants` (A always; B/C only if present in spec).
    - Each entry must have a non-empty `narrative` string; optional `decisionsApplied`/`warnings` preserved.
  - Result: when only A is generated, `byVersion` only has `A` (no fabricated B/C).
- **Handler (success path)**
  - After setting `baseAiReport.narrative`:
    - If `result.spec.aiReport.byVersion` exists and is non-empty, assign it to `baseAiReport.byVersion`.
    - Else if there is a global narrative, set `baseAiReport.byVersion = { A: { narrative: baseAiReport.narrative } }`.
- **normalizeAiReportForFrontend**
  - If `backendReport.byVersion` exists and is non-empty, copy it to `normalized.byVersion` so the frontend receives it.

### 2. `src/services/evaluations/v2Types.ts`

- **New:** `AiReportPerVersionV2`: `narrative: string`, `decisionsApplied?: string[]`, `warnings?: string[]`.
- **AIReportV2:** added optional `byVersion?: { A?: AiReportPerVersionV2; B?: ...; C?: ... }`.

### 3. `src/components/evaluaciones/v2/V2InfoPanels.tsx`

- **V2InfoPanelsProps:** added optional `selectedVersion?: 'A' | 'B' | 'C'` (default `'A'`).
- **V2InfoPanels:** passes `selectedVersion` into `V2AIReportPanel`.
- **V2AIReportPanelProps:** added required `selectedVersion: 'A' | 'B' | 'C'`.
- **V2AIReportPanel:**
  - Resolves narrative for the selected version:  
    `narrativeForVersion = aiReport.byVersion?.[selectedVersion]?.narrative ?? aiReport.narrative` (trimmed, non-empty).
  - Renders a single block: if `hasNarrative` then the narrative text; else the short message “No hay reporte disponible para esta versión.”
  - Legacy structured block (designRationale, versionsExplanation, etc.) still renders when `!hasNarrative`.

### 4. `src/pages/EvaluacionesGrupo.tsx`

- **V2InfoPanels usage:** added prop `selectedVersion={v2SelectedVersion}` so the report panel follows the version selected in the V2 renderer.

---

## Data contract: `aiReport.byVersion`

- **Shape**
  - `aiReport.byVersion` is optional.
  - When present, it has one or more of: `A`, `B`, `C`.
  - Each value is an object:
    - **Required:** `narrative: string` (non-empty after trim).
    - **Optional:** `decisionsApplied?: string[]`, `warnings?: string[]`.
- **Semantics**
  - `A`: always present when `byVersion` exists (at least when Version A was generated).
  - `B` / `C`: only present when that version was actually generated (e.g. not after an A-only fast fallback).
- **Frontend**
  - Use `aiReport.byVersion?.[selectedVersion]?.narrative` when available; otherwise `aiReport.narrative`; otherwise show “No report available for this version”.

---

## Backward compatibility

- **Old saved evaluations (no `byVersion`)**
  - Panel uses `aiReport.narrative` as before.
  - If neither `byVersion[selectedVersion]` nor `narrative` exists, it shows “No hay reporte disponible para esta versión.” and, when `!hasNarrative`, the existing legacy structured report (designRationale, versionsExplanation, etc.).
- **Detail page (EvaluacionDetalle)**
  - Continues to use `AIDesignReport` with the same `ai_report` payload; it uses the global `narrative` and does not depend on `byVersion`. No change.
- **Persistence**
  - Same as today: full `aiReport` (including `byVersion`) is stored in `evaluacion_generada.ai_report` (and `ai_design_report`). No DB or save API change.

---

## Manual test checklist

- [ ] **V2 with A/B/C**
  - Generate a V2 evaluation with versions A, B, and C.
  - Switch version (A → B → C) in the UI.
  - Confirm the “Reporte de diseño de IA” panel content changes and matches the selected version (different text for A vs B vs C when the model produced distinct narratives).
- [ ] **V2 A-only (fast fallback)**
  - Generate a V2 evaluation that falls back to A-only (or force only A).
  - Confirm the report panel shows content for Version A without errors.
  - Confirm B/C are not offered as selectable report content (no B/C in `byVersion`).
- [ ] **Previously saved evaluation without `byVersion`**
  - Open an evaluation saved before this change (no `byVersion` in `ai_report`).
  - Confirm the report still displays using the global `narrative` and that the panel does not error.
- [ ] **Persistence**
  - After generating a V2 evaluation with per-version report, save it.
  - Reload or reopen the evaluation and confirm the report (and version switching, if applicable) still works from the saved `ai_report` / `evaluacion_generada`.
