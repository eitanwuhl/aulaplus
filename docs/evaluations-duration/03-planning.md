# V2 Evaluations Duration — Planning Document

**Phase:** Planning only (no code changes).  
**Goal:** Define a clean, testable fix for the “requested vs estimated duration” mismatch so that (1) the LLM is instructed with the target during initial generation, (2) target and estimate are clearly separated, (3) the UI always shows target vs estimated (and breakdown when available), and (4) auto-extend is robust enough to close large gaps without breaking JSON or hitting token limits.

**References:** `01-investigation.md` (flow and root causes), `02-investigation-followup.md` (UI mapping, response shape, duration branches, auto-extend, prompt map).

---

## 1) Proposed response contract changes (server → client)

### 1.1 New root-level fields (V2 response)

The edge should return the following at the **root** of the JSON response (same level as `success`, `evaluationSpec`, `aiReport`, etc.) so the client can always show “target vs estimated” without parsing the spec:

| Field | Type | Meaning | When present |
|-------|------|---------|--------------|
| `targetDurationMinutes` | `number \| null` | The duration (minutes) the teacher requested when configuring the evaluation. Echo of what was sent in `evaluation_design_plan.targetDurationMinutes`. | Set when the request included a positive target; otherwise `null`. |
| `estimatedTotalMinutes` | `number` | The deterministic estimate from `estimateDurationFromSpec(spec)` for the **final** returned spec. Always reflects actual content (never the target when content is short). | Always set on success (e.g. default 90 if no spec). |
| `timeBreakdown` | `object \| null` | Per-section (and optionally per-item-type) breakdown so the UI can show “X min by section” or similar. | Set when the server can compute it from the final spec; otherwise `null`. |

**Rationale:** The client already expects `estimatedTotalMinutes` and `timeBreakdown` for the time-budgeting widget but receives nothing. Adding them at root level is the smallest contract change that satisfies the UI. Echoing `targetDurationMinutes` at root keeps “what the teacher asked for” explicit and avoids the client having to persist it separately for the comparison.

### 1.2 Fields inside `evaluationSpec.meta.duration`

Keep existing consumers working: the header and normalizer today read `evaluationSpec.meta.duration.minutes`. The **canonical meaning** of that field will be: **estimated minutes only** (see section 3). So no change to the key name; we only stop overwriting it with the target in the scaling branch.

Add optional fields **inside** `meta.duration` for clarity and future use (normalizer/UI can use them if present):

| Field | Type | Meaning |
|-------|------|---------|
| `minutes` | `number` | **Estimated** total minutes (heuristic from content). Must never be overwritten with the target when content is unchanged. |
| `targetMinutes` | `number \| undefined` | Optional. The teacher-requested target when the evaluation was generated. Omitted if no target was sent. |
| `breakdown` | `object \| undefined` | Optional. Same shape as root `timeBreakdown` (e.g. by section, by item type) for consumers that read only the spec. |

**Backward compatibility:** Existing code that only reads `meta.duration.minutes` continues to work and will now always see the estimate. New code can read `targetMinutes` and `breakdown` when present. No breaking change.

### 1.3 Example JSON shape (high-level)

```json
{
  "success": true,
  "evaluationSpec": {
    "version": "2.0",
    "meta": {
      "subject": "Historia",
      "duration": {
        "minutes": 76,
        "targetMinutes": 80,
        "breakdown": { "sections": [...], "heuristicAssumptions": "..." }
      },
      "totalPoints": 50
    },
    "sections": [...]
  },
  "targetDurationMinutes": 80,
  "estimatedTotalMinutes": 76,
  "timeBreakdown": {
    "sections": [
      { "sectionId": "sec-1", "title": "Parte 1", "estimatedMinutes": 25, "itemCount": 5 },
      { "sectionId": "sec-2", "title": "Parte 2", "estimatedMinutes": 51, "itemCount": 8 }
    ],
    "heuristicAssumptions": "Por tipo de ítem (opción múltiple 2 min, ensayo 14 min, etc.)"
  },
  "requestedVersions": { "A": true, "B": false, "C": false },
  "instrumentDesignRulesApplied": [],
  "teacherRemindersByStudent": [],
  "aiReport": { ... },
  "warnings": []
}
```

Omit `targetDurationMinutes` (or set to `null`) and `meta.duration.targetMinutes` when the request did not include a target. `estimatedTotalMinutes` and `evaluationSpec.meta.duration.minutes` must always match.

---

## 2) Prompt changes plan (where + what)

### 2.1 Insertion point

- **Recommendation:** Pass `targetDurationMinutes` into **`buildV2UserPrompt`** (not the system prompt).
- **Reason:** The user prompt already carries request-specific data (group context, modification, instrument rules, versions). Duration is another “request parameter.” The system prompt defines global rules and schema; the user prompt defines “this run’s” constraints. Adding a duration block to the user prompt keeps the system prompt stable and makes it easy to omit the block when no target is sent (e.g. legacy or optional flows).

**Signature change (planning only):**  
`buildV2UserPrompt(groupContext, modification, instrumentDesignRules, requestedVersions, targetDurationMinutes?: number | null)`.

The handler already has `designPlan.targetDurationMinutes` when building the prompt; pass it as the fifth argument. When `targetDurationMinutes` is null/undefined or ≤ 0, the new block is omitted (no duration guidance).

### 2.2 Content of the new prompt block (high-level)

Add a **“Duración objetivo”** section to the user prompt, only when `targetDurationMinutes` is a positive number. The block should:

1. **State the target and band**
   - E.g. “Duración objetivo: N minutos. La evaluación generada debe tener una duración estimada entre low y high minutos (inclusive).”  
   - `low = round(target * 0.9)`, `high = round(target * 1.1)` (90–110% band).

2. **Provide the “minutes per item type” table**
   - Align with the backend heuristic so the model’s notion of “estimated duration” matches `estimateDurationFromSpec`.  
   - Table in natural language, e.g.: “Para estimar la duración total, usa aproximadamente: opción múltiple 2 min, verdadero/falso 1 min, verdadero/falso con justificación 4 min, respuesta corta 4 min, párrafo 9 min, ensayo 14 min, análisis de fuentes 14 min, completar tabla 5 min, relacionar 5 min, ordenar 5 min; ítem no listado 5 min; 1 min por sección de sobrecarga.”  
   - This mirrors `DURATION_MINUTES_BY_ITEM_TYPE` and `SECTION_OVERHEAD_MINUTES` so that the model can self-check.

3. **Give structural guidance to operationalize duration**
   - E.g. “Para alcanzar aproximadamente N minutos, considera al menos X ítems en total (o Y secciones con Z ítems cada una), según la mezcla de tipos.”  
   - X/Y/Z can be derived from a simple formula: e.g. `targetMinutes / averageMinutesPerItem` (e.g. 80/6 ≈ 13 ítems) as a minimum suggested count, with a short note that more open-ended items (essay, source_analysis) increase total time more.

4. **Remind that `meta.duration.minutes` must reflect the estimate**
   - E.g. “En el JSON, meta.duration.minutes debe ser la duración total estimada según la tabla anterior (no el objetivo pedido).”

No need to paste the full verbatim prompt here; the implementation will translate this into 1–2 short paragraphs and a bullet list in Spanish.

---

## 3) Server logic changes plan (duration fields, auto-extend, scaling)

### 3.1 Canonical meaning of `evaluationSpec.meta.duration.minutes`

- **Rule:** `meta.duration.minutes` must **always** be the **estimated** total minutes from `estimateDurationFromSpec(spec)` for the **current** spec (after any auto-extend), and must **never** be overwritten with the teacher’s target when the content has not been extended to match.
- So: after initial generation, set it to `estimatedMinutes`. After a successful auto-extend, set it to the new estimate. Do **not** set it to `targetDurationMinutes` in the scaling branch (see below).

### 3.2 Scaling branch: remove overwrite of `meta.duration.minutes`

- **Current behavior:** When deviation > 15%, the code scales `section.duration` and sets `meta.duration.minutes = targetDurationMinutes`, which is misleading (header shows 80 while content still implies ~36).
- **Proposed change:** **Remove** the assignment `result.spec.meta.duration.minutes = targetDurationMinutes` in the scaling branch. Optionally **remove** the entire scaling step (proportional scaling of `section.duration`) as well, because it does not add content and can confuse downstream logic (e.g. section “durations” no longer match the heuristic). If we keep scaling of section durations for display purposes only, we still **must not** overwrite `meta.duration.minutes` with the target.
- **Recommendation:** Remove the overwrite of `meta.duration.minutes` in the scaling branch at minimum. Prefer removing the whole scaling step unless product explicitly wants “section duration” numbers scaled for UI only; in that case, scale only `section.duration` and leave `meta.duration.minutes` as the heuristic estimate.

### 3.3 Auto-extend improvements

- **Number of attempts:** Allow up to **2** attempts (current is 1). If the first extend returns a spec but `newEst` is still below 90% of target, call extend again with the **current** (extended) spec as input. Cap total attempts at 2 to avoid long runs and token cost.
- **Stop conditions:**  
  - Stop and use the extended spec when `newEst >= targetDurationMinutes * 0.9`.  
  - Stop after 2 attempts even if below 90%; keep the best spec (highest `newEst` so far) and add a single `DURATION_EXTEND_FAILED` warning with the final estimate and target.  
  - Stop immediately on parse or validation failure for that attempt (do not retry the same attempt).
- **Logging / warning codes:** Keep existing codes (`DURATION_EXTEND_OPENAI_ERROR`, `DURATION_EXTEND_PARSE_ERROR`, `DURATION_EXTEND_VALIDATION_FAILED`, `DURATION_EXTEND_FAILED`). Add a log line when starting attempt 2 of 2 (e.g. `[DURATION_AUTO_EXTEND] attempt 2/2`). Optionally add an info-level warning when the extended spec is accepted but still below target (e.g. “Duración extendida a X min; objetivo Y min”).
- **Token-limit truncation:**  
  - Keep `max_completion_tokens` at 6000 for the extend call. If parse/validation often fails due to truncation, consider (in a later iteration) requesting only a **delta** (new items + modified section list) and merging on the server, so the model returns a smaller JSON. For the planned phase, document that truncation is a known failure mode and that 2 attempts give a second chance; if both fail, the warning clearly states that extension was not possible.

### 3.4 Building and returning `timeBreakdown` and root fields

- **timeBreakdown:** Compute from the **final** spec using the same heuristic: e.g. per-section estimated minutes (sum of item-type minutes in that section plus section overhead), and a short `heuristicAssumptions` string (e.g. “Por tipo de ítem: opción múltiple 2 min, ensayo 14 min, …”). Shape can match what `TimeBudgetingSection` already expects: `{ sections: Array<{ sectionId?, title?, estimatedMinutes, itemCount? }>, heuristicAssumptions?: string }`.
- **Root response:** Before returning, set `targetDurationMinutes` from `designPlan.targetDurationMinutes` (or null), `estimatedTotalMinutes` from the final `estimatedMinutes` variable, and `timeBreakdown` from the computed breakdown. Ensure `evaluationSpec.meta.duration.minutes` is exactly `estimatedTotalMinutes` and optionally set `evaluationSpec.meta.duration.targetMinutes` and `evaluationSpec.meta.duration.breakdown` for consistency.

---

## 4) Frontend changes plan (data wiring + display)

### 4.1 Ensure TimeBudgetingSection always receives estimated and breakdown

- **Primary source:** Prefer root-level `estimatedTotalMinutes` and `timeBreakdown` from the V2 response when present.
- **Fallback:** When the pipeline processes a V2 response and root-level `estimatedTotalMinutes` is missing (e.g. old edge version), derive estimated from `evaluationSpec.meta.duration.minutes` and, if needed, build a minimal `timeBreakdown` from `evaluationSpec.meta.duration.breakdown` or from the normalized evaluation’s sections (e.g. per-section duration from normalizer if available). So:  
  - `estimatedMinutes = dataObj?.estimatedTotalMinutes ?? dataObj?.evaluationSpec?.meta?.duration?.minutes ?? null`  
  - `timeBreakdown = dataObj?.timeBreakdown ?? (dataObj?.evaluationSpec?.meta?.duration?.breakdown ? { ... } : null)` (map breakdown to the shape the widget expects, or null).
- **Result:** TimeBudgetingSection always gets a non-null estimated whenever the spec has `meta.duration.minutes`, so “Comparación de tiempos” can always be shown after generation. Target remains from local state.

### 4.2 Components to change (minimal)

| File | Change |
|------|--------|
| `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` | When handling V2 success, set `estimatedMinutes` and `timeBreakdown` from root first, then fallback to `evaluationSpec.meta.duration` as above. Pass the derived values to `onSuccess?.setEstimatedDurationMinutes` and `onSuccess?.setTimeBreakdown`. Optionally set `targetDurationMinutes` from response root when present (so saved/loaded state can show the echoed target). |
| `src/services/evaluations/v2Types.ts` | Extend `V2Response` (or the type used for the parsed response) with optional `targetDurationMinutes?: number | null`, `estimatedTotalMinutes?: number`, `timeBreakdown?: TimeBreakdownShape | null`. Define `TimeBreakdownShape` to match the widget (sections array + heuristicAssumptions). |
| `src/components/evaluaciones/TimeBudgetingSection.tsx` | No change required if the pipeline always passes non-null estimated/breakdown when the response carries them; the component already renders the comparison when `estimatedMinutes !== null`. If we want to show “Objetivo: X | Estimado: —” when estimated is still null (e.g. loading or legacy), we could allow a placeholder line; otherwise keep current behavior. |

No refactor of other components is required for the duration fix; the header already reads from the normalized evaluation, which will now receive a consistent `totalDuration` from `meta.duration.minutes` (estimate only).

---

## 5) Test plan and acceptance criteria

### 5.1 Unit tests

- **estimateDurationFromSpec (existing or add):** Given a spec with known item types and counts, assert the returned number equals the expected sum (e.g. 2× multiple_choice + 1× essay + section overhead → 2*2 + 14 + 1 = 19). Cover at least one spec with multiple sections and mixed types.
- **New breakdown helper (if any):** If a function builds `timeBreakdown` from a spec, unit test it: input spec → expected sections array and heuristicAssumptions string.

### 5.2 Integration / contract test

- **Request with target:** Send a request to the V2 edge with `evaluation_design_plan.targetDurationMinutes = 80`. Assert either:  
  - `estimatedTotalMinutes` is within an acceptable band (e.g. 72–88, 90–110% of 80), or  
  - A warning is present (e.g. `DURATION_EXTEND_FAILED` or `DURATION_DEVIATION`) and the response still returns a valid spec and `estimatedTotalMinutes` equal to `evaluationSpec.meta.duration.minutes`.
- **Response shape:** Assert root contains `estimatedTotalMinutes` (number), and when target was sent, `targetDurationMinutes` (number). Assert `evaluationSpec.meta.duration.minutes` equals `estimatedTotalMinutes`. Optionally assert `timeBreakdown` is an object with a `sections` array when spec has sections.

### 5.3 UI-level sanity checks (manual)

- Set target to 80 min, generate a V2 evaluation. Confirm the time-budgeting widget shows “Comparación de tiempos” with Objetivo 80 and Estimado X (X = number). Confirm the evaluation header shows “Duración: X min” with the same X.
- Confirm that when the estimate is below target, a warning (e.g. “La duración estimada no alcanzó el objetivo”) appears in the UI if the backend added it.
- Optional: Load a saved evaluation that was generated with a target and confirm the comparison still displays if the saved payload includes the new root fields or the spec’s meta.duration.

### 5.4 Acceptance criteria (summary)

- Teacher sets target (e.g. 80 min); the main generation prompt includes target and operational guidance (band, minutes-per-item table, structural hint).
- Response always includes `estimatedTotalMinutes` at root; when target was sent, `targetDurationMinutes` at root; `evaluationSpec.meta.duration.minutes` is always the heuristic estimate (never the target when content is short).
- TimeBudgetingSection shows “Comparación de tiempos” with target and estimated after every V2 generation (using root or fallback from spec).
- Auto-extend runs up to 2 times when estimated < 85% of target; clear warning and best-effort spec when still short. No overwriting of `meta.duration.minutes` with target in the scaling branch (or scaling step removed).
- Unit test(s) for duration heuristic and breakdown; one integration/contract test for target 80 and response shape; manual check that UI shows target vs estimated.

---

## 6) File-by-file checklist for implementation phase

Use this as a linear checklist during implementation (order can be adjusted for dependencies).

### Edge function (Supabase)

| # | File | Task |
|---|------|------|
| 1 | `supabase/functions/modify-evaluation-v2/index.ts` | Add `targetDurationMinutes` to the call to `buildV2UserPrompt` and extend the function signature and implementation to include the duration block (target, band, minutes-per-item table, structural guidance) when target is positive. |
| 2 | `supabase/functions/modify-evaluation-v2/index.ts` | Ensure `meta.duration.minutes` is never set to the target in the scaling branch; remove that assignment. Optionally remove the scaling step entirely or keep only section.duration scaling. |
| 3 | `supabase/functions/modify-evaluation-v2/index.ts` | Implement up-to-2-attempts auto-extend loop; same stop conditions and logging as in section 3.3. |
| 4 | `supabase/functions/modify-evaluation-v2/index.ts` | Add a helper that builds `timeBreakdown` from the final spec (per-section estimate + heuristicAssumptions). Call it after the duration block and before building the response. |
| 5 | `supabase/functions/modify-evaluation-v2/index.ts` | Build the response object with root-level `targetDurationMinutes`, `estimatedTotalMinutes`, and `timeBreakdown`; set `evaluationSpec.meta.duration.minutes` to the final estimate only; optionally set `meta.duration.targetMinutes` and `meta.duration.breakdown`. Update the `V2Response` interface in the same file. |

### Client types and normalizer

| # | File | Task |
|---|------|------|
| 6 | `src/services/evaluations/v2Types.ts` | Add optional `targetDurationMinutes`, `estimatedTotalMinutes`, `timeBreakdown` to the type that represents the V2 response (e.g. `V2Response`). Define a `TimeBreakdownShape` (or reuse an existing type) for the breakdown object. |
| 7 | `src/services/evaluations/v2Normalizer.ts` | Ensure normalized evaluation’s `totalDuration` is taken from `spec.meta?.duration?.minutes` (no change if already so). Optionally map `meta.duration.breakdown` to `durationBreakdown` when building the normalized evaluation. |

### Client pipeline and UI

| # | File | Task |
|---|------|------|
| 8 | `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` | After V2 success, compute `estimatedMinutes = dataObj?.estimatedTotalMinutes ?? dataObj?.evaluationSpec?.meta?.duration?.minutes ?? null` and `timeBreakdown = dataObj?.timeBreakdown ?? (derive from spec meta or null)`. Call `onSuccess?.setEstimatedDurationMinutes` and `onSuccess?.setTimeBreakdown` with these. Optionally set target from `dataObj?.targetDurationMinutes` if we persist it. |
| 9 | `src/components/evaluaciones/TimeBudgetingSection.tsx` | Only if needed: handle the case where estimated is still null (e.g. show “Estimado: —” or leave comparison hidden). Default: no change if pipeline always supplies values. |

### Tests and docs

| # | File | Task |
|---|------|------|
| 10 | (test file for edge or shared duration logic) | Add or extend unit test for `estimateDurationFromSpec`: fixed spec → expected minutes. Add unit test for the breakdown builder if implemented as a separate function. |
| 11 | (integration/contract test) | Add test: request V2 with `targetDurationMinutes: 80`, assert response has `estimatedTotalMinutes`, and either estimate in band or relevant warning; assert `evaluationSpec.meta.duration.minutes === estimatedTotalMinutes`. |
| 12 | `docs/evaluations-duration/03-planning.md` | After implementation, optionally add a short “Implemented” section or update the checklist with “Done” and any deviations. |

---

*End of planning document. No code changes were made in this phase.*
