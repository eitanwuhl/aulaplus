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

**Bucket mapping (evaluación):**
- `diseño_cuadernillo` / `norma_formato` → `INSTRUMENT_DESIGN`
- `recordatorio_docente` → `ADMIN_REMINDER`
- `regla_correccion` → `CORRECTION_REMINDER`

### Version Decision (Draft)
- **A** always generated
- **B** only if high-structure trigger + design complexity guard
- **C** only if `hasDeclaredContentAdaptation === true`

**Version B trigger (deterministic):**
- Condición 1: ≥ 30% del grupo con ≥ 2 de:
  - `contemplacion-13` (Modelos/plantillas)
  - `contemplacion-23` (Respuestas estructuradas)
  - `contemplacion-5` (Segmentación en pasos)
  - `contemplacion-19` (Fragmentación + preguntas)
- Condición 2: `INSTRUMENT_DESIGN` distintos ≥ 6

**Response options (deterministic):**
- Incluir opciones si: necesidades de estructuración **o** (V+K ≥ 50%) **o** mayoría no-R **o** pedido explícito docente
- Cantidad: 2 por defecto; 3 si `INSTRUMENT_DESIGN` ≥ 6 o pedido explícito de 3

---

## Commit Log

- `aaf807b` docs: evaluation generation impact analysis — impact analysis + scope
- `4d6ae08` feat(contemplaciones): add memotecnia and deterministic mapping — #27 + mapping scaffolding
- `3086a8c` feat(evaluations): add deterministic evaluation design plan — plan + reminders scaffolding
- `d591301` feat(edge): support universal evaluation generation output — universal JSON bundle (backward compatible)
- `77a323e` feat(ui): render universal evaluation + teacher reminders with legacy fallback — UI fallback + panels
- `32287d2` refactor(evaluations): retire 3-version generation in new flow (keep legacy rendering) — single-call generation

---

## Files Changed (by area)

- **Docs**: `docs/changes/2026-01-31_universal_evaluation_generation.md`
- **Contemplaciones**: `src/lib/contemplaciones/catalog.ts`, `src/lib/contemplaciones/enforcement.ts`, `src/lib/contemplaciones/mapping.ts`
- **Docs**: `docs/CONTEMPLACIONES_CATALOG.md`
- **Evaluations**: `src/services/evaluations/designPlan.ts`, `src/services/evaluations/index.ts`
- **Edge**: `supabase/functions/modify-evaluation/index.ts`
- **SSoT**: `docs/ARCHITECTURE_SSoT.md`
- **UI**: `src/pages/EvaluacionesGrupo.tsx`, `src/pages/EvaluacionDetalle.tsx`, `src/components/evaluaciones/*`

---

## Verification Steps (to be updated)

1. Generate with no contemplaciones → Version A only
2. Generate with structuring needs → options appear
3. Generate with memotecnia (#27) → thinking anchors appear (no answers)
4. Teacher reminders per student
5. Save + reopen works
6. Chat modify works (if supported)
7. Old saved evaluation renders

**Tooling status (Steps 1-6):**
- `npm run lint` fails due to pre-existing errors in the repo (no new lint errors introduced in these steps).
- Manual smoke test: pendiente (no se inició servidor local).

---

## Risks & Rollback (to be updated)

- **Risk**: Lint baseline is failing, which may block strict gating.
- **Rollback**: `git revert aaf807b` (docs-only).
- **Rollback**: `git revert 4d6ae08` (contemplaciones + mapping).
- **Rollback**: `git revert 3086a8c` (design plan determinista).
- **Rollback**: `git revert d591301` (edge universal bundle).
- **Rollback**: `git revert 77a323e` (UI fallback + panels).
- **Rollback**: `git revert 32287d2` (flujo universal).

---

## Branch Discipline

- Branch used: `nuevas-contemplaciones`
- Statement: no commits on `main`

