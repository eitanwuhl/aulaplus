# Evaluations Duration — Follow-up Investigation

**Phase:** Investigation only (no code changes).  
**Goal:** Close remaining unknowns that block a clean fix for the “requested vs estimated duration” mismatch in V2 evaluations.

**Context recap:** The teacher sets `targetDurationMinutes` in the UI (e.g. 80). The edge function `modify-evaluation-v2` generates a spec via the LLM, then computes `estimatedMinutes` with the deterministic heuristic `estimateDurationFromSpec(spec)`, writes it into `spec.meta.duration.minutes`, and may run a one-shot `runDurationAutoExtend` if `estimatedMinutes < target*0.85`. There may also be metadata-only scaling that sets `spec.meta.duration.minutes` to the target without adding content.

---

## A) UI field mapping table (header vs budgeting vs report)

For each place the UI shows something duration-related, the table below states: the visible location, the component file, the prop or field used, and where that value ultimately comes from (which part of the backend response or normalized object). “Normalized evaluation” means the client-side object built from the V2 response by `v2Normalizer` (it has `totalDuration`, `sections`, etc., and is what the V2 renderer uses for the header and map).

| UI location | File path | Field / prop used | Origin (server / normalized) |
|-------------|-----------|--------------------|------------------------------|
| **Evaluation header “Duración: X min”** | `src/components/evaluaciones/v2/EvalHeader.tsx` | Prop: `evaluation.totalDuration`. Rendered as `{evaluation.totalDuration} min`. | **Normalized evaluation** → `totalDuration`. The normalizer sets `totalDuration: spec.meta?.duration?.minutes ?? 90` in `src/services/evaluations/v2Normalizer.ts` (line ~610). So the header shows whatever is in **`evaluationSpec.meta.duration.minutes`** in the V2 response (after the edge has written the initial estimate, then possibly the post–auto-extend estimate, then possibly the target when scaling is applied). |
| **Time budgeting – “Duración objetivo”** | `src/components/evaluaciones/TimeBudgetingSection.tsx` | Props: `targetMinutes`, `onTargetChange`. Value comes from parent state. | **Client state only.** `EvaluacionesGrupo.tsx` holds `targetDurationMinutes` (default 80) and passes it as `targetMinutes={targetDurationMinutes}`. Not read from the server response. |
| **Time budgeting – “Comparación de tiempos” (estimated vs target)** | `src/components/evaluaciones/TimeBudgetingSection.tsx` | Props: `estimatedMinutes`, `timeBreakdown`. Rendered only when `estimatedMinutes !== null` (see line ~94). | **Client state** set by the pipeline’s `onSuccess`: `setEstimatedDurationMinutes(dataObj?.estimatedTotalMinutes ?? null)` and `setTimeBreakdown(dataObj?.timeBreakdown ?? null)` in `src/features/evaluaciones/hooks/useEvaluationPipeline.ts` (lines ~619–620). The **edge does not return** `estimatedTotalMinutes` or `timeBreakdown` at the root of the V2 response, so `dataObj.estimatedTotalMinutes` and `dataObj.timeBreakdown` are **undefined** → the callback receives **null**. So for V2, the “Comparación de tiempos” block usually **does not show** (estimated is null). |
| **AI report narrative (any mention of “duración estimada X min”)** | `src/components/evaluaciones/v2/V2InfoPanels.tsx` → `V2AIReportPanel` | Narrative text: `narrativeForVersion` = `aiReport?.byVersion?.[selectedVersion]?.narrative` or fallback `aiReport?.narrative`. Rendered as `{narrativeForVersion}` in a `<p>`. | **Server response root:** `v2Response.aiReport`. So `aiReport.narrative` or `aiReport.byVersion.A` (or B/C). That text is **generated on the server** (by the LLM or by the local narrative builder) and can include a phrase like “duración estimada X minutos.” The value X at narrative-generation time comes from **`spec.meta.duration.minutes`** at that moment (before or after scaling, depending on when the narrative is built). So the narrative duration mention is **indirectly** from the same `meta.duration` that the header uses, but as baked into the narrative string. |

**Summary:** The header duration is the single source of truth from the server for “what duration does this evaluation show”: it comes from the normalized `evaluation.totalDuration` ← `evaluationSpec.meta.duration.minutes`. The time-budgeting widget’s *target* is local state; its *estimated* and *timeBreakdown* expect root-level fields that the edge does not send, so they stay null and the comparison often does not appear. The AI report narrative is free text from `aiReport` and may mention duration; that text was produced on the server using the spec (and its `meta.duration`) at generation time.

---

## B) V2 response shape vs client expectations (duration-related fields)

**What the Edge function actually returns (duration-relevant)**

The successful V2 response is built in `supabase/functions/modify-evaluation-v2/index.ts` (around lines 4143–4181). The object has:

- `success: true`
- `evaluationSpec`: the full spec object (with `meta`, `sections`, etc.). **Duration-relevant:** `evaluationSpec.meta.duration` exists and is set by the edge; it has at least `minutes` (number). It may also have `breakdown` in some code paths (not emphasized in the current success path).
- `requestedVersions`, `instrumentDesignRulesApplied`, `teacherRemindersByStudent`, `aiReport`, `warnings`, `debug`

There are **no** top-level properties named `estimatedTotalMinutes` or `timeBreakdown` in the response object. The edge’s TypeScript interface `V2Response` (in the same file, ~lines 190–236) does not include them. So the **returned JSON shape** does not expose a root-level “estimated total minutes” or “time breakdown” for the client.

**What the frontend expects**

- In `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`, after a successful V2 response the code calls:
  - `onSuccess?.setEstimatedDurationMinutes?.((dataObj?.estimatedTotalMinutes as number) ?? null);`
  - `onSuccess?.setTimeBreakdown?.(dataObj?.timeBreakdown ?? null);`
- So the **client expects** (optionally) `dataObj.estimatedTotalMinutes` and `dataObj.timeBreakdown` on the object returned by the edge. Those fields are **never set** by the edge, so they are always **undefined** → the pipeline passes **null** to the setters.
- The client-side type `V2Response` in `src/services/evaluations/v2Types.ts` (lines 279–295) also does **not** define `estimatedTotalMinutes` or `timeBreakdown`. So the type contract and the runtime response are aligned: neither has those fields.

**Mismatch (contract vs UX)**

- **Contract:** There is no mismatch between the edge response and the client TypeScript type; both omit `estimatedTotalMinutes` and `timeBreakdown`.
- **UX/feature mismatch:** The time-budgeting UI is designed to show “Comparación de tiempos” (target vs estimated) and optionally a breakdown. To do that it needs `estimatedMinutes` and `timeBreakdown` in state. Those state values are only set from the response root. Because the root never contains them, the comparison block does not appear for V2, and the teacher never sees “Estimado: X min” next to “Objetivo: 80 min” in that widget. The **header** still shows a duration, but that comes from the normalized spec (`evaluationSpec.meta.duration.minutes`), not from a dedicated “estimated total” field.

**Duration-relevant fields present in the V2 response (summary)**

| Field | Present in response? | Location | Notes |
|-------|----------------------|----------|--------|
| `evaluationSpec.meta.duration.minutes` | Yes | Inside `evaluationSpec` | Set by edge (initial estimate, then possibly after auto-extend, then possibly overwritten with target when scaling). This is what the header shows after normalization. |
| `evaluationSpec.meta.duration.breakdown` | Optional | Inside `evaluationSpec` | Not consistently set in the current duration block; normalizer reads it as `durationBreakdown`. |
| `estimatedTotalMinutes` (root) | No | — | Client would use it for time-budgeting “estimated”; edge does not send it. |
| `timeBreakdown` (root) | No | — | Client would use it for per-section/time breakdown in the widget; edge does not send it. |

---

## C) Duration logic branch audit (write/overwrite points and thresholds)

All of the following occurs in `supabase/functions/modify-evaluation-v2/index.ts` in the block that runs after a successful spec generation (around lines 3797–3868). The variable `estimatedMinutes` is the result of `estimateDurationFromSpec(result.spec)` (or, after a successful auto-extend, the estimate of the extended spec). It is **not** re-computed after the “scaling” step below; only `result.spec.meta.duration.minutes` (and section durations) are updated in that step.

**1) Initial write (first time `spec.meta.duration.minutes` is set)**

- **Condition:** Always, right after generation.
- **Code:** `let estimatedMinutes = estimateDurationFromSpec(result.spec);` then `if (!result.spec.meta.duration) result.spec.meta.duration = { minutes: 90 };` and `result.spec.meta.duration.minutes = estimatedMinutes;`
- **Effect:** `meta.duration.minutes` is set to the heuristic estimate (e.g. 36). This is the first write.

**2) Optional overwrite after auto-extend (when extend is accepted)**

- **Condition:** `targetDurationMinutes != null && targetDurationMinutes > 0 && estimatedMinutes < targetDurationMinutes * 0.85` (i.e. estimated is below 85% of target). Then `runDurationAutoExtend` is called. If it returns a spec and `newEst = estimateDurationFromSpec(extended.spec)` satisfies `newEst >= targetDurationMinutes * 0.9` (i.e. at least 90% of target), the extended spec is kept.
- **Code:** `result.spec = extended.spec; estimatedMinutes = newEst;` and again `result.spec.meta.duration.minutes = estimatedMinutes;`
- **Effect:** `meta.duration.minutes` is overwritten with the new heuristic estimate of the extended spec (e.g. 75). If the extended spec is kept but `newEst < target*0.9`, the code does **not** replace `result.spec`; it only adds a warning `DURATION_EXTEND_FAILED`. In that case `meta.duration.minutes` is **not** updated from the extended spec (the original spec and original `estimatedMinutes` remain).

**3) Optional overwrite in “scaling” branch (metadata-only scaling)**

- **Condition:** `targetDurationMinutes != null && targetDurationMinutes > 0` and `deviation > 0.15`, where `deviation = Math.abs(estimatedMinutes - targetDurationMinutes) / targetDurationMinutes`. So whenever the current `estimatedMinutes` deviates from the target by more than 15%, this block runs.
- **Code:** `const scale = targetDurationMinutes / estimatedMinutes;` then for each section, if `section.duration` is a number, `section.duration = Math.round(section.duration * scale);` and then `if (result.spec.meta?.duration) result.spec.meta.duration.minutes = targetDurationMinutes;`
- **Effect:** Section-level `duration` numbers are scaled proportionally, and **`spec.meta.duration.minutes` is overwritten with the target** (e.g. 80). The heuristic `estimateDurationFromSpec(result.spec)` is **not** run again after this; the in-memory variable `estimatedMinutes` still holds the pre-scale value. So the **returned spec** has `meta.duration.minutes = targetDurationMinutes` even though, if one were to re-run the heuristic on the same spec (same number and types of items), it would still yield the lower value (e.g. 36). So this is “metadata-only” scaling: the UI will show the target (80) in the header, but the actual expected duration by item count/type is unchanged.

**Order and precedence (summary)**

1. **Initial write:** `meta.duration.minutes = estimateDurationFromSpec(result.spec)` (e.g. 36).
2. **Optional auto-extend:** If estimated &lt; 85% of target, run extend once; if extended spec’s estimate ≥ 90% of target, replace spec and set `meta.duration.minutes = newEst`. Otherwise leave spec and `estimatedMinutes` as before and add a warning.
3. **Deviation checks:** If estimated &gt; 120% of target → add `DURATION_TOO_LONG`. If deviation &gt; 15% → add `DURATION_DEVIATION` and run the scaling step.
4. **Scaling step (when deviation &gt; 15%):** Scale each section’s `duration` by `targetDurationMinutes / estimatedMinutes` and set `meta.duration.minutes = targetDurationMinutes`.

So the **final** value in `spec.meta.duration.minutes` when returned can be: (a) the initial heuristic estimate, (b) the post–auto-extend heuristic estimate, or (c) the **target** (when deviation &gt; 15% and scaling runs). In case (c), the displayed duration (e.g. 80) no longer matches what `estimateDurationFromSpec` would compute for that spec.

**Thresholds reference**

| Threshold | Value | Meaning |
|-----------|--------|---------|
| Auto-extend trigger | `estimatedMinutes < targetDurationMinutes * 0.85` | Run auto-extend when estimated is below 85% of target. |
| Auto-extend “success” | `newEst >= targetDurationMinutes * 0.9` | Accept extended spec only if its estimate is at least 90% of target. |
| “Too long” warning | `estimatedMinutes > targetDurationMinutes * 1.2` | Add `DURATION_TOO_LONG` when estimated exceeds 120% of target. |
| Deviation for scaling | `deviation > 0.15` | Deviation = \|estimated − target\| / target. If &gt; 15%, add `DURATION_DEVIATION` and apply scaling (and set `meta.duration.minutes = target`). |

---

## D) Auto-extend prompting, failure modes, and log markers

**Where it lives**

- Function: `runDurationAutoExtend` in `supabase/functions/modify-evaluation-v2/index.ts` (approx. lines 3361–3442).
- It is called from the main success path when `estimatedMinutes < targetDurationMinutes * 0.85`.

**How it prompts the LLM**

- **System message:** A short instruction in Spanish: the model must return only valid JSON. Its only task is to **extend** the given evaluation so that its **estimated total duration** is between `low` and `high` minutes (`low = round(target * 0.9)`, `high = round(target * 1.1)`). Rules: add new items or expand existing ones (e.g. more sub-items, guiding questions); keep `meta` (contentIds, competencyIds, criteriosLogro), `versionVariants`, and `versionedContent` where they exist; do not change existing section/item IDs; new items must have unique IDs; respond only with the full evaluation JSON, no explanations or code fences.
- **User message:** States the current evaluation’s “duración objetivo” and “rango aceptable” (low–high), then pastes the current spec as JSON, and asks to return the extended evaluation in full JSON so that its estimated duration falls between low and high minutes.
- So the model is asked to **add or expand items** to reach a duration band (90–110% of target). It is **not** asked to only “adjust duration numbers” or to remove items. Schema preservation is implied (full JSON, keep meta/versionedContent, don’t change IDs). The prompt does **not** define “duración estimada” with the backend’s heuristic (e.g. minutes per item type); the model may infer length from number/size of items.

**Failure modes**

1. **OpenAI call failure:** If `callOpenAIWithRetries('duration_extend', ...)` returns `!openaiResult.ok`, the function pushes a warning with code `DURATION_EXTEND_OPENAI_ERROR` and message including the first 120 characters of the error, and returns `{ spec: null, warnings }`.
2. **Parse error:** If `JSON.parse(cleanContent)` throws (after stripping optional code fences), it pushes `DURATION_EXTEND_PARSE_ERROR` (“Error al parsear la evaluación extendida”) and returns `{ spec: null, warnings }`.
3. **Validation failure:** The parsed JSON is passed to `validateAndNormalizeSpec(parsed, requestedVersions)`. If the returned `spec` is null (validation failed), it pushes `DURATION_EXTEND_VALIDATION_FAILED` (“La evaluación extendida no pasó la validación”) and returns `{ spec: null, warnings }`.
4. **Insufficient extension:** Not a failure of `runDurationAutoExtend` itself. The **caller** checks whether `newEst >= targetDurationMinutes * 0.9`. If not, it does not replace the spec and adds `DURATION_EXTEND_FAILED` with message “Tras extender, la duración estimada (X min) no alcanzó el objetivo (Y min).”
5. **Extend returns null:** If `extended.spec` is null (any of the above), the caller adds `DURATION_EXTEND_FAILED`: “No se pudo extender la evaluación para alcanzar Y min.”

**Token limit**

- The auto-extend call uses `max_completion_tokens: 6000`. If the model’s extended JSON is truncated, parsing or validation may fail (e.g. truncated JSON → parse error; invalid structure → validation error).

**Log / console markers**

- `timer.log(\`[DURATION_AUTO_EXTEND] calling OpenAI target=... low=... high=...\`)` and `console.log(\`[DURATION_AUTO_EXTEND] target=... requestId=...\`)` when the OpenAI call is about to be made.
- `timer.log(\`[DURATION_AUTO_EXTEND] extended estimate=... target=...\`)` and `console.log(...)` when the extended spec has been validated and the new estimate is computed (before returning to the caller).

**Warning codes (exact)**

- `DURATION_EXTEND_OPENAI_ERROR` — OpenAI call failed.
- `DURATION_EXTEND_PARSE_ERROR` — JSON parse failed.
- `DURATION_EXTEND_VALIDATION_FAILED` — Validation of extended spec failed.
- `DURATION_EXTEND_FAILED` — Added by the **caller** when the extended spec was not accepted (either extend returned no spec, or the extended estimate was below 90% of target).

---

## E) Prompt assembly map (where, how, and whether duration appears)

**Where the prompts live**

- **System prompt:** Built by `buildV2SystemPrompt` in `supabase/functions/modify-evaluation-v2/index.ts` (approx. lines 2848–3077).
- **User prompt:** Built by `buildV2UserPrompt` in the same file (approx. lines 3080–3130).
- Both are called in the main handler (around 3728–3738): `systemPrompt = buildV2SystemPrompt(responseOptionsInclude, responseOptionCount, requestedVersions)` and `userPrompt = buildV2UserPrompt(groupContext || {}, modification, instrumentDesignRules, requestedVersions)`. **Neither function receives `targetDurationMinutes` or any duration parameter.**

**Major sections of the system prompt (paraphrase)**

- Role: “Eres un especialista en evaluación educativa…” — generate a structured JSON spec for a written evaluation.
- **Reglas críticas:** JSON only; no diagnostic inferences from narrative; written evidence only; use only provided competencies/criteria; version rules (A always, B/C conditional with versionedContent).
- **Versión B block (if requested):** Detailed instructions and example for `versionedContent.promptB` (simplified language, shorter sentences, structure, reduced cognitive load, examples).
- **Opciones de respuesta equivalentes:** If enabled, open items must include `equivalentResponseOptions` with at least N options.
- **Rúbrica por ítem:** Obligatory rubric for open types; minimum 4 levels; descriptors must mention action and content; no generic phrasing.
- **Estructura JSON requerida:** Schema including `meta.duration: { "minutes": <total> }`, `sections`, `versionVariants`, `aiReport` with `narrative` and `byVersion`.
- **Tipos de ítems:** List of item types and their required fields (options, correctAnswer, rubric, source, table, etc.).
- **Reporte narrativo (aiReport.narrative):** 8–15 lines, required content order (what was evaluated, why, how, design/adaptations, content coverage), rules (no student IDs, pedagogical tone).
- **Reporte por versión (aiReport.byVersion):** Mandatory per-version narrative when B/C are generated.
- Closing: respond only with valid JSON, no explanations.

**Major sections of the user prompt (paraphrase)**

- **Contexto del grupo:** Materia, grupo, contenidos, competencias, criterios de logro (all from `groupContext`).
- **Versiones solicitadas:** Which versions (A/B/C) to generate.
- **Reglas de diseño del instrumento:** Bullet list from `instrumentDesignRules` (or “(Sin reglas adicionales)”).
- **Requerimientos del docente:** Free text from `modification`.
- **Instrucciones:** Generate full JSON per schema; appropriate for secondary; include variety of item types; coherent total points; version-specific rules for B/C and rubrics.
- Closing: respond only with the JSON object.

**Where duration appears**

- **System prompt:** Duration appears **only** in the **JSON schema** section: `"duration": { "minutes": <total> }` inside `meta`. There is **no** instruction that `<total>` must equal a teacher-requested duration or any numeric target. No other mention of “duración” or “minutos” in the system prompt.
- **User prompt:** **No** mention of duration, minutes, or target time. The user prompt does not include `targetDurationMinutes` or any duration guidance.

So duration is present only as a schema field in the system prompt; the model is never told what value to put in `meta.duration.minutes` (e.g. “80”) or how to structure the evaluation to achieve a given duration. This confirms that the main generation step has no operational link between the teacher’s target duration and the generated spec length.

---

*End of follow-up investigation. No code changes were made.*
