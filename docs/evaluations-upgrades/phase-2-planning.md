# AULA+ — Phase 2 Planning: Evaluations UX + V2 Persistence + Inline Response Options + Per-Question Rubrics + Print/PDF

**Date:** 2026-02-13  
**Scope:** Planning only. No implementation, no refactors.  
**Goal:** Produce a concrete technical plan so Phase 3 (Implementation) can be executed safely.

**References:**
- Phase 1 Investigation: `/docs/ai-audit/phase-1-investigation.md`
- Phase 1 Follow-ups: `/docs/ai-audit/phase-1-investigation-followups.md`

---

## Table of Contents

1. [A) Canonical Evaluation Representation](#a-canonical-evaluation-representation)
2. [B) Inline Equivalent Response Options](#b-inline-equivalent-response-options)
3. [C) Remove "Ítems" Column from MapTable](#c-remove-ítems-column-from-maptable)
4. [D) Rubric per Question](#d-rubric-per-question)
5. [E) Persist V2 Spec + Detail Page Rendering](#e-persist-v2-spec--detail-page-rendering)
6. [F) Print/PDF Unification](#f-printpdf-unification)
7. [G) Testing Plan](#g-testing-plan)
8. [File List & Migration Summary](#file-list--migration-summary)
9. [Rollout Strategy](#rollout-strategy)

---

## A) Canonical Evaluation Representation

### A.1 Decision matrix: storage strategy

| Criterion | Option 1: V2 spec as canonical, HTML cached | Option 2: Hybrid (V2 + V1 both supported, consistent reopen/print) |
|-----------|--------------------------------------------|---------------------------------------------------------------------|
| **Single source of truth** | Yes: V2 spec is truth; HTML is derived for legacy/print. | V2 and V1 are both first-class; display chosen by “what’s present.” |
| **Re-open after save** | Always re-render from spec; no broken detail page. | Same outcome if we persist V2 when available and prefer it on load. |
| **Backward compatibility** | Old rows have no spec → derive or show from HTML bundle. | Old rows: no spec → use HTML; new rows: spec optional → use spec when present. |
| **Print/PDF** | One path: render from spec → same DOM → export. | One path once we unify: render from spec when present, else HTML. |
| **Storage size** | Spec + optional cached HTML (larger). | Spec when V2, else only bundle; optional cache. |
| **Risks** | Must generate or cache HTML for legacy consumers if any. | Slightly more branching (spec vs no spec) in load/render. |

**Recommendation: Option 1 — V2 spec as canonical, with derived HTML as a cached artifact when needed.**

**Rationale:**
- Aligns with product direction (V2 JSON as the main format).
- Detail page and print become deterministic: “if we have a spec, we render from it.”
- Backward compatibility is a one-time concern: existing rows keep using `evaluacion_generada.evaluaciones` / `evaluation_bundle` until migrated or forever; new saves always persist the spec.
- Cached HTML can be added later only where required (e.g. legacy export or compatibility) and can be generated from spec on first load or on save.

### A.2 Where the V2 spec will be stored

- **Location:** Inside the existing **`evaluaciones.evaluacion_generada`** JSONB column.
- **New subfield:** `evaluacion_generada.evaluation_spec` (or `evaluationSpec` for consistency with frontend types).
  - Type: **EvaluationSpecV2** (same shape as Edge Function response: `version`, `generatedAt`, `meta`, `sections`, `versionVariants`).
  - Store the **raw** spec returned by `modify-evaluation-v2` (or the normalized form only if we standardize on a single normalized schema; recommendation: store **raw** to avoid double normalization and to preserve backend contract).
- **Do not** add a new top-level column (e.g. `evaluation_spec jsonb`) for Phase 2: keeping everything under `evaluacion_generada` avoids migrations and keeps one blob per evaluation. If the column size becomes an issue later, a future migration can split.

**Example stored shape (conceptual):**

```json
{
  "evaluaciones": [ ... ],
  "evaluation_bundle": { "versions": { "A": "...", "B": null, "C": null }, ... },
  "evaluation_spec": {
    "version": "2.0",
    "generatedAt": "2026-02-13T...",
    "meta": { "subject": "...", "criteriosLogro": [...], ... },
    "sections": [ { "id": "...", "title": "...", "items": [ ... ] } ],
    "versionVariants": { "A": { ... }, "B": null, "C": null }
  },
  "ai_report": { ... },
  "evaluation_design_plan": { ... },
  "student_assignments": { ... },
  "teacher_reminders_by_student": [ ... ]
}
```

### A.3 Backward compatibility with existing V1 saved evaluations

- **Detection:** On load (group or detail), if `evaluacion_generada.evaluation_spec` is present and valid (has `version`, `sections` array with at least one section and items), treat as **V2-capable** and render with EvaluationRendererV2 (or read-only variant).
- **Otherwise:** Use current V1 path: `evaluacion_generada.evaluaciones` and `evaluacion_generada.evaluation_bundle` to build `displayEvaluations` and render with `EvaluacionVisualRenderer` (HTML).
- **No migration of old rows required:** Existing evaluations continue to work as today. New evaluations (generated with V2 and saved) will have `evaluation_spec` set; old ones will not.
- **Optional future:** A background or on-demand job could “upgrade” old evaluations by calling a conversion (e.g. HTML → structured spec), but that is out of scope for Phase 2.

---

## B) Inline Equivalent Response Options

### B.1 Target behavior

- Equivalent response options **must not** appear as a separate Card below the question.
- They must be **integrated into the question block** in a way that:
  - Is **print-friendly** (no “instructional box” look; looks like part of the item).
  - Supports **optional metacognition text** in a subtle way (e.g. small italic line or compact note).
  - Remains **editable-friendly** for future work (same data shape; only presentation changes).

### B.2 Component strategy: variant support, not replacement

- **Recommendation:** Extend the **existing** response-options rendering with a **variant** prop rather than replacing the component. This keeps a single source of truth for the data and avoids duplicating option list logic.
- **Approach:**
  - Add a **presentation mode** (e.g. `variant: 'inline' | 'box'`). Default for the evaluation body and print: **`inline`**. The current Card layout becomes `variant='box'` and can be used only where explicitly needed (e.g. a future “preview as student” that emphasizes the choice).
  - **New component:** Introduce a small presentational component **`ResponseOptionsInline`** (or a named export from the same file) that renders the **same** `options` + optional `metacognitionText` in an inline style:
    - No Card; options as a compact list (e.g. “Puedes responder en uno de los siguientes formatos: (A) …; (B) …; (C) ….”) directly under the prompt, with minimal styling (e.g. same font size, muted color for labels, no dashed border).
    - Metacognition: one short line below the options, e.g. italic or small text, only if `metacognitionText` is present.
  - **EvalItem** will:
    - For the main evaluation view and print: render **inline** variant (ResponseOptionsInline or ResponseOptions with variant="inline").
    - Not render the **box** variant in the default path (box can be removed from EvalItem entirely, or kept behind a feature flag for future use).

**Alternative considered:** Two separate components (ResponseOptions.tsx for box, ResponseOptionsInline.tsx for inline). Recommendation is to avoid duplication: either one component with variant, or one shared “options list” subcomponent used by both inline and box layouts.

### B.3 Files to change and props

| File | Change |
|------|--------|
| `src/components/evaluaciones/v2/ResponseOptions.tsx` | Add optional prop `variant?: 'inline' \| 'box'` (default `'inline'`). When `variant === 'inline'`: render without Card; compact list + optional metacognition line; use classes that are print-friendly (e.g. `print:font-normal`, no heavy borders). When `variant === 'box'`: keep current Card layout (for backward compatibility or future use). Ensure the same `options` and `metacognitionText` props are used. |
| `src/components/evaluaciones/v2/EvalItem.tsx` | Where ResponseOptions is rendered (lines 57–61): pass `variant="inline"` (or omit and rely on default). Remove or do not use the wrapper `<div className="ml-10">` for the inline case so the options sit visually inside the same “item” block (e.g. same left margin as prompt). Do not add new state or heavy logic; keep EvalItem small. |

**Prop contract (unchanged):**

- `options: NonNullable<NormalizedItem['responseOptions']>` — same as today: `{ enabled, options: Array<{ id, format, description }>, metacognitionText?: string }`.

**Inline layout (design note for implementation):**

- Title/subtitle like “Opciones de respuesta equivalentes” can be shortened to a single line for inline, e.g. “Formatos de respuesta (elegir uno):” or omitted and only list options.
- Options: e.g. “**A.** [format]: [description]. **B.** …” in one block; or a very compact list with bullets. No Card, no dashed border, no large padding.

### B.4 Reusability and size

- Keep **ResponseOptions** as the single component that receives `responseOptions` and delegates to inline or box layout. Optionally extract a tiny **OptionList** (options array → list of lines) used by both variants to avoid duplication.
- **EvalItem** should not grow: it only changes the prop passed to ResponseOptions and possibly the wrapper div (or removes the extra div for inline).

---

## C) Remove "Ítems" Column from MapTable

### C.1 Minimal-impact change plan

- **File:** `src/components/evaluaciones/v2/MapTable.tsx`.
- **Changes:**
  1. Remove the second column header (the `<TableHead>` that contains the “Ítems” label and Hash icon) — i.e. remove the entire `<TableHead className="text-center">` block for Ítems (lines 45–50 in current file).
  2. Remove the second `<TableCell>` in each section row that displays `section.items.length` (line 72–74).
  3. Remove the second `<TableCell>` in the totals row that displays `totalItems` (line 91).
  4. Adjust header count so “Puntos” and “Tiempo” remain centered; optionally give “Sección” slightly more width (e.g. increase from 50% to 60% or use `w-[60%]`) so the table does not look empty.
- **No data or parent component changes:** MapTable still receives `evaluation: NormalizedEvaluation`; we simply do not render one column. No changes to EvaluationRendererV2 or normalizer.

### C.2 UI adjustments

- Totals row: will show three cells (Sección label, Puntos total, Tiempo total). Ensure the first cell still shows “TOTAL” and spans visually correctly (no need for colspan if we simply have three columns).
- No new classes required beyond possible width tweak on the first header.

---

## D) Rubric per Question

### D.1 Data model: additions to EvaluationSpecV2

- **Per-item rubric:** Add an optional field on **each item** in the V2 spec.
  - **Recommended field name:** `rubric` (on `EvaluationItemV2`).
  - **Structure (proposed):**

```json
{
  "id": "item-1",
  "type": "essay",
  "prompt": "...",
  "points": 5,
  "rubric": {
    "levels": [
      { "key": "excelente", "label": "Excelente", "minPoints": 5, "maxPoints": 5, "descriptor": "..." },
      { "key": "bueno", "label": "Bueno", "minPoints": 4, "maxPoints": 4, "descriptor": "..." },
      { "key": "necesita_mejorar", "label": "Necesita mejorar", "minPoints": 2, "maxPoints": 3, "descriptor": "..." },
      { "key": "insuficiente", "label": "Insuficiente", "minPoints": 0, "maxPoints": 1, "descriptor": "..." }
    ],
    "criteriaNote": "Opcional: criterio ANEP asociado o nota del docente."
  }
}
```

- **Simplified alternative** (if full points range is too heavy for first version): `levels` as array of `{ key, label, descriptor }` only; points mapping can be derived (e.g. equal split from item.points). Recommendation: include **minPoints/maxPoints** per level so teacher edits can change point bands.
- **Backward compatibility:** `item.rubric` is optional. Items without `rubric` can show “Sin rúbrica” or a fallback derived from global criterios (current behavior) until we deprecate global-only rubric.

### D.2 Generation strategy: Edge Function (recommended)

- **Recommendation:** Generate per-question rubric **in the `modify-evaluation-v2` Edge Function** output.
  - **Reason:** Keeps rubric aligned with item prompt and type; single source of truth; no client-side model or heavy logic; works in one place for full, fast_fallback, and emergency_template.
- **Client-side generation** is not preferred: would require either duplicating prompt logic in the frontend or a separate API call; harder to keep in sync with item content.

### D.3 Edge Function plan (high level)

- **Prompt changes (high level):**
  - In the system or user prompt, add instructions that for each item (especially open-ended: essay, paragraph, short_answer, source_analysis, true_false_justify, etc.) the model **must** output a `rubric` object with at least 4 levels (e.g. excelente, bueno, necesita_mejorar, insuficiente), each with `label` and `descriptor`. Optionally include `minPoints`/`maxPoints` per level consistent with `item.points`.
  - Specify that rubric descriptors must be concrete and aligned with the item prompt (no generic text).
- **Output validation:**
  - After parsing the JSON spec, validate each `item.rubric` (if present): required `levels` array, each level has `key` and `descriptor`; optionally validate point ranges. If invalid, either strip rubric for that item and add a warning, or retry (depending on policy). Do not fail the whole evaluation for one bad rubric.
- **Fast fallback / emergency template:**
  - **Fast fallback:** Same prompt can ask for rubric; if the model omits it for some items, validation can fill a minimal default rubric (e.g. four levels with generic descriptors) so the UI always has something to show and edit.
  - **Emergency template:** In `buildEmergencyTemplateSpec`, for each item in the emergency spec, add a **minimal `rubric`** with four levels and placeholder descriptors (e.g. “Cumple totalmente el criterio.”, “Cumple parcialmente.”, “Cumple de forma insuficiente.”, “No cumple.”) and point bands derived from `item.points`. This ensures emergency evaluations are also rubric-ready.

### D.4 UI plan: rubric panel and editing

- **Panel structure:**
  - A **single rubric panel** (e.g. “Rúbrica por ítem”) that groups by **section**, then by **item** (section title → list of items with their rubric).
  - For each item: show item number, short prompt preview (e.g. first 80 chars), then the rubric levels (table or cards). Each level: label, descriptor, and optionally points range.
- **Editable controls:**
  - **Basic inline editing:** Each level’s `descriptor` (and optionally `minPoints`/`maxPoints`) editable in-place (e.g. textarea or contenteditable). No separate “edit modal” required for Phase 2 if we keep it simple.
  - **Persistence:** Edits update the in-memory evaluation spec (or normalized structure). On **save evaluation**, the modified spec (including `item.rubric` edits) is persisted in `evaluacion_generada.evaluation_spec`. So no separate “save rubric” button; saving the evaluation saves rubrics.
- **Where the panel lives:**
  - On the **group screen** (V2 path): the panel can live in **V2InfoPanels** — replace or complement the current “Rúbrica de evaluación” (global criterio-derived) with the new “Rúbrica por ítem” when `evaluation_spec` has at least one item with `rubric`. If no item has rubric, show the current global rubric or a message “No hay rúbricas por ítem.”
  - On the **detail page** (when rendering from spec): same panel can be shown in a read-only or editable form; if editable, detail page must also persist back to `evaluacion_generada.evaluation_spec` on save (detail page save flow to be aligned in Phase 3).

### D.5 DB persistence for rubrics

- **Use existing structure:** Store rubrics **inside** `evaluacion_generada.evaluation_spec` (i.e. inside each `sections[].items[].rubric`). Do **not** use a separate top-level `evaluaciones.rubrica` for the new per-item rubrics to avoid two sources of truth.
  - **Existing column `evaluaciones.rubrica`:** Leave as-is for now. If in the future we migrate global rubric or use it for something else, we can. For Phase 2, per-item rubric lives only in `evaluation_spec`.
- **No new migration** for rubric storage: the spec is already JSONB; adding `rubric` to items is a schema extension in TypeScript and in the Edge Function response contract.
- **How edits are saved and reloaded:** When the user clicks “Guardar evaluación” (group or detail), the payload to `evaluaciones` includes `evaluacion_generada` with the full `evaluation_spec` (including any client-side edits to `item.rubric`). On reload, the detail (or group) page loads `evaluacion_generada.evaluation_spec` and renders the rubric panel from it; edits are thus persisted and reloaded with the same blob.

---

## E) Persist V2 Spec + Detail Page Rendering

### E.1 Save flow changes (group screen)

- **When saving after V2 generation:**
  - **Persist** `evaluation_spec`: set `evaluacion_generada.evaluation_spec` to the **raw** `v2RawResponse.evaluationSpec` (or the current in-memory spec if the user has edited rubrics / adjustments). Do not persist empty or null when we have a V2 spec.
  - **Persist** `ai_report`: already stored in `evaluacion_generada.ai_report` (and optionally `ai_design_report`); keep as-is.
  - **Derived HTML (optional):** For backward compatibility with any consumer that only reads HTML, Phase 2 can **optionally** generate HTML from the spec (e.g. via a small spec-to-HTML converter or by rendering to a hidden div and serializing). Recommendation: **do not** persist derived HTML in Phase 2 unless a concrete consumer requires it; keep “V2 spec as canonical” and render from spec everywhere we control (group view, detail view, PDF). If later we find a need for cached HTML, add it as a separate subfield (e.g. `evaluacion_generada.cached_html`) and populate on save or on first load.
- **When saving after V1 generation:** No change; do not set `evaluation_spec`. Existing `evaluaciones` and `evaluation_bundle` remain the source.

**File to change:** `src/pages/EvaluacionesGrupo.tsx` — in the block that builds `evaluacionData.evaluacion_generada` for insert/update, add:

- `evaluation_spec: useBetaV2 && v2RawResponse?.evaluationSpec ? v2RawResponse.evaluationSpec : existingEvaluacionGenerada?.evaluation_spec ?? undefined`

(If the user has made edits to the spec on the client — e.g. rubric edits — the “current” spec should come from state that holds the edited spec, not only `v2RawResponse`; Phase 3 will wire that state.)

### E.2 Detail page: render from V2 spec when present

- **Load:** When loading an evaluation in `EvaluacionDetalle`, read `evaluacion.evaluacion_generada?.evaluation_spec`. If present and valid (e.g. has `sections` with items), build a **V2Response-like** object: `{ success: true, evaluationSpec: evaluation_spec, aiReport: evaluacion_generada.ai_report, ... }` so the same renderer can be used.
- **Render:**
  - **If** `evaluation_spec` is present and valid → render with **EvaluationRendererV2** (or a **EvaluationRendererV2ReadOnly** that reuses the same normalization and section/item tree but hides version selector / PDF if not needed). Use the same normalization (`normalizeV2Response`) so inline response options and rubric panel receive the same data.
  - **Else** → fall back to current **EvaluacionVisualRenderer** using `evaluacion_generada.evaluaciones` and HTML content.
- **Version selector on detail:** If the spec has versionVariants B/C, the detail page can show a version selector (A/B/C) and pass `selectedVersion` to the renderer; otherwise only A is shown.
- **Files to change:**
  - `src/pages/EvaluacionDetalle.tsx`: (1) Read `evaluation_spec` from `evaluacion.evaluacion_generada`. (2) Add a branch: if spec exists and is valid, set state or a variable with a synthetic `V2Response` and render `EvaluationRendererV2` (or read-only variant); else keep current `displayEvaluations` + `EvaluacionVisualRenderer` logic.
  - Optionally: add `src/components/evaluaciones/v2/EvaluationRendererV2ReadOnly.tsx` that wraps EvaluationRendererV2 with `showVersionSelector={false}` and no toolbar if we want a slimmer detail view; or reuse EvaluationRendererV2 with props to hide controls.

### E.3 PDF export on the detail page

- **Requirement:** Detail page must support PDF export when the evaluation is shown (either from V2 spec or from V1 HTML).
- **Approach:** Use the **same** unified PDF path chosen in Section F (e.g. one service or component that captures a ref and exports). The detail page will:
  - Render the evaluation content inside a **ref** (e.g. a wrapper div around EvaluationRendererV2 or EvaluacionVisualRenderer).
  - Expose a **“Descargar PDF”** button that calls the unified export function with that ref.
- **Implementation note for Phase 3:** Reuse the single PDF implementation (e.g. html2canvas + jsPDF, or the chosen unified approach) so that both group and detail use one code path and the same print CSS.

---

## F) Print/PDF Unification

### F.1 Current duplication

- **V2 path:** `EvaluationRendererV2.tsx` — `handleExportPdf` using **html2canvas** + **jsPDF**; applies `.pdf-export-mode` to a content ref; multi-page by slicing the canvas.
- **V1 path:** `EvaluationContentWrapper.tsx` — `exportToPdf` using **html2pdf.js** (which internally uses html2canvas + jsPDF); captures a ref.

### F.2 Recommended single approach

- **Recommendation:** Standardize on **one** client-side export: **html2canvas + jsPDF** (the approach already in EvaluationRendererV2), and **remove** the html2pdf.js path from EvaluationContentWrapper.
  - **Reasons:** (1) One dependency (jsPDF + html2canvas) instead of two code paths and html2pdf’s extra abstraction. (2) EvaluationRendererV2’s logic already handles multi-page and margins. (3) Same CSS (`.pdf-export-mode`) can be applied to any content div, so V1 HTML content can be wrapped in a div that gets the same class and ref for capture.
- **Unification steps (plan):**
  1. Extract a **single** PDF export utility (e.g. `src/utils/pdfExport.ts` or `src/services/evaluations/pdfExport.ts`) that:
     - Accepts a `HTMLElement` ref and options (filename, margins, page size).
     - Applies `.pdf-export-mode` to the element (or a known container).
     - Uses html2canvas to capture the element, then jsPDF to produce the PDF (multi-page if height exceeds one page).
     - Returns a Promise that resolves when the file is saved (or rejects on error).
  2. **EvaluationRendererV2:** Replace inline `handleExportPdf` with a call to this utility, passing `contentRef.current` and the same options (A4, 10 mm margins, filename pattern).
  3. **EvaluationContentWrapper:** Replace `exportToPdf` (html2pdf) with a call to the same utility, passing the existing content ref. Ensure the wrapper’s content div is structured so that the capture looks correct (e.g. same width constraints as V2).
  4. **Detail page:** Add a “Descargar PDF” button that calls the same utility with a ref around the evaluation content (V2 or V1).
  5. **Remove** the dynamic import of `html2pdf.js` from EvaluationContentWrapper and any other references.

### F.3 CSS print rules (documentation for implementation)

- **Classes to keep and use consistently:**
  - **`.pdf-export-mode`** — Applied to the container during PDF capture (and optionally for print preview). Defined in `src/index.css` (~lines 469–493). Sets width 718px, block layout, white background, typography. Use on the same element that is passed to the export utility.
  - **`.pdf-no-break`** — Prevents page breaks inside the element (cards, tables, items). Use on section cards, map table, each EvalItem.
  - **`.pdf-break-before`** / **`.pdf-break-after`** — Force page break before/after element if needed.
  - **`.pdf-hide`** — Elements to hide in PDF (e.g. buttons). Buttons are already hidden via `.pdf-export-mode button` in CSS.
- **`@media print`** — Used when the user does **window.print()** or browser Print. Hides nav/buttons, sets `@page` size and margins, and uses `.print-no-break` (or same break rules) for content. Ensure the same content container has the class that is used for print (e.g. `print-content`) so that both “Export PDF” and “Print” behave consistently.
- **Documentation:** In Phase 3, add a short comment block in `src/index.css` at the top of the print/PDF section listing these classes and that they are shared by the unified PDF export and by `@media print`.

### F.4 Phased rollout (avoid breaking existing flows)

- **Phase 3.1:** Implement the shared PDF utility and switch **EvaluationRendererV2** to use it; verify V2 PDF export still works (group screen).
- **Phase 3.2:** Switch **EvaluationContentWrapper** to use the shared utility; remove html2pdf; verify V1 PDF export (group screen, V1 mode) still works.
- **Phase 3.3:** Add PDF button and ref on **EvaluacionDetalle**; verify PDF from detail for both V2 and V1 evaluations.
- **Rollback:** If issues arise, the shared utility can be in a separate file so that reverting to the previous inline implementation in one component is possible without touching the other.

---

## G) Testing Plan

### G.1 Unit / logic tests (if any exist or to add)

- **Normalizer:** If there are or will be tests for `v2Normalizer`:
  - Add a case that normalizes an item with `equivalentResponseOptions` (object and array shapes) and assert `normalized.responseOptions` shape. Ensures inline UI still receives correct data after any normalizer change.
- **Rubric structure:** Add a small **validation helper** (e.g. `validateItemRubric(item.rubric)`) that returns true when `rubric` has `levels` array of length ≥ 1, each level has `key` and `descriptor`. Unit test this helper with valid, invalid, and missing rubric. Use it in the Edge Function or frontend before rendering rubric panel.

### G.2 Integration / manual test checklist

Use this list for QA and sign-off.

1. **Inline response options**
   - Generate a V2 evaluation with “Incluir opciones de respuesta equivalentes” enabled.
   - Confirm that equivalent options appear **inside** the question block (no separate Card below).
   - Confirm options and optional metacognition text are readable and print-friendly (no dashed box).
   - Export PDF from group view; open PDF and confirm options appear in line with the question, not in a separate box.

2. **Map without Ítems column**
   - Open a V2 evaluation (group view). Open “Mapa de la evaluación.”
   - Confirm the table has **three** columns: Sección, Puntos, Tiempo (no “Ítems” column).
   - Confirm totals row has three cells and aligns correctly.

3. **Rubric per question**
   - Generate a V2 evaluation (ensure backend returns `item.rubric` for at least some items).
   - Open the “Rúbrica por ítem” (or equivalent) panel; confirm rubrics are grouped by section and item.
   - Edit one level’s descriptor (and optionally points), save the evaluation, reload the page, and confirm the edit persisted.
   - If using emergency template: trigger failure path and confirm emergency evaluation still shows per-item rubrics (placeholder or minimal).

4. **V2 persistence and detail page**
   - Generate V2 evaluation on group screen; click **Guardar** (save).
   - Open the **evaluation detail** page (navigate to that evaluation).
   - Confirm the evaluation renders from the **V2 spec** (same layout as group: header, map without Ítems, sections, inline response options, rubric by item). No “Version A missing” or blank content.
   - Confirm version selector appears if B/C were generated; switching version updates content.

5. **PDF export**
   - **Group view (V2):** Generate V2, click “Descargar PDF.” Confirm PDF opens and contains full evaluation (header, map, sections, inline options); no duplicate or broken layout.
   - **Group view (V1):** Generate or open V1 evaluation, click “Descargar PDF.” Confirm PDF contains evaluation content.
   - **Detail view:** Open a saved V2 evaluation on detail page, click “Descargar PDF.” Confirm PDF matches. Open a saved V1 evaluation on detail page, click “Descargar PDF.” Confirm PDF matches.

6. **Backward compatibility**
   - Open an **old** evaluation (saved before Phase 2, no `evaluation_spec`). Confirm it still opens on the detail page and renders via **EvaluacionVisualRenderer** (HTML).
   - Export PDF from that evaluation; confirm it still works.

7. **Rubric edits persist**
   - On a V2 evaluation with per-item rubrics, edit a descriptor in the rubric panel, save the evaluation.
   - Reload the detail page (or re-open from list). Confirm the edited rubric level shows the new text.

---

## File List & Migration Summary

### Files expected to change (by area)

| Area | Files |
|------|--------|
| **Canonical / persistence** | `src/pages/EvaluacionesGrupo.tsx` (save: add `evaluation_spec`); `src/pages/EvaluacionDetalle.tsx` (load spec, branch to V2 renderer, PDF button). |
| **Inline response options** | `src/components/evaluaciones/v2/ResponseOptions.tsx` (variant inline/box); `src/components/evaluaciones/v2/EvalItem.tsx` (use inline variant). |
| **MapTable** | `src/components/evaluaciones/v2/MapTable.tsx` (remove Ítems column and totals cell). |
| **Rubric per question** | `src/services/evaluations/v2Types.ts` (add `rubric` to EvaluationItemV2); `supabase/functions/modify-evaluation-v2/index.ts` (prompt, output validation, emergency template rubric); `src/services/evaluations/v2Normalizer.ts` (pass through item.rubric); `src/components/evaluaciones/v2/V2InfoPanels.tsx` or new component (rubric-by-item panel, editable); optionally `EvaluationRendererV2.tsx` if toolbar changes. |
| **Detail page V2** | `src/pages/EvaluacionDetalle.tsx` (load evaluation_spec, build synthetic V2Response, render EvaluationRendererV2 or read-only variant; PDF ref + button). |
| **PDF unification** | New: `src/utils/pdfExport.ts` or `src/services/evaluations/pdfExport.ts`; `src/components/evaluaciones/v2/EvaluationRendererV2.tsx` (use shared utility); `src/components/evaluaciones/EvaluationContentWrapper.tsx` (use shared utility, remove html2pdf); `src/pages/EvaluacionDetalle.tsx` (PDF button + ref). |
| **Print CSS** | `src/index.css` (optional: add comment block documenting .pdf-export-mode, .pdf-no-break, @media print). |

### New files (optional)

- `src/components/evaluaciones/v2/EvaluationRendererV2ReadOnly.tsx` — if we want a slim detail-only renderer (no version toolbar); otherwise reuse EvaluationRendererV2 with props.
- `src/utils/pdfExport.ts` or `src/services/evaluations/pdfExport.ts` — shared PDF export function.

### Migrations

- **No DB migration** required: `evaluacion_generada` is JSONB; new subfield `evaluation_spec` and `item.rubric` are schema extensions only. Existing column `evaluaciones.rubrica` is unused for this feature.

---

## Rollout Strategy

1. **Feature flags (optional):** If desired, gate “inline response options,” “rubric per item panel,” and “detail page V2 render” behind flags so they can be turned off without deploy (e.g. env or runtime config). Not strictly required if changes are backward-compatible.
2. **Order of implementation (suggested):**
   - **Step 1:** MapTable (remove Ítems) — lowest risk, independent.
   - **Step 2:** Inline response options (ResponseOptions variant + EvalItem) — UI only, no persistence change.
   - **Step 3:** PDF utility extraction and EvaluationRendererV2 + EvaluationContentWrapper switch — unify export without changing behavior.
   - **Step 4:** Persist `evaluation_spec` on save (EvaluacionesGrupo) and detail page load/render from spec when present — enables “reopen and see V2.”
   - **Step 5:** Detail page PDF button and ref.
   - **Step 6:** Rubric per question: data model (v2Types + normalizer), Edge Function (prompt + validation + emergency), then UI panel and editing + persistence.
3. **Verification after each step:** Run the relevant part of the manual test checklist (Section G.2) before moving on.
4. **Release:** Deploy as one or in two releases (e.g. first: map + inline options + PDF unification + persistence + detail V2; second: rubric per question) depending on risk tolerance.

---

*End of Phase 2 Planning. Proceed to Phase 3 (Implementation) using this document as the reference.*
