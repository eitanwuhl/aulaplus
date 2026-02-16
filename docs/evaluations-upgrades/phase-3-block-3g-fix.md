# Phase 3 Block 3g — Fix summary: V2 per-version AI report + deploy fingerprint

**Branch:** `mejorar-evaluaciones`

---

## Summary

1. **Deploy fingerprint and debug fields** were added so we can prove which code is running: `DEBUG_BUILD = 'v2-byVersion-DEPLOY-FINGERPRINT-2026-02-16-01'`, `[BUILD_FINGERPRINT]` log, and `debug.specHasAiReportAfterStrip`, `debug.aiReportByVersionKeys`, `debug.aiReportByVersionLens`.
2. **evaluationSpec** is stripped of `aiReport` before the response; **root.aiReport** is the only canonical report.
3. **Backend guarantee** (already in repo): `ensureByVersionNarratives` + normalizer + safety pass ensure `root.aiReport.byVersion` has at least A and B/C when effective, with deterministic fallbacks.
4. **Deploy and verify** using the checklist in `phase-3-block-3g-deploy-verification.md`. Only if **after a verified deploy** the UI still shows the same narrative for all versions, apply any additional minimal fix (e.g. re-check normalizer/helper).

---

## Files changed

| File | Changes |
|------|---------|
| `supabase/functions/modify-evaluation-v2/index.ts` | `DEBUG_BUILD` fingerprint; strip evaluationSpec.aiReport; `specHasAiReportAfterStrip`, `aiReportByVersionKeys`, `aiReportByVersionLens` in debug; `[BUILD_FINGERPRINT]` log; timeout comment 55s→90s; V2Response.debug extended with optional fields. |
| `src/components/evaluaciones/v2/V2InfoPanels.tsx` | Removed TEMP `[V2_AI_REPORT_UI]` log. |
| `docs/evaluations-upgrades/phase-3-block-3g-deploy-verification.md` | New: deploy commands and verification checklist. |
| `docs/evaluations-upgrades/phase-3-block-3g-fix.md` | This file. |

---

## Manual test checklist

1. **Deploy**
   - From repo root: `supabase link` (if needed), then `supabase functions deploy modify-evaluation-v2`.
   - Confirm success and correct project. (Deploy may fail with "Cannot find project ref" until the project is linked.)

2. **One V2 generation**
   - In app: group with V2 beta, generate evaluation (A+B or A+B+C if possible).
   - Open DevTools → Network; select `modify-evaluation-v2` response.

3. **Verify response**
   - `debug.build === 'v2-byVersion-DEPLOY-FINGERPRINT-2026-02-16-01'`.
   - `debug.timeoutUsedMs === 90000` (or first-attempt value).
   - `debug.specHasAiReportAfterStrip === false`; `evaluationSpec` has no `aiReport` key.
   - `debug.aiReportByVersionKeys` includes at least `['A']`, and B/C when effective.
   - Supabase logs: one `[BUILD_FINGERPRINT]` line with that string.

4. **UI**
   - When only A is effective: version selector only A; report shows A narrative.
   - When A+B (or A+B+C) effective: switch A → B (→ C); report text must change (B/C narratives distinct from A).

5. **If UI still does not change after verified deploy**
   - Check `response.aiReport.byVersion` in Network: if keys and narratives are correct, the issue is frontend (e.g. wrong object or caching). If byVersion is missing or empty, implement or tighten the minimal backend guarantee (ensureByVersionNarratives + normalizer) as in `phase-3-block-3g-fix-backend.md`.
