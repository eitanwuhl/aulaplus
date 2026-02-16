# Phase 3 — Critical Fix: Stabilize V2 Generation (Timeout, Fallback, Narrative, Structure)

**Date:** 2026-02-16  
**Scope:** Edge Function `modify-evaluation-v2` only. No frontend or persistence changes.  
**Goal:** Reduce fallbacks, keep narrative and structure coherent, align versions/assignments and duration.

---

## Root cause analysis

1. **Timeout too short**  
   Primary attempt used 55s. Complex evaluations often exceed that, triggering timeouts and fast fallback even when the model would have completed with a few more seconds.

2. **Fast fallback over-simplified**  
   On retry, the code stripped the system prompt (narrative, Version B/C, equivalent options) and truncated the user prompt to a few keywords. That produced:
   - Simplified/generic narrative
   - Single-section or structurally poor specs
   - Loss of instrument design rules and duration alignment

3. **Version/assignment incoherence**  
   When fast fallback generated only Version A, the response still reported `requestedVersions: { B: true, C: true }` and did not derive “effective” versions from `versionVariants`. The frontend could show B/C as generated and assignments to B/C when only A existed.

4. **Structure not validated**  
   Specs with zero sections were not rejected (no retry). Total estimated duration was not checked against a target, so duration could be inconsistent with the selected target.

5. **Short narrative not reinforced**  
   When the model or local fallback produced a very short narrative (<200 chars), it was returned as-is instead of making a single narrative-only OpenAI call to get a richer report.

---

## PART 1 — Timeout change details

**File:** `supabase/functions/modify-evaluation-v2/index.ts`

- **Constant:** `OPENAI_TIMEOUT_GENERATE_MS`
  - **Before:** `55000` (55s)
  - **After:** `90000` (90s)
- **Retry timeout:** `OPENAI_TIMEOUT_RETRY_MS` unchanged at 24s for fast fallback.
- **Completion tokens:** Primary attempt still uses 6000 `max_completion_tokens`; no reduction on first attempt.
- **Retry logic:** Unchanged (2 attempts, then emergency template).

---

## PART 2 — Fallback changes

**Previous behavior (fast fallback):**

- System prompt was stripped (Version B/C blocks, narrative block, equivalent options removed).
- User prompt was reduced to lines containing only certain keywords (materia, contenidos, competencia, etc.).
- `max_completion_tokens` set to 1800.

**New behavior:**

- **Full prompt structure kept:** `currentSystemPrompt = systemPrompt` and `currentUserPrompt = userPrompt` (no stripping or keyword filtering).
- **Only limits on retry:**
  - `reducedVersions = { A: true, B: false, C: false }` (request only Version A).
  - `max_completion_tokens = Math.max(2500, 1800)` → **2500** (not below 2500).
- Section requirements, duration alignment instructions, and narrative richness requirements remain in the prompt so fallback still produces coherent structure and narrative.

---

## PART 3 — Assignment synchronization logic

- **Helper:** `getEffectiveRequestedVersions(versionVariants)`  
  Derives `{ A, B, C }` from the actual `spec.versionVariants` (only B/C are true if present in the spec).

- **Usage:** After a successful generation, the response uses **effective** requested versions instead of the original design-plan versions:
  - `effectiveRequestedVersions = getEffectiveRequestedVersions(result.spec.versionVariants)`.
  - Response `requestedVersions` = `effectiveRequestedVersions`.
  - `baseAiReport.versionsExplanation` and `normalizeAiReportForFrontend` use `effectiveRequestedVersions`.

- **When only A is generated (e.g. fast fallback):**
  - `versionVariants` only has `A` → `effectiveRequestedVersions = { A: true, B: false, C: false }`.
  - No students are presented as assigned to B/C because the response does not claim B/C were generated.
- **Validation:** Any student assigned to a non-existing version is handled by the frontend using `requestedVersions`; the backend no longer returns B/C as generated when they are not in `versionVariants`.

---

## PART 4 — Structure validation logic

1. **Sections length**  
   In `validateAndNormalizeSpec`, after checking `spec.sections` is an array:
   - If `spec.sections.length < 1` → push warning `NO_SECTIONS`, return `{ spec: null, warnings }` so the attempt is treated as failed and retry/fallback runs.

2. **Duration vs target**  
   In the main handler, after `result.spec` is available:
   - Read `targetDurationMinutes` from `designPlan` (e.g. `evaluation_design_plan.targetDurationMinutes` if the frontend sends it).
   - Compare `spec.meta.duration.minutes` (or 90) to `targetDurationMinutes`.
   - If deviation > 15%:
     - Push warning `DURATION_DEVIATION`.
     - Optionally scale section durations proportionally and set `spec.meta.duration.minutes` to `targetDurationMinutes`.
   - If `targetDurationMinutes` is not sent, this block is skipped.

3. **Section count vs design plan**  
   No explicit field for “expected section count” is used in this fix. Section count coherence is preserved by keeping the full prompt in fallback so the model receives the same structure instructions.

---

## PART 5 — Narrative validation logic

- **Content requirements (already in prompt):**  
  The system prompt already requires the narrative to include: what content was evaluated, how it aligns with competencies, how teacher requirements were applied, and how materials/session context were used when present.

- **Short narrative reinforcement:**  
  - Constant: `MIN_NARRATIVE_LENGTH = 200` (chars).
  - After narrative is set (from OpenAI or from `buildNarrativeLocal`), if `narrativeText.trim().length < MIN_NARRATIVE_LENGTH`:
    - Call `generateNarrativeOnlyCall(spec, groupContext, modification, designPlan, requestId, timer)`.
    - Single OpenAI request (gpt-4o-mini, 15s timeout, ~800 max tokens) with a user prompt that explicitly asks for:
      - What contents were evaluated
      - How they align with selected competencies
      - How teacher requirements were applied
      - How instrument design rules were used (if any)
    - If the returned text has length ≥ 200, replace `narrativeText` with it and set `narrativeSource = 'openai'`.
  - No generic fallback: we never return a placeholder narrative when we could do this narrative-only call first.

---

## Manual test checklist

Use this to confirm behavior after the fix.

1. **V2 generation does not fallback under normal conditions**
   - [ ] Generate a V2 evaluation (Beta V2 on) with normal complexity (e.g. 2–3 sections, 80 min).
   - [ ] In logs/Network, confirm a single successful attempt (no timeout, no retry).
   - [ ] Response: `success: true`, multiple sections, narrative present.

2. **If fallback occurs**
   - [ ] Only Version A is generated (no B/C in `evaluationSpec.versionVariants`).
   - [ ] Response `requestedVersions` is `{ A: true, B: false, C: false }`.
   - [ ] No students shown as assigned to B/C (UI uses `requestedVersions`).

3. **Narrative quality**
   - [ ] Narrative explicitly mentions content evaluated and alignment with competencies.
   - [ ] If teacher requirements or materials were sent, narrative references them.
   - [ ] No generic one-line narrative when a richer one is possible (short narrative triggers narrative-only call).

4. **Structure**
   - [ ] At least one section; multiple sections when design is not minimal.
   - [ ] Section titles and items coherent with the requested design.

5. **Duration**
   - [ ] When `evaluation_design_plan.targetDurationMinutes` is sent (if/when frontend adds it), estimated duration is close to target or a deviation warning is present and, when implemented, section times are scaled.

---

## Files changed

- **`supabase/functions/modify-evaluation-v2/index.ts`**
  - Timeout: `OPENAI_TIMEOUT_GENERATE_MS` 55s → 90s.
  - Fast fallback: full prompt kept; only `reducedVersions` and `max_completion_tokens` (≥2500) limited.
  - `getEffectiveRequestedVersions()` added; success response uses it for `requestedVersions` and aiReport.
  - `validateAndNormalizeSpec`: reject when `sections.length < 1`.
  - Handler: duration deviation check and optional scaling when `targetDurationMinutes` present.
  - `generateNarrativeOnlyCall()` added; short narrative (<200 chars) triggers one narrative-only OpenAI call before returning.

No frontend or persistence logic was modified.
