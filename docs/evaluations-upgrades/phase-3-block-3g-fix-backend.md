# Phase 3 Block 3g — Fix: Backend guarantee of per-version AI report (A/B/C)

**Branch:** `mejorar-evaluaciones`  
**Scope:** `supabase/functions/modify-evaluation-v2/index.ts` only. No frontend, persistence, rubric-per-question, or PDF changes.

---

## What was wrong

- The frontend uses `aiReport.byVersion[selectedVersion].narrative ?? aiReport.narrative`. When **byVersion.B** and **byVersion.C** were missing or empty in the response, the panel always fell back to the global **narrative**, so the report text stayed identical when switching A/B/C.
- Causes on the backend:
  1. The main OpenAI response often did not include `aiReport.byVersion` or only included `byVersion.A`.
  2. The secondary call that fills B/C was only run when `existingA.length >= 50`, so short A narratives skipped the call and B/C were never filled by the model.
  3. The normalizer only added B/C to the output when `bv.B`/`bv.C` had a non-empty narrative, so even when the handler had added fallback B/C, any strict check could still drop them.

---

## What changed

### 1) Deterministic fallbacks (constants)

- **FALLBACK_A_NARRATIVE**, **FALLBACK_B_NARRATIVE**, **FALLBACK_C_NARRATIVE** (B: simplified wording + scaffolding, same cognitive demand; C: exceptional adaptation, same objectives, more support).

### 2) Helper `ensureByVersionNarratives(aiReport, effectiveRequestedVersions, meta)`

- **Location:** `modify-evaluation-v2/index.ts` (before `normalizeAiReportForFrontend`).
- **Role:** Given an `aiReport` and `effectiveRequestedVersions` (and optional `meta`), it **always** returns an aiReport with:
  - **byVersion.A** non-empty: from `aiReport.byVersion.A.narrative` or `aiReport.narrative` or `FALLBACK_A_NARRATIVE`.
  - **byVersion.B** non-empty when `effectiveRequestedVersions.B`: from existing B narrative or `FALLBACK_B_NARRATIVE`.
  - **byVersion.C** non-empty when `effectiveRequestedVersions.C`: from existing C narrative or `FALLBACK_C_NARRATIVE`.
  - **byVersion.B**/**.C** removed when not effective.
  - **narrative** (global fallback) set to `byVersion.A.narrative` when missing/empty.
- Preserves other fields (rationale, versions, etc.). Generic so it can run on the normalized `Record` for the safety pass before return.

### 3) Secondary call guard relaxed + merge rule

- **Before:** The secondary OpenAI call (`generateMissingByVersionNarrativesCall`) ran only when `(needsB || needsC)` **and** `existingA.length >= 50`.
- **After:** The call runs whenever (effective B or C) and (missing B/C narratives or missing byVersion). No minimum A length; if A is short/empty, pass `FALLBACK_A_NARRATIVE` as context. One call, fast model, 15s timeout. **Merge:** only fill B/C slots that are missing or empty; do not overwrite existing non-empty narratives.

### 4) Normalizer robustness

- **normalizeAiReportForFrontend** now:
  - Uses the shared **FALLBACK_A_NARRATIVE** for the global fallback and for missing A.
  - When **requestedVersions.B** is true but `bv.B` is missing or empty, sets `out.B = { narrative: FALLBACK_B_NARRATIVE }`.
  - When **requestedVersions.C** is true but `bv.C` is missing or empty, sets `out.C = { narrative: FALLBACK_C_NARRATIVE }`.
  - Always ensures **output.byVersion.A** exists.
- Output byVersion keys exactly match effective versions. Fallbacks in the normalizer are a safety net when B/C are effective but missing/empty.

### 5) Response shape

- **evaluationSpec** continues to be stripped of `aiReport` before building the response (no `evaluationSpec.aiReport` in the payload).
- **Root `response.aiReport`** is the only canonical report; it always includes **byVersion** with at least A, and B/C when `effectiveRequestedVersions.B`/`.C` are true. Never include B/C when not effective.

### 6) Handler ordering (strict)

1. Build `baseAiReport` from spec/global narrative.  
2. If effective B/C and missing narratives → run secondary call once; merge into `baseAiReport.byVersion` **without overwriting** existing non-empty narratives.  
3. `reportWithGuaranteedByVersion = ensureByVersionNarratives(baseAiReport, effectiveRequestedVersions, meta)`.  
4. `normalizedAiReport = normalizeAiReportForFrontend(...)`.  
5. **Safety:** `normalizedAiReport = ensureByVersionNarratives(normalizedAiReport, effectiveRequestedVersions, meta)` before return.  
6. Response: `aiReport: normalizedAiReport`; `evaluationSpec` has no `aiReport` key.

### 7) Debug logging

- One log line before return: effective versions, byVersion keys, lens (narrative lengths).  
- **Warn:** If effective B but `byVersion.B.narrative` missing/empty, or effective C but `byVersion.C.narrative` missing/empty, log a warning (should not happen after fixes).

---

## Why it fixes the issue

The frontend needs `aiReport.byVersion[selectedVersion].narrative` to be non-empty when that version is effective. The handler now guarantees it by: (1) running `ensureByVersionNarratives` after the secondary call, (2) having the normalizer always emit B/C when effective (with fallbacks), (3) running `ensureByVersionNarratives` again on the normalized output so nothing can drop B/C. The response always has non-empty byVersion.A and, when effective, non-empty byVersion.B/C, so the UI no longer falls back to the global narrative when switching to B/C.

---

## Backward compatibility

- Responses that already had valid `byVersion.A` (and optionally B/C) are unchanged in behavior; the helper and normalizer preserve existing non-empty narratives.
- Old clients that only read `aiReport.narrative` still receive it (set from `byVersion.A` when missing).
- When only A is effective, `byVersion` contains only A; no B/C keys are added.

---

## Manual test checklist

1. **Generate V2 with A+B+C effective**
   - Request a V2 evaluation with students assigned to B and C so the backend has `effectiveRequestedVersions.B` and `.C` true (and `versionVariants` includes B/C after validation).
   - **Check:** Response `aiReport.byVersion` has keys **A**, **B**, **C** and each has a non-empty `narrative`.
   - **Check:** Narratives for B and C are distinct from A (either from the model/secondary call or from the deterministic fallback strings).
   - In the UI, switch versions A → B → C: the report panel text must change (B/C show their own narrative, not only the global one).

2. **Generate V2 with A only**
   - Request V2 with no B/C assignment (or with no `versionedContent.promptB`/`promptC` so validation removes B/C).
   - **Check:** Response `aiReport.byVersion` has only key **A** (no B/C).
   - **Check:** Version selector shows only A (or switching to B/C is not possible). Report panel still shows the A narrative.

3. **Force secondary call failure**
   - Simulate or force the secondary OpenAI call to fail (e.g. timeout, invalid key, or mock that returns null).
   - **Check:** Response still includes `aiReport.byVersion.B` and `.C` with non-empty narratives when B/C are effective (deterministic fallbacks from **ensureByVersionNarratives**).
   - **Check:** Report panel still changes when switching to B/C (fallback text is shown).
