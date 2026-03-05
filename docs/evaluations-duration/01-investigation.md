# Evaluations Duration Mismatch — Investigation Report

**Phase:** Investigation only (no implementation of fixes).  
**Problem:** Teacher configures assessment duration (e.g. 80 minutes); the system generates an assessment that the AI report estimates as much shorter (e.g. 36 minutes).  
**Goal:** Map the end-to-end flow, identify where the mismatch is introduced, and propose a plan for later phases.

---

## A) Executive summary

**What’s happening**

- The teacher sets a **target duration** (e.g. 80 minutes) in the evaluation configuration UI. That value is sent to the backend in the **evaluation design plan**.
- The backend **does not** pass this target duration into the prompt used to generate the evaluation. The model is only told to produce a valid JSON spec (with a generic `meta.duration: { "minutes": <total> }` in the schema) and is given no numeric target.
- The model tends to generate a **short** evaluation (few sections/items). The backend then computes an **estimated duration** with a **deterministic heuristic** that sums fixed minutes-per-item-type (e.g. 2 min for multiple_choice, 14 for essay). That sum (e.g. 36 min) is written into `spec.meta.duration.minutes` and returned.
- **After** generation, the backend checks whether `estimatedMinutes < targetDurationMinutes * 0.85`. If so, it runs a **single** “auto-extend” LLM call to try to lengthen the evaluation. If that fails or still doesn’t reach the target, the response still returns the shorter spec; the UI then shows the **estimated** duration (e.g. 36 min) in the evaluation header and in time-budgeting UI, so the teacher sees a clear mismatch (e.g. 80 requested vs 36 estimated).

**Root cause (summary)**

The main generation prompt never receives the teacher’s target duration, so the model has no instruction to “generate an 80-minute evaluation.” Duration is only used **after** the fact for one optional auto-extend attempt and for warnings. In addition, a 6000-token cap on the model’s response can limit how many items/sections the model can output in one go, and the auto-extend step has its own 6000-token limit and a single attempt, so it may not fully close the gap.

---

## B) System map (files and flow)

**Flow diagram (text)**

```
[Teacher] sets target duration (e.g. 80) in UI
    ↓
EvaluacionesGrupo.tsx (state: targetDurationMinutes)
    ↓
useEvaluationPipeline (runGeneration)
    ↓
Builds v2RequestBody.evaluation_design_plan.targetDurationMinutes
    ↓
invokeEdgeFunctionAuthed('modify-evaluation-v2', { body: v2RequestBody })
    ↓
Edge: modify-evaluation-v2/index.ts
    ├─ designPlan = evaluation_design_plan (targetDurationMinutes present but NOT passed to prompts)
    ├─ buildV2SystemPrompt(...)  ← no duration parameter
    ├─ buildV2UserPrompt(groupContext, modification, instrumentDesignRules, requestedVersions)  ← no duration
    ├─ generateEvaluationV2(systemPrompt, userPrompt, ...)  → OpenAI (max_completion_tokens: 6000)
    ├─ result.spec = parsed JSON from model
    ├─ targetDurationMinutes = designPlan.targetDurationMinutes  (read here, first time)
    ├─ estimatedMinutes = estimateDurationFromSpec(result.spec)  ← deterministic heuristic
    ├─ result.spec.meta.duration.minutes = estimatedMinutes
    ├─ If estimatedMinutes < targetDurationMinutes * 0.85 → runDurationAutoExtend (one attempt, 6000 tokens)
    ├─ Optional: scale section durations if deviation > 15%; set meta.duration.minutes = target (metadata only)
    └─ Return V2Response { evaluationSpec: result.spec, ... }  (no root estimatedTotalMinutes/timeBreakdown)
    ↓
Client: requestService.requestV2 → returns data with v2RawResponse
    ↓
useEvaluationPipeline: setV2RawResponse(data); onSuccess.setEstimatedDurationMinutes(dataObj?.estimatedTotalMinutes ?? null)
    ↓
(NB: Edge does not send estimatedTotalMinutes at root → client often gets null for that callback)
Normalized evaluation built from v2RawResponse.evaluationSpec → totalDuration = spec.meta.duration.minutes (e.g. 36)
    ↓
UI: EvalHeader shows evaluation.totalDuration (36 min); TimeBudgetingSection shows target (80) and estimated (if provided)
```

**Files and functions involved**

| Layer | File | Function / area | Role |
|-------|------|-----------------|------|
| UI | `src/pages/EvaluacionesGrupo.tsx` | state `targetDurationMinutes`, `setTargetDurationMinutes` (default 80) | Teacher sets target duration |
| UI | `src/pages/EvaluacionesGrupo.tsx` | `useEvaluationPipeline({ ..., targetDurationMinutes, ... })` | Passes target into pipeline |
| UI | `src/pages/EvaluacionesGrupo.tsx` | `TimeBudgetingSection` (targetMinutes, estimatedMinutes, timeBreakdown) | Shows target vs estimated |
| UI | `src/components/evaluaciones/v2/EvalHeader.tsx` | Displays `evaluation.totalDuration` | Shows “36 min” (from normalized spec) |
| Pipeline | `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` | `runGeneration`, build `v2RequestBody.evaluation_design_plan.targetDurationMinutes` | Sends target to edge |
| Pipeline | `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` | `onSuccess?.setEstimatedDurationMinutes?.(dataObj?.estimatedTotalMinutes ?? null)` | Receives estimated (often null) |
| Client API | `src/lib/edgeFunctionAuth.ts` | `invokeEdgeFunctionAuthed(name, { body })` | Calls Supabase Edge Function |
| Client API | `src/services/evaluations/requestService.ts` | `requestV2(payload)`, `requestEvaluation(payload, useBeta)` | Invokes modify-evaluation-v2 |
| Normalizer | `src/services/evaluations/v2Normalizer.ts` | Normalization of v2 response → `totalDuration: spec.meta?.duration?.minutes ?? 90` | Feeds UI duration from spec |
| Types | `src/services/evaluations/v2Types.ts` | `NormalizedEvaluation.totalDuration` | Type for displayed duration |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | Handler (Serve, body parsing) | Entry; reads `evaluation_design_plan` |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `designPlan = evaluation_design_plan`; later `targetDurationMinutes = designPlan.targetDurationMinutes` | Target only used after generation |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `buildV2SystemPrompt(...)` | System prompt; no duration |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `buildV2UserPrompt(groupContext, modification, instrumentDesignRules, requestedVersions)` | User prompt; no duration parameter |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `generateEvaluationV2(systemPrompt, userPrompt, ...)` | Calls OpenAI (max_completion_tokens: 6000) |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `estimateDurationFromSpec(spec)` | Deterministic estimate (minutes per item type + section overhead) |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `DURATION_MINUTES_BY_ITEM_TYPE`, `DEFAULT_MINUTES_PER_ITEM`, `SECTION_OVERHEAD_MINUTES` | Heuristic constants |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | Duration block: set `result.spec.meta.duration.minutes = estimatedMinutes`; conditional `runDurationAutoExtend`; scaling/warnings | Post-generation duration logic |
| Edge | `supabase/functions/modify-evaluation-v2/index.ts` | `runDurationAutoExtend(currentSpec, targetDurationMinutes, ...)` | One-shot LLM extend (max_completion_tokens: 6000) |
| Client heuristic | `src/lib/durationValidator.ts` | `estimateEvaluationDuration(content)`, `validateFor90Minutes` | Optional client-side estimate from HTML/text (not used for V2 spec flow) |

---

## C) Where the duration is stored and passed through

- **UI storage:** In `EvaluacionesGrupo.tsx`, React state `targetDurationMinutes` (default 80), set by the teacher in the time-budgeting control (e.g. `TimeBudgetingSection` with `onTargetChange`).
- **Sent to backend:** In `useEvaluationPipeline`, when building the V2 request body, `evaluation_design_plan.targetDurationMinutes` is set from the hook’s `targetDurationMinutes` and sent in the body of the request to `modify-evaluation-v2`.
- **Backend receipt:** The edge function reads `evaluation_design_plan` into `designPlan` and later reads `targetDurationMinutes = (designPlan).targetDurationMinutes`. It is **not** passed into `buildV2SystemPrompt` or `buildV2UserPrompt`, so the **main generation prompt never sees the target duration**.
- **Database:** When the teacher saves the evaluation, `EvaluacionesGrupo` persists `targetDurationMinutes`, `estimatedDurationMinutes`, and `timeBreakdown` inside `evaluacion_generada` (and related fields) in the `evaluaciones` table. This is for storage/display only; the generation request does not read duration from the DB.

---

## D) Where the estimated duration is produced

- **Backend (authoritative for V2):**  
  In `modify-evaluation-v2/index.ts`, **estimated duration is not produced by the LLM**. It is computed **deterministically** by `estimateDurationFromSpec(result.spec)`:
  - For each section, it adds `SECTION_OVERHEAD_MINUTES` (1).
  - For each item, it adds `DURATION_MINUTES_BY_ITEM_TYPE[item.type]` or `DEFAULT_MINUTES_PER_ITEM` (5).
  - Example mapping: multiple_choice 2, true_false 1, true_false_justify 4, short_answer 4, paragraph 9, essay 14, source_analysis 14, table_completion 5, matching 5, ordering 5 (minutes).
  - The result is written to `result.spec.meta.duration.minutes` and returned in `evaluationSpec`. So the “36” (or similar) is this heuristic sum, not an LLM statement.
- **Client display:** The normalized evaluation used for the V2 UI gets `totalDuration` from `spec.meta?.duration?.minutes` in `v2Normalizer.ts`. That value is shown in `EvalHeader` as “Duración: X min”. So the “36 vs 80” is: **target** from UI state (80) vs **estimated** from this heuristic stored in the returned spec (36).
- **AI report narrative:** The narrative in `aiReport` can mention “duración estimada X minutos” when it is generated from the **already-generated spec** (e.g. in `generateNarrativeOnlyCall` or local narrative builder), so it reflects the same `spec.meta.duration.minutes` (the heuristic result), not a separate LLM estimate.
- **Client-side heuristic (ancillary):** `src/lib/durationValidator.ts` provides `estimateEvaluationDuration(content)` (word-count and pattern-based). It is used for validation/display in other flows (e.g. 90-minute limit); it is not the source of the “36” in the V2 spec flow.

---

## E) Constraints / truncation / fallback findings

- **Token limits**
  - Main spec generation: `max_completion_tokens: 6000` in `generateEvaluationV2` → `callOpenAIWithRetries`. So the model can output at most ~6000 tokens of JSON. More sections/items mean more tokens; the model may naturally produce a shorter spec to stay within a “reasonable” length, or the response can be cut off if it exceeds 6000.
  - Duration auto-extend call: `max_completion_tokens: 6000` in `runDurationAutoExtend`. So the extended spec is also limited to 6000 tokens.
- **No explicit “max questions” or “max sections” in prompt:** The prompt asks for “variedad de tipos de items” and “especificación JSON completa” but does not specify a minimum or maximum number of sections/items or a target duration. So the model is free to output a short exam.
- **Fallbacks**
  - If OpenAI fails after retries, the edge can use an **emergency template** (`buildEmergencyTemplateSpec`) and return a minimal spec (success: true to avoid V1 fallback). That template is not designed for a specific duration.
  - V2 → V1 fallback: If the client does not use beta or V2 returns failure, the client may call `modify-evaluation` (V1). V1 has its own prompts and does not share the V2 duration/heuristic logic; duration behavior there is separate.
- **Teacher duration optional:** If the client does not send `targetDurationMinutes` (or sends 0), the edge treats it as “no target”: `targetDurationMinutes != null && targetDurationMinutes > 0` is false, so auto-extend does not run and no duration-based scaling is applied. Default 80 in the UI is only on the client; the edge does not default the target.
- **Single auto-extend attempt:** When `estimatedMinutes < targetDurationMinutes * 0.85`, the edge runs **one** `runDurationAutoExtend` call. If the extended spec still has `newEst < targetDurationMinutes * 0.9`, it keeps the extended spec but adds a warning (`DURATION_EXTEND_FAILED`); it does not retry or add more items in a loop. So a single short response from the model can persist as the final spec.

---

## F) Prompt/spec alignment and hypotheses

**Prompt/spec alignment**

- The “assessment generation rules” are in the **system** and **user** prompts built by `buildV2SystemPrompt` and `buildV2UserPrompt`. They define structure (sections, items, types, rubrics, versions, aiReport, etc.) and say that `meta` must include `"duration": { "minutes": <total> }` in the JSON schema. They do **not** say that `<total>` must match a teacher-requested duration, and the **user prompt does not receive or mention the target duration** (e.g. “80 minutes”). So the model is not instructed to “make it 80 minutes” and has no operational rule (e.g. “aim for N items or M minutes”).
- Conclusion: The duration requirement is **not** translated into concrete structural constraints (number of sections, number of items, reading vs writing time) in the main generation prompt. The model effectively freehands length, which tends to produce shorter exams.

**Hypotheses with evidence**

1. **Target duration never reaches the main generation prompt (primary)**  
   - **Evidence:** `buildV2UserPrompt(groupContext, modification, instrumentDesignRules, requestedVersions)` has no parameter for duration. The handler only reads `targetDurationMinutes` from `designPlan` **after** `generateEvaluationV2` returns.  
   - **Confirm by:** Logging the exact user prompt (or a hash) and verifying it contains no “80” or “duración objetivo”; optionally add a test that asserts the prompt includes the target when we add it.

2. **Model produces a short spec by default (few items/sections)**  
   - **Evidence:** System/user prompts ask for “variedad de tipos de items” and “especificación JSON completa” but do not set a minimum length or duration. The heuristic sum over items then yields a low number (e.g. 36).  
   - **Confirm by:** Logging `result.spec.sections.length`, total item count, and `estimateDurationFromSpec(result.spec)` before and after auto-extend; compare distributions when target is 80 vs when it is not sent.

3. **6000-token cap limits how much the model can output in one call**  
   - **Evidence:** `max_completion_tokens: 6000` in the main generation and in `runDurationAutoExtend`. A long spec (many sections/items with rubrics and narratives) can approach or hit this limit.  
   - **Confirm by:** Logging `result.rawContent.length` and token estimates (or actual usage from OpenAI) per attempt; check if successful responses are near 6000 tokens.

4. **Auto-extend runs only once and may fail or be insufficient**  
   - **Evidence:** Single call to `runDurationAutoExtend`; if parsing/validation fails or `newEst < targetDurationMinutes * 0.9`, the code keeps the best spec and adds a warning. No retry loop.  
   - **Confirm by:** Logging when auto-extend is triggered, when it returns null vs spec, and `newEst` vs target; inspect Supabase logs for `DURATION_EXTEND_FAILED` / `DURATION_EXTEND_PARSE_ERROR`.

5. **Metadata-only scaling does not add content**  
   - **Evidence:** When deviation > 15%, the code scales `section.duration` and sets `result.spec.meta.duration.minutes = targetDurationMinutes`, but it does not add items or lengthen prompts. So the returned spec can have `meta.duration.minutes = 80` (target) while the **heuristic** estimate (and actual expected time) is still ~36. The UI might then show 80 in the header (from spec) while the AI report narrative or time-budgeting logic might still reflect the underlying short length.  
   - **Confirm by:** Checking whether scaling is applied (deviation > 0.15) and whether the UI shows “80” in the header but a lower “estimated” elsewhere, or whether in some flows the unscaled spec (36) is what is displayed.

6. **Client may not show server’s estimated total in time-budgeting**  
   - **Evidence:** The edge’s `V2Response` does not include top-level `estimatedTotalMinutes` or `timeBreakdown`. The pipeline sets `setEstimatedDurationMinutes(dataObj?.estimatedTotalMinutes ?? null)`, so the callback often gets null. The “36” is still visible in the evaluation header because it comes from the normalized spec’s `meta.duration.minutes`.  
   - **Confirm by:** Verifying in the client whether `estimatedTotalMinutes`/`timeBreakdown` are ever set from the V2 response (e.g. from `evaluationSpec.meta.duration`) and whether TimeBudgetingSection shows “Estimado: 36 min” or only the target.

7. **Emergency template and fallbacks ignore duration**  
   - **Evidence:** `buildEmergencyTemplateSpec` produces a minimal spec; there is no duration target in that path.  
   - **Confirm by:** Checking logs when emergency template is used; ensure we do not attribute “36 vs 80” to emergency when the main path was used.

---

## G) Proposed plan for next phases (high-level)

- **Planning**
  - Decide target behaviour: e.g. “estimated duration must be within X% of teacher target (e.g. 90–110%) or trigger a retry/expand step.”
  - Define where to enforce: e.g. in-prompt instruction + minimum structure (sections/items) derived from target minutes, plus optional post-step (extend/trim) with clear rules.

- **Instrumentation / logging**
  - Log at edge: `targetDurationMinutes`, `estimatedMinutes` (before/after auto-extend), section count, item count, and whether auto-extend was run and its outcome.
  - Log prompt presence: ensure the outgoing user (or system) prompt includes the target duration when implemented.
  - Optionally log token usage and response length to detect token-cap effects.

- **Prompt and structure**
  - Pass `targetDurationMinutes` into the prompt builder and include it in the user (or system) prompt with an explicit instruction, e.g. “La evaluación debe tener una duración total estimada de aproximadamente N minutos (considerar X–Y ítems y tipos según tabla de tiempos).”
  - Optionally add a short “duration guidance” table (e.g. minutes per item type) so the model can approximate length.
  - Consider minimum sections/items derived from target (e.g. “at least N items so that estimated duration is at least M minutes”).

- **Structural constraints**
  - After generation, if `estimateDurationFromSpec(spec)` is below target (e.g. &lt; 90% of target), either: (a) retry with a stronger prompt, or (b) run one or more extend steps (with clear token budget and validation), or (c) add a deterministic “padding” step (e.g. add items from a bank) according to product decision.
  - Avoid overwriting `meta.duration.minutes` with the target when the actual content would still imply a lower estimate (or show both “target” and “estimated” clearly in the UI).

- **Validation and UX**
  - Add a server-side warning (or soft error) when `|estimated − target| / target` exceeds a threshold, and surface it in the UI.
  - Ensure the client shows both target and estimated duration (and, if applicable, time breakdown) using values from the backend (e.g. from spec.meta or from new root-level fields if added).

- **Automated tests**
  - Unit tests: `estimateDurationFromSpec` for known specs (e.g. 6 items of known types) yields expected minutes.
  - Integration/contract tests: request with `targetDurationMinutes: 80` and assert the returned spec has `meta.duration.minutes` within an acceptable range, or assert that a warning is present when not.
  - Optional: snapshot or golden prompt test that the user prompt contains the target duration once implemented.

---

## H) Checklist: what to log/verify at runtime to reproduce and measure “requested vs estimated duration”

- [ ] **Request payload:** Log (or inspect in network tab) that `evaluation_design_plan.targetDurationMinutes` is sent and equals the value set in the UI (e.g. 80).
- [ ] **Edge receipt:** Log at start of handler: `designPlan.targetDurationMinutes` (may be undefined if client omits it).
- [ ] **Prompt content:** Log or store a redacted/sanitized copy of the user prompt (and optionally system prompt) and confirm absence of target duration in current implementation; after adding it, confirm presence.
- [ ] **First spec:** Log immediately after parsing: `result.spec.sections.length`, total item count, `estimateDurationFromSpec(result.spec)`.
- [ ] **Duration block:** Log `targetDurationMinutes`, `estimatedMinutes` before auto-extend; whether auto-extend is run; after auto-extend: `newEst`, and which spec is kept.
- [ ] **Response:** Log or assert `evaluationSpec.meta.duration.minutes` in the response body.
- [ ] **Client:** After response, log `dataObj.estimatedTotalMinutes`, `dataObj.timeBreakdown`, and the normalized `evaluation.totalDuration` used for the header.
- [ ] **UI:** Manually verify: target (e.g. 80) in time-budgeting area; “Duración: X min” in evaluation header (X = estimated from spec); and any warning toasts (e.g. DURATION_EXTEND_FAILED).
- [ ] **Tokens:** If available, log OpenAI usage (completion_tokens) for the main call and for the duration-extend call to see if 6000 is a tight limit.

---

*End of investigation report. No code changes were made in this phase.*
