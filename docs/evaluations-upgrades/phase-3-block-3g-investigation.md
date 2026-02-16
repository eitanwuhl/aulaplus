# Phase 3 Block 3g — Investigation: V2 AI report does not change when switching A/B/C

**Branch:** `mejorar-evaluaciones`  
**Scope:** Investigation only. TEMP logs added; remove them in the fix PR.

---

## A) Network evidence

### How to capture

1. Deploy the edge function with the TEMP log (or run locally), trigger a V2 generation with A+B or A+B+C.
2. In DevTools → Network, select the `modify-evaluation-v2` request and copy the **Response** JSON (redact any tokens/secrets if sharing).

### Placeholder: one actual response JSON (paste after verification)

```json
{
  "success": true,
  "evaluationSpec": { "...": "redacted - paste real response here" },
  "requestedVersions": { "A": true, "B": false, "C": false },
  "aiReport": { "...": "redacted" },
  "warnings": [],
  "debug": { "build": "...", "timeoutUsedMs": 55000 }
}
```

### Explicit checklist (fill after capturing one response)

| Check | Expected | Your result |
|-------|----------|-------------|
| Does **root.aiReport** exist? | Yes | _ |
| Does **root.aiReport.byVersion** exist? | Yes (with at least A; B/C when effective) | _ |
| If yes, what keys does **root.aiReport.byVersion** have? | A always; B, C only when effective | _ |
| Does **evaluationSpec.aiReport** exist? | **No** (must be stripped) | _ |

**User-reported evidence:** root.aiReport exists but has **no byVersion**; evaluationSpec.aiReport **is still present**; debug.timeoutUsedMs is **55000**.

---

## B) Deployment verification

### How to confirm deployed code matches repo

1. **Build/version in response:** In repo, `DEBUG_BUILD = 'mejorar-evaluaciones-aiReport-narrative-guaranteed-1'` (modify-evaluation-v2, line ~27). After deploy, trigger a V2 request and inspect `response.debug.build`. If it still shows an older string (e.g. from a previous release), the new code is not deployed.
2. **Supabase deploy output:** Run `supabase functions deploy modify-evaluation-v2` and confirm success. The deployed bundle is what runs in production; local changes are not live until deployed.
3. **Function logs:** In Supabase Dashboard → Edge Functions → modify-evaluation-v2 → Logs, check for `[AI_REPORT_SHAPE]` and `[AI_REPORT]` after a request. If those logs do not appear, the code path that runs is either an older deployment or a different branch (e.g. emergency template path).

### Timeout constant: 55s vs 90s

- **In repo (current):** `OPENAI_TIMEOUT_GENERATE_MS = 90000` (line 21). First attempt uses `firstAttemptTimeout = OPENAI_TIMEOUT_GENERATE_MS` (line 1925). So **90s** is the intended first-attempt timeout.
- **Stale comment:** Line 1898 still says “55s” in a comment; the actual constant used is 90s. If the **response** shows `debug.timeoutUsedMs: 55000`, that indicates the **deployed** function was built from code where the first-attempt timeout was 55000 (or a different code path sets it). So:
  - **Conclusion:** `timeoutUsedMs: 55000` strongly suggests the **deployed** edge function does **not** match the current repo (e.g. last deploy was before the 90s change, or a different project/branch was deployed).

---

## C) Code-path tracing

### Where aiReport is constructed, normalized, and attached to the response

| Step | File:line | What happens |
|------|-----------|--------------|
| 1. Base report | `modify-evaluation-v2/index.ts` ~2533–2547 | `baseAiReport` created (designRationale, versionsExplanation, contemplacionesApplied, responseOptions). No byVersion yet. |
| 2. Narrative from spec | ~2603–2667 | `narrativeText` from `result.spec.aiReport?.narrative` or local/OpenAI fallback. Set on `baseAiReport.narrative`. |
| 3. byVersion from spec or global | ~2710–2723 | `baseAiReport.byVersion` = from `result.spec.aiReport?.byVersion` or `{ A: { narrative: narrativeForA } }`. A ensured non-empty. |
| 4. Secondary call | ~2724–2744 | If effective B/C and missing B/C narratives, `generateMissingByVersionNarrativesCall()`; merge into `baseAiReport.byVersion` without overwriting non-empty. |
| 5. Guarantee byVersion | ~2746–2747 | `reportWithGuaranteedByVersion = ensureByVersionNarratives(baseAiReport, effectiveRequestedVersions, meta)`. |
| 6. Normalize | ~2749–2754 | `normalizedAiReport = normalizeAiReportForFrontend(reportWithGuaranteedByVersion, result.spec, effectiveRequestedVersions)`. |
| 7. Safety pass | ~2756–2757 | `normalizedAiReport = ensureByVersionNarratives(normalizedAiReport, effectiveRequestedVersions, meta)`. |
| 8. Attach to response | ~2814–2815 | `response = { ..., aiReport: normalizedAiReport }`. |

So in **current repo** code, `normalizedAiReport` is built with `byVersion` (normalizer sets `normalized.byVersion = out` with A and B/C when requested, lines 394–407), and the safety pass runs on that. So the **response** should have `root.aiReport.byVersion` with at least A.

### Where evaluationSpec is cloned and stripped

| Location | File:line | What happens |
|----------|-----------|--------------|
| Clone | `modify-evaluation-v2/index.ts` ~2790 | `const evaluationSpecForResponse = { ...result.spec } as Record<string, unknown>`. Shallow copy of parsed spec (which **includes** `aiReport` from the model). |
| Strip | ~2791–2793 | `if (Object.prototype.hasOwnProperty.call(evaluationSpecForResponse, 'aiReport')) { delete evaluationSpecForResponse.aiReport; }` |
| Attach | ~2820 | `evaluationSpec: evaluationSpecForResponse as typeof result.spec`. |

So in **current repo**, the object sent as `evaluationSpec` is a clone of `result.spec` with `aiReport` removed. If the **network** response still has `evaluationSpec.aiReport`, then either (1) the **deployed** code does not have this strip (old deploy), or (2) some other layer re-attaches it (unlikely).

### Branches that could still attach aiReport to evaluationSpec

- **Success path (result.spec present):** Uses `evaluationSpecForResponse` (stripped). No other assignment to `evaluationSpec` in this block.
- **Emergency template path:** When all attempts fail, the handler builds `emergencySpec` and returns `evaluationSpec: emergencySpec` (~2864–2866). `buildEmergencyTemplateSpec` does not add `aiReport`; it builds a minimal spec. So no aiReport there.
- **Failure path:** Returns `evaluationSpec: null` (~2947). No spec.

**Grep: usage/assignment of evaluationSpec.aiReport in V2 flow**

```
# In modify-evaluation-v2 (backend)
1478:  if (spec.aiReport && typeof spec.aiReport === 'object') {   // validateAndCleanSpec: reads spec.aiReport (parsed model output)
2603:  if (result.spec.aiReport?.narrative ...                      // reads narrative from parsed spec
2710:  result.spec.aiReport?.byVersion                              // reads byVersion from parsed spec
2791:  delete evaluationSpecForResponse.aiReport                    // strips from clone before response

# In frontend (V2 flow)
# No reads of evaluationSpec.aiReport for the report panel. Panel uses v2Response.aiReport (root).
# (evaluationSpec is used for sections, versionVariants, meta, etc., not for the AI report narrative.)
```

So the **only** place that should **remove** aiReport from the object sent as evaluationSpec is the delete at 2791–2793. If the deployed code is old, that block may be missing or different.

---

## D) Frontend confirmation

### TEMP logs added (remove after fix)

1. **Backend** (`modify-evaluation-v2/index.ts`, right before building `response`):
   - `[AI_REPORT_SHAPE]` with `requestId`, `effectiveRequestedVersions`, `rootAiReportKeys`, `byVersionKeys`, `lens` (A/B/C narrative lengths), `specHasAiReport` (whether the clone still has `aiReport` after the delete).

2. **Frontend** (`V2InfoPanels.tsx`, just before rendering `V2AIReportPanel`):
   - `[V2_AI_REPORT_UI]` with `selectedVersion`, `byVersionKeys`, `narrativeLen`, `hasRootAiReport`, `hasSpecAiReport`.

### What to confirm

- **selectedVersion:** Changes when the user switches A/B/C (e.g. A → B → C).
- **byVersionKeys:** If the backend is correct, should be `['A']` or `['A','B']` or `['A','B','C']` depending on effective versions. If you see `[]`, root.aiReport has no byVersion.
- **narrativeLen:** Length of the narrative shown for the selected version.
- **hasRootAiReport:** Should be true when the panel is shown.
- **hasSpecAiReport:** Should be **false** if the backend strip is deployed; if **true**, evaluationSpec still has aiReport (deployment/code path issue).

So: the UI panel uses **root** `v2Response.aiReport` (passed as `aiReport` from V2InfoPanels). It does **not** read `evaluationSpec.aiReport` or persisted `ai_design_report` for the main narrative in the “just generated” flow.

---

## E) Conclusion: root causes (evidence-based)

### Root cause 1: Deployed edge function does not match current repo

**Evidence:**

- User sees `debug.timeoutUsedMs: 55000`. Repo uses `OPENAI_TIMEOUT_GENERATE_MS = 90000` for the first attempt; the only 55s is in an outdated **comment** (line 1898).
- User sees `evaluationSpec.aiReport` still present. Repo **deletes** `evaluationSpecForResponse.aiReport` before setting `response.evaluationSpec` (lines 2790–2793).
- User sees **root.aiReport without byVersion**. Repo builds `normalizedAiReport` with `byVersion` (normalizer + `ensureByVersionNarratives` on base and on normalized), so the response should have `aiReport.byVersion` with at least A.

**Conclusion:** The behaviour described (no byVersion, evaluationSpec.aiReport present, 55s timeout) matches an **older** version of the function. The current repo code would (1) strip aiReport from evaluationSpec, (2) set 90s timeout for first attempt, (3) guarantee byVersion via ensureByVersionNarratives and normalizer. So the **minimal fix** from a code perspective is already in the repo; the critical step is to **deploy** the current `modify-evaluation-v2` and verify with the TEMP logs and one real response.

### Root cause 2 (if deployment is confirmed): Normalized payload still missing byVersion

If after a **confirmed** deploy (same `debug.build`, no evaluationSpec.aiReport, 90s timeout) the response still has **root.aiReport** but **no byVersion**, then the bug is in the handler path that builds `normalizedAiReport`:

- Possible causes: (1) `normalizeAiReportForFrontend` receives a `backendReport` that fails the generic `ensureByVersionNarratives` type (e.g. normalized object shape), or (2) an earlier step (e.g. validation or a branch) overwrites or drops byVersion before the safety pass. The TEMP log `[AI_REPORT_SHAPE]` will show `byVersionKeys` and `lens` **on the server** right before the response; if those are empty there, the issue is in the backend construction path; if they are correct on the server but missing in the client, the issue is transport or client-side overwrite.

---

## Summary table

| Item | Repo (current) | If you see otherwise |
|------|----------------|----------------------|
| root.aiReport.byVersion | Present (A; B/C when effective) | Deployed code likely old |
| evaluationSpec.aiReport | Stripped (deleted from clone) | Deployed code likely old |
| debug.timeoutUsedMs (first attempt) | 90000 | 55000 = old deploy |
| UI report source | root aiReport only | N/A |

---

## Next steps (no fix in this doc)

1. Deploy: `supabase functions deploy modify-evaluation-v2`.
2. Trigger one V2 request and capture the full response JSON (redact tokens).
3. Check `[AI_REPORT_SHAPE]` and `[V2_AI_REPORT_UI]` in Edge Function logs and browser console.
4. Paste the response (or the relevant parts) into section A and fill the checklist.
5. If after deploy root.aiReport still has no byVersion, use the TEMP log `byVersionKeys`/`lens` to see whether the server is sending it; then fix the construction path or remove TEMP logs and apply the minimal fix as needed.
