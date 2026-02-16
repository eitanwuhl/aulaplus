# Phase 3 Block 3g — Deploy verification (modify-evaluation-v2)

**Branch:** `mejorar-evaluaciones`

---

## Purpose

Confirm that the **deployed** Edge Function `modify-evaluation-v2` is the same code as in this branch. If runtime behaviour (e.g. `timeoutUsedMs: 55000`, `evaluationSpec.aiReport` present, no `root.aiReport.byVersion`) does not match the repo, use this doc to diagnose.

---

## Fingerprint in code

- **Constant:** `DEBUG_BUILD = 'v2-byVersion-DEPLOY-FINGERPRINT-2026-02-16-01'` (near top of `modify-evaluation-v2/index.ts`).
- **Response:** `response.debug.build` is set to `DEBUG_BUILD`.
- **Log:** Right before returning success, `console.log('[BUILD_FINGERPRINT]', DEBUG_BUILD, 'requestId=', requestId)`.

---

## Commands to run (from repo root)

```bash
# If not already linked, link your Supabase project first
supabase link

# Deploy the function (ensure correct project)
supabase functions deploy modify-evaluation-v2
```

**Note:** If you see `Cannot find project ref. Have you run supabase link?`, run `supabase link` and select/link the project the app uses, then run the deploy again.

After deploy, trigger **one** V2 evaluation in the app (group with V2 beta, generate evaluation).

---

## Verification checklist (Network response + Supabase logs)

After one V2 generation, confirm **all** of the following:

| # | Check | Expected | Your result |
|---|--------|----------|-------------|
| A | `response.debug.build` | `'v2-byVersion-DEPLOY-FINGERPRINT-2026-02-16-01'` | _ |
| B | `response.debug.timeoutUsedMs` | `90000` (or value used for attempt 1, e.g. min(90000, remainingBudget)) | _ |
| C | `response.debug.specHasAiReportAfterStrip` | `false` | _ |
| C2 | `response.evaluationSpec` has **no** `aiReport` key | No key | _ |
| D | `response.debug.aiReportByVersionKeys` | At least `['A']`; when B/C effective, includes `'B'`/`'C'` | _ |
| E | Supabase Edge Function logs | One line `[BUILD_FINGERPRINT] v2-byVersion-DEPLOY-FINGERPRINT-2026-02-16-01 requestId= ...` | _ |

If **any** of these are not true:

1. **Correct project:** `supabase link` and deploy again; confirm the app’s Supabase URL matches the linked project.
2. **Correct function name:** The app must call `modify-evaluation-v2` (same as deployed).
3. **Environment:** Confirm you are not hitting another environment (e.g. staging vs prod) or another region.
4. **Cache:** Hard refresh / clear cache; trigger a **new** generation (not a cached response).

---

## If deployment is not taking effect

Document here:

- **Commands run:** (paste output of `supabase functions deploy modify-evaluation-v2`)
- **Project ref / URL:** (e.g. from `supabase status` or dashboard)
- **What was wrong:** (e.g. wrong project, old deploy, app pointing to different URL)
- **Fix applied:** (e.g. re-linked project, redeployed, updated app env)

---

## Timeout reference (repo)

- `OPENAI_TIMEOUT_GENERATE_MS = 90000` (first attempt).
- `OPENAI_TIMEOUT_RETRY_MS = 24000` (retry).
- `debug.timeoutUsedMs` is the **actual** timeout used for the attempt (e.g. `effectiveTimeout = Math.min(currentTimeout, remainingBudget - 2000)`). So on first attempt it should be 90000 or less if remaining budget was smaller.

If you still see `55000`, the running code is not from this repo (e.g. old deploy or different codebase).
