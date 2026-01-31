# Change Report: Universal Evaluation Generation (EPIC)

**Date**: 2026-01-31  
**Branch**: `nuevas-contemplaciones`  
**Status**: In progress  
**Author**: AI Agent (Cursor)

---

## Impact Analysis (Step 1)

### Scope
- **Evaluation generation UI**: `src/pages/EvaluacionesGrupo.tsx`
- **Evaluation rendering UI**: `src/components/evaluaciones/*`, `src/pages/EvaluacionDetalle.tsx`
- **Contemplaciones catalog + enforcement**: `src/lib/contemplaciones/*`
- **Edge function**: `supabase/functions/modify-evaluation/index.ts`
- **Group context**: `src/services/groupContext/provider.ts` (must remain the only source)

### Contracts / Guardrails Touched
- **Edge function contracts** (`modify-evaluation`): must stay backward compatible with existing response shape used by UI.
- **Contemplaciones catalog IDs**: must remain stable; new ID must be additive.
- **Explicit save pattern**: evaluations saved with `is_saved = true` and `deleted_at IS NULL`.
- **Group context**: generation MUST use `getGroupContextForAI()` only.

### Existing 3-version Assumptions (Current)
- `EvaluacionesGrupo.tsx` builds **version 1/2/3** and uses `adaptationLevel` (`standard`, `moderate`, `high`).
- `modify-evaluation` prompt expects **3 versions** in “default generation” path.
- UI renderer shows **"Versión X"** badge and expects `evaluation.version`.
- Saved evaluations persist `evaluacion_generada.evaluaciones[]` array with multiple versions.

### Risks if Change Is Incorrect
- **Generation failure**: request payload mismatch → edge returns empty content or fails.
- **Rendering regressions**: missing fields in legacy evaluations → UI crash or blank content.
- **Data integrity**: saved evaluations could become non-renderable if structure changes without fallback.
- **Compliance**: inadvertently reading student context from `mockData` or `localStorage` outside provider.

### Backward Compatibility Strategy (Summary)
- **Read-time**: Legacy evaluations render via existing `evaluaciones[]` array.
- **Write-time**: New metadata stored in existing JSON fields with safe fallback.
- **UI fallback**: If new metadata missing, render `evaluaciones[].content` as plain HTML.

---

## Deterministic Rules (Draft - to be finalized)

### Contemplaciones Mapping Buckets
- `INSTRUMENT_DESIGN`
- `ADMIN_REMINDER`
- `CORRECTION_REMINDER`
- `CONTENT_ADAPTATION_EXCEPTION`

### Version Decision (Draft)
- **A** always generated
- **B** only if high-structure trigger + design complexity guard
- **C** only if `hasDeclaredContentAdaptation === true`

---

## Commit Log (to be updated)

- _Pending_

---

## Files Changed (to be updated)

- _Pending_

---

## Verification Steps (to be updated)

1. Generate with no contemplaciones → Version A only
2. Generate with structuring needs → options appear
3. Generate with memotecnia (#27) → thinking anchors appear (no answers)
4. Teacher reminders per student
5. Save + reopen works
6. Chat modify works (if supported)
7. Old saved evaluation renders

---

## Risks & Rollback (to be updated)

- _Pending_

---

## Branch Discipline

- Branch used: `nuevas-contemplaciones`
- Statement: no commits on `main`

